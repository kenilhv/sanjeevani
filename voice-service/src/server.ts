import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFile } from "node:fs/promises"
import { WebSocketServer, WebSocket } from "ws"
import { backend, call, emit } from "./actors/index.ts"
import { config, hasOpenAI, hasSupabase } from "./config.ts"
import { POD_ROOMS, PATIENTS, UNIT, isPod, isRoom, nurseAgent, patientActor, podActor, type FrontendEvent } from "./contracts.ts"
import { runDirector, signIn, signOut } from "./director.ts"
import { currentSimTime, lastClockEvent, publish, recentHistory, subscribe } from "./events.ts"
import { auditHistory, logAudit, saveVoiceClip } from "./supabase.ts"
import { AUDIO_DIR, HttpError, speak, transcribe } from "./voice.ts"
import { hasClaude } from "./brain.ts"
import { relayLive } from "./relay.ts"

const PUBLIC_DIR = new URL("../public/", import.meta.url)
const MAX_BODY = 15 * 1024 * 1024

// ---- Request helpers ----

type Input = { meta: Record<string, any>; audio?: Buffer; contentType: string }

async function readInput(req: IncomingMessage, url: URL): Promise<Input> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, "Body too large")
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks)
  const contentType = (req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase()
  const query = Object.fromEntries(url.searchParams)
  if (contentType === "application/json" || (!contentType && raw.length && raw[0] === 0x7b)) {
    try {
      return { meta: { ...query, ...JSON.parse(raw.toString("utf8") || "{}") }, contentType }
    } catch {
      throw new HttpError(400, "Invalid JSON body")
    }
  }
  if (contentType.startsWith("audio/") || contentType === "application/octet-stream" || contentType === "video/webm") {
    return { meta: query, audio: raw, contentType: contentType === "video/webm" ? "audio/webm" : contentType }
  }
  return { meta: query, contentType }
}

/** Push to talk: audio body is transcribed; typed fallback sends JSON { text }. */
async function heard(input: Input): Promise<string> {
  if (input.audio?.length) return transcribe(input.audio, input.contentType)
  const text = String(input.meta.text ?? input.meta.transcript ?? input.meta.question ?? "").trim()
  if (!text) throw new HttpError(400, "Send audio (Content-Type: audio/webm) or JSON { text }")
  return text
}

function need(value: unknown, name: string, check?: (v: unknown) => boolean): string {
  if (typeof value !== "string" || !value || (check && !check(value))) throw new HttpError(400, `Missing or unknown ${name}`)
  return value
}

async function simTimeFor(meta: Record<string, any>): Promise<string> {
  if (meta.simTime) return String(meta.simTime)
  if (backend.name === "built-in") return currentSimTime()
  try {
    return String((await call(UNIT, "getState", {}))?.simTime ?? currentSimTime())
  } catch {
    return currentSimTime()
  }
}

function answerText(result: unknown): string {
  if (typeof result === "string") return result
  const r = result as { answer?: string; text?: string } | undefined
  return r?.answer ?? r?.text ?? ""
}

// ---- Voice endpoints (contracts.md section 5) ----

async function voiceNurse(input: Input) {
  const podId = need(input.meta.podId, "podId", isPod)
  const nurseId = need(input.meta.nurseId, "nurseId")
  let transcript = await heard(input)
  // Talking at a bedside: if the nurse didn't say which room, it's the room they're standing in.
  const room = isRoom(input.meta.room) ? input.meta.room : null
  if (room && !/\broom\s*(\d+|two|three|four|six|eight)\b/i.test(transcript)) transcript = `${room.replace("room-", "Room ")}, ${transcript}`
  const simTime = await simTimeFor(input.meta)
  await emit({ kind: "transcript", who: nurseId, text: transcript })
  saveVoiceClip({ actorId: podActor(podId), who: nurseId, transcript, audio: input.audio, contentType: input.contentType })
  const result = await call(podActor(podId), "voiceNote", { transcript, nurseId, simTime })
  return { transcript, simTime, result }
}

