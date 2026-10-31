# Live mode (Sanjeevani backend)

| URL | What runs |
|---|---|
| `/?skipIntro=1` | **Live** (default). Clock, alerts, agent feed, Ask, nurse on shift and the Ward A/B patients come from the voice service at `:8787`. |
| `/?demo=1` | The original fully simulated hospital, no backend. |
| `/?api=http://10.0.0.5:8787` | Live mode against a voice service on another machine. |

Only Level 1 is shown (wards, ICU, nurse station). Ward A holds Rooms 2, 4, 6 and 8 (west to east by bed); Ward B holds Room 3. Internally they are `pod-a` and `pod-b`.

In live mode the simulation still runs, but only as scenery: people walking, vehicles, routines. `createTwin({ clinical: false })`
switches off its invented episodes, opening act and agent chatter, and the live twin hides its alerts and feed.
Live patients are never discharged, operated on or moved by the simulation.

| File | Job |
|---|---|
| `config.js` | Mode, API URL, ward mapping, fallback patient names |
| `connection.js` | `/events` WebSocket with reconnect; `/state` + `/history` snapshot on every (re)connect |
| `twin.js` | `createLiveTwin`: the same API as `createTwin`, driven by contracts.md §4 events |
| `voice.js` | Push-to-talk recording and queued playback of agent speech |
| `ui.js` | Live pill (top centre), Hold to talk, mic in the Ask box, reconnect veil |

Mic needs `localhost` or `https://`. Audio needs one click on the page first (browser autoplay rule).
