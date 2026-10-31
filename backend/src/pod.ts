import { Actor, Persisted } from "terse-sdk/actor"
import { askJson, askText } from "./ai.js"
import { defaultClock, nextAlarmMs, simTimeNow, splitDue, toStory, type Clock, type DueItem } from "./clock.js"
import { nurseAgentName, roomLabel, twinName, type Level, type RelayMessage } from "./contracts.js"
import { post } from "./outbox.js"
import { PATIENT_SEEDS } from "./seed.js"

// Pod Actor + Nurse Agent: one per group of rooms. Actor ID is the pod ("pod-a"), i.e. contracts.md `pod:pod-a`.
// Serves whichever nurse is on shift and never clocks out: signIn/signOut only changes currentNurse.

export interface QueuedAlert {
    id: string
    room: string
    level: Level
    text: string
    simTime: string
    type: string
}

export interface PodState {
    podId: string
    rooms: string[]
    currentNurse: string | null
    alertQueue: QueuedAlert[]
    todo: string[]
    contextNotes: string[]
    sections: Record<string, string>
    briefing: string | null
    helpLog: string[]
    simTime: string
}

const NURSE_SYSTEM = `You are the Nurse Agent for a pod of hospital rooms. You serve whichever nurse is on shift.
You never clock out: you keep the whole pod's context across shifts.
Rules: never make clinical decisions; never see rooms outside your pod.`

// Who's on which pod at the start of the night, and who takes over at 07:00.
const NIGHT_NURSE: Record<string, string> = { "pod-a": "maya", "pod-b": "sam" }
const DAY_NURSE: Record<string, string> = { "pod-a": "jordan" }
const OTHER_POD: Record<string, string> = { "pod-a": "pod-b", "pod-b": "pod-a" }
const LEVEL_RANK: Record<Level, number> = { urgent: 3, soon: 2, fyi: 1 }
const cap = (name: string | null) => (name ? name[0].toUpperCase() + name.slice(1) : "The nurse")

export class Pod extends Actor {
    @Persisted seeded = false
    @Persisted rooms: string[] = []
    @Persisted currentNurse: string | null = null
    @Persisted alertQueue: QueuedAlert[] = []
    @Persisted todo: string[] = []
    @Persisted contextNotes: string[] = []
    @Persisted sections: Record<string, string> = {}
    @Persisted briefing: string | null = null
    @Persisted briefingSections = 0
    @Persisted helpLog: string[] = []
    @Persisted nextNum = 1
    @Persisted clock: Clock = defaultClock()
    @Persisted dues: DueItem[] = []

