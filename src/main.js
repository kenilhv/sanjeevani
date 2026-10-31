import { createEngine } from './engine/index.js';
import { buildShell } from './world/shell.js';
import { registerClinicalProps } from './props/clinical.js';
import { registerFurnitureProps } from './props/furniture.js';
import { registerOutdoorProps } from './props/outdoor.js';
import { createTwin } from './sim/index.js';
import { createPeople } from './people/index.js';
import { mountUI } from './ui/index.js';
import { DEMO, CLOSED_ROOMS } from './live/config.js';
import { hiddenRooms } from './ui/util.js';
import { createLiveTwin } from './live/twin.js';
import { mountLive } from './live/ui.js';

const q = new URLSearchParams(location.search);
const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);

registerClinicalProps();
registerFurnitureProps();
registerOutdoorProps();

const engine = createEngine(document.getElementById('stage'), { quality: q.get('quality') || 'auto' });
const shell = buildShell(engine);
// Live (default) is driven by the Sanjeevani backend; ?demo=1 is the original fully simulated hospital.
const twin = DEMO ? createTwin({ shell }) : createLiveTwin({ shell });
const people = createPeople(engine);
// One floor: Level 1 holds the wards, ICU and nurse station, which is where the night and the handoff happen.
engine.setFloorMode('level1');

if (DEMO) {
  if (q.has('hours')) twin.setHours(num('hours'));
  if (q.has('warm')) for (let m = 0; m < num('warm'); m++) twin.tick(1 / Math.max(twin.speed, 1));
  if (q.has('scenario')) twin.runScenario(q.get('scenario'));
  if (q.has('speed')) twin.setSpeed(num('speed'));
}

// Live mode shows only what the story needs: Pod A, Pod B, the nurse station, corridor and lifts.
if (!DEMO) for (const id of CLOSED_ROOMS) hiddenRooms.add(id);
const ui = mountUI({ engine, twin, shell, people, root: document.getElementById('ui'), params: q });
if (!DEMO) mountLive(ui);

let frames = 0;
engine.onFrame((dt, t) => {
  twin.tick(dt);
  engine.setHours(twin.clock.hours);
  shell.update(dt, t, twin);
  people.update(dt, t, twin);
  for (const [id, bed] of twin.beds) shell.entities.get(id)?.group.userData.setState?.(bed);
  for (const [id, eq] of twin.equipment) shell.entities.get(id)?.group.userData.setState?.(eq);
  ui.update(dt, t);
  if (++frames === 3) window.__ready = true;
});

window.__twin = { engine, shell, twin, people, ui };

if (q.has('focus')) engine.focusRoom(q.get('focus'));
// Compile before the first frame, or Level 1 freezes the opening for two seconds the moment it comes into view.
await engine.renderer.compileAsync(engine.scene, engine.camera).catch((e) => console.warn('shader warm-up', e));
engine.start();
if (!q.has('skipIntro')) engine.intro();
