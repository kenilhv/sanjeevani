// A fresh load opens on a hospital mid-morning: staff at their posts, wards mostly full, a theatre running, people in the lobby,
// and within seconds an ambulance on the road. Everything here is deterministic, so the opening story is the same every time.
import { spawn, addActor, setLife, claim, postFeed, syncRoom } from './core.js';
import {
  staffLife, inpatientLife, standIn, nurseLoop, triageLoop, erDoctorLoop, wardDoctorLead, wardDoctorMate, surgeonLoop, receptionLoop, paramedicLoop,
  imagingLoop, labLoop, orStaffLoop, pharmacistLoop, porterLoop, cleanerLoop, pressCallButton, inBed, visitorLeaves,
} from './life.js';
import { makePatient, settleInBed, erStay, admit, afterSeated, waitForBay, bootSurgery, ambulanceTrip, carTrip } from './flows.js';
import { startEpisode, noteFor } from './clinical.js';
import { buildTracks, stepVehicles } from './vehicles.js';
import { WARD, ICU, WALK_INS, AMBULANCE } from './data.js';

const POST = (role, zone, rooms, props, routine, o = {}) => ({ role, zone, rooms, props, routine, ...o });
const ROSTER = [
  POST('reception', 'lobby', ['lobby'], ['receptionDesk'], receptionLoop, { fixed: true }),
  POST('reception', 'lobby', ['lobby'], ['receptionDesk'], receptionLoop, { fixed: true }),
  POST('nurse', 'triage', ['er'], ['triageDesk'], triageLoop, { fixed: true }),
  POST('nurse', 'er', ['er'], ['medCart', 'supplyCart'], nurseLoop, { list: 'erNurses' }),
  POST('nurse', 'er', ['er'], ['supplyCart', 'linenShelf'], nurseLoop, { list: 'erNurses' }),
  POST('nurse', 'ward_a', ['ward_a'], ['medCart', 'linenShelf'], nurseLoop),
  POST('nurse', 'ward_b', ['ward_b'], ['linenShelf'], nurseLoop),
  POST('nurse', 'ward_c', ['ward_c'], ['linenShelf'], nurseLoop),
  POST('nurse', 'icu', ['icu'], ['workstation'], nurseLoop),
  POST('nurse', 'icu', ['icu'], ['workstation'], nurseLoop),
  POST('nurse', 'or', ['or1', 'or2'], ['supplyCart', 'medCart'], orStaffLoop, { fixed: true }),
  POST('doctor', 'er', ['er'], ['workstation'], erDoctorLoop),
  POST('doctor', 'er', ['er'], ['workstation'], erDoctorLoop),
  POST('doctor', 'ward', ['nurses'], ['nurseStation'], wardDoctorLead, { lead: true }),
  POST('doctor', 'ward', ['nurses'], ['nurseStation'], wardDoctorMate, { mate: true }),
  POST('surgeon', 'or', ['or1'], ['scrubSink'], surgeonLoop),
  POST('surgeon', 'or', ['or2'], ['scrubSink'], surgeonLoop),
  POST('tech', 'imaging', ['radiology'], ['controlDesk'], imagingLoop, { fixed: true, list: 'imaging' }),
  POST('tech', 'imaging', ['radiology'], ['controlDesk'], imagingLoop, { fixed: true, list: 'imaging' }),
  POST('tech', 'lab', ['lab'], ['labBench', 'analyzer'], labLoop, { fixed: true }),
  POST('tech', 'or', ['or1', 'or2'], ['anesthesiaCart'], orStaffLoop, { fixed: true }),
  POST('pharmacist', 'pharmacy', ['pharmacy'], ['pillRobot', 'pharmacyShelf'], pharmacistLoop),
  POST('pharmacist', 'pharmacy', ['pharmacy'], ['workstation', 'pharmacyShelf'], pharmacistLoop),
  POST('porter', 'floor0', ['corridor0'], [], porterLoop),
  POST('porter', 'floor0', ['corridor0'], [], porterLoop),
  POST('porter', 'floor0', ['corridor0'], [], porterLoop),
  POST('porter', 'floor1', ['corridor1'], [], porterLoop),
  POST('cleaner', 'er', ['er'], [], cleanerLoop, { fixed: true }),
  POST('cleaner', 'floor0', ['corridor0'], [], cleanerLoop),
  POST('cleaner', 'floor1', ['corridor1'], [], cleanerLoop),
  POST('paramedic', 'er', null, [], paramedicLoop, { list: 'paramedics', at: [39.7, 17.3] }),
  POST('paramedic', 'er', null, [], paramedicLoop, { list: 'paramedics', at: [40.5, 17.9] }),
];
export const staffDisplay = (role, id) => (role === 'nurse' ? `Nurse ${id.first}` : role === 'doctor' || role === 'surgeon' ? `Dr ${id.last}` : role === 'paramedic' ? `Paramedic ${id.first}` : id.first);