    #ensureSeeded(): void {
        if (this.seeded) return
        this.rooms = Object.values(PATIENT_SEEDS).filter(p => p.podId === this.id).map(p => p.room)
        this.currentNurse = NIGHT_NURSE[this.id] ?? null
        this.alertQueue = []
        this.todo = []
        this.contextNotes = []
        this.sections = {}
        this.briefing = null
        this.briefingSections = 0
        this.helpLog = []
        this.nextNum = 1
        this.dues = DAY_NURSE[this.id] ? [{ id: "shift_change", type: "shift_change", at: toStory("07:00") }] : []
        this.seeded = true
        this.#reschedule()
    }

    #now(): string {
        return simTimeNow(this.clock)
    }

    #msg(type: RelayMessage["type"], to: string, text: string, extra: Partial<RelayMessage> = {}): RelayMessage {
        return { type, from: nurseAgentName(this.id), to, text, simTime: this.#now(), ...extra }
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
        for (const item of due) if (item.type === "shift_change") await this.#shiftChange()
        this.#reschedule()
    }

    // 07:00: the nurse changes, the agent doesn't. All context stays; only currentNurse moves.
    async #shiftChange(): Promise<void> {
        const next = DAY_NURSE[this.id]
        if (!next || this.currentNurse === next) return
        const prev = this.currentNurse
        this.currentNurse = next
        const text = await this.#buildBriefing(next)
        await post({
            events: [
                { kind: "nurse.change", pod: this.id, from: prev, to: next },
                { kind: "speech", who: nurseAgentName(this.id), text }
            ]
        })
    }

    async #buildBriefing(nurseId: string): Promise<string> {
        const sectionCount = Object.keys(this.sections).length
        if (this.briefing && this.briefingSections === sectionCount) return this.briefing
        const ranked = this.#ranked()
        const input = JSON.stringify({
            newNurse: nurseId,
            rooms: this.rooms,
            handoffSections: this.sections,
            openAlerts: ranked.map(a => `${roomLabel(a.room)} (${a.level}): ${a.text}`),
            podNotes: this.contextNotes
        })
        const ai = await askText(
            `${NURSE_SYSTEM}
At shift change, write a short spoken briefing for the new nurse: greet them by name, sickest patient first,
then open flags, then what's due. Under 60 words. Warm, clear, no jargon, no markdown. Say "Room 2", not "room-2".`,
            input,
            2000
        )
        const fallback =
            `Good morning ${cap(nurseId)}. ` +
            (ranked.length
                ? ranked.slice(0, 3).map(a => `${roomLabel(a.room)}: ${a.text}`).join(" ")
                : Object.entries(this.sections).map(([room, s]) => `${roomLabel(room)}: ${s}`).join(" ") || "Quiet night across the pod.")
        this.briefing = ai ?? fallback
        this.briefingSections = sectionCount
        return this.briefing
    }

    // Rule ranking: most dangerous first (urgent > soon > fyi), then oldest first.
    #ranked(): QueuedAlert[] {
        return [...this.alertQueue].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.id.localeCompare(b.id))
    }

    // ---------- public methods (contracts.md section 2) ----------

    async voiceNote(input: { transcript: string; nurseId: string; simTime?: string }): Promise<{ routed: { room: string; text: string }[] }> {
        this.#ensureSeeded()
        const simTime = input.simTime || this.#now()
        let parts = await askJson<{ room: string; text: string }[]>(
            `${NURSE_SYSTEM}
Split the nurse's voice note into one note per room. Rooms in your pod: ${this.rooms.join(", ")}.
Rewrite each part as a clean, short clinical note (keep drug names, doses, numbers). Drop the room number from the text.
Anything not about one room goes under room "pod".
Reply ONLY as JSON: [{ "room": "room-6", "text": "..." }]`,
            input.transcript,
            1500
        )
        if (!Array.isArray(parts) || parts.length === 0) parts = splitByRoom(input.transcript)
        const routed = parts.filter(p => p && this.rooms.includes(p.room) && p.text)
        const podNotes = parts.filter(p => p && !this.rooms.includes(p.room) && p.text).map(p => `${simTime} ${p.text}`)
        if (podNotes.length) this.contextNotes = [...this.contextNotes, ...podNotes]
        await post({
            messages: routed.map(p => this.#msg("note.new", twinName(p.room), p.text, { room: p.room, simTime, nurseId: input.nurseId }))
        })
        return { routed }
    }

    // Incoming Relay messages from Twins and the other pod's Nurse Agent.
    async onRelay(msg: RelayMessage): Promise<void> {
        this.#ensureSeeded()
        if ((msg.type === "alert" || msg.type === "patient.request") && msg.room) {
            const alert: QueuedAlert = {
                id: `${String(this.nextNum).padStart(4, "0")}`,
                room: msg.room,
                level: msg.level ?? "soon",
                text: msg.text,
                simTime: msg.simTime,
                type: msg.type
            }
            this.nextNum = this.nextNum + 1
            const otherUrgent = this.alertQueue.find(a => a.level === "urgent" && a.room !== msg.room)
            this.alertQueue = [...this.alertQueue, alert]
            // Nurse is tied up with another urgent room: ask the other pod's Nurse Agent to cover.
            const other = OTHER_POD[this.id]
            // Charting questions go to the nurse who gave the dose, not to another pod.
            const charting = msg.refs?.includes("kind:med_overdue")
            if (alert.level === "urgent" && otherUrgent && other && !charting) {
                const text = `${cap(this.currentNurse)} is with ${roomLabel(otherUrgent.room)}. Can your nurse check ${roomLabel(alert.room)}? ${alert.text}`
                this.helpLog = [...this.helpLog, `${msg.simTime} asked ${other} to cover ${alert.room}`]
                await post({ messages: [this.#msg("help.request", nurseAgentName(other), text, { room: alert.room })] })
            }
        } else if (msg.type === "help.request") {
            const reply = `Yes, ${cap(this.currentNurse)} is heading to ${msg.room ? roomLabel(msg.room) : "that room"}.`
            this.helpLog = [...this.helpLog, `${msg.simTime} covering ${msg.room} for ${msg.from}`]
            await post({ messages: [this.#msg("help.response", msg.from, reply, { room: msg.room })] })
        } else if (msg.type === "help.response") {
            this.helpLog = [...this.helpLog, `${msg.simTime} ${msg.text}`]
        } else if (msg.type === "handoff.section" && msg.room) {
            this.sections = { ...this.sections, [msg.room]: msg.text }
        } else if ((msg.type === "readback.ok" || (msg.type === "note.ack" && msg.refs?.includes("resolved"))) && msg.room) {
            this.alertQueue = this.alertQueue.filter(a => a.room !== msg.room)
        }
    }

    // Answers from pod context, or tells the caller which Twin to ask (the gateway does the Relay round trip,
    // so this actor never waits on another actor).
    async ask(input: { question: string; nurseId: string }): Promise<{ answer?: string; forwardTo?: string }> {
        this.#ensureSeeded()
        const match = input.question.match(/room\s*(\d+)/i)
        const room = match ? `room-${match[1]}` : null
        if (room && this.rooms.includes(room)) return { forwardTo: room }
        if (room) return { answer: `${roomLabel(room)} isn't in my pod, so I can't see that patient.` }
        const answer = await askText(
            `${NURSE_SYSTEM}\nAnswer the nurse's question from the pod context. Under 40 words, spoken style, no markdown.`,
            JSON.stringify({ question: input.question, nurse: input.nurseId, openAlerts: this.#ranked(), handoffSections: this.sections, podNotes: this.contextNotes, helpLog: this.helpLog }),
            1500
        )
        return { answer: answer ?? "I don't have that in the pod record yet." }
    }

    async signIn(input: { nurseId: string }): Promise<void> {
        this.#ensureSeeded()
        const prev = this.currentNurse
        this.currentNurse = input.nurseId
        await post({ events: [{ kind: "nurse.change", pod: this.id, from: prev, to: input.nurseId }] })
    }

    async signOut(input: { nurseId: string }): Promise<void> {
        this.#ensureSeeded()
        if (this.currentNurse === input.nurseId) this.currentNurse = null
    }

    async brief(input: { nurseId: string }): Promise<{ text: string }> {
        this.#ensureSeeded()
        return { text: await this.#buildBriefing(input.nurseId) }
    }

    async resetDemo(clock: Clock): Promise<void> {
        this.seeded = false
        this.clock = clock
        this.#ensureSeeded()
    }

    async getState(): Promise<PodState> {
        this.#ensureSeeded()
        return {
            podId: this.id,
            rooms: this.rooms,
            currentNurse: this.currentNurse,
            alertQueue: this.#ranked(),
            todo: this.todo,
            contextNotes: this.contextNotes,
            sections: this.sections,
            briefing: this.briefing,
            helpLog: this.helpLog,
            simTime: this.#now()
        }
    }
}

// Fallback router when the model is unavailable: "Room 4, pain 7 ... Room 6, gave zolpidem" -> per-room parts.
function splitByRoom(transcript: string): { room: string; text: string }[] {
    const pieces = transcript.split(/(?=\broom\s*\d+)/i).map(s => s.trim()).filter(Boolean)
    return pieces.map(piece => {
        const m = piece.match(/^room\s*(\d+)[,:.\s-]*/i)
        return m ? { room: `room-${m[1]}`, text: piece.slice(m[0].length).trim() } : { room: "pod", text: piece }
    })
}
