// The five stories a salesperson can trigger. Each one changes real rates and real people, and narrates itself through
// 'scenario', 'alert', 'moment' and the agent feed, so the tour can simply follow along.
import { SPEED, until, take, raise, resolveAlert, say, setLife, showBubble } from './core.js';
import { go, staffLife, bedSpot, faceBed, inBed, nurseLoop } from './life.js';
import { reserveBed, bedTarget, transfer, settleInBed, vacate, ambulanceTrip, helicopterTrip, engineerVisit, roomFor } from './flows.js';
import { publishVitals } from './clinical.js';
import { makeStaff } from './boot.js';
import { CASUALTIES, pronoun } from './data.js';

const moment = (sim, text, roomId, bedId) => sim.emit('moment', { text, roomId, bedId });
function announce(sim, name, phase, text, roomId, bedId) {
  sim.emit('scenario', { name, phase, text, roomId, bedId });
  if (phase === 'start' || phase === 'end') moment(sim, text, roomId, bedId);
}
const settleScenario = (sim) => { sim.scenario = sim.surge ? 'flu' : 'normal'; };

// Extra staff stay until the queue they came for has gone. Sending them all home at once is what made the wait spike after a surge.
function* standDown(sim, staff) {
  yield until(() => !sim.surge && sim.er.triageQ.length + sim.er.bayQ.length <= 2, 240);
  for (const a of staff) a._leaving = true;
}

function recall(sim, role, zone, n, label) {
  const made = [];
  for (let i = 0; i < n && roomFor(sim, 1); i++) {
    const end = sim.rng.pick(sim.world.plazaEnds);
    const a = makeStaff(sim, { role, zone, routine: role === 'nurse' ? nurseLoop : undefined }, { floor: 0, x: end.x, z: end.z });
    a._recalled = true; a._nextBreak = Infinity;
    const home = sim.grids[zone === 'er' ? 0 : 1];
    const room = zone === 'er' ? { x: 33 + i * 1.2, z: 17.5 } : { x: 14.6 + i, z: 12.4 };
    const p = home.point(room.x, room.z);
    a._post = { kind: 'stand', floor: zone === 'er' ? 0 : 1, x: p.x, z: p.z, ax: p.x, az: p.z };
    a.task = label;
    setLife(sim, a, staffLife(sim, a));
    made.push(a);
  }
  return made;
}
function openSurgeBeds(sim) {
  const beds = [...sim.beds.values()].filter((b) => b._surge && b.status === 'reserved' && b._for === 'surge');
  for (const b of beds) { b.status = 'free'; b._for = null; }
  return beds;
}
function closeSurgeBeds(sim) {
  for (const b of sim.beds.values()) {
    if (!b._surge) continue;
    if (b.status === 'free') { b.status = 'reserved'; b._for = 'surge'; } else if (b.status !== 'reserved') b._closing = true;
  }
}

// ── Flu ─────────────────────────────────────────────────────────────────────
function* fluResponse(sim, run) {
  const alive = () => sim.run === run;
  say(sim, 'Triage', 'Staffing', 'Walk-ins have tripled in the last hour, nearly all of it flu. I need more hands at the front.', 'alert', 'er');
  yield 2.5;
  if (!alive()) return;
  say(sim, 'Staffing', 'Triage', 'Calling in two nurses and a doctor. Twenty minutes out.', 'ack', 'er');
  sim.recalled.push(...recall(sim, 'nurse', 'er', 2, 'Called in for the surge'), ...recall(sim, 'doctor', 'er', 1, 'Called in for the surge'));
  const porter = recall(sim, 'porter', 'floor1', 1, 'Called in for the surge');
  sim.recalled.push(...porter);
  yield 4;
  if (!alive()) return;
  const beds = openSurgeBeds(sim);
  if (beds.length) {
    say(sim, 'Bed', 'Staffing', `Opening the surge beds, ${beds.map((b) => b.id).join(' and ')}. That is ${beds.length} more places on Ward C.`, 'handoff', 'ward_c');
    moment(sim, 'Surge beds are opening on Ward C', 'ward_c');
  }
  yield 5;
  if (!alive()) return;
  say(sim, 'Pharmacy', 'Bed', 'Antivirals and fluids are going up to every ward. Stock is fine for today.', 'ack');
  for (const k of Object.keys(sim.stock)) sim.stock[k] = Math.max(sim.stock[k], 0.6);
  yield 12;
  while (alive()) {
    const m = sim.metrics;
    say(sim, 'Triage', 'Bed', `${sim.er.triageQ.length + sim.er.bayQ.length} waiting and the wait is ${m.erWaitMin} minutes. How are the wards?`, 'request', 'er');
    yield 3;
    say(sim, 'Bed', 'Triage', m.bedsFree > 0 ? `${m.bedsFree} beds left. Speeding up discharges for anyone ready to go.` : 'Every bed is full. Prioritising the sickest, and asking doctors to review who can go home.', 'ack');
    yield 24;
  }
}
function startFlu(sim) {
  sim.scenario = 'flu'; sim.surge = true;
  sim.rates.walkIn = 3; sim.rates.ambulance = 1.3; sim.fluMix = 0.8;
  sim.next.walkIn = Math.min(sim.next.walkIn, sim.now + 0.5);
  sim.scenarioAlert = raise(sim, { severity: 'watch', title: 'Flu surge: walk-ins have tripled', detail: 'Emergency is filling up. Extra staff are on the way and surge beds are opening.', roomId: 'er' });
  announce(sim, 'flu', 'start', 'A flu surge has hit. Walk-ins have tripled.', 'er');
  sim.startProc(fluResponse(sim, sim.run));
}

