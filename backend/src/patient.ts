import { Actor, Persisted } from "terse-sdk/actor"
import { askJson, askText } from "./ai.js"
import { defaultClock, fromStory, nextAlarmMs, simTimeNow, splitDue, toStory, type Clock, type DueItem } from "./clock.js"
import { nurseAgentName, twinName, type FrontendEvent, type Level, type RelayMessage, type RoomStatus } from "./contracts.js"
import { post } from "./outbox.js"
import { PATIENT_SEEDS, type MedScheduleItem, type Profile, type RiskLevel, type Vital } from "./seed.js"

// Patient Actor + Patient Twin: one per room. Actor ID is the room ("room-4"), i.e. contracts.md `patient:room-4`.
// The Twin knows ONE patient deeply. It reminds, warns, drafts, and answers; humans decide.

export interface Note {
    id: string
    text: string
    status: "draft" | "confirmed"
    simTime: string
    by: string
    confirmedBy?: string
}

export interface Flag {
    id: string
    kind: string // fall_sedative, med_overdue, bp_trend, hypoglycemia, allergy, ai
    level: Level
    text: string
    simTime: string
    acked: boolean
    refs: string[]
    data?: Record<string, string>
}

export interface Task {
    id: string
    text: string
    dueSimTime?: string
    done: boolean
}

export interface PatientState {
    room: string
    podId: string
    profile: Profile
    allergies: string[]
    riskScores: Record<string, RiskLevel>
    medSchedule: MedScheduleItem[]
    vitals: Vital[]
    timeline: Note[]
    flags: Flag[]
    tasks: Task[]
    handoffSection: string | null
    dues: DueItem[]
    simTime: string
}

interface TwinDecision {
    logAs?: string
    alert?: { level: Level; text: string } | null
    setAlarm?: { type: string; atSimTime: string } | null
    resolvesFlags?: string[]
}

const TWIN_SYSTEM = `You are the Patient Twin for ONE hospital patient. You only know this patient.
Your job: protect your patient by keeping their story, catching risks, and passing on their requests.

You will get: the patient's full state (profile, allergies, risk scores, medicines, vitals, timeline, open flags) and ONE new event.

Rules:
- Never give, order, or change medicines. Never diagnose. You remind, warn, draft, and answer.
- Everything you log is an "AI draft" until a nurse confirms it.
- Check every new event against the full history. Warn if it creates a risk
  (e.g., a sedating medicine for a high fall-risk patient, a medicine conflicting with an allergy,
  a vital-sign trend getting worse over 3 checks, an overdue dose).
- If the event shows an open flag has been handled (e.g., "bed alarm on", "dose given"), list that flag id in resolvesFlags.
- Keep alert text under 20 words, plain English, with the key reason.
- Levels: urgent = could harm the patient soon; soon = needs attention this hour; fyi = information.
- Alert ONLY for a clear new safety risk: a sedating medicine with HIGH fall risk, a medicine that conflicts with an allergy,
  a vital sign worsening over 3 checks, or a scheduled dose that is overdue. Do not alert for routine care, expected effects,
  reminders, or anything already in openFlags. Routine notes and confirmations get alert: null.

Reply ONLY with JSON:
{ "logAs": string, "alert": null | { "level": "urgent"|"soon"|"fyi", "text": string },
  "setAlarm": null | { "type": string, "atSimTime": "HH:MM" }, "resolvesFlags": string[] }`

const SEDATIVES = ["zolpidem", "ambien", "lorazepam", "ativan", "diphenhydramine", "benadryl", "trazodone", "temazepam", "quetiapine"]
const LEVEL_RANK: Record<Level, number> = { urgent: 3, soon: 2, fyi: 1 }
const statusFor = (level: Level): RoomStatus | null => (level === "urgent" ? "urgent" : level === "soon" ? "warning" : null)

export class Patient extends Actor {
    @Persisted seeded = false
    @Persisted podId = ""
    @Persisted profile: Profile = { name: "", age: 0, reason: "", notes: [] }
    @Persisted allergies: string[] = []
    @Persisted riskScores: Record<string, RiskLevel> = {}
    @Persisted medSchedule: MedScheduleItem[] = []
    @Persisted vitals: Vital[] = []
    @Persisted timeline: Note[] = []
    @Persisted flags: Flag[] = []
    @Persisted tasks: Task[] = []
    @Persisted handoffSection: string | null = null
    @Persisted nextNum = 1
    @Persisted clock: Clock = defaultClock()
    @Persisted dues: DueItem[] = []

