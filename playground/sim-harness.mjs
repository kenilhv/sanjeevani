// Headless twin harness. Builds shell.placed from the real FURNISHING (or the fixture with --fixture), so no browser is needed.
//   node playground/sim-harness.mjs                      boot + 2 hours, print a report
//   node playground/sim-harness.mjs --soak               24 simulated hours of every scenario, with invariants
//   node playground/sim-harness.mjs --scenario codeblue --hours 3
import { FURNISHING } from '../src/world/furnishing.js';
import { roomById } from '../src/world/plan.js';
import { CATALOG } from '../src/props/registry.js';
import { createTwin } from '../src/sim/index.js';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

export function shellFromFurnishing() {
  const placed = [];
  for (const [roomId, list] of Object.entries(FURNISHING)) {
    const room = roomId === 'exterior' ? null : roomById(roomId);
    for (const e of list) {
      placed.push({
        name: e.p, entry: e, roomId, floor: room?.floor ?? 0, meta: CATALOG[e.p], heading: ((e.r ?? 0) * Math.PI) / 180,
        world: { x: (room?.rect.x ?? 0) + e.x, y: e.y ?? 0, z: (room?.rect.z ?? 0) + e.z },
      });
    }
  }
  return { placed };
}

const report = (twin, label) => {
  const m = twin.metrics;
  const kinds = {};
  for (const a of twin.actors) kinds[a.role] = (kinds[a.role] ?? 0) + 1;
  const beds = {};
  for (const b of twin.beds.values()) beds[b.status] = (beds[b.status] ?? 0) + 1;
  console.log(`${label} ${twin.clock.label} scen=${twin.scenario} actors=${twin.actors.length} veh=${twin.vehicles.length} occ=${m.occupancyPct}% free=${m.bedsFree}/${m.bedsTotal} wait=${m.erWaitMin} staff=${m.staffOnDuty}/${m.staffBusyPct}% alerts=${m.activeAlerts} adm=${m.admissionsToday} dis=${m.dischargesToday} stay=${m.avgStayHours} or=${m.orUtilPct}`);
  console.log('   ', JSON.stringify(kinds), JSON.stringify(beds));
};

function invariantChecker(twin, sim) {
  const seen = new Map();
  const problems = new Map();
  const note = (k, msg) => { problems.set(k, (problems.get(k) ?? 0) + 1); if (problems.get(k) === 1) console.log('  !!', k, msg); };
  return {
    problems,
    check(min) {
      if (twin.actors.length > 80) note('too-many-actors', twin.actors.length);
      for (const a of twin.actors) {
        const last = seen.get(a.id);
        const moved = !last || Math.hypot(last.x - a.x, last.z - a.z) > 0.05 || last.floor !== a.floor || last.anim !== a.anim || last.task !== a.task;
        if (moved) seen.set(a.id, { x: a.x, z: a.z, floor: a.floor, anim: a.anim, task: a.task, at: min });
        else if (min - last.at > 420 && a.kind !== 'patient') note(`frozen-${a.role}`, `${a.name} frozen for ${min - last.at} min: ${a.task} anim=${a.anim}`);
        if (!Number.isFinite(a.x) || !Number.isFinite(a.z)) note('nan', a.name);
      }
    },
  };
}

async function soak(scenario, hours = 24) {
  const out = console.warn; let warns = 0;
  console.warn = (...a) => { warns++; if (warns < 6) out(...a); };
  const shell = flag('fixture') ? { placed: [] } : shellFromFurnishing();
  const t0 = performance.now();
  const twin = createTwin({ shell });
  const boot = performance.now() - t0;
  const events = { alert: 0, resolve: 0, scenario: 0, arrival: 0, feed: 0, discharge: 0, moment: 0 };
  for (const k of Object.keys(events)) twin.on(k, () => { events[k]++; });
  const inv = invariantChecker(twin);
  if (scenario) twin.runScenario(scenario);
  let peakActors = 0, peakWait = 0, worstStep = 0, ticks = 0;
  const repeat = { flu: 0, normal: 0 };
  void repeat;
  for (let m = 0; m < hours * 60; m++) {
    const s = performance.now();
    twin.tick(1);
    worstStep = Math.max(worstStep, performance.now() - s);
    ticks++;
    peakActors = Math.max(peakActors, twin.actors.length);
    peakWait = Math.max(peakWait, twin.metrics.erWaitMin);
    if (m % 10 === 0) inv.check(m);
    if (scenario && scenario !== 'flu' && scenario !== 'normal' && m > 0 && m % 240 === 0) twin.runScenario(scenario);
    if (m % 240 === 0 && flag('verbose')) report(twin, `  t+${m}`);
  }
  const total = performance.now() - t0;
  report(twin, `[${scenario ?? 'baseline'}]`);
  const stuckBeds = [...twin.beds.values()].filter((b) => b.status === 'occupied' && !b.patientId).map((b) => b.id);
  console.log(`    boot ${boot.toFixed(0)}ms, ${hours}h in ${total.toFixed(0)}ms, worst minute ${worstStep.toFixed(1)}ms, peak actors ${peakActors}, peak wait ${peakWait}, warns ${warns}, events ${JSON.stringify(events)}, problems ${JSON.stringify([...inv.problems])}, stuck ${stuckBeds}`);
  console.warn = out;
  return twin;
}

if (flag('soak')) {
  for (const s of [null, 'flu', 'codeblue', 'mci', 'mrifault', 'normal']) await soak(s, Number(opt('hours', 24)));
} else {
  const scenario = opt('scenario');
  const twin = await soak(scenario, Number(opt('hours', 2)));
  console.log('feed tail:');
  for (const m of twin.feed.slice(-14)) console.log('   ', m.from, '->', m.to + ':', m.text);
  console.log('alerts tail:');
  for (const a of twin.alerts.slice(-8)) console.log('   ', a.severity, a.resolved ? '[done]' : '[open]', a.title, '|', a.detail);
  for (const q of ['how many beds are free?', 'what is the er wait', 'who is the sickest', 'what is busy', 'how many nurses are on', 'what if a surge happens', 'any equipment problems', 'where is ' + twin.actors.find((a) => a.kind === 'patient').name, 'tell me a joke']) {
    console.log('Q:', q, '\n   A:', JSON.stringify(twin.ask(q)));
  }
}
