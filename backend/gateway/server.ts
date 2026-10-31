// Sanjeevni gateway: the one HTTP + WebSocket front door for Shresth (voice/Director) and Kenil (3D floor).
//  - POST /outbox     actors hand off Relay messages + frontend events here (answers at once, delivers after)
//  - WS   /events     live frontend event stream (contracts.md section 4)
//  - POST /api/...    voiceNote, ask, brief, readback, bedside, clock, reset ... (see README)
// Delivery is per-recipient and in order, so one slow agent never blocks the others.
import { actors } from "../generated/index.js"
import type { Clock } from "../src/clock.js"
import { fromStory, storyNow, toStory } from "../src/clock.js"
import type { FrontendEvent, Outbox, RelayMessage } from "../src/contracts.js"
import { nurseAgentName, twinName } from "../src/contracts.js"
import { PATIENT_SEEDS } from "../src/seed.js"
import { mirrorToRelay, registerAgents, relayEnabled } from "./relay.js"

const PORT = Number(process.env.GATEWAY_PORT || 8787)
const FLOOR = "floor-4west"
const ROOMS = Object.keys(PATIENT_SEEDS)
const PODS = ["pod-a", "pod-b"]
const unit = () => actors.Unit.get(FLOOR)

// ---------- event fan-out ----------

const sockets = new Set<Bun.ServerWebSocket<unknown>>()
const recentMessages: (RelayMessage & { at: string })[] = [] // Relay log, for the Supabase audit_log copy

function broadcast(event: FrontendEvent) {
    const data = JSON.stringify(event)
    for (const ws of sockets) ws.send(data)
}

async function emit(event: FrontendEvent) {
    try {
        broadcast(await unit().emit({ event }))
    } catch (error) {
        console.error("[gateway] emit failed:", error)
        broadcast(event)
    }
}

// ---------- per-recipient delivery queues ----------

const chains = new Map<string, Promise<void>>()
function enqueue(key: string, job: () => Promise<void>) {
    const next = (chains.get(key) ?? Promise.resolve()).then(job).catch(error => console.error(`[gateway] ${key}:`, error))
    chains.set(key, next)
}

function deliver(msg: RelayMessage) {
    recentMessages.push({ ...msg, at: new Date().toISOString() })
    if (recentMessages.length > 500) recentMessages.shift()
    console.log(`[relay] ${msg.from} -> ${msg.to} ${msg.type}: ${msg.text}`)
    // Mirror rule: every Relay message is also a frontend agent.message (Kenil's beams).
    void emit({ kind: "agent.message", from: msg.from, to: msg.to, type: msg.type, level: msg.level, text: msg.text, room: msg.room, simTime: msg.simTime })
    if (relayEnabled()) void mirrorToRelay(msg)

    enqueue(msg.to, async () => {
        if (msg.to.startsWith("twin-")) await actors.Patient.get(msg.to.slice("twin-".length)).onRelay(msg)
        else if (msg.to.startsWith("nurse-")) await actors.Pod.get(msg.to.slice("nurse-".length)).onRelay(msg)
    })
    // Handoff checklist hooks (Unit Actor rules).
    if (msg.room && msg.type === "handoff.section") enqueue("unit", async () => { for (const e of await unit().markSection({ room: msg.room! })) broadcast(e) })
    if (msg.room && (msg.type === "readback.ok" || msg.type === "readback.missing"))
        enqueue("unit", async () => { for (const e of await unit().markReadback({ room: msg.room!, ok: msg.type === "readback.ok" })) broadcast(e) })
}

function handleOutbox(outbox: Outbox) {
    for (const event of outbox.events ?? []) enqueue("events", () => emit(event))
    for (const msg of outbox.messages ?? []) deliver(msg)
}

// ---------- demo clock ----------

let clockCache: Clock | null = null

async function syncAllClocks(clock: Clock) {
    clockCache = clock
    await Promise.all([
        ...ROOMS.map(r => actors.Patient.get(r).syncClock(clock)),
        ...PODS.map(p => actors.Pod.get(p).syncClock(clock))
    ])
}

async function setClock(simTime?: string, speed?: number) {
    const { clock, notices } = await unit().setClock({ simTime, speed })
    await syncAllClocks(clock)
    broadcast({ kind: "clock", simTime: fromStory(storyNow(clock)), speed: clock.speed })
    for (const m of notices) deliver(m)
    return clock
}

