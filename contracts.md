# 🔗 Sanjeevni: Shared Contracts

**Everyone reads this first.** If all three of us follow these names and shapes, the pieces snap together at integration. If you need to change something here, tell the other two **before** you change it.

---

## 1. IDs (use these exact strings everywhere)

| Thing | ID |
|---|---|
| Floor | `floor-4west` |
| Pods | `pod-a`, `pod-b` |
| Rooms (Pod A) | `room-2`, `room-4`, `room-6`, `room-8` |
| Room (Pod B, look-alike example) | `room-3` |
| Nurses | `maya` (night, pod-a), `jordan` (day, pod-a), `sam` (night, pod-b) |

### Actor IDs (Terse)
| Actor | ID pattern | Examples |
|---|---|---|
| Patient Actor (has Twin) | `patient:<room>` | `patient:room-4` |
| Pod Actor (has Nurse Agent) | `pod:<pod>` | `pod:pod-a` |
| Unit Actor (rules only) | `unit:<floor>` | `unit:floor-4west` |

### Agent names (Agent Relay)
| Agent | Relay name |
|---|---|
| Patient Twins | `twin-room-2`, `twin-room-4`, `twin-room-6`, `twin-room-8`, `twin-room-3` |
| Nurse Agents | `nurse-pod-a`, `nurse-pod-b` |
| Floor channel | `#4-west` |

---

## 2. Actor methods (what each actor can be asked to do)

*These are the agreed names and inputs. Aditya picks the exact Terse syntax.*

### Patient Actor (`patient:<room>`)
| Method | Input | Does |
|---|---|---|
| `addNote` | `{ text, nurseId, simTime }` | Saves the note as an AI draft, runs the Twin's risk check, sets any follow-up alarm |
| `confirmNote` | `{ noteId, nurseId }` | Marks the note official |
| `addVital` | `{ type, value, simTime }` | Saves a vital; the Twin checks for trends |
| `patientRequest` | `{ text, simTime }` | From the bedside; the Twin adds context and alerts the Nurse Agent |
| `ask` | `{ question, askedBy }` | The Twin answers about its patient |
| `readback` | `{ text, nurseId }` | The Twin checks the read-back; returns `ok` or what's missing |
| `getState` | `{}` | Full patient state (for debugging and the UI) |

**Alarms:** `med_due`, `vitals_due`, `pain_recheck`, `fall_rounds`, `handoff_prep` (6:45am).

### Pod Actor (`pod:<pod>`)
| Method | Input | Does |
|---|---|---|
| `voiceNote` | `{ transcript, nurseId, simTime }` | The Nurse Agent splits and routes notes to Twins |
| `ask` | `{ question, nurseId }` | The Nurse Agent answers, asking Twins if needed |
| `signIn` | `{ nurseId }` | Sets the current nurse |
| `signOut` | `{ nurseId }` | Clears the nurse; the agent keeps all context |
| `brief` | `{ nurseId }` | Returns the spoken-style briefing for the new nurse |
| `getState` | `{}` | Rooms, current nurse, alert queue, to-do list |

**Alarms:** `shift_change` (7:00am → prepare the briefing).

### Unit Actor (`unit:floor-4west`), rules only, no AI
| Method | Input | Does |
|---|---|---|
| `setClock` | `{ simTime, speed }` | Demo clock (see Section 6) |
| `assign` | `{ podId, nurseId }` | Sets who's on which pod |
| `markReadback` | `{ room, ok }` | Updates the handoff checklist |
| `emit` | `{ event }` | Pushes an event to the frontend WebSocket (Section 4) |
| `getState` | `{}` | Assignments, checklist, room statuses |

**Rules it runs:** handoff checklist, overload check (3+ high-risk per pod), look-alike names, 7:30am handoff deadline.

---

## 3. Agent Relay messages

Every message body is JSON with this shape:

```json
{
  "type": "alert",
  "from": "twin-room-6",
  "to": "nurse-pod-a",
  "room": "room-6",
  "level": "urgent",
  "text": "Fall risk plus new sleeping pill (age 81). Bed alarm on?",
  "simTime": "23:30",
  "refs": ["note-17"]
}
```