// ── Code blue ───────────────────────────────────────────────────────────────
function responders(sim, bed) {
  const cost = (a) => Math.abs(a.x - bed.x) + Math.abs(a.z - bed.z) + (a.floor === bed.floor ? 0 : 30);
  const ready = (a) => a.alive && !a._puppet && !a._locked && !a._leader && !a.hidden && !a._fixed;
  const nurses = sim.actors.filter((a) => a.role === 'nurse' && ready(a)).sort((x, y) => cost(x) - cost(y));
  const doctors = sim.actors.filter((a) => a.role === 'doctor' && ready(a)).sort((x, y) => cost(x) - cost(y));
  return { nurses: nurses.slice(0, 2), doctor: doctors[0] ?? null };
}
const freeStaff = (sim, a) => { if (a.alive) { a.carrying = null; a._busy = false; setLife(sim, a, staffLife(sim, a)); } };

function* codeBlue(sim) {
  const { rng } = sim;
  const pool = [...sim.beds.values()].filter((b) => {
    const p = b.kind === 'ward' && b.patientId && sim.byId.get(b.patientId);
    return p && inBed(p) && !p._booked && !p._order;
  });
  if (!pool.length) { settleScenario(sim); return; }
  pool.sort((x, y) => (sim.byId.get(y.patientId)._cond.risk ?? 0) - (sim.byId.get(x.patientId)._cond.risk ?? 0));
  const bed = pool[rng.int(0, Math.min(2, pool.length - 1))], p = sim.byId.get(bed.patientId), pro = pronoun(p);
  p._trend = null;
  p._crash = { hr: 34, spo2: 68, sys: 54 };
  bed.alarm = 'critical'; p.status = 'critical';
  showBubble(sim, p, 'alert', 60);
  p.task = 'Medical emergency';
  if (p._alert) { resolveAlert(sim, p._alert); p._alert = null; }
  const al = raise(sim, {
    severity: 'critical', title: `Code blue: ${p.display} in ${bed.id} has collapsed`,
    detail: `${pro.His} heart has stopped beating properly. The crash team is running to ${bed.id}.`, roomId: bed.roomId, bedId: bed.id, actorId: p.id,
  });
  announce(sim, 'codeblue', 'start', `Code blue. ${p.display} has collapsed in ${bed.id}.`, bed.roomId, bed.id);
  say(sim, 'Staffing', 'Bed', `Code blue in ${bed.id}. Sending the nearest team now.`, 'alert', bed.roomId);
  const { nurses, doctor } = responders(sim, bed);
  const team = [...nurses, ...(doctor ? [doctor] : [])];
  team.forEach((a) => { take(sim, a); a._busy = true; });
  const cart = [...sim.equipment.values()].filter((e) => e.type === 'crashCart' && e._spot).sort((x, y) => Math.hypot(x._item.x - bed.x, x._item.z - bed.z) * (x._item.floor === bed.floor ? 1 : 3) - Math.hypot(y._item.x - bed.x, y._item.z - bed.z) * (y._item.floor === bed.floor ? 1 : 3))[0];
  let arrived = 0;
  const runner = function* (a, role) {
    const s = bedSpot(bed, a);
    a.task = `Running to ${bed.id}`;
    if (role === 'cart' && cart) {
      a.task = `Grabbing the crash cart`;
      yield* go(sim, a, cart._spot, { speed: SPEED.run });
      cart.status = 'in-use';
      a.carrying = 'crashCart';
      a.task = `Running to ${bed.id} with the crash cart`;
    }
    yield* go(sim, a, s, { speed: SPEED.run });
    faceBed(a, bed);
    a.anim = role === 'cpr' ? 'cpr' : 'work';
    a.task = role === 'cpr' ? `Doing CPR on ${p.display}` : role === 'cart' ? 'Getting the defibrillator ready' : `Leading the resuscitation of ${p.display}`;
    a.speed = 0; arrived++;
    yield until(() => sim.codeDone === bed.id, 60);
  };
  sim.codeDone = null;
  team.forEach((a, i) => { a._proc = sim.startProc(runner(a, i === 0 ? 'cpr' : a.role === 'doctor' ? 'lead' : 'cart')); });
  yield until(() => arrived >= 1, 26);
  moment(sim, `${team[0]?.display ?? 'The team'} has started CPR on ${p.display}`, bed.roomId, bed.id);
  al.detail = `CPR is under way. ${doctor ? `${doctor.display} is on the way.` : ''}`;
  yield until(() => arrived >= Math.max(1, team.length - 1), 22);
  // Two simulated minutes would be two seconds on screen. Slowing the clock keeps the time honest and the drama watchable.
  sim.dilate = 0.28;
  yield 2;
  sim.dilate = 1;
  p._crash = null;
  p._base = { ...p._base, hr: 96, spo2: 94, sys: 104, dia: 66 };
  bed.alarm = 'watch'; p.status = 'watch';
  publishVitals(bed, p._v);
  p.bubble = null;
  showBubble(sim, p, 'heart', 8);
  p.reason = 'Recovering after a cardiac arrest';
  p.acuity = 1;
  p._cond = { ...p._cond, risk: 0, ward: 'Recovering after a cardiac arrest', preop: null };
  sim.codeDone = bed.id;
  if (cart) cart.status = 'idle';
  resolveAlert(sim, al, `${doctor?.display ?? 'The team'} got ${pro.his} heart back into rhythm. ${pro.He} is stable and moving to intensive care.`);
  announce(sim, 'codeblue', 'stable', `${p.display} is stable. The team got ${pro.his} heart back.`, bed.roomId, bed.id);
  moment(sim, `${p.display} is stable. The team got ${pro.his} heart back.`, bed.roomId, bed.id);
  say(sim, 'Bed', 'Staffing', `${p.display} is back. I need an ICU bed for ${pro.him} now.`, 'request', bed.roomId);
  yield 1.5;
  team.forEach((a) => freeStaff(sim, a));
  const icu = reserveBed(sim, 'icu', p);
  if (icu) {
    say(sim, 'Bed', 'Staffing', `Holding ${icu.id}. Moving ${p.display} now.`, 'ack', 'icu');
    p._order = function* () {
      p.task = 'Being moved to intensive care';
      yield* transfer(sim, p, bedTarget(icu), { pri: 7, label: icu.id, onPickup: () => vacate(sim, p) });
      settleInBed(sim, p, icu);
      p.task = 'Being watched closely in intensive care';
      p._stayUntil = sim.now + rng.range(500, 1100);
      bedOk(p, icu);
      moment(sim, `${p.display} is settled in ${icu.id}`, 'icu', icu.id);
    };
  } else {
    say(sim, 'Bed', 'Staffing', `ICU is full. ${p.display} stays in ${bed.id} with a nurse alongside.`, 'ack', bed.roomId);
  }
  sim.scenarioEnd?.('codeblue');
  settleScenario(sim);
  announce(sim, 'codeblue', 'end', `Code blue over. ${p.display} survived.`, icu?.roomId ?? bed.roomId, icu?.id ?? bed.id);
}
const bedOk = (p, bed) => { bed.alarm = null; p.status = 'watch'; };

