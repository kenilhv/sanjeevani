// Patient journeys, read top to bottom. Each one is a generator that runs on the patient's own process; anything that
// needs another person posts a job and waits with a timeout, so no journey can hang on someone who never comes.
import {
  SPEED, MAX_ACTORS, LIE_Y, until, addActor, removeActor, setLife, take, postJob, claim, release, releaseAll, showBubble, attach, detach, say, raise, resolveAlert, spawn, syncRoom, faceTo,
} from './core.js';
import { go, sitDown, bedSpot, faceBed, inBed, inpatientLife, goOutside, standIn, visitorLife, staffLife } from './life.js';
import { publishVitals, clearVitals, noteFor } from './clinical.js';
import { tableSpot } from './world.js';
import { addVehicle, removeVehicle, drive, flyTo, trafficCar } from './vehicles.js';
import { ROUTES } from '../world/plan.js';
import { WALK_INS, AMBULANCE, FLU, SCAN_NAME, BASE_VITALS, lowerFirst } from './data.js';

// ── People and beds ─────────────────────────────────────────────────────────
export function makePatient(sim, cond, o = {}) {
  const id = sim.names(o.gender);
  const title = id.g === 'f' ? (sim.rng.chance(0.65) ? 'Mrs' : 'Ms') : 'Mr';
  const p = addActor(sim, { kind: 'patient', role: 'patient', name: id.name, gender: id.g, display: `${title} ${id.last}`, floor: o.floor ?? 0, x: o.x, z: o.z, hidden: o.hidden, task: o.task });
  p.first = id.first; p.surname = id.last;
  p.reason = cond.reason; p.acuity = cond.acuity; p.triage = cond.triage; p._cond = cond;
  p._arrivedAt = sim.now; p._admittedAt = sim.now - (o.ago ?? 0);
  p._base = { ...BASE_VITALS, ...cond.v }; p._v = { ...p._base };
  p._trend = null; p._alert = null; p._order = null;
  return p;
}
export const bedTarget = (bed) => ({ floor: bed.floor, x: bed.x, z: bed.z, ax: bed._use.ax, az: bed._use.az, heading: bed.heading, roomId: bed.roomId });
export function settleInBed(sim, p, bed) {
  p.floor = bed.floor; p.x = bed.x; p.z = bed.z; p.y = LIE_Y; p.heading = bed.heading; p.anim = 'lie'; p.speed = 0;
  p.bedId = bed.id; p.roomId = bed.roomId; p._away = false; p._waiting = false;
  bed.status = 'occupied'; bed.patientId = p.id; bed._for = null;
  publishVitals(bed, p._v);
}
export function reserveBed(sim, kind, p) {
  const free = [...sim.beds.values()].filter((b) => b.kind === kind && b.status === 'free');
  if (!free.length) return null;
  const bed = sim.rng.pick(free);
  bed.status = 'reserved'; bed._for = p.id;
  return bed;
}
export function unreserve(bed) { if (bed.status === 'reserved') { bed.status = 'free'; bed._for = null; } }
export function vacate(sim, p, clean = true) {
  const bed = sim.beds.get(p.bedId);
  p.bedId = null;
  if (!bed || bed.patientId !== p.id) return;
  bed.patientId = null; bed.alarm = null;
  clearVitals(bed);
  if (p._alert) { resolveAlert(sim, p._alert); p._alert = null; }
  if (clean) { bed.status = 'cleaning'; requestClean(sim, bed); } else bed.status = 'free';
}
export function requestClean(sim, bed) {
  // The other floor's cleaner is a lift ride away, so they only come when a bed has really been left waiting.
  postJob(sim, {
    role: 'cleaner', zone: bed.kind === 'er' ? 'er' : bed.floor === 0 ? 'floor0' : 'floor1', pri: 2, exclusive: 20,
    run: function* (a) {
      const s = bedSpot(bed, a);
      a.task = `On the way to clean ${bed.id}`;
      let done = false;
      try {
        yield* go(sim, a, s);
        faceBed(a, bed);
        a.anim = 'work'; a.task = `Cleaning ${bed.id} for the next patient`;
        yield bed.kind === 'er' ? sim.rng.range(3, 5) : sim.rng.range(5, 8);
        bed.status = bed._closing ? 'reserved' : 'free';
        if (bed._closing) { bed._for = 'surge'; bed._closing = false; }
        done = true;
      } finally { if (!done) requestClean(sim, bed); }
    },
  });
}
export const roomFor = (sim, n = 1) => sim.actors.length + n <= MAX_ACTORS;
export function logDischarge(sim, p) {
  const s = sim.stats;
  s.discharges++;
  s.moves.push(sim.now);
  s.stays.push((sim.now - p._admittedAt) / 60);
  if (s.stays.length > 40) s.stays.shift();
  sim.emit('discharge', { actorId: p.id, name: p.display, roomId: p.roomId, bedId: p.bedId, text: `${p.display} is going home` });
}

const WHEELED = { speed: SPEED.push, anim: 'lie', gurney: true };

/** A porter wheels the patient. The patient leads the path and the porter walks in their footsteps, so nobody clips a door frame. */
export function* transfer(sim, p, target, o = {}) {
  // Live mode: patients the actors own stay in their beds; the ambient simulation never moves them.
  if (p._live) return;
  let done = false, started = false, pushed = null;
  const job = postJob(sim, {
    role: 'porter', pri: o.pri ?? 2, zone: `floor${p.floor}`, exclusive: 3,
    run: function* (porter) {
      started = true;
      try {
        // Booked before live mode adopted the patient: nothing to collect.
        if (p._live) return;
        porter._locked = true;
        porter.task = `On the way to collect ${p.display}`;
        yield* go(sim, porter, { floor: p.floor, ...sim.grids[p.floor].point(p.x + 0.9, p.z) });
        if (p._live) return;
        o.onPickup?.();
        releaseAll(p);
        p._away = true; p.anim = 'lie'; p.y = LIE_Y;
        pushed = porter;
        attach(porter, p, 1.25, 'push');
        porter.task = `Wheeling ${p.display} to ${o.label ?? 'the next stop'}`;
        if (o.via) yield* o.via(porter);
        yield* go(sim, p, target, WHEELED);
      } finally { if (pushed) detach(pushed); done = true; }
    },
  });
  yield until(() => done || started, o.timeout ?? 150);
  if (!started) {
    job.taken = true;
    sim.jobs.splice(sim.jobs.indexOf(job), 1);
    o.onPickup?.();
    releaseAll(p);
    p._away = true; p.anim = 'lie'; p.y = LIE_Y;
    if (o.via) yield* o.via(null);
    yield* go(sim, p, target, WHEELED);
  } else yield until(() => done, 400);
}

