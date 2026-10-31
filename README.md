# 🌿 Sanjeevani

**Nothing gets lost at 7am.**

Built for Haunted Hacks: Real-Time AI Edition (October 31, 2026).

Every morning a tired night nurse hands their patients to a fresh day nurse. In that rushed handoff, details get lost: a dose that was never charted, a fall-risk patient who got a sleeping pill, a patient who felt unwell at 2am. Communication failures contribute to an estimated 50–80% of the most serious hospital harms, and structured handoffs cut adverse events by up to 47%. After a 12-hour night shift, though, no nurse can do one perfectly for every patient.

Sanjeevani gives every patient an AI **Patient Twin** and every ward an AI **Nurse Agent**. Nurses and patients just talk. The agents remember, check, escalate and, at 7am, brief the incoming nurse with the whole night.

> In the Ramayana, the Sanjeevani herb had to reach Lakshmana before sunrise. Our agents carry every patient's story through the night, so it reaches the morning nurse by 7am.

---

## What you see

A live 3D hospital floor (Level 1: Ward A, Ward B and the nurse station), running through one night shift.

- **Talk to it.** Hold **Hold to talk** and speak as the nurse ("Room 6, gave zolpidem 5 milligrams for sleep"). Open any patient and hold **Hold to talk as the patient** ("I feel shaky and sweaty"). The words appear live as a caption.
- **Watch the agents think.** For 10 seconds an overlay shows:
  - what was said, and what the agent picked up from it (medication, dose, symptom, time, vitals);
  - what it is doing, step by step, and its decision (log it, warn, or call the nurse now);
  - the Nurse Agent and the Patient Twin talking it through, with real questions answered from the patient's chart.
- **The patient's Twin decides whether to call the nurse.** "I feel shaky and confused" from a diabetic patient is urgent, and the nurse walks to the bed. "Can I have some water?" is noted for the next round.
- **Agents talking, on the floor.** Each Twin is an avatar over its patient's bed, and each Nurse Agent floats over its ward. Every message travels between them as a beam of light. The **Agent network** panel opens as a live chat when they talk.
- **Alarms that catch misses.** Room 4's 3am potassium was never charted. At 3:30 her Twin's alarm fires on its own and asks.
- **Shift handover.** Press **Shift handover**: the night nurse heads home, the day nurse arrives, and the Nurse Agent briefs them out loud. A **handover report** comes up with every room, sickest first: what happened tonight, what the patient said, what to do, and what to watch for. It is written from everything that happened during the night, including everything you said.
- **Ask anything.** "Did Room 4's pain improve?" The Nurse Agent asks Room 4's Twin and answers.
- **Play the story.** One button runs the whole night end to end, with narration on why each moment matters.

Humans always decide. Agents remind, warn, draft and answer; everything they log is an AI draft until a nurse confirms it.

---

## How it works

```
 Nurse / patient speaks (hold to talk, Chrome speech recognition or server speech-to-text)
        │
        ▼
 voice-service  (Node, :8787)
   ├─ voice endpoints ──► the actors: one Patient actor per patient, one Ward actor per ward, one Floor actor
   │                        each with its own memory, story clock and alarms
   ├─ agent reasoning ──► Patient Twin and Nurse Agent (Anthropic API, structured outputs;
   │                        rule-based fallback when no key is set or a call fails)
   ├─ director actions ─► clock, sign in/out, shift handover, reset
   └─ /events (WebSocket) ─► every screen, live
        │
        ▼
 Frontend  (three.js, :5199): the hospital floor, agent avatars and beams, overlays, handover report
```

### The two agents

| | **Patient Twin** (one per patient) | **Nurse Agent** (one per ward) |
|---|---|---|
| Works for | The patient | The nurse on shift, whoever that is |
| Knows | One patient, deeply: chart, medicines, allergies, risks, every note tonight | Every patient in the ward at a glance |
| Does | Logs what it hears, checks it against the history, warns, decides whether to call the nurse, answers questions, confirms read-backs | Routes voice notes, asks Twins questions, ranks what matters, asks the other ward for help, briefs the next nurse |
| Never | Gives or changes medicines, diagnoses, or makes anything official without a nurse | Makes clinical decisions or sees other wards' patients |

### The night (all patients are fictional)

