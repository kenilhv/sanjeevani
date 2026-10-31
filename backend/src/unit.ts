import { Actor, Persisted, type ActorSocket } from "terse-sdk/actor"
import { defaultClock, fromStory, nextAlarmMs, simTimeNow, splitDue, storyNow, toStory, type Clock, type DueItem } from "./clock.js"
import { roomLabel, type FrontendEvent, type RelayMessage, type RoomStatus } from "./contracts.js"
import { post } from "./outbox.js"
import { PATIENT_SEEDS } from "./seed.js"

// Unit Actor: one per floor. Actor ID is the floor ("floor-4west"), i.e. contracts.md `unit:floor-4west`.
// Rules only, no AI: assignments, handoff checklist, overload and look-alike checks, the demo clock,
// and the live event stream to the 3D floor.

export interface ChecklistRow {
    sectionReady: boolean
    flagsAcked: boolean
    readbackOk: boolean
    accepted: boolean
}

export interface RoomView {
    status: RoomStatus
    owner: string | null
    label?: string
    podId: string
}

export interface UnitState {
    simTime: string
    speed: number
    clock: Clock
    assignments: Record<string, string | null>
    checklist: Record<string, ChecklistRow>
    roomStatus: Record<string, RoomView>
    notices: string[]
}

const emptyRow = (): ChecklistRow => ({ sectionReady: false, flagsAcked: false, readbackOk: false, accepted: false })

export class Unit extends Actor<{ role: string }, { type: "ping" }, FrontendEvent> {
    @Persisted seeded = false
    @Persisted clock: Clock = defaultClock()
    @Persisted assignments: Record<string, string | null> = {}
    @Persisted checklist: Record<string, ChecklistRow> = {}
    @Persisted roomStatus: Record<string, RoomView> = {}
    @Persisted noticeKeys: string[] = []
    @Persisted notices: string[] = []
    @Persisted dues: DueItem[] = []

