// Step 1 check: add a note to room-6, then (after a runtime restart) confirm it's still there.
// Usage: bun scripts/step1-test.ts add     -> adds a note
//        bun scripts/step1-test.ts check   -> prints room-6 state
import { actors } from "../generated/index.js"

const room6 = actors.Patient.get("room-6")
const mode = process.argv[2] ?? "check"

if (mode === "add") {
    const note = await room6.addNote({ text: "Gave zolpidem 5 mg for sleep.", nurseId: "maya", simTime: "23:30" })
    console.log("added:", note)
}

const state = await room6.getState()
console.log(`${state.profile.name}, ${state.profile.age} | fallRisk=${state.riskScores.fallRisk} | pod=${state.podId}`)
console.log(`timeline (${state.timeline.length}):`)
for (const n of state.timeline) console.log(`  ${n.id} [${n.status}] ${n.simTime} ${n.by}: ${n.text}`)
