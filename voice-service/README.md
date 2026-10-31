# 🎙️ Sanjeevni voice service (Shresth)

Voice (push-to-talk → speech to text → actors, text to speech back), Supabase (sign-in, voice clips, audit log),
and the Director panel wiring. Implements `contracts.md` sections 5, 6 and 7.

```bash
cp .env.example .env        # add OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm start                   # http://localhost:8787  (test console + director)
npm run smoke               # in a 2nd terminal: plays the whole night through the mock backend
npm run check-voice         # once the OpenAI key is in: TTS -> STT round trip
```

Everything works without keys: typed fallback replaces the mic, and screens show text when there's no audio.
`BACKEND=mock` (default) is a built-in stand-in for Aditya's actors that emits the exact contract events,
so Kenil can build live mode against `ws://<host>:8787/events` right now.

## For Kenil: endpoints

All `POST`. Push-to-talk sends the **raw audio blob** as the body (`Content-Type: audio/webm`) with metadata in the
query string. The typed fallback sends **JSON** `{ text, ...same fields }` to the same URL.

| Endpoint | Fields | Returns |
|---|---|---|
| `/voice/nurse` | `podId`, `nurseId` (`simTime` optional) | `{ transcript, simTime, result }` and emits `transcript` |
| `/voice/ask` | `podId`, `nurseId` | `{ question, answer, audioUrl }` and emits `transcript` + `speech` |
| `/voice/bedside` | `room` | `{ transcript, reply, audioUrl }` (reply plays on the tablet only) |
| `/voice/readback` | `podId`, `nurseId`, `room` | `{ transcript, ok }` |
| `/tts` | `text`, `voice` (`agent` or `twin`) | `{ audioUrl }` |
| `/auth/signin`, `/auth/signout` | `nurseId` | `{ profile }` and the Pod Actor sign-in/out |
| `/director/<action>` | see below | the action's result |
| `GET /state` | | unit + pods + patients `getState` (use on reconnect) |
| `GET /history` | `limit` | recent events for screens that load mid-night; from memory, or from Supabase `audit_log` after this service restarts |
| `GET /health` | | which of backend/openai/supabase are on |

