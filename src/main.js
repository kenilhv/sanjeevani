import { createEngine } from './engine/index.js';
import { buildShell } from './world/shell.js';
import { registerClinicalProps } from './props/clinical.js';
import { registerFurnitureProps } from './props/furniture.js';
import { registerOutdoorProps } from './props/outdoor.js';
import { createTwin } from './sim/index.js';
import { createPeople } from './people/index.js';
import { mountUI } from './ui/index.js';

const q = new URLSearchParams(location.search);
const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);

registerClinicalProps();
registerFurnitureProps();
registerOutdoorProps();

const engine = createEngine(document.getElementById('stage'), { quality: q.get('quality') || 'auto' });
const shell = buildShell(engine);
const twin = createTwin({ shell });
const people = createPeople(engine);

if (q.has('hours')) twin.setHours(num('hours'));
if (q.has('warm')) for (let m = 0; m < num('warm'); m++) twin.tick(1 / Math.max(twin.speed, 1));
if (q.has('scenario')) twin.runScenario(q.get('scenario'));
if (q.has('speed')) twin.setSpeed(num('speed'));

const ui = mountUI({ engine, twin, shell, people, root: document.getElementById('ui'), params: q });

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

if (q.has('floor')) engine.setFloorMode(q.get('floor'));
if (q.has('focus')) engine.focusRoom(q.get('focus'));
engine.start();
if (!q.has('skipIntro')) engine.intro();
