// Daily life: how each kind of person moves, works and takes a break. Every routine is one "beat" that hands back to the
// job board between beats, so staff stay responsive without a central planner.
import {
  SPEED, until, startLeg, stopLeg, claim, release, releaseAll, hasJob, takeJob, postJob, faceTo, showBubble, removeActor, resetTrail, raise, resolveAlert, syncRoom,
} from './core.js';
import { roomById } from '../world/plan.js';

export function* leg(sim, a, t, o) {
  startLeg(sim, a, t, o);
  yield () => !a._moving;
}
export const standOf = (portal, floor) => (portal.kind === 'stairs' && floor === 1 ? portal.standTop : portal.stand);

function pickPortal(sim, a, o) {
  const { portals } = sim.world;
  const lifts = portals.filter((p) => p.kind === 'lift'), stairs = portals.find((p) => p.kind === 'stairs');
  const wheeled = o.gurney || a._followers?.length;
  if (!wheeled && a.kind === 'staff' && stairs && sim.rng.chance(0.5)) return stairs;
  return sim.rng.pick(lifts);
}
/** One floor change. The rider vanishes into the cabin or stairwell and reappears on the other plate. */
export function* ride(sim, a, portal, toFloor, o = {}) {
  const from = standOf(portal, a.floor), to = standOf(portal, toFloor), task = a.task;
  yield* leg(sim, a, { x: from.x, z: from.z }, o);
  const lift = portal.kind === 'lift', cabin = { x: portal.x, z: portal.z + 0.9 };
  if (lift) {
    if (!a._followers?.length) a.task = 'Waiting for the lift';
    const state = sim.lifts[portal.id];
    state.calls++;
    yield sim.rng.range(0.6, 1.6);
    a.task = task;
    yield* leg(sim, a, { ...cabin, noclip: true }, o);
    state.moving = true; state.target = toFloor; state.until = sim.now + portal.ride;
  }
  const group = [a, ...(a._followers ?? [])];
  for (const m of group) m.hidden = true;
  yield portal.ride;
  const out = lift ? cabin : to;
  for (const m of group) { m.floor = toFloor; m.x = out.x; m.z = out.z; }
  resetTrail(a);
  for (const m of group) { m.hidden = false; syncRoom(m); }
  if (lift) yield* leg(sim, a, { x: to.x, z: to.z, noclip: true }, o);
}
export function* go(sim, a, t, o = {}) {
  if (t.floor !== undefined && t.floor !== a.floor) yield* ride(sim, a, pickPortal(sim, a, o), t.floor, o);
  yield* leg(sim, a, t, o);
}
/** A walk that can be dropped: the moment `stop` is true the actor pulls up where they are. Staying on one floor keeps lifts out of it. */
function* goUnless(sim, a, t, stop, o = {}) {
  if (t.floor !== undefined && t.floor !== a.floor) { yield* go(sim, a, t, o); return; }
  startLeg(sim, a, t, o);
  yield until(() => !a._moving || stop());
  if (a._moving) stopLeg(a);
}

export function bedSpot(bed, a) {
  for (const s of bed._spots) if (claim(a, s)) return s;
  return bed._foot;
}
export const inBed = (p) => !!p?.alive && !!p.bedId && p.anim === 'lie' && !p._away && !p._moving;
export function faceBed(a, bed) { faceTo(a, bed.x, bed.z); }

/** A random clear standing place inside a room. */
export function standIn(sim, roomId) {
  const room = roomById(roomId).rect;
  const floor = sim.rooms.get(roomId).floor, g = sim.grids[floor];
  for (let i = 0; i < 24; i++) {
    const x = sim.rng.range(room.x + 1, room.x + room.w - 1), z = sim.rng.range(room.z + 1, room.z + room.d - 1);
    if (g.free(x, z)) return { floor, x, z, roomId };
  }
  const p = g.point(room.x + room.w / 2, room.z + room.d / 2);
  return { floor, ...p, roomId };
}
/** `rooms` is in order of preference: nobody crosses the lobby while a nearer chair is free. */
export function freeSeat(sim, rooms, a) {
  for (const room of rooms) {
    const pool = sim.world.seats.filter((s) => !s.by && s.roomId === room);
    if (!pool.length) continue;
    const s = sim.rng.pick(pool);
    claim(a, s);
    return s;
  }
  return null;
}
/** Passing `called` lets someone turn round on the way to the chair as soon as their name comes up. */
export function* sitDown(sim, a, rooms, task, called = () => false) {
  const seat = freeSeat(sim, rooms, a);
  const t = seat ?? standIn(sim, rooms[0]);
  a.task = task;
  yield* goUnless(sim, a, t, called);
  if (called()) return null;
  if (seat) { a.anim = 'sit'; a.heading = seat.heading; } else a.anim = 'idle';
  return seat;
}