async function voiceAsk(input: Input) {
  const podId = need(input.meta.podId, "podId", isPod)
  const nurseId = need(input.meta.nurseId, "nurseId")
  const question = await heard(input)
  await emit({ kind: "transcript", who: nurseId, text: question })
  saveVoiceClip({ actorId: podActor(podId), who: nurseId, transcript: question, audio: input.audio, contentType: input.contentType })
  const answer = answerText(await call(podActor(podId), "ask", { question, nurseId }))
  const audioUrl = await speak(answer, "agent").catch((err) => (console.error("[ask] TTS failed:", err.message), null))
  await emit({ kind: "speech", who: nurseAgent(podId), text: answer, audioUrl })
  return { question, answer, audioUrl }
}

async function voiceBedside(input: Input) {
  const room = need(input.meta.room, "room", isRoom)
  const text = await heard(input)
  const simTime = await simTimeFor(input.meta)
  await emit({ kind: "transcript", who: `bedside-${room}`, text })
  saveVoiceClip({ actorId: patientActor(room), who: `bedside-${room}`, transcript: text, audio: input.audio, contentType: input.contentType })
  const result = await call(patientActor(room), "patientRequest", { text, simTime })
  // Played on the bedside tablet only (returned, not broadcast), so the floor stays quiet.
  // The Twin's own words back to the patient (it decided whether the nurse is coming).
  const reply = typeof result?.reply === "string" && result.reply ? result.reply : "Your nurse has been told. Help is coming."
  const audioUrl = await speak(reply, "twin").catch(() => null)
  return { transcript: text, reply, audioUrl }
}

async function voiceReadback(input: Input) {
  const nurseId = need(input.meta.nurseId, "nurseId")
  const room = need(input.meta.room, "room", isRoom)
  const text = await heard(input)
  await emit({ kind: "transcript", who: nurseId, text })
  saveVoiceClip({ actorId: patientActor(room), who: nurseId, transcript: text, audio: input.audio, contentType: input.contentType })
  // The Twin judges the read-back; the Unit Actor checklist records the result.
  const result = await call(patientActor(room), "readback", { text, nurseId })
  const ok = typeof result === "string" ? result === "ok" : Boolean(result?.ok)
  await call(UNIT, "markReadback", { room, ok })
  return { transcript: text, ok, result }
}

async function tts(input: Input) {
  const text = need(input.meta.text, "text")
  const voice = input.meta.voice === "twin" ? "twin" : "agent"
  return { audioUrl: await speak(text, voice) }
}

// ---- Everything else ----

async function state() {
  const settle = (p: Promise<unknown>) => p.catch((err) => ({ error: (err as Error).message }))
  const rooms = Object.keys(PATIENTS)
  const [unit, ...rest] = await Promise.all([
    settle(call(UNIT, "getState", {})),
    ...Object.keys(POD_ROOMS).map((pod) => settle(call(podActor(pod), "getState", {}))),
    ...rooms.map((room) => settle(call(patientActor(room), "getState", {}))),
  ])
  const pods = Object.fromEntries(Object.keys(POD_ROOMS).map((pod, i) => [pod, rest[i]]))
  const patients = Object.fromEntries(rooms.map((room, i) => [room, rest[Object.keys(POD_ROOMS).length + i]]))
  return { unit, pods, patients }
}

function ingest(input: Input, req: IncomingMessage) {
  if (config.ingestToken && req.headers["x-ingest-token"] !== config.ingestToken) throw new HttpError(401, "Bad ingest token")
  const raw = input.meta.events ?? input.meta.event ?? input.meta
  const events = (Array.isArray(raw) ? raw : [raw]) as FrontendEvent[]
  let accepted = 0
  for (const event of events) {
    if (event && typeof event.kind === "string" && publish(event)) accepted++
  }
  return { accepted }
}

type Route = (input: Input, req: IncomingMessage, url: URL) => Promise<unknown> | unknown