async function currentSimTime(): Promise<string> {
    if (!clockCache) clockCache = (await unit().getClock()).clock
    return fromStory(storyNow(clockCache))
}

// Clock ticks for the 3D floor, once per real second.
let lastTick = ""
setInterval(async () => {
    if (!clockCache || sockets.size === 0) return
    const simTime = fromStory(storyNow(clockCache))
    if (simTime !== lastTick) {
        lastTick = simTime
        broadcast({ kind: "clock", simTime, speed: clockCache.speed })
    }
}, 1000)

async function resetDemo() {
    const clock: Clock = { anchorStory: toStory("19:00"), anchorReal: Date.now(), speed: 1 }
    await unit().resetDemo(clock)
    await Promise.all([...ROOMS.map(r => actors.Patient.get(r).resetDemo(clock)), ...PODS.map(p => actors.Pod.get(p).resetDemo(clock))])
    clockCache = clock
    broadcast({ kind: "system", text: "Demo reset to 19:00." })
    broadcast({ kind: "clock", simTime: "19:00", speed: 1 })
    broadcast({ kind: "nurse.change", pod: "pod-a", from: null, to: "maya" })
    broadcast({ kind: "nurse.change", pod: "pod-b", from: null, to: "sam" })
    for (const room of ROOMS) broadcast({ kind: "room.status", room, status: "stable", owner: PATIENT_SEEDS[room].podId === "pod-a" ? "maya" : "sam" })
    const { notices } = await unit().setClock({})
    for (const m of notices) deliver(m)
}

async function snapshot(): Promise<FrontendEvent[]> {
    const state = await unit().getState()
    clockCache = state.clock
    return [
        { kind: "clock", simTime: state.simTime, speed: state.speed },
        ...Object.entries(state.assignments).filter(([, n]) => n).map(([pod, n]) => ({ kind: "nurse.change" as const, pod, from: null, to: n! })),
        ...Object.entries(state.roomStatus).map(([room, v]) => ({ kind: "room.status" as const, room, status: v.status, owner: v.owner ?? undefined, label: v.label }))
    ]
}

// ---------- HTTP API ----------

type Body = Record<string, any>
const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } })

const routes: Record<string, (b: Body) => Promise<unknown>> = {
    // Nurse voice note -> Nurse Agent splits and routes to Twins.
    "/api/voice-note": async b => {
        const podId = b.podId ?? "pod-a"
        const nurseId = b.nurseId ?? "maya"
        await emit({ kind: "transcript", who: nurseId, text: b.transcript })
        return actors.Pod.get(podId).voiceNote({ transcript: b.transcript, nurseId, simTime: b.simTime ?? (await currentSimTime()) })
    },
    // Day nurse question -> Nurse Agent, which may ask one Twin (question/answer over Relay).
    "/api/ask": async b => {
        const podId = b.podId ?? "pod-a"
        const nurseId = b.nurseId ?? "jordan"
        await emit({ kind: "transcript", who: nurseId, text: b.question })
        const result = await actors.Pod.get(podId).ask({ question: b.question, nurseId })
        let answer = result.answer ?? ""
        if (result.forwardTo) {
            const simTime = await currentSimTime()
            const room = result.forwardTo
            deliverRecordOnly({ type: "question", from: nurseAgentName(podId), to: twinName(room), room, text: `${cap(nurseId)} asks: ${b.question}`, simTime })
            answer = (await actors.Patient.get(room).ask({ question: b.question, askedBy: nurseId })).answer
            deliverRecordOnly({ type: "answer", from: twinName(room), to: nurseAgentName(podId), room, text: answer, simTime })
        }
        await emit({ kind: "speech", who: nurseAgentName(podId), text: answer })
        return { answer }
    },
    "/api/brief": async b => {
        const podId = b.podId ?? "pod-a"
        const { text } = await actors.Pod.get(podId).brief({ nurseId: b.nurseId ?? "jordan" })
        await emit({ kind: "speech", who: nurseAgentName(podId), text })
        return { text }
    },
    // New nurse's read-back for one room -> that room's Twin confirms or lists what's missing.
    "/api/readback": async b => {
        const podId = b.podId ?? "pod-a"
        const nurseId = b.nurseId ?? "jordan"
        const room = b.room
        deliverRecordOnly({ type: "readback", from: nurseAgentName(podId), to: twinName(room), room, text: `${cap(nurseId)}'s read-back: ${b.text}`, simTime: await currentSimTime() })
        return actors.Patient.get(room).readback({ text: b.text, nurseId })
    },
    "/api/sign-in": async b => actors.Pod.get(b.podId ?? "pod-a").signIn({ nurseId: b.nurseId }),
    "/api/sign-out": async b => actors.Pod.get(b.podId ?? "pod-a").signOut({ nurseId: b.nurseId }),
    "/api/bedside": async b => {
        await emit({ kind: "transcript", who: `patient-${b.room}`, text: b.text })
        return actors.Patient.get(b.room).patientRequest({ text: b.text, simTime: b.simTime })
    },
    "/api/note": async b => actors.Patient.get(b.room).addNote({ text: b.text, nurseId: b.nurseId ?? "maya", simTime: b.simTime }),
    "/api/confirm-note": async b => actors.Patient.get(b.room).confirmNote({ noteId: b.noteId, nurseId: b.nurseId ?? "maya" }),
    "/api/vital": async b => actors.Patient.get(b.room).addVital({ type: b.type, value: Number(b.value), simTime: b.simTime }),
    // Director panel: set time / fast-forward / speed.
    "/api/clock": async b => {
        const clock = await setClock(b.simTime, b.speed !== undefined ? Number(b.speed) : undefined)
        return { simTime: fromStory(storyNow(clock)), speed: clock.speed }
    },
    "/api/reset": async () => {
        await resetDemo()
        return { ok: true }
    },
    // Lets Shresth post the "Backend restarted" / TTS speech events with audio URLs.
    "/api/emit": async b => {
        await emit(b.event)
        return { ok: true }
    }
}