// ── Staff ───────────────────────────────────────────────────────────────────
const BREAK_ROLES = new Set(['nurse', 'doctor', 'tech', 'pharmacist', 'porter', 'cleaner', 'surgeon']);

export function* staffLife(sim, a) {
  for (;;) {
    if (a._leaving) { yield* staffLeaves(sim, a); return; }
    const job = takeJob(sim, a);
    if (job) {
      a._busy = true;
      try { yield* job.run(a); } finally { a._busy = false; a._locked = false; releaseAll(a); }
      yield 0.1;
      continue;
    }
    if (sim.now > a._nextBreak && sim.onBreak < 3 && BREAK_ROLES.has(a.role) && !a._fixed && !sim.surge) {
      a._nextBreak = sim.now + sim.rng.range(130, 260);
      yield* coffeeBreak(sim, a);
      yield 0.1;
      continue;
    }
    yield* (a._routine ?? atPostIdle)(sim, a);
    yield 0.1;
  }
}
function* staffLeaves(sim, a) {
  a.task = 'Heading home after the shift';
  a._busy = false;
  yield* go(sim, a, sim.world.entry.inside);
  yield* go(sim, a, sim.world.entry.outside);
  yield* go(sim, a, sim.rng.pick(sim.world.plazaEnds));
  removeActor(sim, a);
}
export function* atPost(sim, a, task, mins) {
  const p = a._post;
  a._busy = false;
  if (a.floor !== p.floor || Math.hypot(a.x - p.x, a.z - p.z) > 0.4) {
    a.task = 'Heading back';
    yield* goUnless(sim, a, p, () => hasJob(sim, a));
    if (hasJob(sim, a)) return;
  }
  a.heading = p.heading ?? a.heading;
  a.anim = p.kind === 'seat' ? 'sit' : p.kind === 'use' ? 'work' : 'idle';
  a.task = task;
  yield until(() => hasJob(sim, a), mins);
}
function* atPostIdle(sim, a) { yield* atPost(sim, a, a._postTask ?? 'Ready to help', sim.rng.range(6, 10)); }

function* workAt(sim, a, spots, tasks, mins) {
  const pool = spots.filter((s) => !s.by || s.by === a.id);
  if (!pool.length) { yield* atPost(sim, a, tasks[0], mins); return; }
  const s = sim.rng.pick(pool);
  claim(a, s);
  a._busy = true;
  yield* go(sim, a, s);
  a.heading = s.heading; a.anim = s.kind === 'seat' ? 'sit' : 'work'; a.task = sim.rng.pick(tasks);
  yield until(() => hasJob(sim, a), mins);
  release(a, s);
  a._busy = false;
}
const spotsIn = (sim, rooms, props) => sim.world.uses.filter((s) => rooms.includes(s.roomId) && (!props || props.includes(s.prop)));