// ── Walk-ins ────────────────────────────────────────────────────────────────
function pickWalkIn(sim) {
  return sim.rng.chance(sim.fluMix ?? 0) ? sim.rng.pick(FLU) : sim.rng.pick(WALK_INS);
}
export function spawnWalkIn(sim, at, cond = pickWalkIn(sim)) {
  const p = makePatient(sim, cond, { x: at.x, z: at.z, floor: 0, task: 'Arriving at the main doors' });
  setLife(sim, p, walkIn(sim, p));
  return p;
}
function* checkIn(sim, p) {
  const { queue } = sim.world;
  let mine = null, spins = 0;
  while (queue.length && spins++ < 60) {
    const i = mine ? queue.indexOf(mine) : Infinity;
    const j = queue.findIndex((s) => !s.by);
    if (j >= 0 && j < i) {
      if (mine) release(p, mine);
      mine = queue[j];
      claim(p, mine);
      yield* go(sim, p, mine);
      p.task = 'In the queue at reception';
      p.anim = 'idle';
    }
    if (mine && queue.indexOf(mine) < 2) break;
    yield 0.8;
  }
  const clerk = sim.staff.reception[mine ? queue.indexOf(mine) % sim.staff.reception.length : 0];
  p.task = 'Checking in at reception';
  p.anim = 'talk';
  if (clerk) { showBubble(sim, clerk, 'chat', 3); clerk.task = `Checking in ${p.name}`; }
  yield sim.rng.range(2.5, 4.5);
  if (mine) release(p, mine);
}
export function* walkIn(sim, p) {
  const { world } = sim;
  const speed = p._cond.acuity <= 2 ? SPEED.hobble : SPEED.stroll * 1.1;
  yield* go(sim, p, world.entry.outside, { speed });
  yield* go(sim, p, world.entry.inside, { speed });
  sim.stats.moves.push(sim.now);
  sim.emit('arrival', { actorId: p.id, kind: 'walk-in', roomId: 'lobby', text: `${p.name} has arrived with ${lowerFirst(p.reason)}` });
  yield* checkIn(sim, p);
  p._arrivedAt = sim.now;
  sim.er.triageQ.push(p);
  p._waiting = true;
  yield* sitDown(sim, p, ['er', 'lobby'], 'Waiting to see the triage nurse', () => p._calledBy);
  yield* afterSeated(sim, p);
}
export function* afterSeated(sim, p) {
  const { world } = sim;
  yield until(() => p._calledBy, 150);
  const qi = sim.er.triageQ.indexOf(p);
  if (qi >= 0) sim.er.triageQ.splice(qi, 1);
  releaseAll(p);
  if (p._calledBy && world.triageFront) {
    p.task = 'Going to see the triage nurse';
    yield* go(sim, p, world.triageFront);
    p.task = 'With the triage nurse';
    p.anim = 'talk'; p._atDesk = true;
    yield until(() => p._triaged, 9);
    p._atDesk = false;
  }
  p.acuity = p._cond.acuity;
  yield* waitForBay(sim, p);
}
export function* waitForBay(sim, p, seated = false) {
  sim.er.bayQ.push(p);
  p._bay = null; p._waiting = true;
  if (!seated) yield* sitDown(sim, p, ['er', 'lobby'], 'Waiting for a bay in Emergency', () => p._bay);
  yield until(() => p._bay, 320);
  const i = sim.er.bayQ.indexOf(p);
  if (i >= 0) sim.er.bayQ.splice(i, 1);
  p._waiting = false;
  releaseAll(p);
  sim.stats.recentWait = (sim.stats.recentWait ?? 0) * 0.7 + (sim.now - p._arrivedAt) * 0.3;
  if (!p._bay) {
    p.task = 'Decided to go home and see their own doctor';
    p.anim = 'idle';
    yield* goOutside(sim, p);
    return;
  }
  const bed = p._bay;
  p.task = `Going to ${bed.id}`;
  yield* go(sim, p, bedTarget(bed));
  settleInBed(sim, p, bed);
  yield* erStay(sim, p, bed);
}
export function assignBays(sim) {
  const q = sim.er.bayQ;
  if (!q.length) return;
  q.sort((a, b) => a.acuity - b.acuity || a._arrivedAt - b._arrivedAt);
  for (const p of q) {
    if (p._bay) continue;
    const bed = reserveBed(sim, 'er', p);
    if (!bed) return;
    p._bay = bed;
    if (p.acuity <= 2) say(sim, 'Bed', 'Triage', `${bed.id} is free. ${p.display} goes in first, ${lowerFirst(p.reason)}.`, 'handoff', 'er');
  }
}