// question/answer/readback travel as Relay messages for the record and the beams;
// the gateway itself does the round trip so no actor waits on another.
function deliverRecordOnly(msg: RelayMessage) {
    recentMessages.push({ ...msg, at: new Date().toISOString() })
    console.log(`[relay] ${msg.from} -> ${msg.to} ${msg.type}: ${msg.text}`)
    void emit({ kind: "agent.message", from: msg.from, to: msg.to, type: msg.type, level: msg.level, text: msg.text, room: msg.room, simTime: msg.simTime })
    if (relayEnabled()) void mirrorToRelay(msg)
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

async function fullState() {
    const [unitState, pods, patients] = await Promise.all([
        unit().getState(),
        Promise.all(PODS.map(p => actors.Pod.get(p).getState())),
        Promise.all(ROOMS.map(r => actors.Patient.get(r).getState()))
    ])
    return { unit: unitState, pods, patients }
}

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    async fetch(req, server) {
        const url = new URL(req.url)
        if (url.pathname === "/events") {
            if (server.upgrade(req)) return undefined
            return new Response("WebSocket upgrade expected", { status: 400 })
        }
        if (req.method === "OPTIONS")
            return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST" } })
        try {
            if (req.method === "POST" && url.pathname === "/outbox") {
                handleOutbox((await req.json()) as Outbox)
                return json({ ok: true })
            }
            if (req.method === "GET" && url.pathname === "/api/state") return json(await fullState())
            if (req.method === "GET" && url.pathname === "/api/messages") return json(recentMessages)
            if (req.method === "GET" && url.pathname === "/health") return json({ ok: true, relay: relayEnabled() })
            const route = routes[url.pathname]
            if (req.method === "POST" && route) return json((await route((await req.json().catch(() => ({}))) as Body)) ?? { ok: true })
            return json({ error: "not found" }, 404)
        } catch (error) {
            console.error(`[gateway] ${url.pathname}:`, error)
            return json({ error: String(error) }, 500)
        }
    },
    websocket: {
        async open(ws) {
            sockets.add(ws)
            try {
                for (const e of await snapshot()) ws.send(JSON.stringify(e))
            } catch (error) {
                console.error("[gateway] snapshot failed:", error)
            }
        },
        message() {},
        close(ws) {
            sockets.delete(ws)
        }
    }
})

if (relayEnabled()) void registerAgents([...ROOMS.map(twinName), ...PODS.map(nurseAgentName)])

// On (re)start, push the stored clock back to every actor so alarms line up again.
unit()
    .getClock()
    .then(({ clock }) => syncAllClocks(clock))
    .then(() => console.log(`[gateway] actors synced; http://localhost:${PORT}  ws://localhost:${PORT}/events  relay=${relayEnabled()}`))
    .catch(error => console.error("[gateway] initial sync failed (is the actor runtime up?):", error))
