// End-to-end run of the demo night through the gateway, printing every live frontend event.
// Usage: bun scripts/night-test.ts   (runtime + gateway must be running)
const GW = process.env.GATEWAY || "http://localhost:8787"

const ws = new WebSocket(GW.replace("http", "ws") + "/events")
ws.addEventListener("message", e => {
    const ev = JSON.parse(String(e.data))
    if (ev.kind === "clock") return
    const detail =
        ev.kind === "agent.message" ? `${ev.from} -> ${ev.to} [${ev.type}${ev.level ? "/" + ev.level : ""}] ${ev.text}`
        : ev.kind === "room.status" ? `${ev.room} = ${ev.status} (owner ${ev.owner ?? "-"}) ${ev.label ?? ""}`
        : JSON.stringify(ev)
    console.log(`  ⚡ ${ev.kind.padEnd(16)} ${detail}`)
})

const api = async (path: string, body: object = {}) => {
    const res = await fetch(GW + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    return res.json()
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const step = (s: string) => console.log(`\n=== ${s}`)

await new Promise(r => ws.addEventListener("open", r))
step("reset to 19:00"); await api("/api/reset"); await wait(1500)

step("22:00 voice note: Room 4 pain + Room 6 zolpidem")
await api("/api/clock", { simTime: "23:30" })
console.log(await api("/api/voice-note", { podId: "pod-a", nurseId: "maya", transcript: "Room 4, pain 7, gave oxycodone 5 milligrams. Room 6, gave zolpidem for sleep." }))
await wait(12000)

step("Maya: bed alarm on in Room 6")
await api("/api/voice-note", { podId: "pod-a", nurseId: "maya", transcript: "Room 6, bed alarm is on." })
await wait(8000)

step("02:00 bedside Room 8: I feel shaky")
await api("/api/clock", { simTime: "02:00" })
console.log(await api("/api/bedside", { room: "room-8", text: "I feel shaky" }))
await wait(4000)

step("03:30 fast-forward: Room 4 potassium alarm should fire on its own")
await api("/api/clock", { simTime: "03:30" })
await wait(5000)
step("Maya: given at 3, forgot to chart")
await api("/api/voice-note", { podId: "pod-a", nurseId: "maya", transcript: "Room 4, potassium given at 3, forgot to chart." })
await wait(8000)

step("04:00 Room 2 BP dropping (Room 8 still urgent -> pod-to-pod help)")
await api("/api/clock", { simTime: "04:00" })
await api("/api/vital", { room: "room-2", type: "bp_systolic", value: 112 })
await api("/api/vital", { room: "room-2", type: "bp_systolic", value: 98 })
await wait(10000)

step("Maya: Room 8 glucose checked, gave juice")
await api("/api/voice-note", { podId: "pod-a", nurseId: "maya", transcript: "Room 8, glucose 64, gave juice, rechecked 110." })
await wait(8000)

step("06:45 handoff prep, then 07:00 shift change")
await api("/api/clock", { simTime: "06:45" })
await wait(15000)
await api("/api/clock", { simTime: "07:00" })
await wait(15000)

step("Jordan asks about Room 4")
console.log(await api("/api/ask", { podId: "pod-a", nurseId: "jordan", question: "Did Room 4's pain improve?" }))

step("Jordan reads back every room")
const readbacks: Record<string, string> = {
    "room-2": "Daniel Okafor, pneumonia, blood pressure dropped on three checks to 98. I'll see him first.",
    "room-4": "Linda Park, knee replacement day 1. 3am potassium was given late but confirmed.",
    "room-6": "Walter Hughes, 81, high fall risk, got zolpidem last night, bed alarm is on.",
    "room-8": "Grace Lee, diabetic, felt shaky at 2am, glucose was low and treated with juice."
}
for (const [room, text] of Object.entries(readbacks)) console.log(room, await api("/api/readback", { podId: "pod-a", nurseId: "jordan", room, text }))
await wait(3000)

step("final state")
const s: any = await (await fetch(GW + "/api/state")).json()
console.log("checklist:", JSON.stringify(s.unit.checklist))
console.log("rooms:", Object.entries(s.unit.roomStatus).map(([r, v]: any) => `${r}=${v.status}/${v.owner}`).join(" "))
console.log("pod-a nurse:", s.pods[0].currentNurse, "| briefing:", s.pods[0].briefing)
ws.close()
process.exit(0)