function zoneBeds(sim, zone) {
  const c = (sim.zoneBeds ??= new Map());
  if (!c.has(zone)) c.set(zone, [...sim.beds.values()].filter((b) => (zone === 'ward' ? b.kind === 'ward' : b.roomId === zone)));
  return c.get(zone);
}
function roundList(sim, a, n) {
  const list = zoneBeds(sim, a._zone).filter((b) => b.patientId && inBed(sim.byId.get(b.patientId)));
  sim.rng.shuffle(list);
  const out = [];
  let x = a.x, z = a.z;
  const left = list.slice(0, n + 2);
  while (out.length < n && left.length) {
    left.sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z));
    const b = left.shift();
    out.push(b); x = b.x; z = b.z;
  }
  return out;
}
export const nurseLoop = function* (sim, a) {
  yield* atPost(sim, a, sim.rng.pick(['Updating patient notes', 'Writing up the handover', 'Checking the drug chart']), sim.rng.range(4, 9));
  if (hasJob(sim, a)) return;
  const beds = roundList(sim, a, sim.rng.int(2, 4));
  a._busy = true;
  for (const bed of beds) {
    if (hasJob(sim, a)) break;
    const p = sim.byId.get(bed.patientId);
    if (!inBed(p)) continue;
    const s = bedSpot(bed, a);
    a.task = `On the way to ${p.display}`;
    yield* go(sim, a, s);
    if (bed.patientId !== p.id) { release(a, s); continue; }
    faceBed(a, bed);
    a.anim = 'work'; a.task = `Checking on ${p.display}`;
    if (sim.rng.chance(0.35)) showBubble(sim, sim.rng.chance(0.5) ? p : a, sim.rng.chance(0.5) ? 'pill' : 'heart', 5);
    if (sim.stock) sim.stock[bed.roomId] = Math.max(0, (sim.stock[bed.roomId] ?? 1) - 0.03);
    yield sim.rng.range(4, 7);
    release(a, s);
  }
  a._busy = false;
};
export const triageLoop = function* (sim, a) {
  yield* atPost(sim, a, 'Ready for the next patient', 0.4);
  const q = sim.er.triageQ;
  const callNext = () => {
    const n = q.find((x) => x._cond.acuity <= 2) ?? q[0];
    if (!n) return null;
    q.splice(q.indexOf(n), 1);
    n._calledBy = a;
    return n;
  };
  const p = a._nextUp?.alive ? a._nextUp : callNext();
  a._nextUp = null;
  if (!p) { yield until(() => q.length > 0 || hasJob(sim, a), 5); return; }
  a._busy = true;
  a.task = `Calling ${p.name} over`;
  yield until(() => p._atDesk || !p.alive, 24);
  if (p.alive && p._atDesk) {
    a.task = `Assessing ${p.display}`;
    // The next person sets off now, so the desk never stands empty while someone crosses the room.
    a._nextUp = callNext();
    showBubble(sim, a, 'chat', 3);
    yield sim.rng.range(3, 4.5);
    p.acuity = p._cond.acuity;
    p.status = p.acuity <= 2 ? 'watch' : 'ok';
  }
  p._triaged = true;
  a._busy = false;
};
export const erDoctorLoop = function* (sim, a) {
  yield* atPost(sim, a, sim.rng.pick(['Reviewing test results', 'Reading a scan', 'Writing up notes']), sim.rng.range(5, 9));
};
export const wardDoctorLead = function* (sim, a) {
  yield* atPost(sim, a, 'Going through the patient list', sim.rng.range(5, 10));
  if (hasJob(sim, a)) return;
  const mate = a._mate;
  const beds = roundList(sim, a, 3);
  if (!beds.length) return;
  a._busy = true;
  try {
    for (const bed of beds) {
      if (hasJob(sim, a)) break;
      const p = sim.byId.get(bed.patientId);
      if (!inBed(p)) continue;
      a._roundBed = bed;
      const s = bedSpot(bed, a);
      a.task = `Ward round: on the way to ${p.display}`;
      yield* go(sim, a, s);
      if (bed.patientId !== p.id) { release(a, s); continue; }
      faceBed(a, bed);
      a.anim = 'talk'; a.task = `Ward round with ${mate.display}: seeing ${p.display}`;
      yield 2.5;
      showBubble(sim, a, 'chat', 4);
      showBubble(sim, p, 'heart', 3);
      yield sim.rng.range(5, 8);
      if (bed.kind === 'ward' && sim.now > (p._stayUntil ?? Infinity) - 120 && sim.rng.chance(0.4)) {
        p._cleared = true;
        p.task = 'Cleared to go home soon';
      }
      release(a, s);
    }
  } finally { a._roundBed = null; a._busy = false; }
};
export const wardDoctorMate = function* (sim, a) {
  const lead = a._mate;
  if (!lead._roundBed) { yield* atPost(sim, a, 'Going through the patient list', 2); return; }
  a._busy = true;
  while (lead._roundBed && !hasJob(sim, a)) {
    const bed = lead._roundBed;
    const s = bedSpot(bed, a);
    a.task = `Ward round with ${lead.display}`;
    yield* go(sim, a, s);
    faceBed(a, bed);
    a.anim = 'talk';
    yield until(() => lead._roundBed !== bed, 16);
    release(a, s);
  }
  a._busy = false;
};
export const surgeonLoop = function* (sim, a) { yield* atPost(sim, a, 'Planning the next operation', sim.rng.range(6, 11)); };
export const receptionLoop = function* (sim, a) { yield* atPost(sim, a, 'Looking after the front desk', 6); };
export const paramedicLoop = function* (sim, a) { yield* atPost(sim, a, 'Standing by for the next call', 8); };
export const imagingLoop = function* (sim, a) { yield* atPost(sim, a, 'Watching the scanner screens', 7); };
export const labLoop = function* (sim, a) {
  yield* workAt(sim, a, spotsIn(sim, ['lab']), ['Running blood samples', 'Checking a slide', 'Loading the analyser', 'Sorting samples'], sim.rng.range(6, 11));
};
export const orStaffLoop = function* (sim, a) {
  yield* workAt(sim, a, spotsIn(sim, ['or1', 'or2'], ['instrumentTable', 'anesthesiaCart', 'supplyCart', 'medCart']), ['Laying out instruments', 'Checking the theatre', 'Restocking supplies'], sim.rng.range(6, 10));
};
export const pharmacistLoop = function* (sim, a) {
  yield* workAt(sim, a, spotsIn(sim, ['pharmacy']), ['Checking prescriptions', 'Refilling the pill robot', 'Restocking the shelves', 'Counting stock'], sim.rng.range(6, 10));
};
export const porterLoop = function* (sim, a) {
  yield* atPost(sim, a, 'Waiting for the next move', sim.rng.range(4, 8));
  if (hasJob(sim, a)) return;
  a.task = 'Tidying the wheelchairs and trolleys';
  yield* goUnless(sim, a, standIn(sim, a._zone === 'floor1' ? 'corridor1' : 'corridor0'), () => hasJob(sim, a));
  yield until(() => hasJob(sim, a), sim.rng.range(2, 4));
};
export const cleanerLoop = function* (sim, a) {
  const rooms = a._zone === 'er' ? ['er'] : a._zone === 'floor1' ? ['corridor1', 'nurses', 'ward_b', 'ward_a', 'ward_c'] : ['corridor0', 'lobby', 'lobby'];
  a.task = 'Heading to the next patch of floor';
  yield* goUnless(sim, a, standIn(sim, sim.rng.pick(rooms)), () => hasJob(sim, a), { speed: SPEED.stroll });
  if (hasJob(sim, a)) return;
  a.anim = 'work'; a.task = 'Mopping the floor';
  yield until(() => hasJob(sim, a), sim.rng.range(4, 7));
};

