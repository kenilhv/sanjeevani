// End-to-end check of the whole demo night through this service, using typed input.
// Run against a server started with BACKEND=mock:  npm start  (in one terminal), then  npm run smoke
// Exits non-zero if any planted moment doesn't produce its contract events.

const BASE = process.env.BASE ?? "http://localhost:8787"
const events: any[] = []

const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/events")
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = () => reject(new Error(`Cannot reach ${BASE}/events. Is the server running?`))
})
ws.onmessage = (m) => events.push(JSON.parse(String(m.data)))

async function post(path: string, body: unknown = {}) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path} → ${res.status} ${json.error}`)
  return json
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let failures = 0

function expect(label: string, match: (e: any) => boolean) {
  const ok = events.some(match)
  if (!ok) failures++
  console.log(`${ok ? "✅" : "❌"} ${label}`)
}

await post("/director/reset")
await post("/director/start-night")
expect("Maya signs in to Pod A", (e) => e.kind === "nurse.change" && e.pod === "pod-a" && e.to === "maya")
expect("Sam signs in to Pod B", (e) => e.kind === "nurse.change" && e.pod === "pod-b" && e.to === "sam")

await post("/director/jump-2330")
const note = await post("/voice/nurse", { podId: "pod-a", nurseId: "maya", text: "Room 6, gave zolpidem for sleep." })
expect("23:30 transcript event", (e) => e.kind === "transcript" && e.who === "maya" && /zolpidem/.test(e.text))
expect("Nurse Agent routes note to Room 6 Twin", (e) => e.kind === "agent.message" && e.type === "note.new" && e.to === "twin-room-6")
expect("Room 6 Twin pushes back (urgent alert)", (e) => e.kind === "agent.message" && e.type === "alert" && e.from === "twin-room-6" && e.level === "urgent")
expect("Room 6 turns amber", (e) => e.kind === "room.status" && e.room === "room-6" && e.status === "warning")
console.log(`   note simTime = ${note.simTime}`)
await post("/voice/nurse", { podId: "pod-a", nurseId: "maya", text: "Room 6, bed alarm is on." })
expect("Room 6 resolved after bed alarm", (e) => e.kind === "room.status" && e.room === "room-6" && e.status === "resolved")

await post("/voice/bedside", { room: "room-8", text: "I feel shaky." })
expect("Room 8 bedside request with diabetic context", (e) => e.kind === "agent.message" && e.type === "patient.request" && /diabetic/.test(e.text))

await post("/director/ff-0330")
for (let i = 0; i < 8 && !events.some((e) => e.kind === "room.status" && e.room === "room-4" && e.status === "urgent"); i++) await wait(500)
expect("Clock fast-forwards past 03:00", (e) => e.kind === "clock" && e.simTime > "03:00" && e.simTime < "04:00")
expect("Room 4 alarm fires on its own (urgent)", (e) => e.kind === "room.status" && e.room === "room-4" && e.status === "urgent")
await post("/voice/nurse", { podId: "pod-a", nurseId: "maya", text: "Room 4, given at 3, forgot to chart." })
expect("Room 4 resolved", (e) => e.kind === "room.status" && e.room === "room-4" && e.status === "resolved")

await post("/director/jump-0400")
expect("Room 2 BP trend alert", (e) => e.kind === "agent.message" && e.from === "twin-room-2" && e.type === "alert")
expect("Pod A asks Pod B for help", (e) => e.kind === "agent.message" && e.type === "help.request" && e.to === "nurse-pod-b")
expect("Pod B answers", (e) => e.kind === "agent.message" && e.type === "help.response" && e.to === "nurse-pod-a")

const handoff = await post("/director/handoff")
expect("Twins send handoff sections at 06:45", (e) => e.kind === "agent.message" && e.type === "handoff.section")
expect("Nurse change Maya → Jordan", (e) => e.kind === "nurse.change" && e.from === "maya" && e.to === "jordan")
expect("Spoken briefing event", (e) => e.kind === "speech" && e.who === "nurse-pod-a" && /Good morning Jordan/.test(e.text))
console.log(`   briefing audioUrl = ${handoff.audioUrl ?? "(none: no OpenAI key)"}`)

const ask = await post("/voice/ask", { podId: "pod-a", nurseId: "jordan", text: "Did Room 4's pain improve?" })
expect("Question routed to Room 4 Twin", (e) => e.kind === "agent.message" && e.type === "question" && e.to === "twin-room-4")
expect("Twin answers", (e) => e.kind === "agent.message" && e.type === "answer" && e.from === "twin-room-4")
console.log(`   answer = "${ask.answer}"`)

const rb = await post("/voice/readback", { podId: "pod-a", nurseId: "jordan", room: "room-4", text: "Room 4: 3am potassium given late, confirmed." })
expect("Read-back confirmed", (e) => e.kind === "agent.message" && e.type === "readback.ok" && e.from === "twin-room-4")
expect("Room 4 handoff accepted", (e) => e.kind === "handoff.progress" && e.room === "room-4" && e.state === "accepted")
expect("Room 4 owned by Jordan (gold)", (e) => e.kind === "room.status" && e.room === "room-4" && e.owner === "jordan")
console.log(`   readback ok = ${rb.ok}`)

const ingest = await post("/events/ingest", { kind: "system", text: "ingest test", id: "smoke-ingest-1" })
const echo = await post("/events/ingest", { kind: "system", text: "ingest test", id: "smoke-ingest-1" })
const ingestOk = ingest.accepted === 1 && echo.accepted === 0
if (!ingestOk) failures++
console.log(`${ingestOk ? "✅" : "❌"} /events/ingest accepts once and drops the echo`)

const health = await fetch(BASE + "/health").then((r) => r.json())
console.log(`\nhealth: ${JSON.stringify(health)}`)
console.log(`${events.length} events seen; ${failures ? `${failures} FAILED` : "all passed"}`)
ws.close()
process.exit(failures ? 1 : 0)