// ── Emergency department ────────────────────────────────────────────────────
function requestDoctor(sim, p, bed) {
  // Ward doctors are a lift ride away, so they only come down when both Emergency doctors are truly stuck.
  postJob(sim, {
    role: 'doctor', zone: 'er', pri: 6 - (p.acuity ?? 3), exclusive: 15,
    run: function* (d) {
      let done = false;
      try {
        if (!p.alive || p.bedId !== bed.id) { done = true; return; }
        const s = bedSpot(bed, d);
        d.task = `On the way to ${p.display}`;
        yield* go(sim, d, s, { speed: p.acuity <= 2 ? 2.2 : 1.7 });
        if (p.alive && p.bedId === bed.id) {
          faceBed(d, bed);
          d.anim = 'work'; d.task = `Examining ${p.display}`;
          showBubble(sim, p, 'heart', 3);
          yield sim.rng.range(3.5, 6);
          p._seen = true;
        }
        done = true;
      } finally { if (!done && p.alive && !p._seen && !p._rush) requestDoctor(sim, p, bed); }
    },
  });
}
export function* erStay(sim, p, bed) {
  const c = p._cond, { rng } = sim;
  p.task = 'Waiting for the doctor';
  if (!p._seen) requestDoctor(sim, p, bed);
  yield until(() => p._seen || p._rush, 60);
  // Imaging is a 30 metre walk, and at one metre a minute no bay can wait for that. Nobody keeps a bay for a scan.
  let scan = p._rush ? null : c.scan;
  if (scan && c.walks && !p._trend) { yield* walkToScan(sim, p, scan); return; }
  if (scan === 'XRAY') {
    p.task = 'Having a bedside X-ray';
    yield until(() => p._rush, rng.range(5, 8));
    scan = null;
  }
  p.task = 'Being treated';
  yield until(() => p._rush, rng.range(10, 18) * (c.acuity <= 2 ? 1.3 : 1));
  if (c.surgery && !p._gotSurgery) {
    const th = [...sim.beds.values()].find((b) => b.kind === 'or' && b.status === 'free' && !b._busy);
    if (th) { p._gotSurgery = true; yield* emergencySurgery(sim, p, bed, th); return; }
  }
  if (rng.chance(c.admit)) yield* admit(sim, p, scan);
  else if (scan && pickScanner(sim, scan)) yield* scanThenWalk(sim, p, scan);
  else {
    if (c.walks) vacate(sim, p, false);
    yield* goHome(sim, p);
  }
}
/** Back in a chair after a scan: the results decide whether this is the way home or a bed upstairs. */
function* awaitResults(sim, p) {
  yield* sitDown(sim, p, ['er', 'lobby'], 'Waiting for results');
  yield sim.rng.range(5, 9);
  showBubble(sim, p, 'chat', 3);
  if (sim.rng.chance(p._cond.admit)) yield* admit(sim, p); else yield* goHome(sim, p);
}
export function* goHome(sim, p) {
  logDischarge(sim, p);
  vacate(sim, p);
  releaseAll(p);
  p.y = 0; p.anim = 'idle'; p.status = 'ok'; p.bubble = null; p._away = false;
  p.task = 'Going home';
  showBubble(sim, p, 'heart', 5);
  yield* go(sim, p, sim.world.entry.inside, { speed: SPEED.hobble });
  yield* goOutside(sim, p, SPEED.hobble);
}
export function* admit(sim, p, scan = null) {
  const c = p._cond, wantIcu = sim.rng.chance(c.icu ?? 0);
  p.task = 'Waiting for a bed upstairs';
  say(sim, 'Triage', 'Bed', `${p.display} needs ${wantIcu ? 'an ICU' : 'a ward'} bed.`, 'request', 'er');
  let bed = null;
  for (let tries = 0; tries < 80 && !bed; tries++) {
    bed = reserveBed(sim, wantIcu ? 'icu' : 'ward', p) ?? (tries > 6 ? reserveBed(sim, wantIcu ? 'ward' : 'icu', p) : null);
    if (!bed) yield 3;
  }
  if (!bed) { yield* goHome(sim, p); return; }
  sim.stats.admissions++;
  say(sim, 'Bed', 'Triage', wantIcu && bed.kind === 'icu' ? `I'm holding ${bed.id} for your priority ${p.acuity} patient.` : `${bed.id} is ready for ${p.display}.`, 'ack', bed.roomId);
  say(sim, 'Bed', 'Staffing', `Moving ${p.display} up to ${bed.id}. Can I have a porter?`, 'request', bed.roomId);
  const task = `Being moved to ${sim.rooms.get(bed.roomId).name}`;
  p.task = task;
  yield* transfer(sim, p, bedTarget(bed), {
    pri: p.acuity <= 2 ? 3 : 2, label: bed.id, onPickup: () => vacate(sim, p),
    via: scan && pickScanner(sim, scan) ? viaImaging(sim, p, scan, task) : null,
  });
  settleInBed(sim, p, bed);
  sim.emit('arrival', { actorId: p.id, kind: 'admission', roomId: bed.roomId, bedId: bed.id, text: `${p.display} is settled in ${bed.id}` });
  if (c.ward) p.reason = c.ward;
  p.status = 'ok';
  p._stayUntil = sim.now + sim.rng.range(300, 1100);
  p.task = 'Settling in';
  yield* inpatientLife(sim, p);
}
export function* dischargeInpatient(sim, p) {
  p.task = 'Getting ready to go home';
  say(sim, 'Bed', 'Staffing', `${p.display} in ${p.bedId} is cleared to go home. Booking the clean.`, 'handoff', p.roomId);
  yield sim.rng.range(1.5, 3);
  yield* goHome(sim, p);
}
export function* stepDown(sim, p) {
  const bed = reserveBed(sim, 'ward', p);
  if (!bed) return;
  say(sim, 'Bed', 'Staffing', `${p.display} is well enough to leave ICU. ${bed.id} is ready.`, 'handoff', bed.roomId);
  p.task = `Being moved to ${sim.rooms.get(bed.roomId).name}`;
  yield* transfer(sim, p, bedTarget(bed), { label: bed.id, onPickup: () => vacate(sim, p) });
  settleInBed(sim, p, bed);
  p.reason = p._cond.ward ?? 'Recovering after intensive care';
  p._cond = { ...p._cond, vent: false, risk: 1 };
  p._stayUntil = sim.now + sim.rng.range(300, 900);
  p.task = 'Settling in';
}

// ── Imaging ─────────────────────────────────────────────────────────────────
const SCANNERS = { XRAY: 'xray', CT: 'ct', MRI: 'mri' };
function pickScanner(sim, kind) {
  const type = SCANNERS[kind];
  const eq = [...sim.equipment.values()].find((e) => e.type === type);
  if (eq && eq.status !== 'fault' && eq.status !== 'maintenance') return { eq, kind };
  if (kind === 'MRI') {
    const ct = [...sim.equipment.values()].find((e) => e.type === 'ct' && e.status !== 'fault' && e.status !== 'maintenance');
    if (ct) return { eq: ct, kind: 'CT', rerouted: true };
  }
  return null;
}
/** Waits for the machine, moving a broken MRI's booking to CT. Returns the booking, or null if there is no scan to be had. */
function* bookScanner(sim, p, kind, patience = 70) {
  const first = pickScanner(sim, kind);
  if (!first) return null;
  p.task = `Waiting for ${SCAN_NAME[first.kind]}`;
  let eq = null, used = first;
  yield until(() => {
    used = pickScanner(sim, kind);
    if (used && !used.eq._by) { eq = used.eq; return true; }
    return p._rush;
  }, patience);
  if (!eq) return null;
  eq._by = p.id;
  if (used.rerouted) say(sim, 'Imaging', 'Triage', `MRI is down, so ${p.display} goes to ${eq.id} instead.`, 'handoff', 'radiology');
  else if (p.acuity <= 2) say(sim, 'Imaging', 'Triage', `${eq.id} is clear. Bring ${p.display} now.`, 'handoff', 'radiology');
  return { eq, kind: used.kind };
}
function* scanOnTable(sim, p, { eq, kind }, table) {
  p.heading = table.heading; p.anim = 'lie'; p.y = LIE_Y;
  eq.status = 'in-use';
  p.task = `Having ${SCAN_NAME[kind]}`;
  const tech = sim.staff.imaging.find((t) => !t._busy && !t._puppet);
  if (tech) { tech._busy = true; tech.task = `Scanning ${p.display}`; }
  const faulted = yield until(() => eq.status === 'fault', sim.rng.range(8, 13));
  if (tech) tech._busy = false;
  if (eq.status === 'in-use') eq.status = 'idle';
  if (faulted) { p.task = 'Scan stopped'; sim.reroutes = (sim.reroutes ?? 0) + 1; }
}
const freeScanner = (eq) => { eq._by = null; if (eq.status === 'in-use') eq.status = 'idle'; };

