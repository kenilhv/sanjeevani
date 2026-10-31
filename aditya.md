# 🧠 Aditya: Durable Actors + Agent Relay + Agent Brains

**Your mission:** Build the backbone. Every patient, pod, and the floor is a Terse Durable Actor. The two AI agents (Patient Twin and Nurse Agent) live inside their actors and talk over Agent Relay. If your part works, the product works.

**Read first:** `contracts.md` (IDs, methods, message shapes) and `master.md` (sections 3–7).

---

## 0. First 15 minutes: answer these before writing code

1. **Install Terse:** run `bunx terse-cli@latest install` and finish the quickstart counter example. Confirm you can deploy and connect.
2. **Ask the Terse team:** Can an actor make outbound HTTP calls (to OpenAI and Agent Relay) from inside a method or alarm?
   - **Yes:** The agent brains run inside the actors. This is the cleanest option.
   - **No:** Run a small **agent worker** (Node/Bun) per agent type that subscribes to the actor's WebSocket, does the AI and Relay work, and writes results back to the actor. The design works either way.
3. **Ask how to demo a restart:** If running locally, can we kill and restart the actor runtime and see state return? If on Terse Cloud, we'll kill our agent worker and refresh the UI instead. **Tell Shresth the answer**, because he scripts the demo.
4. **Agent Relay:** Set up a workspace, register one test agent, and send one DM to another. Use the Relaycast TypeScript SDK (channels, DMs, threads, realtime events).

**Post the answers in the team chat.**

---

## 1. Build order (do them in this order)

### Step 1: Patient Actor, storage only (target: 30 min)
- State (persisted): `profile`, `allergies`, `riskScores` (for example `fallRisk: "high"`), `medSchedule`, `vitals[]`, `timeline[]` (each note has `id`, `text`, `status: draft|confirmed`, `simTime`, `by`), `flags[]`, `tasks[]`, `handoffSection`, `podId`.
- Methods: `addNote`, `confirmNote`, `addVital`, `getState` (see `contracts.md`).
- Seed the 4 demo patients from `master.md` section 11.
- ✅ **Done when:** you can add a note to `patient:room-6`, restart, and the note is still there.

### Step 2: Unit Actor, rules + demo clock + emit (target: 30 min)
- State: `simTime`, `speed`, `assignments`, `checklist` (per room: `sectionReady`, `flagsAcked`, `readbackOk`, `accepted`), `roomStatus`.
- `setClock`, `assign`, `markReadback`, `emit`, `getState`.
- **Emit → WebSocket:** every event goes out in the shape from `contracts.md` section 4. **Kenil connects here.**
- Rules (plain code, no AI):
  - Checklist: when all 3 checks pass for a room, set `accepted` and emit `handoff.progress`.
  - Overload: 3 or more high-risk patients in one pod → `floor.notice`.
  - Look-alike names: compare patient names across pods → `floor.notice`.
  - Deadline: at 07:30 story time, any room not accepted → `floor.notice`.
- ✅ **Done when:** Kenil's frontend receives your `clock` and `room.status` events.

### Step 3: Relay wiring (target: 30 min)
- Register agents: `twin-room-2/4/6/8/3`, `nurse-pod-a`, `nurse-pod-b`, and channel `#4-west`.
- Every message uses the JSON shape in `contracts.md` section 3.
- **Mirror rule:** every Relay message you send also goes to `unit.emit` as an `agent.message` event (that's what powers Kenil's beams).
- ✅ **Done when:** `nurse-pod-a` sends `note.new` to `twin-room-6`, the Twin replies `note.ack`, and both show up as beams on Kenil's screen.

### Step 4: The Patient Twin brain (target: 45 min)
On every `note.new`, `patientRequest`, `addVital`, or alarm:
1. Load the patient state from the actor.
2. Call OpenAI with the Twin prompt (section 2) plus the patient state plus the new event.
3. The model returns JSON: `{ "logAs": "...", "alert": null | { "level", "text" }, "setAlarm": null | { "type", "atSimTime" } }`.
4. Save the note as a draft, send `note.ack`, send `alert` if any, set any alarm.

Also handle:
- `ask` → answer from the patient state.
- `readback` → compare with open flags and key points → `readback.ok` or `readback.missing`.
- `handoff_prep` alarm (06:45) → write `handoffSection` → send `handoff.section`.

### Step 5: The Nurse Agent brain, inside the Pod Actor (target: 45 min)
- State: `rooms[]`, `currentNurse`, `alertQueue[]` (ranked), `todo[]`, `contextNotes[]` (things not tied to one patient).
- `voiceNote(transcript)` → OpenAI splits it into per-room notes → `note.new` to each Twin.
- Incoming alerts → OpenAI ranks the queue across rooms → emit the top one as urgent; bundle the rest.
- `help.request` / `help.response` with `nurse-pod-b` (the 4am Room 2 moment).
- `shift_change` alarm (07:00) → collect `handoff.section` from every Twin → build the briefing.
- `signOut` / `signIn` → **keep all context**; only `currentNurse` changes.
- `brief(nurseId)` → returns the briefing text (Shresth turns it into speech).
- `ask(question)` → answer from context, or forward a `question` to the right Twin and return its `answer`.