`level` is one of `urgent`, `soon`, or `fyi` (alerts only).

| `type` | From → To | Meaning |
|---|---|---|
| `note.new` | Nurse Agent → Twin | A routed voice note |
| `note.ack` | Twin → Nurse Agent | "Logged as AI draft" plus any alarm set |
| `alert` | Twin → Nurse Agent | Risk, overdue, or trend warning |
| `patient.request` | Twin → Nurse Agent | Bedside request with context |
| `question` | Nurse Agent → Twin | A nurse's question about one patient |
| `answer` | Twin → Nurse Agent | The Twin's answer |
| `handoff.section` | Twin → Nurse Agent | The Twin's 6:45am section |
| `readback` | Nurse Agent → Twin | The new nurse's read-back |
| `readback.ok` / `readback.missing` | Twin → Nurse Agent | Confirmed, or what's missing |
| `help.request` | Nurse Agent → Nurse Agent | "Can your nurse check Room 2?" |
| `help.response` | Nurse Agent → Nurse Agent | "Yes, Sam is heading there." |
| `floor.notice` | System (Unit Actor) → `#4-west` | Overload, look-alike names, deadline warnings |

**Rule:** Every Relay message is **also** sent to the Unit Actor's `emit`, so Kenil gets it as an `agent.message` event for beams, and Shresth copies it into the Supabase `audit_log`.

---

## 4. Frontend events (Unit Actor WebSocket → Kenil)

One WebSocket stream. Every event has a `kind`:

```json
{ "kind": "clock", "simTime": "03:30", "speed": 1 }
{ "kind": "room.status", "room": "room-4", "status": "urgent", "owner": "maya", "label": "3am dose not charted" }
{ "kind": "agent.message", "from": "twin-room-4", "to": "nurse-pod-a", "type": "alert", "level": "urgent", "text": "3am potassium not charted. Given?" }
{ "kind": "transcript", "who": "maya", "text": "Room 6, gave zolpidem for sleep." }
{ "kind": "speech", "who": "nurse-pod-a", "text": "Good morning Jordan...", "audioUrl": "https://..." }
{ "kind": "nurse.change", "pod": "pod-a", "from": "maya", "to": "jordan" }
{ "kind": "handoff.progress", "room": "room-4", "state": "accepted" }
{ "kind": "system", "text": "Backend restarted. All state restored." }
```

| `room.status.status` | 3D color |
|---|---|
| `stable` | 🔵 blue (night) / 🟡 gold (after handoff, owner = jordan) |
| `warning` | 🟠 amber |
| `urgent` | 🔴 red |
| `resolved` | 🟢 green (fades back to stable after about 3 seconds) |

---

## 5. Voice service (Shresth → everyone)

| Endpoint | Input | Output |
|---|---|---|
| `POST /voice/nurse` | audio + `{ podId, nurseId, simTime }` | Transcript → calls `pod:<pod>.voiceNote`; emits `transcript` |
| `POST /voice/ask` | audio + `{ podId, nurseId }` | Transcript → `pod:<pod>.ask` → answer text + spoken audio; emits `speech` |
| `POST /voice/bedside` | audio + `{ room }` | Transcript → `patient:<room>.patientRequest` |
| `POST /voice/readback` | audio + `{ podId, nurseId, room }` | Transcript → Nurse Agent → `readback` to the Twin |
| `POST /tts` | `{ text }` | Spoken audio URL |

**Push-to-talk only** (hold the button to talk). Always-on listening is too risky in a demo.

---

## 6. Demo clock (important!)

Real alarms at real times won't fire during a 2-minute demo, so the **Unit Actor owns a simulated clock**:
- `simTime` is the story time (for example, `"23:30"`).
- `speed` is how fast story time moves (1 = normal, 600 = 10 story minutes per real second).
- Every actor stores due times in **story time**. Whenever the clock changes, each actor **recalculates and re-sets its next real alarm**. The alarms are still real actor alarms, just on a compressed clock.
- The **Director panel** (Kenil builds the buttons, Shresth wires them) can: set the time, fast-forward to the next moment, trigger 7am, and reset the demo.