/** On foot: the bay goes to the next patient with just a fresh sheet, this one waits at Imaging, and the machine is held only once it is theirs. */
export function* walkToScan(sim, p, kind) {
  vacate(sim, p, false);
  p.y = 0; p.anim = 'idle'; p._away = false;
  yield* sitDown(sim, p, ['radiology'], `Waiting for ${SCAN_NAME[kind]}`);
  const booked = yield* bookScanner(sim, p, kind);
  releaseAll(p);
  if (booked) {
    const table = tableSpot(booked.eq);
    try {
      p.task = `Going in for ${SCAN_NAME[booked.kind]}`;
      yield* go(sim, p, table, { speed: SPEED.stroll });
      yield* scanOnTable(sim, p, booked, table);
    } finally { freeScanner(booked.eq); }
    p.y = 0; p.anim = 'idle';
  }
  yield* awaitResults(sim, p);
}
/**
 * On a trolley, as a stop on the way to wherever they are going next. The bay is free the moment they leave it, and the porter
 * stays with them through Imaging: they wait outside together and the machine is held only once it is theirs.
 */
function viaImaging(sim, p, kind, after) {
  return function* (porter) {
    p.task = `Going for ${SCAN_NAME[kind]}`;
    yield* go(sim, p, standIn(sim, 'radiology'), WHEELED);
    const booked = yield* bookScanner(sim, p, kind, 30);
    if (booked) {
      const table = tableSpot(booked.eq);
      try {
        p.task = `Going in for ${SCAN_NAME[booked.kind]}`;
        yield* go(sim, p, table, WHEELED);
        const wheeling = porter?.task;
        if (porter) { detach(porter); porter.task = `Waiting with ${p.display}`; }
        yield* scanOnTable(sim, p, booked, table);
        if (porter) { attach(porter, p, 1.25, 'push'); porter.task = wheeling; }
      } finally { freeScanner(booked.eq); }
    }
    p.task = after;
  };
}
/** Came in on a trolley but does not need a bed: scanned, then up and walking back for the results. */
function* scanThenWalk(sim, p, kind) {
  p.task = 'Waiting for a porter';
  yield* transfer(sim, p, standIn(sim, 'radiology'), { label: 'Imaging', onPickup: () => vacate(sim, p), via: viaImaging(sim, p, kind, 'Up and walking again') });
  p.y = 0; p.anim = 'idle'; p._away = false;
  yield* awaitResults(sim, p);
}

// ── Theatres ────────────────────────────────────────────────────────────────
function teamJob(sim, s, a, where, task) {
  return function* (m = a) {
    m._locked = true;
    const scrub = sim.world.uses.find((u) => u.prop === 'scrubSink' && u.roomId === s.bed.roomId && !u.by);
    if (scrub && !s.started) {
      claim(m, scrub);
      m.task = 'Scrubbing in';
      yield* go(sim, m, scrub);
      m.heading = scrub.heading; m.anim = 'work';
      yield sim.rng.range(1.5, 2.5);
      release(m, scrub);
    }
    const spot = where(m);
    claim(m, spot);
    m.task = 'Heading to the table';
    yield* go(sim, m, spot);
    faceBed(m, s.bed);
    m.anim = 'work'; m.task = task; s.team++;
    yield until(() => s.done, 240);
  };
}
function callTeam(sim, s) {
  const { bed, p } = s, cart = sim.world.uses.find((u) => u.prop === 'anesthesiaCart' && u.roomId === bed.roomId);
  postJob(sim, { role: 'surgeon', pri: 5, run: teamJob(sim, s, null, () => bed._use, `Operating on ${p.display}`) });
  postJob(sim, { role: 'tech', zone: 'or', pri: 5, run: teamJob(sim, s, null, () => cart ?? bed._foot, `Keeping ${p.display} safely asleep`) });
  postJob(sim, { role: 'nurse', zone: 'or', pri: 5, run: teamJob(sim, s, null, () => bed._use2, `Assisting in theatre`) });
}
export function* operate(sim, s, op) {
  const { bed, p } = s;
  s.done = false; s.team = 0;
  callTeam(sim, s);
  p.task = `Waiting for the surgical team`;
  yield until(() => s.team >= 2, 30);
  s.started = true;
  p.task = `In surgery: ${op}`;
  sim.emit('moment', { text: `Surgery under way in ${sim.rooms.get(bed.roomId).name}: ${op}`, roomId: bed.roomId, bedId: bed.id });
  yield sim.rng.range(30, 55);
  s.done = true;
  p.reason = `Recovering from ${op}`;
  p._cond = { ...p._cond, preop: null };
  p._base = { ...BASE_VITALS, hr: 84, sys: 116 };
}
function* intoRecovery(sim, p, orBed, home) {
  p.task = 'Waking up, going to recovery';
  yield 3;
  let bed = home;
  if (!bed) {
    for (let i = 0; i < 40 && !bed; i++) { bed = reserveBed(sim, 'ward', p) ?? reserveBed(sim, 'icu', p); if (!bed) yield 4; }
  }
  orBed._busy = false;
  if (!bed) { yield* goHome(sim, p); return; }
  yield* transfer(sim, p, bedTarget(bed), { label: bed.id, pri: 3, onPickup: () => vacate(sim, p) });
  settleInBed(sim, p, bed);
  p._stayUntil = sim.now + sim.rng.range(240, 800);
  p.status = 'ok';
  p.task = 'Recovering';
}
export function* electiveSurgery(sim, p, orBed) {
  const home = sim.beds.get(p.bedId), op = p._cond.preop ?? 'planned surgery';
  say(sim, 'Bed', 'Staffing', `${p.display} is ready for theatre. Holding ${home.id} for the return.`, 'handoff', orBed.roomId);
  p.task = `Going to theatre for a ${op}`;
  yield* transfer(sim, p, bedTarget(orBed), {
    label: sim.rooms.get(orBed.roomId).name, pri: 3,
    onPickup: () => { home.patientId = null; home.status = 'reserved'; home._for = p.id; home.alarm = null; clearVitals(home); p.bedId = null; },
  });
  settleInBed(sim, p, orBed);
  yield* operate(sim, { bed: orBed, p }, op);
  yield* intoRecovery(sim, p, orBed, home);
}
export function* emergencySurgery(sim, p, erBed, orBed) {
  orBed._busy = true; orBed.status = 'reserved'; orBed._for = p.id;
  const op = p._cond.surgery;
  say(sim, 'Bed', 'Staffing', `${sim.rooms.get(orBed.roomId).name} is ready. Sending ${p.display} up now.`, 'alert', orBed.roomId);
  p.task = `Rushing to theatre for ${op}`;
  yield* transfer(sim, p, bedTarget(orBed), { label: sim.rooms.get(orBed.roomId).name, pri: 6, onPickup: () => vacate(sim, p) });
  settleInBed(sim, p, orBed);
  yield* operate(sim, { bed: orBed, p }, op);
  yield* intoRecovery(sim, p, orBed, null);
}
export function bootSurgery(sim, orBed, p, op, team) {
  orBed._busy = true;
  settleInBed(sim, p, orBed);
  p._v = { ...p._base };
  publishVitals(orBed, p._v);
  const s = { bed: orBed, p, done: false, team: team.length, started: true };
  for (const m of team) {
    const spot = m._theatre;
    claim(m, spot);
    m.x = spot.x; m.z = spot.z; m.floor = spot.floor;
    faceBed(m, orBed);
    m.anim = 'work'; m.task = m.role === 'surgeon' ? `Operating on ${p.display}` : m.role === 'tech' ? `Keeping ${p.display} safely asleep` : 'Assisting in theatre';
    m._busy = true; m._locked = true;
    syncRoom(m);
    setLife(sim, m, (function* () {
      m._busy = true;
      yield until(() => s.done, 240);
      m._busy = false; m._locked = false;
      releaseAll(m);
      yield* staffLife(sim, m);
    })());
  }
  p.task = `In surgery: ${op}`;
  setLife(sim, p, (function* () {
    yield sim.rng.range(26, 34);
    s.done = true;
    p.reason = `Recovering from ${op}`;
    p._base = { ...BASE_VITALS, hr: 84, sys: 116 };
    yield* intoRecovery(sim, p, orBed, null);
    yield* inpatientLife(sim, p);
  })());
}
function startElective(sim, bed) {
  const pool = [];
  for (const a of sim.actors) if (a.kind === 'patient' && a._cond.preop && !a._booked && inBed(a) && !a._trend) pool.push(a);
  if (!pool.length) return false;
  const p = sim.rng.pick(pool);
  p._booked = true;
  bed._busy = true; bed.status = 'reserved'; bed._for = p.id;
  p._order = () => electiveSurgery(sim, p, bed);
  return true;
}