| Room | Patient | What happens |
|---|---|---|
| 2 | Daniel Okafor, 67, pneumonia | Blood pressure falls on three checks; Ward A asks Ward B for help |
| 4 | Linda Park, 58, knee replacement day 1 | 3am potassium not charted, so the alarm fires at 3:30 |
| 6 | Walter Hughes, 81, high fall risk | A sleeping pill is given and his Twin pushes back immediately |
| 8 | Grace Lee, 45, type 1 diabetes | "I feel shaky" at the bedside; her Twin calls the nurse with the context |
| 3 | Grace Li, 52, cellulitis (Ward B) | Same-name check across wards |

---

## Run it

Requirements: Node 23.6 or newer, and Chrome (for the microphone and built-in speech recognition).

```bash
# 1. The voice service and agents
cd voice-service
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY for the agents' reasoning (optional, see below)
npm start                     # http://localhost:8787

# 2. The hospital floor (in another terminal, from the repo root)
npm install
npm run dev                   # http://localhost:5199
```

Open **http://localhost:5199/?skipIntro=1** and click the page once so audio can play.

- The microphone works on `localhost` or `https://` only.
- To use the floor from another machine, open `http://<this-ip>:5199/?api=http://<this-ip>:8787`.
- **http://localhost:8787/** is the control console: reset or start the night, move the clock, a typed fallback for every voice, and a live event log.

### Configuration (`voice-service/.env`)

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | The Patient Twins and Nurse Agents reason with it (`ANTHROPIC_MODEL` to override the model). Without it, the same flows run on rules. |
| `OPENAI_API_KEY` | Optional. Server speech-to-text and natural voices. Without it, Chrome transcribes and speaks. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Optional. Sign-in, original voice clips and a floor-wide audit log (schema in `voice-service/supabase/schema.sql`). |
| `PUBLIC_URL` | The address other machines use to reach the voice service (for audio links). |

Never commit `.env`; it is ignored by git.

---

## Try it: what to say

Open Linda Park (Room 4) to use her bedside buttons. Nurse lines through the bottom **Hold to talk** start with the room number.

1. **Nurse:** "Room 4, Linda's pain is 7 out of 10, gave oxycodone 5 milligrams."
2. **Linda:** "My knee is still really hurting and I feel a bit sick."
3. **Nurse** (at her bedside): "Pain is down to 3 now, nausea settled with some ginger ale, ice pack on her knee."
4. *(Drag the clock past 3:30: Linda's potassium alarm fires.)*
5. **Nurse:** "Room 4, potassium was given at 3, I forgot to chart it."
6. **Linda:** "Could I have some water and another blanket please?"
7. **Linda:** "My calf feels tight and a little swollen."
8. **Nurse** (at her bedside): "Checked her calf, it's soft, mild swelling from surgery, I've told the doctor and I'll recheck at 6."
9. *(Press **Shift handover**.)*
10. **Day nurse** (Ask box): "How is Linda's calf, and did her pain improve?"

---

## Repository layout

```
index.html, src/          The hospital floor (plain ES modules, three.js, served by tools/serve.mjs)
  src/live/               The live layer: event stream, live patients and nurses, overlays, voice,
                          agent avatars and beams, handover report, story mode
  src/sim, engine, world, props, people, ui
                          The 3D hospital: building, furniture, people, camera and interface
voice-service/            Voice, agents and the event stream (Node, TypeScript run directly)
  src/brain.ts            Patient Twin and Nurse Agent reasoning (structured outputs)
  src/actors/             The actors: patients, wards, floor, clock and alarms
  src/server.ts           Voice endpoints, /events WebSocket, /state, /history, /health
  src/director.ts         Clock, sign-in, shift handover, reset
  public/                 Control console and push-to-talk helper
  scripts/smoke.ts        End-to-end check of the whole night (npm run smoke)
  supabase/schema.sql     Tables, policies and storage bucket
docs/                     Frontend module contract
```

Key events on `ws://<host>:8787/events`:
- `clock`, `room.status`, `agent.message`, `transcript`, `speech`, `nurse.change`, `handoff.progress`, `vitals`;
- `insight`: an agent's reasoning about something someone said;
- `report`: the handover report.

---

## Team

- **Shresth**: voice, agents' reasoning, integration, live layer.
- **Kenil**: the 3D hospital floor and interface.
- **Aditya**: actors and agent backend.

All patients, staff and data are fictional. Sanjeevani is a hackathon project, not a medical device.