Push-to-talk helper (hold to record, release to send; handles mic permission, Safari's mp4, Space bar):

```js
import { attachPushToTalk, sendTyped } from "http://localhost:8787/ptt.js"
attachPushToTalk(button, {
  url: "http://localhost:8787/voice/nurse?podId=pod-a&nurseId=maya",
  onState: (s) => button.dataset.state = s,      // idle | recording | sending
  onResult: (res) => {},
  onError: (err) => {},
})
```

`speech` events carry `audioUrl`: play it on receipt. It's served by this service, so playback starts instantly.

⚠️ **Two browser rules that will bite on stage:**
- **The mic only works on `localhost` or `https://`.** A phone or second laptop opening `http://<laptop-ip>:5173/nurse/pod-a`
  gets no mic and no dialog. Open nurse/bedside screens on `localhost` on the machine serving them, or put them behind
  HTTPS (`vite --https`, or a cloudflared/ngrok tunnel).
- **Audio won't autoplay until someone clicks the page.** `/floor` must handle a rejected `audio.play()` with a visible
  "tap to enable sound" prompt, and we click it once before recording.

## Director buttons → `POST /director/<action>`

| Button | Action | Calls |
|---|---|---|
| Start night | `start-night` | `unit.setClock 19:00 x1`, sign in Maya + Sam |
| Jump to 23:30 | `jump-2330` | `unit.setClock 23:30` |
| Fast-forward to 03:30 | `ff-0330` | `unit.setClock 03:00 x600`; Room 4 alarm fires on its own |
| Jump to 04:00 | `jump-0400` | `unit.setClock 04:00`, Room 2 BP 128 → 112 → 98 via `patient.addVital` |
| Pre-generate briefing | `prep-briefing` | `pod.brief` + TTS, cached, not played |
| 7am handoff | `handoff` | 06:45 → wait 4s → 07:00 → sign out Maya → sign in Jordan → `pod.brief` → `speech` |
| Replay briefing | `play-briefing` | emits the (cached) briefing `speech` again |
| Restart backend | `restart` | runs `RESTART_CMD`, waits for `unit.getState`, emits the `system` restored message |
| Reset demo | `reset` | `unit.reset` |
| (any time) | `set-clock` | `{ simTime, speed }` |

The test console at `/` has all of these plus hold-to-talk buttons and a live event log. It works as a backup Director panel.

## Placeholder backend (until the real actors land)

`BACKEND=mock` runs `src/actors/mock.ts`, a placeholder for Nagpal's actors and agent brains. It has the same
methods and events as contracts.md, realistic fictional charts (MRN, allergies, meds, labs, Morse fall scores), scripted
Twin and Nurse Agent replies, a real-time story clock, and live vitals. `npm run samples` writes a request, a response
and the events emitted for every method to `samples/`. That's the target the real actors should match. It is
**not durable**: restarting this service resets the night, so the restart moment must kill the real actor runtime.

One event beyond contracts.md §4, which the frontend uses for bedside monitors:
`{ "kind": "vitals", "room": "room-2", "vitals": { "hr": 98, "spo2": 93, "rr": 22, "sys": 106, "dia": 64, "temp": 38.4 } }`

## For Aditya: plugging in the real actors

`src/actors/index.ts` makes every call as `call("pod:pod-a", "voiceNote", { transcript, nurseId, simTime })`,
exactly `contracts.md` section 2. To switch from mock to your actors:

Needs Bun 1.4.2+ (`/opt/homebrew/bin/brew install bun`). Terse runs fully local: `bunx durable-actors dev` in the
actor project serves `http://127.0.0.1:7100`, project `local`, no secret, state in `<actor project>/.durable-actors/`.
(Terse's GKE self-hosting guide is for production; not needed here.)

1. From the actor project, with `dev` running: `bunx durable-actors generate --out-dir <this folder>/generated`.
   If the runtime isn't on this machine, set `DURABLE_ACTORS_CONTROL_PLANE_URL=http://<ip>:7100` (no path) in `.env`.
   **Regenerate after every change to actor methods**, or calls fail with "not exposed by the generated client".
2. Make `CLASS_FOR` in `src/actors/terse.ts` match your exported class names (default `Patient`, `Pod`, `Unit`).
3. `BACKEND=terse` in `.env`, restart, `npm run smoke` (the event checks need item 4 below).

Persisted fields save on assignment only: `this.notes = [...this.notes, note]`, never `this.notes.push(note)`.

What this service needs from your actors (beyond contracts.md):

- **Required: forward every event you emit to `POST http://<shresth>:8787/events/ingest`** (one event, an array,
  or `{ events }`). Kenil's live floor listens to this service's `/events`, not to your Unit Actor socket, so with
  `BACKEND=terse` nothing reaches the screen until this is wired. It also feeds the Supabase `audit_log`.

- **`unit.reset({})`** for the Reset button (clear and reseed). Not in contracts.md yet.
- **Read-back:** this service calls `patient:<room>.readback({ text, nurseId })`, then `unit.markReadback({ room, ok })`.
  `readback` should return `{ ok: boolean, missing?: string }` (or `"ok"`). Say if you'd rather route it through the Pod Actor.
- **`pod.ask`** returns `{ answer }` (or a string). **`pod.brief`** returns `{ text }` (or a string).
- **`pod.brief` must return the same stored text on every call** (built once at `shift_change`), not regenerate.
  The briefing audio is cached by exact text; new wording means 3–5s of silence at 7am instead of instant playback.
- **`pod.signIn` must emit `nurse.change`** (`{ pod, from, to }`) through the Unit Actor. That event drives the
  Maya → Jordan moment on the floor, and no contract method owns it yet.
- **`unit.emit({ event })`**: this service sends `transcript`, `speech` and `system` events through it so Kenil
  gets them on your WebSocket. Each carries an `id`.
- Echoes of our own events (transcript, speech, system) coming back through ingest are dropped by `id`.
- **Restart:** agree on what gets killed. `scripts/restart-backend.sh` kills and restarts a local `durable-actors dev`
  (in a clean environment, so it reads only the actor project's `.env`) and returns once port 7100 is listening;
  set `RESTART_CMD` in `.env`. Rehearse it in `BACKEND=terse`.

The generated client is plain `index.js` plus a standalone `runtime/` (fetch and WebSocket only). It runs under
this service's Node; no `tsconfig.json` or Bun needed here.

## Supabase setup (about 5 minutes)

1. Create a project → SQL Editor → paste `supabase/schema.sql` → Run (tables, RLS, `voice` bucket, seed profiles).
2. Settings → API: copy the URL and the **service_role** key into `.env`.
3. `npm run seed:auth`: creates `maya@sanjeevni.demo`, `jordan@…`, `sam@…` and one bedside device per room
   (password `DEMO_PASSWORD`), linked to `profiles`.

With Supabase on: every voice clip is uploaded and logged in `voice_clips`, generated speech is uploaded under `tts/`,
every `agent.message` is copied into `audit_log`, and `/auth/signin` does a real Supabase Auth sign-in.
None of it is on the request path. If Supabase is slow, the demo isn't.
