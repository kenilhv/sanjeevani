# Haven General · Live Hospital Twin · Build Contract

Everyone building this reads this file first. It is the only coordination between parallel builders.
If you need something from another module, code against the API here. Never edit a file you don't own;
if the contract is wrong, make the smallest local workaround and write it in `docs/notes/<your-area>.md`.

## 0. The product and the bar

We are selling a **live digital twin of a hospital** to a non-technical hospital buyer who must fall in love
with how it looks in the first ten seconds. The hero is a soft, pastel, isometric 3D cutaway of the whole
hospital that is **alive**: patients in beds, nurses walking rounds, ambulances arriving, monitors blinking.
On top sits a calm, premium interface that a non-software person understands without being told.

**Visual reference:** `docs/reference/reference.png` (ithappy isometric hospital). View it before you start.
Pink tile floors, powder-blue wainscot, mustard stripe, dusty-mauve upper walls, white caps, yellow doors, teal sofas,
white beds with pale-blue blankets, brown curtains, dark-green plants, metal linen racks, soft blue-grey backdrop.
Rounded, toy-like, cosy, expensive. Reference quality also: Two Point Hospital, Monument Valley, Linear, Apple keynote UI.

**Non-negotiables**
- Smooth. 60 fps on a normal laptop. Every state change is eased; nothing pops. Numbers tween, panels spring, camera glides.
- Reward zooming in. Every object has small believable details (wheels, buttons, tubes, cables, screens that animate).
- Alive at a glance. Something is always moving somewhere on screen.
- Plain language. "Beds free", never "resource availability index". No jargon, no developer-looking UI.
- No fake placeholders in the final result: no lorem ipsum, no TODO text, no grey boxes.

## 1. Stack and files

Plain browser ES modules + three.js 0.170. **No bundler, no frameworks, no JSX, no CSS imports in JS.** This machine's Application Control blocks native Node addons, so Vite, Rollup and esbuild binaries cannot run; do not try to add them, and add no npm packages. `tools/serve.mjs` serves the repo at http://localhost:5199 (already started; do not start another, do not kill it). It injects the `three` import map into every HTML page, and sends no-store so a browser refresh always sees your latest file. Importing `three` and `three/examples/jsm/...` works as usual. CSS lives in JS template strings injected as a `<style>` tag, so the final single-file build stays simple.

| Owner | Files |
|---|---|
| shared, read-only | `docs/CONTRACT.md`, `src/style/palette.js`, `src/style/kit.js`, `src/props/registry.js`, `src/world/plan.js`, `src/main.js` |
| engine | `src/engine/*` |
| shell | `src/world/shell.js` + any `src/world/shell-*.js` |
| clinical props | `src/props/clinical.js` + any `src/props/clinical-*.js` |
| furniture + outdoor props | `src/props/furniture.js`, `src/props/outdoor.js` |
| people | `src/people/*` |
| furnishing | `src/world/furnishing.js`, `tools/check-furnishing.mjs` |
| sim | `src/sim/*` |
| ui | `src/ui/*` |

Playgrounds for testing your module in isolation go in `playground/<area>*.{html,js}`. Screenshots go in `shots/<area>-*.png`.

## 2. World conventions

- 1 unit = 1 metre. +X east, +Z south, +Y up. Building footprint 38 × 26, NW corner at origin. See `src/world/plan.js` (rooms, doors, portals, wall heights, site extents).
- Two floor plates. `engine.floors[i]` is the parent Group for floor i. Inside it, y = 0 is that floor's finished floor level. The engine animates the plate's y.
- `engine.ground` holds the island, site and floor-0-independent exterior. It never moves.
- Default camera is orthographic from the SE at 32° elevation, azimuth steps of 90°. N and W perimeter walls are the tall backdrop; S and E perimeter walls are cut low. On rotation, whichever two perimeter sides are nearest the camera get cut.
- Interior partitions are always low (`WALL.partition`) with frosted glass up to `WALL.glassTop`, so rooms stay readable.

## 3. Modelling style

Use `src/style/kit.js` for everything (`box`, `cyl`, `ball`, `pill`, `ring`, `panel`, `mat`, `matGlow`, `matGlass`, `contact`, `canvasTex`, `signMat`, `bakeStatic`). Colours come from `C` in `src/style/palette.js`.
- Forms are soft and rounded, slightly chunky and toy-like. Never a raw sharp box at furniture scale.
- Add `contact(w, d)` at the base of every floor-standing prop. This fake AO is a large part of the look.
- Target under 1.5k triangles for a typical prop, 4k for hero props (bed, MRI, ambulance). Share geometry and materials through the kit.
- Canvas-drawn textures are fine (screens, signs, tiles). No external images or models.

## 4. Props API (`src/props/registry.js`)

`registerProp(name, (opts) => group)` for every name in `CATALOG` that your area owns. `CATALOG` gives footprint, height, and use/seat points. Stay inside the footprint. Origin is footprint centre at floor level; the front faces +Z.

Each module exports one function that registers all its props: `registerClinicalProps()`, `registerFurnitureProps()`, `registerOutdoorProps()`.