// ── Ambulances ──────────────────────────────────────────────────────────────
function makeCrew(sim, x, z, task) {
  const id = sim.names();
  const a = addActor(sim, { kind: 'staff', role: 'paramedic', name: id.name, gender: id.g, display: `Paramedic ${id.first}`, x, z, floor: 0, task });
  a._crew = true; a._puppet = true; a._busy = true;
  return a;
}
const rearOf = (v, back) => ({ x: v.x - Math.sin(v.heading) * back, z: v.z - Math.cos(v.heading) * back });

export function* ambulanceTrip(sim, o = {}) {
  const { rng, tracks, amb, world } = sim;
  let slot = -1;
  yield until(() => { slot = amb.slots.indexOf(null); return slot >= 0 && roomFor(sim, 3); }, 200);
  if (slot < 0 || !roomFor(sim, 3)) return;
  const num = ++amb.count;
  const v = addVehicle(sim, 'ambulance', `Ambulance ${num}`);
  amb.slots[slot] = v.id;
  const cond = o.cond ?? rng.pick(AMBULANCE);
  const p = makePatient(sim, cond, { x: -8, z: 37, hidden: true, task: 'On the way in by ambulance' });
  p._enRoute = true; p._puppet = true;
  p.status = cond.triage === 'red' ? 'critical' : cond.acuity <= 2 ? 'watch' : 'ok';
  v.lights = true;
  const speed = 8.5, etaMin = Math.round((tracks.ambIn.len + 8) / speed);
  v.eta = etaMin;
  const tag = cond.triage ? `${cond.triage} tag` : `priority ${cond.acuity}`;
  say(sim, 'Triage', 'Bed', `${v.label} is ${etaMin} minutes out with ${p.display}, ${lowerFirst(cond.reason)}. I need a bay.`, 'request', 'er');
  let bed = reserveBed(sim, 'er', p);
  if (bed) say(sim, 'Bed', 'Triage', `${bed.id} is yours for the incoming ${tag}.`, 'ack', 'er');
  else say(sim, 'Bed', 'Triage', `Emergency is full. Clearing the next bay for ${v.label}.`, 'ack', 'er');
  sim.emit('moment', { text: `${v.label} is on its way in with ${p.display}`, roomId: 'er', bedId: bed?.id });
  const al = cond.acuity <= 2 ? raise(sim, { severity: 'info', title: `${v.label} arriving with ${p.display}`, detail: `${cond.reason}. About ${etaMin} minutes away.`, roomId: 'er', bedId: bed?.id, actorId: p.id, soft: true }) : null;

  drive(v, tracks.ambIn, { speed, v0: speed, fadeIn: true, to: slot === 0 ? tracks.ambIn.len : tracks.holdS });
  const t0 = sim.now;
  yield until(() => { v.eta = Math.max(0, Math.round(etaMin - (sim.now - t0))); return !v._moving; }, 40);
  if (slot === 0) {
    drive(v, tracks.ambBack, { speed: 2.4, snap: false });
    yield until(() => !v._moving, 20);
  }
  v.eta = undefined;
  yield 0.7;
  v.doors = true;
  yield 1;
  const spawnAt = rearOf(v, 1.1), g = sim.grids[0];
  const start = g.free(spawnAt.x, spawnAt.z) ? spawnAt : g.point(spawnAt.x, spawnAt.z);
  const crew = [makeCrew(sim, start.x, start.z, `Bringing ${p.display} in`), makeCrew(sim, start.x, start.z, `Bringing ${p.display} in`)];
  p.x = start.x; p.z = start.z; p.floor = 0; p.y = LIE_Y; p.anim = 'lie'; p.heading = v.heading + Math.PI; p.hidden = false; p._enRoute = false;
  syncRoom(p);
  sim.stats.moves.push(sim.now);
  sim.emit('arrival', { actorId: p.id, kind: 'ambulance', roomId: 'er', bedId: bed?.id, text: `${v.label} has arrived with ${p.display}` });
  attach(crew[0], p, 1.25, 'push');
  attach(crew[1], p, 2.1, 'walk');
  // Meet them at the doors, because it reads beautifully and it is what a real team does.
  const meet = sim.staff.erNurses.find((n) => !n._busy && !n._puppet);
  if (meet) setMeet(sim, meet, p);
  if (!bed) {
    p.task = 'Waiting on the trolley for a bay';
    const hold = standIn(sim, 'er');
    yield* go(sim, p, hold, { speed: SPEED.push, anim: 'lie', gurney: true });
    yield until(() => (bed = reserveBed(sim, 'er', p)), 45);
  }
  resolveAlert(sim, al);
  if (bed) {
    p.task = `Being wheeled to ${bed.id}`;
    yield* go(sim, p, bedTarget(bed), { speed: SPEED.push * 1.25, anim: 'lie', gurney: true });
    for (const c of crew) detach(c);
    settleInBed(sim, p, bed);
    p.task = 'Being handed over to the team';
    crew[0].anim = 'talk'; crew[0].task = `Handing over ${p.display}`;
    faceTo(crew[0], bed.x, bed.z);
    showBubble(sim, crew[0], 'chat', 2);
    yield 2;
    p._puppet = false;
    p._arrivedAt = sim.now;
    setLife(sim, p, erStay(sim, p, bed));
  } else {
    for (const c of crew) detach(c);
    p.y = 0; p.anim = 'idle'; p._puppet = false;
    p._arrivedAt = sim.now;
    setLife(sim, p, waitForBay(sim, p));
  }
  crew.forEach((c) => { c.task = `Heading back to ${v.label}`; });
  const back = rearOf(v, 1.1);
  const legs = crew.map((c) => spawn(sim, go(sim, c, { floor: 0, x: back.x, z: back.z, ax: back.x, az: back.z })));
  yield until(() => legs.every((l) => l.dead), 40);
  crew.forEach((c) => removeActor(sim, c));
  v.doors = false;
  yield 0.8;
  v.lights = false;
  if (slot === 0) drive(v, tracks.ambOut, { speed: 7.5, fadeOut: true });
  else drive(v, tracks.holdOut, { speed: 6.5, fadeOut: true });
  yield until(() => {
    if (amb.slots[slot] === v.id && v._s > 8) amb.slots[slot] = null;
    return !v._moving;
  }, 40);
  if (amb.slots[slot] === v.id) amb.slots[slot] = null;
  removeVehicle(sim, v);
}
function setMeet(sim, nurse, p) {
  postJob(sim, {
    role: 'nurse', zone: nurse._zone, pri: 4, exclusive: 8,
    run: function* (a) {
      a.task = `Meeting ${p.display} at the doors`;
      yield* go(sim, a, { floor: 0, ...sim.grids[0].point(36.4, 18.2) }, { speed: 2 });
      a.anim = 'idle'; faceTo(a, 38, 20);
      yield until(() => p.bedId || !p.alive, 14);
    },
  });
}