    // ---------- seeding, clock, alarms ----------

    // Seeds once from PATIENT_SEEDS; safe to call on every request (no duplicates after restart).
    #ensureSeeded(): void {
        if (this.seeded) return
        const seed = PATIENT_SEEDS[this.id]
        if (!seed) throw new Error(`Unknown room: ${this.id}`)
        this.podId = seed.podId
        this.profile = seed.profile
        this.allergies = seed.allergies
        this.riskScores = seed.riskScores
        this.medSchedule = seed.medSchedule
        this.vitals = seed.vitals
        this.timeline = []
        this.flags = []
        this.tasks = []
        this.handoffSection = null
        this.nextNum = 1
        // Planted alarms: scheduled doses get an overdue check 30 min later; everyone drafts a handoff at 06:45.
        const dues: DueItem[] = [{ id: "handoff_prep", type: "handoff_prep", at: toStory("06:45") }]
        for (const item of this.medSchedule) {
            for (const time of item.times) {
                if (this.id !== "room-4") continue // demo: only Room 4's 3am potassium is planted
                dues.push({ id: `med_check-${item.med}-${time}`, type: "med_check", at: toStory(time) + 30, data: { med: item.med, time } })
            }
        }
        this.dues = dues
        this.seeded = true
        this.#reschedule()
    }

    #newId(prefix: string): string {
        const id = `${this.id}-${prefix}-${this.nextNum}`
        this.nextNum = this.nextNum + 1
        return id
    }

    #now(): string {
        return simTimeNow(this.clock)
    }

    #reschedule(): void {
        const at = nextAlarmMs(this.clock, this.dues)
        if (at === null) this.alarm.delete()
        else this.alarm.set(Math.max(at, Date.now()))
    }

    async syncClock(clock: Clock): Promise<void> {
        this.#ensureSeeded()
        this.clock = clock
        this.#reschedule()
    }

    async onAlarm(): Promise<void> {
        this.#ensureSeeded()
        const { due, later } = splitDue(this.clock, this.dues)
        this.dues = later
        for (const item of due) await this.#handleDue(item)
        this.#reschedule()
    }

    async #handleDue(item: DueItem): Promise<void> {
        const simTime = fromStory(item.at)
        if (item.type === "med_check" && item.data) {
            const med = item.data.med
            const word = med.split(" ")[0].toLowerCase()
            const charted = this.timeline.some(n => n.text.toLowerCase().includes(word))
            if (!charted) {
                const hour = Number(item.data.time.split(":")[0])
                const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "am" : "pm"}`
                await this.#raise({ kind: "med_overdue", level: "urgent", text: `${label} ${word} not charted. Given?`, simTime, refs: [], data: { med: word } }, `${label} dose not charted`)
            }
        } else if (item.type === "pain_recheck" || item.type === "vitals_due" || item.type === "fall_rounds") {
            const text = item.data?.text || `${item.type.replace("_", " ")} due now.`
            await this.#raise({ kind: item.type, level: "soon", text, simTime, refs: [] }, text)
        } else if (item.type === "handoff_prep") {
            await this.#writeHandoff(simTime)
        }
    }

    // ---------- flags and outgoing messages ----------

    #msg(type: RelayMessage["type"], text: string, extra: Partial<RelayMessage> = {}): RelayMessage {
        return { type, from: twinName(this.id), to: nurseAgentName(this.podId), room: this.id, text, simTime: this.#now(), ...extra }
    }

    async #raise(flag: Omit<Flag, "id" | "acked">, label: string): Promise<Flag> {
        // FYI flags are information only, so they never hold a room amber.
        const full: Flag = { ...flag, id: this.#newId("flag"), acked: flag.level === "fyi" }
        this.flags = [...this.flags, full]
        const events: FrontendEvent[] = []
        const status = statusFor(full.level)
        if (status) events.push({ kind: "room.status", room: this.id, status, label })
        await post({ messages: [this.#msg("alert", full.text, { level: full.level, refs: [full.id, `kind:${full.kind}`, ...full.refs] })], events })
        return full
    }

    // Acks flags; when nothing is left open the room turns green (resolved).
    async #ack(flagIds: string[] | "all"): Promise<number> {
        const open = this.flags.filter(f => !f.acked && (flagIds === "all" || flagIds.includes(f.id)))
        if (open.length === 0) return 0
        const ids = new Set(open.map(f => f.id))
        this.flags = this.flags.map(f => (ids.has(f.id) ? { ...f, acked: true } : f))
        if (!this.flags.some(f => !f.acked)) {
            await post({
                messages: [this.#msg("note.ack", "All flags handled for this patient.", { refs: ["resolved"] })],
                events: [{ kind: "room.status", room: this.id, status: "resolved" }]
            })
        }
        return open.length
    }

    // ---------- rule checks (always run, so the planted moments never depend on the model) ----------

    #ruleAlert(text: string): Omit<Flag, "id" | "acked" | "simTime" | "refs"> | null {
        const lower = text.toLowerCase()
        const sedative = SEDATIVES.find(s => lower.includes(s))
        if (sedative && this.riskScores.fallRisk === "high") {
            return { kind: "fall_sedative", level: "soon", text: `Fall risk plus new sleeping pill (age ${this.profile.age}). Bed alarm on?` }
        }
        const allergy = this.allergies.find(a => lower.includes(a.toLowerCase()))
        if (allergy) return { kind: "allergy", level: "urgent", text: `Allergy alert: patient is allergic to ${allergy}.` }
        return null
    }

    #ruleResolves(text: string): string[] {
        const lower = text.toLowerCase()
        return this.flags
            .filter(f => !f.acked)
            .filter(f => {
                if (f.kind === "fall_sedative") return /bed alarm|alarm (is )?on|fall precautions/.test(lower)
                if (f.kind === "med_overdue") return lower.includes(f.data?.med ?? "~") && /given|gave|charted/.test(lower)
                if (f.kind === "patient_request") return /glucose|sugar|juice|checked on|saw (her|him|patient)|resolved/.test(lower)
                return false
            })
            .map(f => f.id)
    }

    #bpTrend(): string | null {
        const bp = this.vitals.filter(v => v.type === "bp_systolic").slice(-3)
        if (bp.length < 3) return null
        const [a, b, c] = bp.map(v => v.value)
        if (a > b && b > c && c < 105) return `Blood pressure dropped on 3 checks: ${a}, ${b}, ${c}.`
        return null
    }

    // ---------- Twin brain ----------

    #stateForModel(): string {
        return JSON.stringify({
            room: this.id,
            profile: this.profile,
            allergies: this.allergies,
            riskScores: this.riskScores,
            medSchedule: this.medSchedule,
            vitals: this.vitals,
            timeline: this.timeline,
            openFlags: this.flags.filter(f => !f.acked).map(f => ({ id: f.id, text: f.text })),
            simTime: this.#now()
        })
    }

    async #think(event: string): Promise<TwinDecision | null> {
        const decision = await askJson<TwinDecision>(TWIN_SYSTEM, `Patient state:\n${this.#stateForModel()}\n\nNew event:\n${event}`)
        if (!decision || typeof decision !== "object") return null
        return decision
    }

    // Combines the rule result with the model's, keeping whichever alert is more serious.
    async #react(event: string, ruleFlag: Omit<Flag, "id" | "acked" | "simTime" | "refs"> | null, refs: string[], resolveText?: string): Promise<void> {
        const decision = await this.#think(event)
        const simTime = this.#now()
        const ruleKinds = new Set(this.flags.filter(f => !f.acked).map(f => f.kind))
        if (ruleFlag && !ruleKinds.has(ruleFlag.kind)) await this.#raise({ ...ruleFlag, simTime, refs }, ruleFlag.text)
        const resolves = new Set([...(resolveText ? this.#ruleResolves(resolveText) : []), ...(decision?.resolvesFlags ?? [])])
        if (resolves.size) await this.#ack([...resolves])
        else await this.#maybeAiAlert(ruleFlag, decision, simTime, refs)
        if (decision?.setAlarm?.atSimTime && /^\d{1,2}:\d{2}$/.test(decision.setAlarm.atSimTime)) {
            const type = decision.setAlarm.type || "pain_recheck"
            this.dues = [...this.dues, { id: this.#newId("due"), type, at: toStory(decision.setAlarm.atSimTime), data: { text: `${type.replace("_", " ")} due (set ${simTime}).` } }]
            this.#reschedule()
        }
    }

    // Rules win; the model may add at most one open "soon" alert, and never on a note that just resolved something.
    async #maybeAiAlert(ruleFlag: unknown, decision: TwinDecision | null, simTime: string, refs: string[]): Promise<void> {
        const alert = decision?.alert
        // The model must judge it urgent; softer model alerts were noise in testing.
        if (ruleFlag || !alert || alert.level !== "urgent") return
        if (this.flags.some(f => !f.acked && f.kind === "ai")) return
        const text = String(alert.text).slice(0, 160)
        await this.#raise({ kind: "ai", level: "soon", text, simTime, refs }, text.slice(0, 60))
    }

    async #handleNote(text: string, by: string, simTime: string): Promise<Note> {
        const note: Note = { id: this.#newId("note"), text, status: "draft", simTime, by }
        this.timeline = [...this.timeline, note]
        // Save first, ack right away, then run the (slower) risk check.
        await post({ messages: [this.#msg("note.ack", `Logged as AI draft: "${text}"`, { refs: [note.id] })] })
        await this.#react(`Nurse ${by} note at ${simTime}: "${text}"`, this.#ruleAlert(text), [note.id], text)
        return note
    }

    // ---------- public methods (contracts.md section 2) ----------

    async addNote(input: { text: string; nurseId: string; simTime?: string }): Promise<Note> {
        this.#ensureSeeded()
        return this.#handleNote(input.text, input.nurseId, input.simTime || this.#now())
    }

    async confirmNote(input: { noteId: string; nurseId: string }): Promise<Note> {
        this.#ensureSeeded()
        const note = this.timeline.find(n => n.id === input.noteId)
        if (!note) throw new Error(`Note not found: ${input.noteId}`)
        const confirmed: Note = { ...note, status: "confirmed", confirmedBy: input.nurseId }
        this.timeline = this.timeline.map(n => (n.id === input.noteId ? confirmed : n))
        return confirmed
    }

    async addVital(input: { type: string; value: number; simTime?: string }): Promise<Vital> {
        this.#ensureSeeded()
        const vital: Vital = { type: input.type, value: input.value, simTime: input.simTime || this.#now() }
        this.vitals = [...this.vitals, vital]
        const trend = this.#bpTrend()
        const ruleFlag = trend ? { kind: "bp_trend", level: "urgent" as Level, text: trend } : null
        await this.#react(`New vital at ${vital.simTime}: ${vital.type} = ${vital.value}`, ruleFlag, [])
        return vital
    }

    async patientRequest(input: { text: string; simTime?: string }): Promise<{ forwarded: string }> {
        this.#ensureSeeded()
        const simTime = input.simTime || this.#now()
        const note: Note = { id: this.#newId("note"), text: `Patient said: "${input.text}"`, status: "draft", simTime, by: "patient" }
        this.timeline = [...this.timeline, note]
        const lower = input.text.toLowerCase()
        const diabetic = this.riskScores.hypoglycemiaRisk === "high" || /diabet/i.test(this.profile.reason)
        let context = ""
        let level: Level = "soon"
        if (diabetic && /shaky|dizzy|sweaty|faint|weak|confused/.test(lower)) {
            context = "Diabetic. Check glucose."
            level = "urgent"
        } else {
            const ai = await askText(
                "You are a Patient Twin. In under 15 words, add the clinical context a nurse needs for this bedside request. No diagnosis.",
                `Patient state:\n${this.#stateForModel()}\n\nPatient said: "${input.text}"`,
                1000
            )
            context = ai ?? ""
        }
        const text = `Patient says '${input.text}'. ${context}`.trim()
        const label = context ? `Patient: "${input.text}"` : "Bedside request"
        this.flags = [...this.flags, { id: this.#newId("flag"), kind: "patient_request", level, text, simTime, acked: false, refs: [note.id] }]
        const status = statusFor(level)
        await post({
            messages: [this.#msg("patient.request", text, { level, refs: [note.id] })],
            events: status ? [{ kind: "room.status", room: this.id, status, label }] : []
        })
        return { forwarded: text }
    }

    async ask(input: { question: string; askedBy: string }): Promise<{ answer: string }> {
        this.#ensureSeeded()
        const answer = await askText(
            "You are the Patient Twin for one patient. Answer the nurse's question about this patient only, from the state given. Under 30 words, plain English. If the record doesn't say, say so.",
            `Patient state:\n${this.#stateForModel()}\n\nQuestion from ${input.askedBy}: ${input.question}`,
            1500
        )
        const fallback = this.timeline.length
            ? `Latest: ${this.timeline.slice(-2).map(n => `${n.simTime} ${n.text}`).join("; ")}`
            : "No notes recorded for this patient tonight."
        return { answer: answer ?? fallback }
    }

    async readback(input: { text: string; nurseId: string }): Promise<{ ok: boolean; missing: string[] }> {
        this.#ensureSeeded()
        // Checks only the open safety flags; to-dos from the handoff section are not required.
        const open = this.flags.filter(f => !f.acked && f.level !== "fyi")
        const result =
            open.length === 0
                ? { ok: true, missing: [] }
                : await askJson<{ ok: boolean; missing: string[] }>(
                      `You are the Patient Twin checking a new nurse's read-back of your patient.
Mark ok=true if the read-back mentions the core issue of every open safety flag listed (any wording, short phrasing is fine).
Do NOT require to-dos, history, or details beyond the open flags. If ok=false, list only the open flags that were not mentioned.
Reply ONLY with JSON: { "ok": boolean, "missing": string[] }`,
                      `Patient: ${this.profile.name}, ${this.profile.age}, ${this.profile.reason}\nOpen safety flags:\n${open.map(f => `- ${f.text}`).join("\n")}\n\nRead-back from ${input.nurseId}: "${input.text}"`,
                      1500
                  )
        const ok = result ? Boolean(result.ok) : true
        const missing = result && Array.isArray(result.missing) ? result.missing.map(String) : []
        if (ok) {
            await this.#ack("all")
            await post({ messages: [this.#msg("readback.ok", "✅ Read-back correct.")] })
        } else {
            await post({ messages: [this.#msg("readback.missing", `Read-back missing: ${missing.join("; ")}`)] })
        }
        return { ok, missing }
    }

    async #writeHandoff(simTime: string): Promise<void> {
        const section = await askText(
            `You are the Patient Twin writing your patient's section of the 7am nurse handoff (I-PASS style).
Cover: how sick (stable/watch/unstable), one-line summary, overnight events, to-do, watch for. Under 50 words, plain text, no markdown.`,
            `Patient state:\n${this.#stateForModel()}`,
            2000
        )
        const fallback = [
            `${this.profile.name}, ${this.profile.age}, ${this.profile.reason}.`,
            this.timeline.length ? `Overnight: ${this.timeline.map(n => n.text).join("; ")}.` : "Quiet night.",
            this.flags.length ? `Flags: ${this.flags.map(f => `${f.text}${f.acked ? " (handled)" : " (OPEN)"}`).join("; ")}.` : ""
        ].join(" ")
        this.handoffSection = section ?? fallback
        await post({ messages: [this.#msg("handoff.section", this.handoffSection, { simTime })] })
    }

    // Lets the gateway deliver Relay messages to this Twin.
    async onRelay(msg: RelayMessage): Promise<void> {
        this.#ensureSeeded()
        if (msg.type === "note.new") await this.#handleNote(msg.text, msg.nurseId ?? msg.from, msg.simTime || this.#now())
    }

    async resetDemo(clock: Clock): Promise<void> {
        this.seeded = false
        this.clock = clock
        this.#ensureSeeded()
    }

    async getState(): Promise<PatientState> {
        this.#ensureSeeded()
        return {
            room: this.id,
            podId: this.podId,
            profile: this.profile,
            allergies: this.allergies,
            riskScores: this.riskScores,
            medSchedule: this.medSchedule,
            vitals: this.vitals,
            timeline: this.timeline,
            flags: this.flags,
            tasks: this.tasks,
            handoffSection: this.handoffSection,
            dues: this.dues,
            simTime: this.#now()
        }
    }
}