Optional hooks on the returned group's `userData`:
- `dynamic: true` on any child that moves, so `bakeStatic` keeps it. Static children get merged away, so hold references only to dynamic children.
- `tick(dt, t, ctx)` per-frame animation. `ctx = { night: 0..1 }`. Keep it cheap: no allocation.
- `setState(state)` receives the live twin object for this entity (a Bed or Equipment, see §7). Must be cheap and safe to call every frame; compare before changing textures.
- `anchors: { top: Vector3 }` local point for floating labels. Default is footprint centre at `h + 0.3`.

Props that glow at night read `ctx.night`.

## 5. Shell API (`src/world/shell.js`) — `buildShell(engine)` returns `shell`

Builds the island, site, ground plane, floors, walls, doors, windows, lifts, stairs, then places everything in `FURNISHING` using `makeProp`, then bakes each floor.

```
shell.rooms      Map<roomId, { room, overlay: Mesh, centre: {x,y,z}, floor }>
shell.entities   Map<entityId, { group, entry, roomId, floor, world: {x,y,z}, heading }>   // every placed prop with an id
shell.placed     [{ name, entry, roomId, floor, world: {x,y,z}, heading, meta }]            // every placed prop (sim reads this)
shell.update(dt, t, twin)                  // ticks prop hooks and doors (doors open when twin.actors come near), lifts
shell.setRoomTint(roomId, color|null, a)   // eased heatmap overlay on the room floor
shell.highlightRoom(roomId|null)           // soft selection glow
shell.setWallMode('cutaway'|'up')          // 'up' raises all perimeter walls
```
The shell subscribes to `engine.on('view', …)` and eases perimeter wall heights by rotating which sides are cut. Floors below the active floor keep their walls full height. Rooms and beds register invisible pick proxies with `engine.addPickable(mesh, { type, id })`. Types: `room`, `bed`, `equipment`.

`FURNISHING` format (`src/world/furnishing.js`):
```js
export const FURNISHING = {
  ward_a: [ { p: 'bed', x: 2, z: 1.4, r: 0, id: 'A1', o: {} }, { p: 'wallArt', x: 3, z: 0.1, y: 1.5, r: 0, o: { style: 'butterfly' } } ],
  // room ids from plan.js. x, z in metres from the room's NW corner. r = rotation in degrees about Y (0 keeps +Z front).
  exterior: [ { p: 'treeRound', x: -5, z: 4, r: 0 } ],   // world coordinates, floor 0
};
```
Entity ids: beds `bed` ids like `ER1`, `A1`, `ICU1`, `OR1`. Equipment worth tracking gets an id (`MRI1`, `CT1`, `XRAY1`, `VENT1`…).

`plan.js` also defines `ZONES` (street, spur, apron, dropoff, plaza, parking, helipad, garden) which the shell paints, and `ROUTES` which vehicles drive. All three modules must agree with those numbers, so never invent alternatives.

## 6. Engine API (`src/engine/index.js`) — `createEngine(container, { quality })` returns `engine`

```
engine.scene, .camera, .renderer, .root
engine.ground, engine.floors[0|1]
engine.ctx = { night: 0..1 }
engine.onFrame(cb(dt, t)), engine.start()                 // dt in seconds, clamped to 0..0.05
engine.on(event, cb)                                      // 'view' {azimuthIndex, floorMode, zoom}, 'hover' hit|null, 'select' hit|null
engine.setFloorMode('ground'|'level1'|'stack')            // eases plates; 'ground': level 1 flies up out of frame and hides
engine.floorMode, engine.floorVisible(i)
engine.rotate(±1), engine.azimuthIndex
engine.flyTo({ x, y, z, zoom, azimuthIndex, duration }) → Promise
engine.focusRoom(roomId, { zoom }) → Promise, engine.resetView() → Promise
engine.setHours(h)                                        // 0..24 drives sun, sky, ctx.night, with continuous blending
engine.project(x, y, z) → { x, y, visible }               // world → CSS pixels, for HTML labels. y is world y, already including plate offset
engine.floorY(i)                                          // current world y of floor plate i
engine.addPickable(object, info), engine.removePickable(object)   // info: { type: 'room'|'bed'|'equipment'|'person'|'vehicle', id }
engine.pulse(x, y, z, color)                              // an expanding ring on the floor, for events
engine.intro() → Promise                                  // cinematic opening
engine.setQuality('auto'|'high'|'medium'|'low'), engine.stats = { fps, calls, tris }
```
Pointer: drag pans, wheel or pinch zooms around the cursor with inertia, two-finger or right-drag rotates in 90° steps, click selects, hover reports. Empty-space click clears the selection.

## 7. Twin API (`src/sim/index.js`) — `createTwin({ shell })` returns `twin`

The twin is the single source of truth. Plain objects, mutated in place, cheap to read every frame. All content is fictional. One real second at speed 1 is one simulated minute.