// ── Air ambulance ───────────────────────────────────────────────────────────
export function* helicopterTrip(sim, o = {}) {
  const { rng } = sim, { from, pad } = ROUTES.heli;
  if (sim.heliBusy || !roomFor(sim, 3)) return;
  sim.heliBusy = true;
  const v = addVehicle(sim, 'helicopter', 'Air Ambulance', { x: from.x, y: from.y, z: from.z, heading: Math.atan2(pad.x - from.x, pad.z - from.z) });
  v.lights = true; v.rotor = 1; v._rotorWant = 1;
  const cond = o.cond ?? rng.pick(AMBULANCE.filter((c) => c.acuity <= 2));
  const p = makePatient(sim, cond, { x: pad.x, z: pad.z, hidden: true, task: 'On the way in by helicopter' });
  p._enRoute = true; p._puppet = true; p.status = 'watch';
  let bed = reserveBed(sim, 'er', p);
  say(sim, 'Triage', 'Bed', `Air Ambulance is 14 minutes out with ${p.display}, ${lowerFirst(cond.reason)}.`, 'request', 'er');
  if (bed) say(sim, 'Bed', 'Triage', `${bed.id} is held for the helicopter patient.`, 'ack', 'er');
  sim.emit('moment', { text: `Air Ambulance is coming in with ${p.display}`, roomId: 'er', bedId: bed?.id });
  v.eta = 14;
  // The on-site crew head out to the pad as the helicopter comes in.
  const crew = sim.staff.paramedics.filter((c) => !c._puppet && !c._busy).slice(0, 2);
  const padSide = sim.grids[0].point(pad.x - 3.2, pad.z + 3.4);
  for (const c of crew) {
    take(sim, c);
    c._busy = true; c.task = 'Running out to the helipad';
    c._proc = spawn(sim, go(sim, c, { floor: 0, ...padSide }, { speed: 2.6 }));
  }
  flyTo(v, { x: pad.x, y: 11, z: pad.z }, 11);
  yield 11;
  flyTo(v, { x: pad.x, y: pad.y, z: pad.z }, 4);
  yield 4;
  v.eta = undefined;
  v._rotorWant = 0.35;
  v.doors = true;
  sim.emit('arrival', { actorId: p.id, kind: 'helicopter', roomId: 'er', text: `Air Ambulance has landed with ${p.display}` });
  yield 1.2;
  const crewNow = [...crew];
  while (crewNow.length < 2) crewNow.push(makeCrew(sim, padSide.x, padSide.z, 'Bringing the patient in'));
  p.x = padSide.x; p.z = padSide.z; p.floor = 0; p.y = LIE_Y; p.anim = 'lie'; p.hidden = false; p._enRoute = false;
  syncRoom(p);
  sim.stats.moves.push(sim.now);
  attach(crewNow[0], p, 1.25, 'push');
  attach(crewNow[1], p, 2.1, 'walk');
  p.task = 'Being rushed to Emergency';
  if (!bed) yield* go(sim, p, sim.world.ambulanceDoor, { speed: SPEED.push * 1.4, anim: 'lie', gurney: true });
  if (!bed) yield until(() => (bed = reserveBed(sim, 'er', p)), 40);
  if (bed) {
    yield* go(sim, p, bedTarget(bed), { speed: SPEED.push * 1.4, anim: 'lie', gurney: true });
    for (const c of crewNow) detach(c);
    settleInBed(sim, p, bed);
    yield 2;
    p._puppet = false; p._arrivedAt = sim.now;
    setLife(sim, p, erStay(sim, p, bed));
  } else {
    for (const c of crewNow) detach(c);
    p.y = 0; p.anim = 'idle'; p._puppet = false; p._arrivedAt = sim.now;
    setLife(sim, p, waitForBay(sim, p));
  }
  for (const c of crewNow) {
    if (c._crew) removeActor(sim, c);
    else { c._busy = false; setLife(sim, c, staffLife(sim, c)); }
  }
  v.doors = false;
  v._rotorWant = 1;
  yield 3;
  flyTo(v, { x: pad.x, y: 14, z: pad.z }, 5);
  yield 5;
  flyTo(v, { x: from.x, y: from.y, z: from.z }, 12);
  yield 12;
  removeVehicle(sim, v);
  sim.heliBusy = false;
}