    #ensureSeeded(): void {
        if (this.seeded) return
        this.assignments = { "pod-a": "maya", "pod-b": "sam" }
        const rooms = Object.values(PATIENT_SEEDS)
        this.checklist = Object.fromEntries(rooms.filter(p => p.podId === "pod-a").map(p => [p.room, emptyRow()]))
        this.roomStatus = Object.fromEntries(rooms.map(p => [p.room, { status: "stable" as RoomStatus, owner: this.assignments[p.podId] ?? null, podId: p.podId }]))
        this.noticeKeys = []
        this.notices = []
        this.dues = [{ id: "handoff_deadline", type: "handoff_deadline", at: toStory("07:30") }]
        this.seeded = true
        this.#reschedule()
    }

    #reschedule(): void {
        const at = nextAlarmMs(this.clock, this.dues)
        if (at === null) this.alarm.delete()
        else this.alarm.set(Math.max(at, Date.now()))
    }

    #clockEvent(): FrontendEvent {
        return { kind: "clock", simTime: simTimeNow(this.clock), speed: this.clock.speed }
    }

    #notice(key: string, text: string): RelayMessage | null {
        if (this.noticeKeys.includes(key)) return null
        this.noticeKeys = [...this.noticeKeys, key]
        this.notices = [...this.notices, text]
        return { type: "floor.notice", from: "unit-4west", to: "#4-west", text, simTime: simTimeNow(this.clock) }
    }

    // Overload (3+ high-risk patients in one pod) and look-alike names across pods.
    #floorRules(): RelayMessage[] {
        const out: RelayMessage[] = []
        const seeds = Object.values(PATIENT_SEEDS)
        const byPod = new Map<string, number>()
        for (const p of seeds) if (Object.values(p.riskScores).includes("high")) byPod.set(p.podId, (byPod.get(p.podId) ?? 0) + 1)
        for (const [podId, count] of byPod) {
            if (count >= 3) {
                const m = this.#notice(`overload-${podId}`, `${podId} has ${count} high-risk patients. Consider rebalancing assignments.`)
                if (m) out.push(m)
            }
        }
        for (const a of seeds) {
            for (const b of seeds) {
                if (a.room >= b.room || a.podId === b.podId) continue
                if (looksAlike(a.profile.name, b.profile.name)) {
                    const m = this.#notice(
                        `lookalike-${a.room}-${b.room}`,
                        `Look-alike names: ${a.profile.name} (${roomLabel(a.room)}, ${a.podId}) and ${b.profile.name} (${roomLabel(b.room)}, ${b.podId}). Double-check IDs.`
                    )
                    if (m) out.push(m)
                }
            }
        }
        return out
    }

    // When all 3 checks pass for a room, mark it accepted and hand it to the day nurse.
    #checkRoom(room: string): FrontendEvent[] {
        const row = this.checklist[room]
        if (!row || row.accepted || !(row.sectionReady && row.flagsAcked && row.readbackOk)) return []
        this.checklist = { ...this.checklist, [room]: { ...row, accepted: true } }
        const owner = this.assignments[this.roomStatus[room]?.podId ?? "pod-a"] ?? null
        this.roomStatus = { ...this.roomStatus, [room]: { ...this.roomStatus[room], status: "stable", owner, label: undefined } }
        return [
            { kind: "handoff.progress", room, state: "accepted" },
            { kind: "room.status", room, status: "stable", owner: owner ?? undefined }
        ]
    }

    // ---------- public methods (contracts.md section 2) ----------

    async setClock(input: { simTime?: string; speed?: number }): Promise<{ clock: Clock; notices: RelayMessage[] }> {
        this.#ensureSeeded()
        const story = input.simTime ? toStory(input.simTime) : storyNow(this.clock)
        this.clock = { anchorStory: story, anchorReal: Date.now(), speed: input.speed && input.speed > 0 ? input.speed : this.clock.speed }
        this.#reschedule()
        this.broadcast(this.#clockEvent())
        return { clock: this.clock, notices: this.#floorRules() }
    }

    async getClock(): Promise<{ clock: Clock; simTime: string; speed: number }> {
        this.#ensureSeeded()
        return { clock: this.clock, simTime: simTimeNow(this.clock), speed: this.clock.speed }
    }

    async assign(input: { podId: string; nurseId: string | null }): Promise<void> {
        this.#ensureSeeded()
        this.assignments = { ...this.assignments, [input.podId]: input.nurseId }
    }

    async markSection(input: { room: string }): Promise<FrontendEvent[]> {
        this.#ensureSeeded()
        const row = this.checklist[input.room]
        if (!row) return []
        this.checklist = { ...this.checklist, [input.room]: { ...row, sectionReady: true } }
        const events: FrontendEvent[] = [{ kind: "handoff.progress", room: input.room, state: "section_ready" }, ...this.#checkRoom(input.room)]
        for (const e of events) this.broadcast(e)
        return events
    }

    // A correct read-back means the new nurse heard every open flag, so it also counts as flags acknowledged.
    async markReadback(input: { room: string; ok: boolean }): Promise<FrontendEvent[]> {
        this.#ensureSeeded()
        const row = this.checklist[input.room]
        if (!row) return []
        this.checklist = { ...this.checklist, [input.room]: { ...row, readbackOk: input.ok, flagsAcked: input.ok || row.flagsAcked } }
        const events: FrontendEvent[] = [{ kind: "handoff.progress", room: input.room, state: input.ok ? "readback_ok" : "readback_missing" }, ...this.#checkRoom(input.room)]
        for (const e of events) this.broadcast(e)
        return events
    }

    // Records an event (filling in the room owner) and pushes it to connected WebSocket clients.
    async emit(input: { event: FrontendEvent }): Promise<FrontendEvent> {
        this.#ensureSeeded()
        let event = input.event
        if (event.kind === "room.status") {
            const view = this.roomStatus[event.room]
            const owner = event.owner ?? (view ? this.assignments[view.podId] ?? undefined : undefined)
            event = { ...event, owner }
            if (view) this.roomStatus = { ...this.roomStatus, [event.room]: { ...view, status: event.status, owner: owner ?? null, label: event.label } }
        } else if (event.kind === "nurse.change") {
            this.assignments = { ...this.assignments, [event.pod]: event.to }
        }
        this.broadcast(event)
        return event
    }

    async onAlarm(): Promise<void> {
        this.#ensureSeeded()
        const { due, later } = splitDue(this.clock, this.dues)
        this.dues = later
        const messages: RelayMessage[] = []
        for (const item of due) {
            if (item.type !== "handoff_deadline") continue
            const pending = Object.entries(this.checklist).filter(([, row]) => !row.accepted).map(([room]) => roomLabel(room))
            if (pending.length) {
                const m = this.#notice(`deadline-${fromStory(item.at)}`, `${fromStory(item.at)} handoff deadline: ${pending.join(", ")} not accepted yet.`)
                if (m) messages.push(m)
            }
        }
        this.#reschedule()
        await post({ messages })
    }

    async onConnect(socket: ActorSocket<{ role: string }, FrontendEvent>): Promise<void> {
        this.#ensureSeeded()
        socket.send(this.#clockEvent())
        for (const [room, view] of Object.entries(this.roomStatus)) {
            socket.send({ kind: "room.status", room, status: view.status, owner: view.owner ?? undefined, label: view.label })
        }
    }

    async resetDemo(clock: Clock): Promise<void> {
        this.seeded = false
        this.clock = clock
        this.#ensureSeeded()
    }

    async getState(): Promise<UnitState> {
        this.#ensureSeeded()
        return {
            simTime: simTimeNow(this.clock),
            speed: this.clock.speed,
            clock: this.clock,
            assignments: this.assignments,
            checklist: this.checklist,
            roomStatus: this.roomStatus,
            notices: this.notices
        }
    }
}

// "Grace Lee" vs "Grace Li": same first name and last names within 2 edits.
function looksAlike(a: string, b: string): boolean {
    const [af, ...al] = a.toLowerCase().split(" ")
    const [bf, ...bl] = b.toLowerCase().split(" ")
    return af === bf && editDistance(al.join(" "), bl.join(" ")) <= 2
}

function editDistance(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 1; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return dp[a.length][b.length]
}