function* coffeeBreak(sim, a) {
  sim.onBreak++;
  try {
    const ground = a.floor === 0 || sim.rng.chance(0.25);
    if (ground) {
      const spots = sim.world.uses.filter((s) => (s.prop === 'coffeeKiosk' || s.prop === 'vending') && !s.by);
      if (!spots.length) return;
      const s = sim.rng.pick(spots);
      claim(a, s);
      a.task = 'Heading for a coffee';
      yield* go(sim, a, s);
      a.heading = s.heading; a.anim = 'idle'; a.task = 'Getting a coffee';
      showBubble(sim, a, 'chat', 3);
      yield until(() => hasJob(sim, a), sim.rng.range(3, 5));
      release(a, s);
      if (hasJob(sim, a)) return;
    }
    const pool = sim.world.seats.filter((s) => !s.by && s.floor === a.floor && s.prop === 'chair' && (s.roomId === 'nurses' || s.roomId === 'lobby'));
    if (pool.length) {
      const seat = sim.rng.pick(pool);
      claim(a, seat);
      a.task = 'On a short break';
      yield* go(sim, a, seat);
      a.heading = seat.heading; a.anim = 'sit';
      yield until(() => hasJob(sim, a), sim.rng.range(4, 7));
      release(a, seat);
    }
  } finally { sim.onBreak--; }
}