// ── Mass casualty ───────────────────────────────────────────────────────────
function* mci(sim, run) {
  const { rng } = sim, alive = () => sim.run === run;
  sim.scenario = 'mci'; sim.mciOn = true;
  const al = raise(sim, { severity: 'critical', title: 'Major incident: coach crash on the ring road', detail: 'Six casualties on the way by ambulance and helicopter. Emergency is clearing bays.', roomId: 'er' });
  sim.scenarioAlert = al;
  announce(sim, 'mci', 'start', 'Major incident. Six casualties are on the way.', 'er');
  say(sim, 'Triage', 'Bed', 'Major incident. Six casualties coming. Red tags first, I need every bay you can give me.', 'alert', 'er');
  for (const a of sim.actors) {
    if (a.kind === 'patient' && a.bedId && a.roomId === 'er' && (a.acuity ?? 3) >= 3) a._rush = true;
  }
  yield 2;
  if (!alive()) return;
  say(sim, 'Bed', 'Triage', 'Moving the walking wounded out of Emergency now. Bays free up in minutes.', 'ack', 'er');
  const th = [...sim.beds.values()].filter((b) => b.kind === 'or' && b.status === 'free' && !b._busy);
  if (th.length) {
    say(sim, 'Staffing', 'Bed', `${sim.rooms.get(th[0].roomId).name} is prepped and held for the first red tag.`, 'ack', th[0].roomId);
    moment(sim, `${sim.rooms.get(th[0].roomId).name} is being prepared for emergency surgery`, th[0].roomId);
  }
  sim.recalled.push(...recall(sim, 'nurse', 'er', 2, 'Called in for the major incident'), ...recall(sim, 'porter', 'floor0', 1, 'Called in for the major incident'));
  yield 3;
  const order = [CASUALTIES[1], CASUALTIES[2], CASUALTIES[4], CASUALTIES[3], CASUALTIES[5]];
  sim.startProc(helicopterTrip(sim, { cond: CASUALTIES[0] }));
  for (const cond of order) {
    if (!alive()) return;
    sim.startProc(ambulanceTrip(sim, { cond }));
    yield rng.range(6, 9);
  }
  yield 24;
  if (!alive()) return;
  resolveAlert(sim, al, 'All casualties are in and being treated.');
  sim.mciOn = false;
  sim.scenarioAlert = null;
  say(sim, 'Triage', 'Staffing', 'Last casualty is in a bay. Standing down the major incident.', 'ack', 'er');
  sim.scenarioEnd?.('mci');
  settleScenario(sim);
  if (!sim.surge) sim.startProc(standDown(sim, sim.recalled.splice(0)));
  announce(sim, 'mci', 'end', 'Major incident over. Everyone is being cared for.', 'er');
}

