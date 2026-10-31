// The engine room: a tiny cooperative scheduler, actors, walking, job board, alerts and the agent feed.
// Behaviour is written as generators (life.js, flows.js) so a whole patient journey reads top to bottom.
// Time: sim.now is scheduler minutes. One movement second equals one simulated minute, as in the contract.
import { makeRng } from './rng.js';
import { readWorld } from './world.js';
import { makeNames } from './data.js';
import { roomAt } from '../world/plan.js';

export const SPEED = { walk: 1.35, stroll: 1.0, hobble: 0.8, run: 3.0, push: 1.75 };
export const STEP = 0.2;
export const MAX_ACTORS = 80;
export const LIE_Y = 0.6;
export const until = (fn, timeout = Infinity) => ({ until: fn, timeout });

const FEED_GAP = 3.4;
const SEP = 1.0;

export function createCore(shell) {
  const world = readWorld(shell);
  const rng = makeRng(20261031);
  return {
    world, rng, grids: world.grids, names: makeNames(rng),
    now: 0, clock: 0, dilate: 1, slowT: 0, realT: 0,
    actors: [], byId: new Map(), vehicles: [], beds: world.beds, rooms: world.rooms, equipment: world.equipment,
    alerts: [], feed: [], feedQ: [], feedWait: 0,
    procs: [], jobs: [], running: null, seq: 0, budget: 0, listeners: new Map(),
    scenario: 'normal', surge: false, faults: new Set(), snaps: 0,
    on(ev, cb) {
      if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
      this.listeners.get(ev).add(cb);
      return () => this.listeners.get(ev).delete(cb);
    },
    emit(ev, payload) { this.listeners.get(ev)?.forEach((cb) => cb(payload)); },
  };
}

// ── Scheduler ───────────────────────────────────────────────────────────────
export function spawn(sim, gen, owner = null) {
  const p = { gen, wake: 0, cond: null, deadline: Infinity, dead: false, owner, val: undefined };
  sim.procs.push(p);
  return p;
}
export function kill(sim, p) {
  if (!p || p.dead) return;
  p.dead = true;
  if (sim.running === p) return;
  try { p.gen.return(); } catch (e) { fault(sim, e); }
}
function fault(sim, e) {
  const key = e?.message ?? String(e);
  if (sim.faults.has(key)) return;
  sim.faults.add(key);
  console.warn('[sim] behaviour error:', e?.stack ?? e);
}
function resume(sim, p) {
  sim.running = p;
  let r;
  try { r = p.gen.next(p.val); } catch (e) { fault(sim, e); p.dead = true; sim.running = null; return; }
  sim.running = null;
  p.val = undefined;
  if (r.done) { p.dead = true; return; }
  if (p.dead) { try { p.gen.return(); } catch (e) { fault(sim, e); } return; }
  const y = r.value;
  if (typeof y === 'number') p.wake = sim.now + y;
  else if (typeof y === 'function') { p.cond = y; p.deadline = Infinity; }
  else if (y && y.until) { p.cond = y.until; p.deadline = sim.now + y.timeout; }
}
function runProcs(sim) {
  const ps = sim.procs;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.dead || sim.now < p.wake) continue;
    if (p.cond) {
      const ok = p.cond();
      if (!ok && sim.now < p.deadline) continue;
      p.cond = null; p.val = !!ok;
    }
    resume(sim, p);
  }
}
export function compactProcs(sim) {
  let w = 0;
  const ps = sim.procs;
  for (let i = 0; i < ps.length; i++) if (!ps[i].dead) ps[w++] = ps[i];
  ps.length = w;
}