function findPost(sim, rooms, props) {
  for (const prop of props) {
    for (const room of rooms) {
      const s = sim.world.uses.find((u) => u.prop === prop && u.roomId === room && !u.by);
      if (s) return s;
    }
  }
  return null;
}
export function makeStaff(sim, spec, at) {
  const id = sim.names();
  const a = addActor(sim, { kind: 'staff', role: spec.role, name: id.name, gender: id.g, display: staffDisplay(spec.role, id), floor: at.floor, x: at.x, z: at.z });
  a.first = id.first; a.surname = id.last;
  a._zone = spec.zone; a._fixed = !!spec.fixed; a._routine = spec.routine;
  a._nextBreak = sim.now + sim.rng.range(30, 240);
  return a;
}
function staffUp(sim) {
  const pairs = {};
  for (const spec of ROSTER) {
    let post;
    if (spec.at) {
      const p = sim.grids[0].point(spec.at[0], spec.at[1]);
      post = { kind: 'stand', floor: 0, x: p.x, z: p.z, ax: p.x, az: p.z, heading: Math.PI * 1.5, roomId: null };
    } else {
      post = findPost(sim, spec.rooms, spec.props);
      if (post) post.by = 'post';
      else { const s = standIn(sim, spec.rooms[0]); post = { kind: 'stand', ...s, ax: s.x, az: s.z }; }
    }
    const a = makeStaff(sim, spec, post);
    a._post = post;
    a.heading = post.heading ?? 0;
    a.anim = post.kind === 'seat' ? 'sit' : post.kind === 'use' ? 'work' : 'idle';
    a.task = 'Starting the shift';
    if (spec.list) sim.staff[spec.list].push(a);
    if (spec.role === 'reception') sim.staff.reception.push(a);
    if (spec.lead) pairs.lead = a;
    if (spec.mate) pairs.mate = a;
    setLife(sim, a, staffLife(sim, a));
  }
  if (pairs.lead && pairs.mate) { pairs.lead._mate = pairs.mate; pairs.mate._mate = pairs.lead; }
}