// ── Patients in a bed ───────────────────────────────────────────────────────
/** Orders are how the outside world moves a patient: `p._order = () => generator`. The patient's own process runs them. */
export function* inpatientLife(sim, p) {
  for (;;) {
    yield until(() => p._order, sim.rng.range(5, 12));
    if (p._order) {
      const order = p._order;
      p._order = null;
      yield* order();
      if (!p.alive) return;
      continue;
    }
    const bed = sim.beds.get(p.bedId);
    if (!bed || !inBed(p) || p.bubble) continue;
    const h = (sim.clock / 60) % 24;
    if ((h > 22 || h < 6) ? sim.rng.chance(0.55) : sim.rng.chance(0.1)) { showBubble(sim, p, 'zzz', 8); p.task = 'Resting'; continue; }
    p.task = sim.rng.pick(['Resting', 'Reading', 'Watching television', 'Chatting with the nurses']);
    if (sim.rng.chance(0.09) && !bed.alarm) pressCallButton(sim, p, bed);
  }
}
const CALLS = ['would like some water', 'needs help getting comfortable', 'is in a bit of pain', 'needs help to the bathroom', 'has a question about the medicine', 'feels cold and would like a blanket'];
export function pressCallButton(sim, p, bed) {
  if (p._calling) return;
  p._calling = true;
  showBubble(sim, p, 'call', Infinity);
  const need = sim.rng.pick(CALLS);
  const al = sim.rng.chance(0.4) ? { severity: 'info', title: `${p.display} in ${bed.id} ${need}`, detail: 'Call button pressed. A nurse is on the way.', roomId: bed.roomId, bedId: bed.id, actorId: p.id, soft: true } : null;
  const alert = al ? raise(sim, al) : null;
  postJob(sim, {
    role: 'nurse', zone: bed.roomId, pri: 3, exclusive: 2,
    run: function* (a) {
      let done = false;
      try {
        if (!p.alive || p.bedId !== bed.id) { done = true; return; }
        const s = bedSpot(bed, a);
        a.task = `Answering ${p.display}'s call button`;
        yield* go(sim, a, s);
        if (p.alive && p.bedId === bed.id) {
          faceBed(a, bed);
          a.anim = 'work'; a.task = `Helping ${p.display}`;
          p.bubble = null; p._calling = false;
          showBubble(sim, a, 'heart', 3);
          resolveAlert(sim, alert, `${a.display} sorted it out.`);
          yield sim.rng.range(3, 5);
        }
        done = true;
      } finally {
        if (!done && p.alive) { p._calling = false; p.bubble = null; resolveAlert(sim, alert); }
      }
    },
  });
}

// ── Visitors ────────────────────────────────────────────────────────────────
export function* visitorLife(sim, v) {
  const beds = [...sim.beds.values()].filter((b) => (b.kind === 'ward' || b.kind === 'icu') && b.patientId && !b._visitor);
  const bed = beds.length ? sim.rng.pick(beds) : null;
  const p = bed && sim.byId.get(bed.patientId);
  yield* go(sim, v, sim.world.entry.inside, { speed: SPEED.stroll });
  if (!p) {
    yield* sitDown(sim, v, ['lobby'], 'Waiting for a friend');
    yield sim.rng.range(14, 28);
    yield* visitorLeaves(sim, v);
    return;
  }
  bed._visitor = v.id;
  v._visiting = p.id;
  v.task = `Going up to see ${p.display}`;
  try {
    const seat = sim.world.seats.find((s) => s.roomId === bed.roomId && !s.by && Math.hypot(s.x - bed.x, s.z - bed.z) < 2.2);
    if (seat) {
      claim(v, seat);
      yield* go(sim, v, seat, { speed: SPEED.stroll });
      v.heading = Math.atan2(bed.x - seat.x, bed.z - seat.z); v.anim = 'sit';
    } else {
      const s = bedSpot(bed, v);
      yield* go(sim, v, s, { speed: SPEED.stroll });
      faceBed(v, bed); v.anim = 'talk';
    }
    v.task = `Visiting ${p.display}`;
    showBubble(sim, v, 'heart', 6);
    yield until(() => !p.alive || p.bedId !== bed.id, sim.rng.range(18, 34));
  } finally { if (bed._visitor === v.id) bed._visitor = null; }
  releaseAll(v);
  yield* visitorLeaves(sim, v);
}
export function* visitorLeaves(sim, v) {
  v.task = 'Heading home';
  releaseAll(v);
  yield* go(sim, v, sim.world.entry.inside, { speed: SPEED.stroll });
  yield* goOutside(sim, v);
}
/** Out the main doors, then either a lift from the kerb or a walk off along the paving. */
export function* goOutside(sim, a, speed = SPEED.stroll) {
  const { world, rng } = sim;
  yield* go(sim, a, world.entry.outside, { speed });
  if (rng.chance(0.6) && sim.kerbQ.length < 4) {
    yield* go(sim, a, world.kerb, { speed });
    a.task = 'Waiting for a lift home';
    a.anim = 'idle';
    sim.kerbQ.push(a);
    yield until(() => !a.alive, 30);
    if (a.alive) { sim.kerbQ.splice(sim.kerbQ.indexOf(a), 1); removeActor(sim, a); }
    return;
  }
  yield* go(sim, a, rng.pick(world.plazaEnds), { speed });
  removeActor(sim, a);
}
