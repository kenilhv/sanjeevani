// The twin: the single source of truth for everything alive in Haven General. See docs/CONTRACT.md §7.
// One real second at speed 1 is one simulated minute. No THREE here, so it can be backed by durable actors later.
import { createCore, advance, pumpFeed, compactProcs, resolveAlert, setLife, STEP, syncRoom } from './core.js';
import { populate, afterWarm } from './boot.js';
import { updateVitals, updateRooms, updateMetrics, sampleHistory, prefillHistory, stepEquipment, episodeRoll } from './clinical.js';
import { minuteFlows, erStay, goHome } from './flows.js';
import { staffLife, inpatientLife, visitorLeaves } from './life.js';
import { runScenario } from './scenarios.js';
import { ask } from './ask.js';

const DAYPARTS = [[5, 'Night'], [12, 'Morning'], [17, 'Afternoon'], [21, 'Evening'], [24, 'Night']];
const WARMUP_MIN = 12;
const pad = (n) => String(n).padStart(2, '0');

function syncClock(sim, clock) {
  const t = sim.clock, m = ((t % 1440) + 1440) % 1440;
  clock.minutes = t;
  clock.hours = m / 60;
  clock.label = `${pad(Math.floor(m / 60))}:${pad(Math.floor(m % 60))}`;
  clock.dayPart = DAYPARTS.find(([h]) => clock.hours < h)[1];
}
function watchdog(sim) {
  for (const a of sim.actors) {
    if (a._puppet || (a._proc && !a._proc.dead)) continue;
    if (a.kind === 'staff') { if (a._crew) continue; setLife(sim, a, staffLife(sim, a)); continue; }
    if (a.kind === 'visitor') { setLife(sim, a, visitorLeaves(sim, a)); continue; }
    const bed = a.bedId && sim.beds.get(a.bedId);
    if (!bed) setLife(sim, a, goHome(sim, a));
    else if (bed.kind === 'er') setLife(sim, a, erStay(sim, a, bed));
    else setLife(sim, a, inpatientLife(sim, a));
  }
}
function minuteStep(sim) {
  sim.minutes = (sim.minutes ?? 0) + 1;
  const n = sim.minutes;
  updateVitals(sim);
  // Random deteriorations are demo content; live mode gets its clinical events from the actors.
  if (sim.clinical) episodeRoll(sim);
  for (const a of sim.actors) {
    if (a.bubble && sim.now > a._bubbleUntil) a.bubble = null;
    if (a._moving || a._leader) syncRoom(a);
  }
  for (const l of Object.values(sim.lifts)) if (l.moving && sim.now >= l.until) { l.moving = false; l.floor = l.target; }
  minuteFlows(sim);
  updateRooms(sim);
  updateMetrics(sim);
  if (n % 5 === 0) { sampleHistory(sim); stepEquipment(sim); }
  if (n % 10 === 0) { compactProcs(sim); watchdog(sim); }
  const day = Math.floor(sim.clock / 1440);
  if (day !== sim.day) { sim.day = day; sim.stats.admissions = 0; sim.stats.discharges = 0; }
}

// clinical: false keeps only the ambient life (people, vehicles, routines) for live mode,
// with no invented alerts, episodes or agent chatter. Demo mode keeps the full simulation.
export function createTwin({ shell, clinical = true } = {}) {
  const sim = createCore(shell);
  sim.day = 0;
  sim.clinical = clinical;
  populate(sim);
  sim.minuteStep = minuteStep;
  // Silent head start, so staff are mid-stride on the very first frame instead of all standing at their marks.
  for (let i = 0; i < WARMUP_MIN / STEP; i++) advance(sim, STEP);
  updateVitals(sim); updateRooms(sim); updateMetrics(sim);
  prefillHistory(sim);
  if (clinical) afterWarm(sim);

  const clock = { minutes: 0, hours: 0, label: '', dayPart: '' };
  syncClock(sim, clock);

  const twin = {
    speed: 1, paused: false, clock,
    actors: sim.actors, vehicles: sim.vehicles, beds: sim.beds, rooms: sim.rooms, equipment: sim.equipment,
    alerts: sim.alerts, metrics: sim.metrics, history: sim.history, feed: sim.feed,
    lifts: sim.lifts,
    // For live mode's choreography (the shift-change walk-out and walk-in). Not part of the twin contract.
    _sim: sim,
    get scenario() { return sim.scenario; },
    tick(dt) {
      if (twin.paused || !(dt > 0)) return;
      let left = Math.min(dt * twin.speed, 600);
      while (left > 1e-9) { const h = Math.min(left, STEP); advance(sim, h); left -= h; }
      pumpFeed(sim, dt);
      syncClock(sim, clock);
    },
    setSpeed(n) { twin.speed = n; },
    setPaused(b) { twin.paused = !!b; },
    setHours(h) { sim.clock = Math.floor(sim.clock / 1440) * 1440 + h * 60; sim.day = Math.floor(sim.clock / 1440); syncClock(sim, clock); },
    runScenario(name) { runScenario(sim, name); },
    ack(alertId) {
      const al = sim.alerts.find((a) => a.id === alertId);
      if (!al) return;
      al.acked = true;
      if (al.severity === 'info' || al._soft) resolveAlert(sim, al);
    },
    ask: (question) => ask(sim, question),
    routeOf(actorId) {
      const a = sim.byId.get(actorId);
      if (!a || !a._wps) return [];
      return a._wps.slice(a._wi);
    },
    on: (event, cb) => sim.on(event, cb),
  };
  return twin;
}