const routes: Record<string, Route> = {
  "POST /voice/nurse": voiceNurse,
  "POST /voice/ask": voiceAsk,
  "POST /voice/bedside": voiceBedside,
  "POST /voice/readback": voiceReadback,
  "POST /tts": tts,
  "POST /auth/signin": (input) => signIn(need(input.meta.nurseId, "nurseId"), input.meta.password),
  "POST /auth/signout": (input) => signOut(need(input.meta.nurseId, "nurseId")),
  "POST /events/ingest": ingest,
  "GET /state": state,
  // Recent story for screens that load or reconnect mid-night. After this service restarts, memory is
  // empty, so the agent conversation comes back from the Supabase audit log.
  "GET /history": async (_input, _req, url) => {
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 80))
    const memory = recentHistory(limit)
    if (memory.length) return { source: "memory", events: memory }
    return { source: "supabase", events: (await auditHistory(limit)) ?? [] }
  },
  "GET /health": () => ({
    ok: true,
    backend: backend.name,
    // What the floor's status bar shows: each piece lights up only when it is really connected.
    actors: backend.name === "terse" ? "terse" : "built-in",
    relay: relayLive(),
    brain: hasClaude() ? "claude" : "rules",
    openai: hasOpenAI(),
    supabase: hasSupabase(),
    sttModel: config.sttModel,
    ttsModel: config.ttsModel,
    simTime: currentSimTime(),
  }),
}

// ---- Static files: the test console, the push-to-talk helper, generated audio ----

const STATIC: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/director": ["index.html", "text/html; charset=utf-8"],
  "/ptt.js": ["ptt.js", "text/javascript; charset=utf-8"],
}

async function serveStatic(path: string, res: ServerResponse) {
  const audio = path.match(/^\/audio\/([a-f0-9]{16}\.mp3)$/)
  const [file, type] = audio ? [audio[1]!, "audio/mpeg"] : (STATIC[path] ?? [])
  if (!file) return false
  try {
    const body = await readFile(new URL(file, audio ? AUDIO_DIR : PUBLIC_DIR))
    res.writeHead(200, { "Content-Type": type!, "Cache-Control": audio ? "public, max-age=86400" : "no-store" })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
  return true
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Ingest-Token")
  if (req.method === "OPTIONS") return void res.writeHead(204).end()

  const url = new URL(req.url ?? "/", "http://localhost")
  const started = Date.now()
  try {
    const director = url.pathname.match(/^\/director\/([a-z0-9-]+)$/)
    const route = req.method === "POST" && director ? (input: Input) => runDirector(director[1]!, input.meta) : routes[`${req.method} ${url.pathname}`]
    if (!route) {
      if (req.method === "GET" && (await serveStatic(url.pathname, res))) return
      return send(res, 404, { error: `No route ${req.method} ${url.pathname}` })
    }
    const result = await route(await readInput(req, url), req, url)
    send(res, 200, result ?? { ok: true })
    if (url.pathname !== "/health") console.log(`${req.method} ${url.pathname} 200 ${Date.now() - started}ms`)
  } catch (err) {
    const status = (err as HttpError).status ?? 500
    console.error(`${req.method} ${url.pathname} ${status} ${Date.now() - started}ms: ${(err as Error).message}`)
    send(res, status, { error: (err as Error).message })
  }
})

// ---- /events WebSocket: everything this service sees, same shapes as contracts.md section 4 ----

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url ?? "/", "http://localhost").pathname !== "/events") return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.send(JSON.stringify(lastClockEvent()))
    const unsubscribe = subscribe((event) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(event)))
    ws.on("close", unsubscribe)
  })
})

subscribe(logAudit)

server.listen(config.port, () => {
  console.log(`Sanjeevni voice service on ${config.publicUrl}`)
  console.log(`  backend=${backend.name}  openai=${hasOpenAI() ? "on" : "OFF (typed fallback only)"}  supabase=${hasSupabase() ? "on" : "off"}`)
  console.log(`  test console + director: ${config.publicUrl}/   events: ws://localhost:${config.port}/events`)
})