// ── Cars ────────────────────────────────────────────────────────────────────
export function* carTrip(sim, o = {}) {
  const { tracks } = sim;
  sim.carsComing++;
  const v = addVehicle(sim, 'car', 'Car');
  drive(v, tracks.drop, { speed: 7, v0: 7, to: tracks.dropS, fadeIn: true });
  yield until(() => !v._moving, 40);
  v.doors = true;
  yield 0.8;
  const kerb = sim.grids[0].point(v.x, v.z - 1.3) ?? sim.world.kerb;
  if (o.passenger && roomFor(sim)) spawnWalkIn(sim, kerb);
  else if (o.visitor && roomFor(sim)) spawnVisitor(sim, kerb);
  yield 1;
  const boarding = sim.kerbQ.splice(0, 3);
  for (const a of boarding) a.hidden = true;
  yield 0.6;
  for (const a of boarding) removeActor(sim, a);
  v.doors = false;
  yield 0.5;
  drive(v, tracks.drop, { from: tracks.dropS, speed: 7.5, snap: false, fadeOut: true });
  sim.carsComing--;
  yield until(() => !v._moving, 40);
  removeVehicle(sim, v);
}
export function spawnVisitor(sim, at) {
  const id = sim.names();
  const v = addActor(sim, { kind: 'visitor', role: 'visitor', name: id.name, gender: id.g, x: at.x, z: at.z, floor: 0, task: 'Arriving to visit' });
  setLife(sim, v, visitorLife(sim, v));
  return v;
}

// ── Engineers ───────────────────────────────────────────────────────────────
export function* engineerVisit(sim, eq, o = {}) {
  if (!roomFor(sim)) { yield 30; eq._booked = false; return; }
  const id = sim.names();
  const end = sim.rng.pick(sim.world.plazaEnds);
  const a = addActor(sim, { kind: 'staff', role: 'tech', name: id.name, gender: id.g, display: `Engineer ${id.first}`, x: end.x, z: end.z, floor: 0, task: `Coming in to look at ${eq.name}` });
  a._crew = true; a._puppet = true; a._busy = true;
  if (o.delay) yield o.delay;
  say(sim, 'Facilities', 'Imaging', `${a.display} is on site for ${eq.id}. ${o.reason === 'routine service' ? 'Routine service, about 40 minutes.' : 'Repair under way.'}`, 'ack', eq.roomId);
  if (eq.status !== 'fault') { eq.status = 'maintenance'; eq.note = 'Being serviced by the engineer right now.'; }
  yield* go(sim, a, sim.world.entry.outside);
  yield* go(sim, a, eq._spot ?? { floor: eq._item.floor, x: eq._item.x + 1.5, z: eq._item.z + 1.5 });
  a.anim = 'work'; a.task = `Working on ${eq.name}`;
  if (eq.status === 'fault') { eq.status = 'maintenance'; eq.note = 'Engineer on site, replacing the failed part.'; }
  showBubble(sim, a, 'chat', 3);
  yield o.mins ?? sim.rng.range(26, 40);
  eq.status = 'idle'; eq.health = 0.97; eq._booked = false;
  eq.note = noteFor(eq);
  say(sim, 'Facilities', 'Imaging', `${eq.id} is back in service.`, 'ack', eq.roomId);
  if (o.onDone) o.onDone();
  a.task = 'All done, heading out';
  yield* go(sim, a, sim.world.entry.inside);
  yield* go(sim, a, sim.world.entry.outside);
  yield* go(sim, a, sim.rng.pick(sim.world.plazaEnds));
  removeActor(sim, a);
}

// ── The minute beat that keeps the building moving ──────────────────────────
const dayCurve = (h) => Math.max(0.35, 0.8 + 0.24 * Math.sin(((h - 9) / 24) * Math.PI * 2));

// Five bays turn over about six patients an hour while the wards have room. With the helicopter these gaps peak just over five,
// so a normal afternoon queues a little and clears. Much faster and the wait grows without limit, which is what a surge is for.
const WALK_IN_GAP = 16;
const AMBULANCE_GAP = [38, 62];