function fillBeds(sim) {
  const { rng } = sim;
  const byKind = (k) => [...sim.beds.values()].filter((b) => b.kind === k);
  // Two beds stay closed as surge capacity until an agent opens them.
  const ward = rng.shuffle(byKind('ward').filter((b) => b.roomId !== 'ward_c' || !/[34]$/.test(b.id)));
  byKind('ward').filter((b) => !ward.includes(b)).forEach((b) => { b.status = 'reserved'; b._for = 'surge'; b._surge = true; });
  const wardConds = rng.shuffle([...WARD]);
  const take = Math.round(ward.length * 0.72);
  for (let i = 0; i < take; i++) {
    const bed = ward[i], cond = wardConds[i % wardConds.length];
    const p = makePatient(sim, cond, { floor: bed.floor, x: bed.x, z: bed.z, ago: rng.range(120, 1500) });
    p._stayUntil = sim.now + rng.range(60, 760);
    p.task = 'Resting';
    settleInBed(sim, p, bed);
    setLife(sim, p, inpatientLife(sim, p));
  }
  const icu = rng.shuffle(byKind('icu')), icuConds = rng.shuffle([...ICU]);
  for (let i = 0; i < Math.round(icu.length * 0.67); i++) {
    const bed = icu[i], cond = icuConds[i % icuConds.length];
    const p = makePatient(sim, cond, { floor: bed.floor, x: bed.x, z: bed.z, ago: rng.range(240, 2200) });
    p._stayUntil = sim.now + rng.range(240, 1300);
    p.task = 'Being cared for around the clock';
    settleInBed(sim, p, bed);
    setLife(sim, p, inpatientLife(sim, p));
  }
  const er = rng.shuffle(byKind('er'));
  // The first opens the scene with a new arrival, the second is already bound for a ward, so a porter is on the move from the start.
  const opening = [rng.pick(WALK_INS), AMBULANCE[1], AMBULANCE[0]];
  for (let i = 0; i < Math.round(er.length * 0.6); i++) {
    const bed = er[i], cond = opening[i];
    const p = makePatient(sim, cond, { floor: 0, x: bed.x, z: bed.z, ago: rng.range(25, 120) });
    p._seen = i > 0;
    p.task = 'Being treated';
    settleInBed(sim, p, bed);
    setLife(sim, p, i === 1 ? admit(sim, p) : erStay(sim, p, bed));
  }
}
function seatLobby(sim) {
  const { rng } = sim;
  const seats = rng.shuffle(sim.world.seats.filter((s) => s.roomId === 'lobby' && s.prop !== 'chair'));
  const place = (a, s) => { claim(a, s); a.x = s.x; a.z = s.z; a.heading = s.heading; a.anim = 'sit'; syncRoom(a); };
  const forPatient = rng.shuffle(WALK_INS.filter((c) => c.acuity >= 3));
  for (let i = 0; i < Math.min(4, seats.length); i++) {
    const cond = forPatient[i % forPatient.length];
    const p = makePatient(sim, cond, { floor: 0, x: seats[i].x, z: seats[i].z });
    p._arrivedAt = sim.now - rng.range(3, 22);
    p._waiting = true;
    place(p, seats[i]);
    if (i < 2) {
      p.task = 'Waiting to see the triage nurse';
      sim.er.triageQ.push(p);
      setLife(sim, p, afterSeated(sim, p));
    } else {
      p.acuity = cond.acuity;
      p.task = 'Waiting for a bay in Emergency';
      setLife(sim, p, waitForBay(sim, p, true));
    }
  }
  for (let i = 6; i < Math.min(9, seats.length); i++) {
    const id = sim.names();
    const v = addActor(sim, { kind: 'visitor', role: 'visitor', name: id.name, gender: id.g, floor: 0, x: seats[i].x, z: seats[i].z, task: 'Waiting for a friend' });
    place(v, seats[i]);
    setLife(sim, v, (function* () { yield rng.range(10, 30); yield* visitorLeaves(sim, v); })());
  }
}
function equipUp(sim) {
  const seeded = { mri: 0.62, ct: 0.86, xray: 0.74, crashCart: 1 };
  for (const eq of sim.equipment.values()) {
    eq.health = seeded[eq.type] ?? sim.rng.range(0.74, 0.97);
    eq.note = noteFor(eq);
  }
}
function theatreRunning(sim) {
  const th = [...sim.beds.values()].filter((b) => b.kind === 'or');
  if (!th.length) return;
  const bed = th[0];
  const p = makePatient(sim, { reason: 'Knee replacement under way', acuity: 3, admit: 0 }, { floor: bed.floor, x: bed.x, z: bed.z, ago: 200 });
  const team = [];
  const surgeon = sim.actors.find((a) => a.role === 'surgeon');
  const tech = sim.actors.find((a) => a.role === 'tech' && a._zone === 'or');
  const nurse = sim.actors.find((a) => a.role === 'nurse' && a._zone === 'or');
  const cart = sim.world.uses.find((u) => u.prop === 'anesthesiaCart' && u.roomId === bed.roomId);
  if (surgeon) { surgeon._theatre = bed._use; team.push(surgeon); }
  if (tech) { tech._theatre = cart ?? bed._foot; team.push(tech); }
  if (nurse) { nurse._theatre = bed._use2; team.push(nurse); }
  bootSurgery(sim, bed, p, 'knee replacement', team);
}
function seedFeed(sim) {
  const ward = [...sim.beds.values()].filter((b) => b.patientId && b.kind === 'ward');
  const icuPatient = [...sim.beds.values()].find((b) => b.patientId && b.kind === 'icu');
  const lines = [
    ['Staffing', 'Bed', `Morning handover finished. ${sim.actors.filter((a) => a.kind === 'staff').length} staff on the floor.`, 'ack'],
    ['Bed', 'Triage', `${ward.length} ward beds in use and the two surge beds in Ward C are closed.`, 'ack'],
    icuPatient && ['Bed', 'Staffing', `${icuPatient.id} stays on one-to-one watch this morning.`, 'request'],
    ['Pharmacy', 'Bed', 'Morning medicine round is stocked on every ward.', 'ack'],
    ['Imaging', 'Triage', `Scanners are ready. ${[...sim.equipment.values()].find((e) => e.type === 'mri')?.note ?? ''}`, 'ack'],
    ['Facilities', 'Imaging', 'MRI cooling is on my list. Service is booked for Thursday.', 'ack'],
    ['Triage', 'Bed', `${sim.er.triageQ.length + sim.er.bayQ.length} people waiting in the lobby. Nothing urgent yet.`, 'ack'],
  ].filter(Boolean);
  lines.forEach(([from, to, text, kind], i) => postFeed(sim, { from, to, text, kind }, sim.clock - (lines.length - i) * 4));
}
function* openingAct(sim) {
  yield 0.4;
  sim.startProc(ambulanceTrip(sim, { cond: AMBULANCE[0] }));
  yield 2.5;
  sim.startProc(carTrip(sim, { passenger: true }));
  yield 4;
  const pick = (test) => {
    const list = [...sim.beds.values()].filter((b) => b.kind === 'ward' && b.patientId && inBed(sim.byId.get(b.patientId)) && test(sim.byId.get(b.patientId)));
    return list.length ? sim.rng.pick(list) : null;
  };
  const callBed = pick((p) => !p._trend);
  if (callBed) pressCallButton(sim, sim.byId.get(callBed.patientId), callBed);
  yield 7;
  const sick = pick((p) => (p._cond.risk ?? 0) >= 1 && !p._calling) ?? pick((p) => !p._calling);
  if (sick) startEpisode(sim, sim.byId.get(sick.patientId), sick, 'breath');
}