// ── Actors ──────────────────────────────────────────────────────────────────
export function addActor(sim, o) {
  const prefix = { staff: 's', patient: 'p', visitor: 'v' }[o.kind];
  const a = {
    id: `${prefix}${++sim.seq}`, name: o.name, kind: o.kind, role: o.role,
    floor: o.floor ?? 0, x: o.x ?? 0, z: o.z ?? 0, y: 0, heading: o.heading ?? 0,
    anim: o.anim ?? 'idle', speed: 0, task: o.task ?? '', roomId: null, status: 'ok', bubble: null, hidden: !!o.hidden,
    seed: sim.rng.int(1, 1 << 30), gender: o.gender ?? 'f', display: o.display ?? o.name,
    alive: true, _holds: [], _proc: null, _puppet: false, _busy: false, _locked: false, _moving: false, _needPath: false,
    _wps: null, _wi: 0, _goal: null, _stuck: 0, _fails: 0, _leader: null, _lag: 0, _fAnim: 'push', _followers: null, _trail: null,
    _bubbleUntil: 0,
  };
  syncRoom(a);
  sim.actors.push(a);
  sim.byId.set(a.id, a);
  return a;
}
export function removeActor(sim, a) {
  if (!a.alive) return;
  a.alive = false;
  if (a._leader) detach(a);
  for (const f of [...(a._followers ?? [])]) detach(f);
  releaseAll(a);
  kill(sim, a._proc);
  const i = sim.actors.indexOf(a);
  if (i >= 0) sim.actors.splice(i, 1);
  sim.byId.delete(a.id);
}
export function syncRoom(a) { a.roomId = roomAt(a.floor, a.x, a.z)?.id ?? null; }
export function showBubble(sim, a, kind, mins = 5) { a.bubble = kind; a._bubbleUntil = sim.now + mins; }
export function setLife(sim, a, gen) {
  kill(sim, a._proc);
  stopLeg(a);
  a._puppet = false;
  a._proc = spawn(sim, gen, a);
}
/** Hands an actor to a script. The script moves them directly until it calls `sim.freeActor`. */
export function take(sim, a) {
  kill(sim, a._proc);
  a._proc = null; a._puppet = true;
  stopLeg(a);
  if (a._leader) detach(a);
  releaseAll(a);
}
export const claim = (a, spot) => {
  if (spot.by && spot.by !== a.id) return false;
  spot.by = a.id;
  if (!a._holds.includes(spot)) a._holds.push(spot);
  return true;
};
export const release = (a, spot) => {
  if (!spot) return;
  if (spot.by === a.id) spot.by = null;
  const i = a._holds.indexOf(spot);
  if (i >= 0) a._holds.splice(i, 1);
};
export const releaseAll = (a) => {
  for (const s of a._holds) if (s.by === a.id) s.by = null;
  a._holds.length = 0;
};
export const faceTo = (a, x, z) => { a.heading = Math.atan2(x - a.x, z - a.z); };

// ── Walking ─────────────────────────────────────────────────────────────────
export function startLeg(sim, a, t, o = {}) {
  a._goal = t;
  a._legSpeed = o.speed ?? SPEED.walk;
  a._legAnim = o.anim ?? (a._legSpeed >= SPEED.run ? 'run' : 'walk');
  a._moving = true; a._needPath = true; a._wps = null; a._wi = 0; a._stuck = 0; a._fails = 0;
}
export function stopLeg(a) {
  a._moving = false; a._needPath = false; a._wps = null; a.speed = 0;
  if (a.anim === 'walk' || a.anim === 'run') a.anim = 'idle';
}
function planLeg(sim, a) {
  if (sim.budget <= 0) return false;
  sim.budget--;
  const g = sim.grids[a.floor], t = a._goal, wps = [];
  a._clipFirst = false; a._clipLast = false;
  if (t.noclip) {
    wps.push({ x: t.x, z: t.z });
    a._clipFirst = a._clipLast = true;
  } else {
    const gx = t.ax ?? t.x, gz = t.az ?? t.z;
    const path = g.find(a.x, a.z, gx, gz);
    if (!path) { a.x = t.x; a.z = t.z; arrive(sim, a); sim.snaps++; return false; }
    const here = g.free(a.x, a.z);
    if (!here) { a._clipFirst = true; wps.push(path[0]); }
    for (let i = 1; i < path.length; i++) wps.push(path[i]);
    if (!wps.length) wps.push(path[0]);
    const end = wps[wps.length - 1];
    if (Math.abs(end.x - t.x) + Math.abs(end.z - t.z) > 0.02) { wps.push({ x: t.x, z: t.z }); a._clipLast = true; }
  }
  a._wps = wps; a._wi = 0; a._needPath = false;
  a.anim = a._legAnim; a.speed = a._legSpeed;
  return true;
}
function arrive(sim, a) {
  const t = a._goal;
  a._moving = false; a._wps = null; a.speed = 0;
  if (a.anim === 'walk' || a.anim === 'run') a.anim = 'idle';
  if (t?.heading !== undefined) a.heading = t.heading;
  syncRoom(a);
}
const side = { x: 0, z: 0 };
function avoid(sim, a, nx, nz) {
  let sx = 0, sz = 0;
  const list = sim.actors;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b === a || b.floor !== a.floor || b.hidden || b._leader === a || a._leader === b || (a._leader && a._leader === b._leader)) continue;
    const dx = b.x - a.x;
    if (dx > SEP || dx < -SEP) continue;
    const dz = b.z - a.z;
    if (dz > SEP || dz < -SEP) continue;
    if (b.anim === 'sit' || (b.anim === 'lie' && !b._moving)) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 > SEP * SEP || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    if ((dx * nx + dz * nz) / d < -0.1) continue;
    // Keep right when someone is dead ahead, otherwise step away from whichever side they are on.
    const s = nx * dz - nz * dx > 0.12 * d ? -1 : 1, w = 1 - d / SEP;
    sx += -nz * s * w; sz += nx * s * w;
  }
  side.x = sx; side.z = sz;
}
function stepMove(sim, a, h) {
  if (a._needPath && !planLeg(sim, a)) return;
  if (!a._moving) return;
  const g = sim.grids[a.floor];
  let rem = a._legSpeed * h;
  for (let guard = 0; rem > 1e-4 && guard < 6; guard++) {
    const wps = a._wps, last = a._wi === wps.length - 1, w = wps[a._wi];
    const dx = w.x - a.x, dz = w.z - a.z, d = Math.hypot(dx, dz);
    const clip = (a._clipFirst && a._wi === 0) || (a._clipLast && last);
    if (d <= (last ? 0.03 : 0.22)) {
      if (last) { a.x = w.x; a.z = w.z; arrive(sim, a); return; }
      a._wi++;
      continue;
    }
    const step = Math.min(rem, d), nx = dx / d, nz = dz / d;
    if (!clip && !a._solo) avoid(sim, a, nx, nz); else side.x = side.z = 0;
    const lim = step * 0.6, sl = Math.hypot(side.x, side.z), k = sl > 1 ? lim / sl : lim;
    const tx = a.x + nx * step + side.x * k, tz = a.z + nz * step + side.z * k;
    if (clip || g.free(tx, tz)) { a.x = tx; a.z = tz; a._stuck = 0; }
    else if (g.free(a.x + nx * step, a.z + nz * step)) { a.x += nx * step; a.z += nz * step; a._stuck = 0; }
    else {
      a._stuck += h;
      if (a._stuck > 0.5) {
        a._stuck = 0;
        if (++a._fails >= 3) { const t = a._goal; a.x = t.ax ?? t.x; a.z = t.az ?? t.z; a._needPath = true; a._fails = 0; sim.snaps++; }
        else a._needPath = true;
      }
      return;
    }
    a.heading = Math.atan2(nx, nz);
    rem -= step;
  }
  a._trail?.add(a.x, a.z);
}