export function minuteFlows(sim) {
  const { rng, next, rates, now } = sim, h = (sim.clock / 60) % 24, day = dayCurve(h), M = sim.metrics;
  assignBays(sim);
  if (now >= next.walkIn) {
    next.walkIn = now + rng.exp(WALK_IN_GAP / (day * rates.walkIn));
    // Walk-ins stop short of the actor cap, so there is always room for an ambulance and its crew.
    if (roomFor(sim, 6)) {
      if (rng.chance(0.55) && sim.carsComing < 3) sim.startProc(carTrip(sim, { passenger: true }));
      else spawnWalkIn(sim, rng.pick(sim.world.plazaEnds));
    }
  }
  if (now >= next.ambulance) {
    next.ambulance = now + rng.range(...AMBULANCE_GAP) / (rates.ambulance * Math.max(0.6, day));
    if (roomFor(sim, 4)) sim.startProc(ambulanceTrip(sim));
  }
  if (now >= next.heli) {
    next.heli = now + rng.range(170, 300);
    sim.startProc(helicopterTrip(sim));
  }
  if (now >= next.visitor) {
    next.visitor = now + rng.exp(10 / rates.visitor) + 2;
    const open = h >= 8 && h < 20.5 && !sim.surge;
    const visitors = sim.actors.reduce((n, a) => n + (a.kind === 'visitor' ? 1 : 0), 0);
    if (open && visitors < 9 && roomFor(sim, 6)) {
      if (rng.chance(0.5) && sim.carsComing < 3) sim.startProc(carTrip(sim, { visitor: true }));
      else spawnVisitor(sim, rng.pick(sim.world.plazaEnds));
    }
  }
  if (now >= next.east) { next.east = now + rng.range(4, 9) / Math.max(0.5, day); sim.startProc(trafficCar(sim, sim.tracks.east)); }
  if (now >= next.west) { next.west = now + rng.range(4, 10) / Math.max(0.5, day); sim.startProc(trafficCar(sim, sim.tracks.west)); }
  if (sim.kerbQ.length && sim.carsComing === 0) sim.startProc(carTrip(sim));

  // Elective lists run through the working day; emergencies do not wait for office hours.
  if (now >= next.elective && h >= 7.5 && h < 19 && !sim.surge) {
    next.elective = now + rng.range(25, 60);
    const th = [...sim.beds.values()].filter((b) => b.kind === 'or' && b.status === 'free' && !b._busy);
    if (th.length) startElective(sim, rng.pick(th));
  }

  // Beds: hold the building around a healthy occupancy. Discharges run ahead of schedule when it fills and pause when it empties.
  if (now >= next.discharge) {
    next.discharge = now + 4;
    const beds = [...sim.beds.values()].filter((b) => b.kind === 'ward' && b._for !== 'surge');
    const occ = beds.filter((b) => b.status === 'occupied' || b.status === 'reserved').length / Math.max(1, beds.length);
    // In a surge routine discharges hold off until the wards are nearly full, then anyone ready to go makes way. Occupancy moves in
    // fourteenths of a ward: 0.82 starts forcing discharges at the thirteenth bed, and anything from 0.74 to 0.81 at the twelfth, which
    // floods the cleaners and porters and brings the Emergency wait spikes back.
    const target = sim.surge ? 0.97 : 0.82, floor = sim.surge ? 0.93 : 0.58;
    const pool = [];
    for (const b of beds) {
      const p = b.patientId && sim.byId.get(b.patientId);
      if (p && !p._trend && !p._order && !p._booked && !p._cond.preop && inBed(p)) pool.push(p);
    }
    pool.sort((a, b) => a._stayUntil - b._stayUntil);
    const due = pool[0];
    if (due && (occ > target + 0.04 || (now > due._stayUntil && occ > floor))) due._order = () => dischargeInpatient(sim, due);
    const icu = [...sim.beds.values()].filter((b) => b.kind === 'icu');
    const icuOcc = icu.filter((b) => b.status !== 'free' && b.status !== 'cleaning').length / Math.max(1, icu.length);
    const down = icu.map((b) => b.patientId && sim.byId.get(b.patientId)).find((p) => p && inBed(p) && !p._trend && !p._order && now > p._stayUntil);
    if (down && (occ < 0.97 || icuOcc > 0.8) && M.bedsFree > 0) down._order = () => stepDown(sim, down);
  }

  if (now >= next.stock) {
    next.stock = now + 7;
    const low = Object.entries(sim.stock).find(([, v]) => v < 0.45);
    if (low && !sim.stockRun) {
      const [roomId] = low;
      sim.stockRun = roomId;
      say(sim, 'Pharmacy', 'Bed', `${sim.rooms.get(roomId).name} is running low on medicines. Sending a restock up.`, 'handoff', roomId);
      postJob(sim, {
        role: 'pharmacist', pri: 2,
        run: function* (a) {
          const cart = sim.world.uses.find((u) => u.roomId === roomId && (u.prop === 'medCart' || u.prop === 'supplyCart')) ?? standIn(sim, roomId);
          a.task = `Taking medicines up to ${sim.rooms.get(roomId).name}`;
          showBubble(sim, a, 'pill', 30);
          try {
            yield* go(sim, a, cart);
            a.anim = 'work'; a.task = 'Restocking the medicine cart';
            yield sim.rng.range(3, 5);
            sim.stock[roomId] = 1;
            say(sim, 'Pharmacy', 'Bed', `${sim.rooms.get(roomId).name} is restocked.`, 'ack', roomId);
          } finally { a.bubble = null; sim.stockRun = null; }
        },
      });
    }
  }
  if (now >= next.chatter) {
    next.chatter = now + rng.range(8, 13);
    chatter(sim);
  }
}
function chatter(sim) {
  const { rng, metrics: m, er } = sim;
  const wait = er.triageQ.length + er.bayQ.length;
  const lines = [];
  if (wait >= 4) lines.push(() => say(sim, 'Triage', 'Staffing', `${wait} people are waiting in Emergency, about ${m.erWaitMin} minutes each. Can you keep the second doctor down here?`, 'request', 'er'));
  if (wait >= 4) lines.push(() => say(sim, 'Staffing', 'Triage', `Yes, holding both doctors in Emergency until the queue drops.`, 'ack', 'er'));
  if (wait < 4) lines.push(() => say(sim, 'Triage', 'Bed', `Only ${wait} waiting right now. Emergency is flowing well.`, 'ack', 'er'));
  lines.push(() => say(sim, 'Bed', 'Staffing', `${m.bedsFree} beds free of ${m.bedsTotal}. Occupancy is ${m.occupancyPct}%.`, 'ack'));
  lines.push(() => say(sim, 'Staffing', 'Bed', `${m.staffOnDuty} staff on duty and ${m.staffBusyPct}% are with patients.`, 'ack'));
  const worn = [...sim.equipment.values()].filter((e) => e.health < 0.72 && e.status !== 'fault').sort((a, b) => a.health - b.health)[0];
  if (worn) lines.push(() => say(sim, 'Facilities', 'Imaging', `${worn.name}: ${worn.note}`, 'ack', worn.roomId));
  const busyScan = [...sim.equipment.values()].find((e) => e._by);
  if (busyScan) lines.push(() => say(sim, 'Imaging', 'Triage', `${busyScan.name} is in use. Next slot is in about ${rng.int(6, 12)} minutes.`, 'ack', 'radiology'));
  const stockLow = Object.entries(sim.stock).sort((a, b) => a[1] - b[1])[0];
  if (stockLow) lines.push(() => say(sim, 'Pharmacy', 'Bed', `Medicine stock is lowest in ${sim.rooms.get(stockLow[0]).name}, ${Math.round(stockLow[1] * 100)}% left.`, 'ack', stockLow[0]));
  rng.pick(lines)();
}