### Step 6: Alarms on the demo clock (target: 20 min)
- Store all due times in **story time**.
- When `unit.setClock` changes `simTime` or `speed`, notify each actor. Each actor recalculates its next due item and **re-sets its real Terse alarm** (`realDelay = (storyDue - storyNow) / speed`).
- Planted alarms: `room-4` `med_due` at 03:00 (overdue check at 03:30); `room-6` `fall_rounds`; every Twin's `handoff_prep` at 06:45; `pod-a` `shift_change` at 07:00.
- ✅ **Done when:** Shresth hits "fast-forward to 03:30" and Room 4 flashes red on its own.

---

## 2. Agent prompts (starting drafts; tune as you test)

### Patient Twin system prompt
```
You are the Patient Twin for ONE hospital patient. You only know this patient.
Your job: protect your patient by keeping their story, catching risks, and passing on their requests.

You will get: the patient's full state (profile, allergies, risk scores, medicines, vitals, timeline) and ONE new event.

Rules:
- Never give, order, or change medicines. Never diagnose. You remind, warn, draft, and answer.
- Everything you log is an "AI draft" until a nurse confirms it.
- Check every new event against the full history. Warn if it creates a risk
  (e.g., a sedating medicine for a high fall-risk patient, a medicine conflicting with an allergy,
  a vital-sign trend getting worse over 3 checks, an overdue dose).
- Keep alert text under 20 words, plain English, with the key reason.
- Levels: urgent = could harm the patient soon; soon = needs attention this hour; fyi = information.

Reply ONLY with JSON:
{ "logAs": string, "alert": null | { "level": "urgent"|"soon"|"fyi", "text": string },
  "setAlarm": null | { "type": string, "atSimTime": "HH:MM" } }
```

### Nurse Agent system prompt
```
You are the Nurse Agent for a pod of hospital rooms. You serve whichever nurse is on shift.
You never clock out: you keep the whole pod's context across shifts.

Your jobs:
1. Split a nurse's voice note into one note per room. Reply as JSON: [{ "room": "room-6", "text": "..." }].
2. Rank incoming alerts across rooms by how dangerous they are. The most dangerous comes first.
3. At shift change, write a short spoken briefing for the new nurse: sickest patient first,
   then open flags, then what's due. Under 60 words. Warm, clear, no jargon.
4. Answer the nurse's questions. If a question is about one patient's details, ask that room's Twin.
5. If your nurse is busy with an urgent patient and another room needs a check, ask the other pod's Nurse Agent for help.

Rules: never make clinical decisions; never see rooms outside your pod.
```

**Model tip:** Use a fast OpenAI model so replies arrive within a couple of seconds. Live demo speed matters more than perfect wording.

---

## 3. What you hand to the others

| To | You give them |
|---|---|
| **Kenil** | The Unit Actor WebSocket URL, emitting the events from `contracts.md` section 4 |
| **Shresth** | A way to call `pod.voiceNote`, `pod.ask`, `pod.brief`, `pod.signIn/signOut`, `patient.patientRequest`, `unit.setClock`, and the Relay message stream (for the Supabase audit log) |

---

## 4. Checkpoints

| Time | You must have |
|---|---|
| **1:15pm** | Terse and Relay answers posted; Patient Actor storing notes and surviving a restart |
| **1:45pm** | **Loop 1:** a note goes to `twin-room-6`, its alert comes back over Relay, and the event reaches Kenil |
| **2:45pm** | Twin + Nurse Agent brains, alarms on the demo clock, the 7am briefing, read-back, checklist accepted |
| **3:15pm** | **Feature freeze.** Only bug fixes after this. |

---

## 5. If you fall behind, cut in this order
1. Pod B and the pod-to-pod help request (fake Pod B's reply with a fixed message)
2. Overload and look-alike rules
3. The Room 2 blood pressure trend

**Never cut:** the Room 6 Twin pushback, the Room 4 alarm, the 7am briefing with read-back, the restart moment.

---

## 6. Gotchas
- **Never let two actors call each other and wait.** Send a Relay message and move on; handle the reply when it arrives.
- **Keep AI calls out of the hot path where you can.** Save the note first, then run the risk check, so the UI updates instantly.
- **Validate the AI's JSON.** If parsing fails, log the note anyway and skip the alert, so the demo never crashes on a bad reply.
- **Seed data must load on restart without duplicating.** Check "already seeded" first.