class Trail {
  constructor(x, z) { this.xs = new Float32Array(48); this.zs = new Float32Array(48); this.n = 1; this.head = 0; this.xs[0] = x; this.zs[0] = z; }
  reset(x, z) { this.n = 1; this.head = 0; this.xs[0] = x; this.zs[0] = z; }
  add(x, z) {
    const dx = x - this.xs[this.head], dz = z - this.zs[this.head];
    if (dx * dx + dz * dz < 0.04) return;
    this.head = (this.head + 1) % 48;
    this.xs[this.head] = x; this.zs[this.head] = z;
    this.n = Math.min(this.n + 1, 48);
  }
  at(lag, x, z, out) {
    let left = lag, px = x, pz = z;
    for (let i = 0; i < this.n; i++) {
      const k = (this.head - i + 48) % 48, qx = this.xs[k], qz = this.zs[k], d = Math.hypot(qx - px, qz - pz);
      if (d >= left && d > 0) { const t = left / d; out.x = px + (qx - px) * t; out.z = pz + (qz - pz) * t; return out; }
      left -= d; px = qx; pz = qz;
    }
    out.x = px; out.z = pz;
    return out;
  }
}
/** The follower replays the leader's own footsteps, so gurney crews inherit a wall-safe path. */
export function attach(follower, leader, lag = 1.25, anim = 'push') {
  stopLeg(follower);
  follower._leader = leader; follower._lag = lag; follower._fAnim = anim;
  follower.anim = anim;
  if (!leader._trail) { leader._trail = new Trail(follower.x, follower.z); leader._trail.add(leader.x, leader.z); }
  (leader._followers ??= []).push(follower);
}
export function detach(f) {
  const L = f._leader;
  if (!L) return;
  f._leader = null; f.speed = 0;
  if (f.anim === 'push') f.anim = 'idle';
  const i = L._followers?.indexOf(f) ?? -1;
  if (i >= 0) L._followers.splice(i, 1);
  if (!L._followers?.length) { L._followers = null; L._trail = null; }
}
export const resetTrail = (a) => a._trail?.reset(a.x, a.z);