---

## 7. Supabase tables (Shresth)

| Table | Columns |
|---|---|
| `profiles` | `id`, `name`, `role` (nurse / patient_device), `pod_id`, `room` |
| `voice_clips` | `id`, `actor_id`, `who`, `audio_url`, `transcript`, `created_at` |
| `audit_log` | `id`, `sim_time`, `from`, `to`, `type`, `text`, `created_at` |

Pre-seed accounts: `maya`, `jordan`, `sam`, and one bedside device per room.

---

## 8. Mock event timeline (Kenil builds against this until the backend is ready)

Replay these events with a short delay between each to drive the whole demo without any backend:

```json
[
  { "kind": "clock", "simTime": "19:00", "speed": 1 },
  { "kind": "nurse.change", "pod": "pod-a", "from": null, "to": "maya" },
  { "kind": "room.status", "room": "room-2", "status": "stable", "owner": "maya" },
  { "kind": "room.status", "room": "room-4", "status": "stable", "owner": "maya" },
  { "kind": "room.status", "room": "room-6", "status": "stable", "owner": "maya" },
  { "kind": "room.status", "room": "room-8", "status": "stable", "owner": "maya" },
  { "kind": "clock", "simTime": "23:30", "speed": 1 },
  { "kind": "transcript", "who": "maya", "text": "Room 6, gave zolpidem for sleep." },
  { "kind": "agent.message", "from": "nurse-pod-a", "to": "twin-room-6", "type": "note.new", "text": "Gave zolpidem for sleep." },
  { "kind": "agent.message", "from": "twin-room-6", "to": "nurse-pod-a", "type": "alert", "level": "urgent", "text": "Fall risk plus new sleeping pill (age 81). Bed alarm on?" },
  { "kind": "room.status", "room": "room-6", "status": "warning", "owner": "maya", "label": "Fall risk + sleeping pill" },
  { "kind": "room.status", "room": "room-6", "status": "resolved", "owner": "maya" },
  { "kind": "clock", "simTime": "03:30", "speed": 1 },
  { "kind": "agent.message", "from": "twin-room-4", "to": "nurse-pod-a", "type": "alert", "level": "urgent", "text": "3am potassium not charted. Given?" },
  { "kind": "room.status", "room": "room-4", "status": "urgent", "owner": "maya", "label": "3am dose not charted" },
  { "kind": "room.status", "room": "room-4", "status": "resolved", "owner": "maya" },
  { "kind": "clock", "simTime": "04:00", "speed": 1 },
  { "kind": "agent.message", "from": "nurse-pod-a", "to": "nurse-pod-b", "type": "help.request", "text": "Maya is with Room 8. Can your nurse check Room 2's BP?" },
  { "kind": "agent.message", "from": "nurse-pod-b", "to": "nurse-pod-a", "type": "help.response", "text": "Yes, Sam is heading to Room 2." },
  { "kind": "clock", "simTime": "07:00", "speed": 1 },
  { "kind": "nurse.change", "pod": "pod-a", "from": "maya", "to": "jordan" },
  { "kind": "speech", "who": "nurse-pod-a", "text": "Good morning Jordan. Room 2 is the sickest; see him first." },
  { "kind": "agent.message", "from": "nurse-pod-a", "to": "twin-room-4", "type": "question", "text": "Jordan asks: did pain improve?" },
  { "kind": "agent.message", "from": "twin-room-4", "to": "nurse-pod-a", "type": "answer", "text": "Pain went from 7 to 3 at the 23:00 recheck." },
  { "kind": "agent.message", "from": "twin-room-4", "to": "nurse-pod-a", "type": "readback.ok", "text": "Read-back correct." },
  { "kind": "handoff.progress", "room": "room-4", "state": "accepted" },
  { "kind": "room.status", "room": "room-4", "status": "stable", "owner": "jordan" },
  { "kind": "system", "text": "Backend restarted. All state restored." }
]
```