export function populate(sim) {
  sim.stats = { admissions: 12, discharges: 7, stays: [6.2, 3.1, 18.4, 4.2, 26.5, 2.4, 11.8, 5.6, 3.3, 14.2], moves: [], erWait: 21, recentWait: 22, orUtil: 64 };
  sim.metrics = { occupancyPct: 0, bedsFree: 0, bedsTotal: 0, erWaitMin: 0, patientsInHouse: 0, staffOnDuty: 0, staffBusyPct: 0, activeAlerts: 0, admissionsToday: 0, dischargesToday: 0, avgStayHours: 0, orUtilPct: 0 };
  sim.history = { occupancy: [], erWait: [], staffBusy: [], throughput: [] };
  sim.er = { triageQ: [], bayQ: [] };
  sim.staff = { reception: [], imaging: [], erNurses: [], paramedics: [] };
  sim.kerbQ = []; sim.onBreak = 0; sim.carsComing = 0; sim.heliBusy = false;
  sim.lifts = Object.fromEntries(sim.world.portals.filter((p) => p.kind === 'lift').map((p) => [p.id, { id: p.id, floor: 0, target: 0, moving: false, calls: 0, until: 0 }]));
  sim.stock = { ward_a: 0.82, ward_b: 0.66, ward_c: 0.74, icu: 0.9, er: 0.7 };
  sim.rates = { walkIn: 1, ambulance: 1, visitor: 1 };
  sim.amb = { slots: [null, null], count: 11 };
  sim.tracks = buildTracks();
  sim.stepVehicles = stepVehicles;
  sim.startProc = (gen) => spawn(sim, gen);
  sim.clock = 9 * 60 + 30;
  sim.next = { walkIn: 2, ambulance: 34, heli: 75, visitor: 1, east: 0.5, west: 1.5, elective: 9, discharge: 5, stock: 11, chatter: 9 };
  staffUp(sim);
  fillBeds(sim);
  seatLobby(sim);
  theatreRunning(sim);
  equipUp(sim);
  for (const a of sim.actors) syncRoom(a);
}
export function afterWarm(sim) {
  seedFeed(sim);
  sim.startProc(openingAct(sim));
}