const crumb = { x: 0, z: 0 };
function stepFollow(a, h) {
  const L = a._leader;
  a.floor = L.floor; a.hidden = L.hidden;
  L._trail.at(a._lag, L.x, L.z, crumb);
  const dx = crumb.x - a.x, dz = crumb.z - a.z, d = Math.hypot(dx, dz);
  const reach = Math.max(L.speed, 0.7) * 1.3 * h;
  if (d > 1e-3) { const k = Math.min(1, reach / d); a.x += dx * k; a.z += dz * k; }
  a.speed = d > 0.03 ? Math.max(L.speed, 0.7) : 0;
  const lx = L.x - a.x, lz = L.z - a.z;
  if (lx * lx + lz * lz > 0.04) a.heading = Math.atan2(lx, lz);
  a.anim = a._fAnim === 'walk' && a.speed === 0 ? 'idle' : a._fAnim;
}

// ── Job board ───────────────────────────────────────────────────────────────
export function postJob(sim, job) {
  job.t0 = sim.now;
  job.open = sim.now + (job.exclusive ?? 3);
  job.pri ??= 1;
  sim.jobs.push(job);
  return job;
}
const fits = (sim, a, j) => j.role === a.role && !j.taken && (!j.zone || j.zone === a._zone || (!a._fixed && sim.now >= j.open));
export const hasJob = (sim, a) => {
  for (let i = 0; i < sim.jobs.length; i++) if (fits(sim, a, sim.jobs[i])) return true;
  return false;
};
export function takeJob(sim, a) {
  // At equal priority, work on this floor comes first. Oldest-first alone has two people swapping floors by lift for every job.
  const here = `floor${a.floor}`;
  const better = (j, b) => j.pri - b.pri || (j.zone === here) - (b.zone === here) || b.t0 - j.t0;
  let best = -1;
  for (let i = 0; i < sim.jobs.length; i++) {
    if (fits(sim, a, sim.jobs[i]) && (best < 0 || better(sim.jobs[i], sim.jobs[best]) > 0)) best = i;
  }
  if (best < 0) return null;
  const [job] = sim.jobs.splice(best, 1);
  return job;
}

// ── Alerts + agent feed ─────────────────────────────────────────────────────
export function raise(sim, o) {
  const al = {
    id: `al${++sim.seq}`, severity: o.severity ?? 'info', title: o.title, detail: o.detail ?? '',
    roomId: o.roomId, bedId: o.bedId, actorId: o.actorId, at: sim.clock, resolved: false, acked: false, _soft: !!o.soft,
  };
  sim.alerts.push(al);
  if (sim.alerts.length > 80) {
    const i = sim.alerts.findIndex((x) => x.resolved);
    if (i >= 0) sim.alerts.splice(i, 1);
  }
  sim.emit('alert', al);
  return al;
}
export function resolveAlert(sim, al, detail) {
  if (!al || al.resolved) return;
  al.resolved = true; al.resolvedAt = sim.clock;
  if (detail) al.detail = detail;
  sim.emit('resolve', al);
}
export function say(sim, from, to, text, kind = 'request', roomId) {
  sim.feedQ.push({ from, to, text, kind, roomId });
  // A long backlog at high speed would make the feed a history lesson, so the oldest routine lines give way.
  if (sim.feedQ.length > 12) {
    const i = sim.feedQ.findIndex((m) => m.kind !== 'alert');
    sim.feedQ.splice(i < 0 ? 0 : i, 1);
  }
}
export function pumpFeed(sim, realDt) {
  sim.feedWait -= realDt;
  if (sim.feedWait > 0 || !sim.feedQ.length) return;
  sim.feedWait = sim.feedQ.length > 6 ? FEED_GAP * 0.6 : FEED_GAP;
  postFeed(sim, sim.feedQ.shift());
}
export function postFeed(sim, m, at = sim.clock) {
  const msg = { id: `m${++sim.seq}`, at, from: m.from, to: m.to, text: m.text, kind: m.kind, roomId: m.roomId };
  sim.feed.push(msg);
  if (sim.feed.length > 200) sim.feed.shift();
  sim.emit('feed', msg);
}

// ── One step of everything ──────────────────────────────────────────────────
export function advance(sim, h) {
  const brain = h * sim.dilate;
  sim.now += brain;
  sim.clock += brain;
  sim.budget = 4;
  runProcs(sim);
  const list = sim.actors;
  for (let i = 0; i < list.length; i++) { const a = list[i]; if (a._moving) stepMove(sim, a, h); }
  for (let i = 0; i < list.length; i++) { const a = list[i]; if (a._leader) stepFollow(a, h); }
  sim.stepVehicles?.(sim, h);
  sim.slowT += brain;
  while (sim.slowT >= 1) { sim.slowT -= 1; sim.minuteStep?.(sim); }
}