// ── MRI fault ───────────────────────────────────────────────────────────────
function* mriFault(sim) {
  const eq = [...sim.equipment.values()].find((e) => e.type === 'mri');
  if (!eq) { settleScenario(sim); return; }
  const ct = [...sim.equipment.values()].find((e) => e.type === 'ct');
  sim.scenario = 'mrifault';
  eq.status = 'fault'; eq.health = Math.min(eq.health, 0.2); eq._booked = true;
  eq.note = 'Stopped working: the cooling has failed. An engineer has been booked.';
  const al = raise(sim, { severity: 'watch', title: 'The MRI scanner has stopped working', detail: `Cooling failure. Scans are moving to ${ct?.name ?? 'the CT scanner'} while an engineer comes in.`, roomId: eq.roomId });
  announce(sim, 'mrifault', 'start', 'The MRI scanner has failed. Scans are being rerouted.', eq.roomId);
  say(sim, 'Imaging', 'Triage', `${eq.id} is down with a cooling fault. I'm moving every MRI booking to ${ct?.id ?? 'CT'}.`, 'alert', eq.roomId);
  yield 2;
  say(sim, 'Imaging', 'Facilities', `${eq.id} needs an engineer. Quench alarm is clear, cooling has stopped.`, 'request', eq.roomId);
  yield 2.5;
  say(sim, 'Facilities', 'Imaging', 'Repair booked. Engineer is 15 minutes away, parts are on the van.', 'ack', eq.roomId);
  let done = false;
  sim.startProc(engineerVisit(sim, eq, {
    delay: 6, mins: 24, reason: 'repair',
    onDone: () => { done = true; },
  }));
  yield until(() => done, 90);
  if (eq.status === 'fault') { eq.status = 'idle'; eq.health = 0.97; }
  resolveAlert(sim, al, 'Repaired and back in service.');
  say(sim, 'Imaging', 'Triage', `${eq.id} is taking bookings again.`, 'ack', eq.roomId);
  sim.scenarioEnd?.('mrifault');
  settleScenario(sim);
  announce(sim, 'mrifault', 'end', 'The MRI scanner is repaired and back in service.', eq.roomId);
}

// ── Back to normal ──────────────────────────────────────────────────────────
function toNormal(sim) {
  sim.surge = false; sim.mciOn = false;
  sim.rates.walkIn = 1; sim.rates.ambulance = 1; sim.fluMix = 0;
  closeSurgeBeds(sim);
  sim.startProc(standDown(sim, sim.recalled.splice(0)));
  resolveAlert(sim, sim.scenarioAlert, 'Back to normal.');
  sim.scenarioAlert = null;
  sim.scenario = 'normal';
  say(sim, 'Staffing', 'Bed', 'Standing down. Extra staff can head home once the queue has cleared.', 'ack');
  announce(sim, 'normal', 'start', 'Back to a normal day.', null);
}

export function runScenario(sim, name) {
  sim.recalled ??= [];
  sim.run = (sim.run ?? 0) + 1;
  const run = sim.run;
  switch (name) {
    case 'normal': toNormal(sim); break;
    case 'flu': if (!sim.surge) startFlu(sim); break;
    case 'codeblue': sim.scenario = 'codeblue'; sim.startProc(codeBlue(sim)); break;
    case 'mci': if (!sim.mciOn) sim.startProc(mci(sim, run)); break;
    case 'mrifault': sim.startProc(mriFault(sim)); break;
    default: break;
  }
  // A transient story must not cancel a flu surge already in progress, so that loop keeps its own token.
  if (sim.surge && name !== 'normal' && name !== 'flu') sim.run = run - 1;
}