```
twin.tick(dtRealSeconds)
twin.speed, twin.setSpeed(n), twin.paused, twin.setPaused(b)
twin.clock = { minutes, hours, label: '09:42', dayPart: 'Morning' }, twin.setHours(h)
twin.actors: Actor[], twin.vehicles: Vehicle[], twin.beds: Map, twin.rooms: Map, twin.equipment: Map
twin.alerts: Alert[], twin.metrics: Metrics, twin.history: { occupancy: number[], erWait: number[], staffBusy: number[], throughput: number[] }  // last 90 samples
twin.feed: AgentMsg[]                       // newest last, capped at 200
twin.scenario, twin.runScenario('normal'|'flu'|'codeblue'|'mci'|'mrifault')
twin.ack(alertId)
twin.ask(question) → { answer, focus?: { roomId?, bedId?, actorId? }, highlights?: roomId[] }
twin.routeOf(actorId) → [{ x, z }]          // remaining walking path, for flow lines
twin.on(event, cb)                          // 'alert', 'resolve', 'scenario', 'arrival', 'feed', 'discharge', 'moment'
```
```
Actor   { id, name, kind:'staff'|'patient'|'visitor', role:'nurse'|'doctor'|'surgeon'|'tech'|'paramedic'|'porter'|'cleaner'|'reception'|'pharmacist'|'patient'|'visitor',
          floor, x, z, y, heading, anim:'idle'|'walk'|'run'|'sit'|'lie'|'work'|'push'|'cpr'|'talk', speed, task, roomId, bedId?, acuity?, status:'ok'|'watch'|'critical',
          bubble: null|'call'|'heart'|'pill'|'zzz'|'alert'|'chat', hidden: false, seed }
Vehicle { id, type:'ambulance'|'helicopter'|'car', x, y, z, heading, lights:boolean, doors:boolean, rotor:0..1, label, eta? }
Bed     { id, roomId, floor, x, z, heading, kind:'ward'|'icu'|'er'|'or', status:'free'|'occupied'|'cleaning'|'reserved', patientId|null,
          vitals:{hr,spo2,rr,sys,dia,temp}, alarm:null|'watch'|'critical' }
Room    { id, name, dept, floor, capacity, occupied, occupancy, status:'calm'|'busy'|'full'|'alert', waiting, staffIds:[], patientIds:[] }
Equip   { id, roomId, type, name, status:'idle'|'in-use'|'maintenance'|'fault', health:0..1, note }
Alert   { id, severity:'info'|'watch'|'critical', title, detail, roomId?, bedId?, actorId?, at, resolved }
Metrics { occupancyPct, bedsFree, bedsTotal, erWaitMin, patientsInHouse, staffOnDuty, staffBusyPct, activeAlerts, admissionsToday, dischargesToday, avgStayHours, orUtilPct }
AgentMsg{ id, at, from, to, text, kind:'request'|'handoff'|'ack'|'alert', roomId? }
```
The `feed` is the agent network: named software agents negotiating in plain English (Triage, Bed, Staffing, Pharmacy, Imaging, Facilities). Derive beds, seats and work spots from `shell.placed` + `CATALOG`, never hard-code positions. Build a walkable grid per floor from `plan.js` (walls + door gaps) and prop footprints.

Keep the twin behind this API so it can later be backed by durable actors (Terse) and real agent messaging (Agent Relay). No THREE imports in `src/sim`.

## 8. People API (`src/people/index.js`) — `createPeople(engine)` returns `people`

```
people.update(dt, t, twin)      // syncs actors and vehicles, eases positions so sim steps never show
people.setLayer('flow', bool)   // draws soft route lines from twin.routeOf
people.highlight(actorId|null)
```
Adds each person to `engine.floors[actor.floor]`, vehicles to `engine.ground`, and registers pick proxies with type `person` / `vehicle`. Handles up to 80 people at 60 fps (shared geometry, shared materials).

## 9. UI (`src/ui/index.js`) — `mountUI({ engine, twin, shell, people, root })` returns `{ update(dt, t) }`

Pure DOM + CSS over the canvas. `root` is `#ui` (pointer-events none; panels turn it on). Fonts are already loaded by `main.js`: `Inter Variable`, `Instrument Serif` (italic display moments), `JetBrains Mono Variable` (vitals and clock). Full spec is in your task prompt.

## 10. `src/main.js` (shared, read-only)

Boots everything and runs: `twin.tick` → `engine.setHours` → `shell.update` → `people.update` → bind Bed/Equip state to `setState` → `ui.update`. Exposes `window.__twin = { engine, shell, twin, people, ui }`, and sets `window.__ready = true` after the first frames.

URL parameters for testing: `?skipIntro=1&floor=ground|level1|stack&hours=21.5&speed=8&scenario=flu&focus=icu&warm=120&quality=high`. `warm` fast-forwards the simulation that many minutes on boot, so a screenshot shows a populated hospital.

## 11. QA

`node tools/shot.mjs --url "/?skipIntro=1&warm=120&quality=low" --out shots/x.png` screenshots through headless Chrome (software GL, so slow but faithful) and prints page errors. Use `--eval "js"` to drive the page, `--size WxH`, `--mobile`, `--wait ms`. Open the PNG with your Read tool and actually look at it. Headless frame rates mean nothing.

For prop work use the ready-made stage: `/playground/props.html?owner=clinical` or `?names=bed,ivStand&zoom=3`.
