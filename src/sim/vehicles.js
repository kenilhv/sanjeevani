// Everything on wheels and rotors. Routes come straight from plan.js; corners are rounded here so nothing turns on a sixpence.
import { ROUTES } from '../world/plan.js';
import { until } from './core.js';

const ACC = 3.2, DEC = 3.8;
const CAR_COLOURS = ['#9fd0ea', '#f39aa8', '#a9e2c8', '#cdbff0', '#f7f3ee', '#ffc48a', '#7fe0dc', '#e1bf95'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeTrack(points, radius = 3.2) {
  const pts = [];
  points.forEach((p, i) => {
    if (i === 0 || i === points.length - 1) { pts.push([p.x, p.z]); return; }
    const a = points[i - 1], c = points[i + 1];
    const la = Math.hypot(a.x - p.x, a.z - p.z), lc = Math.hypot(c.x - p.x, c.z - p.z);
    const r = Math.min(radius, la / 2, lc / 2);
    const x0 = p.x + ((a.x - p.x) / la) * r, z0 = p.z + ((a.z - p.z) / la) * r;
    const x1 = p.x + ((c.x - p.x) / lc) * r, z1 = p.z + ((c.z - p.z) / lc) * r;
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * p.x + t * t * x1, u * u * z0 + 2 * u * t * p.z + t * t * z1]);
    }
  });
  const ls = [0];
  for (let i = 1; i < pts.length; i++) ls.push(ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, ls, len: ls[ls.length - 1] };
}
export function trackNear(t, x, z) {
  let best = 0, bd = Infinity;
  t.pts.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = i; } });
  return t.ls[best];
}
const pos = { x: 0, z: 0, tx: 0, tz: 1 };
function sample(t, s) {
  const { pts, ls } = t;
  let lo = 0, hi = ls.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ls[m] <= s) lo = m; else hi = m; }
  const seg = ls[hi] - ls[lo] || 1, k = clamp((s - ls[lo]) / seg, 0, 1);
  pos.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * k;
  pos.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * k;
  pos.tx = (pts[hi][0] - pts[lo][0]) / seg; pos.tz = (pts[hi][1] - pts[lo][1]) / seg;
  return pos;
}

export function buildTracks() {
  const ai = ROUTES.ambulanceIn, fwd = ai.filter((p) => !p.reverse);
  const tracks = {
    ambIn: makeTrack(fwd),
    ambBack: makeTrack([fwd[fwd.length - 1], ai[ai.length - 1]]),
    ambOut: makeTrack(ROUTES.ambulanceOut),
    drop: makeTrack(ROUTES.carDropoff, 2.6),
    east: makeTrack(ROUTES.trafficEast),
    west: makeTrack(ROUTES.trafficWest),
    // Second place on the apron: swing round the turning circle and join the way out.
    holdOut: makeTrack([{ x: 45, z: 27 }, { x: 45, z: 23 }, { x: 47.4, z: 20.6 }, { x: 48.5, z: 24 }, { x: 48.5, z: 33 }, { x: 53, z: 37.1 }], 1.6),
  };
  tracks.holdS = trackNear(tracks.ambIn, 45, 27);
  tracks.dropS = trackNear(tracks.drop, 8, 30.6);
  return tracks;
}

export function addVehicle(sim, type, label, o = {}) {
  const v = {
    id: `veh${++sim.seq}`, type, x: o.x ?? -20, y: o.y ?? 0, z: o.z ?? 37, heading: o.heading ?? 0,
    lights: false, doors: false, rotor: 0, label, scale: 1, color: o.color ?? sim.rng.pick(CAR_COLOURS),
    _track: null, _s: 0, _end: 0, _vel: 0, _cruise: 0, _rev: false, _moving: false, _brake: true, _fadeIn: false, _fadeOut: false, _stall: 0,
    _fly: null, _rotorWant: 0,
  };
  sim.vehicles.push(v);
  return v;
}
export function removeVehicle(sim, v) {
  const i = sim.vehicles.indexOf(v);
  if (i >= 0) sim.vehicles.splice(i, 1);
}
export function drive(v, track, o = {}) {
  v._track = track; v._s = o.from ?? 0; v._end = o.to ?? track.len; v._cruise = o.speed ?? 8; v._rev = !!o.reverse;
  v._vel = o.v0 ?? 0; v._brake = o.brake ?? true; v._fadeIn = !!o.fadeIn; v._fadeOut = !!o.fadeOut; v._moving = true; v._stall = 0;
  const p = sample(track, v._s);
  v.x = p.x; v.z = p.z;
  if (o.snap ?? v._s === 0) v.heading = o.reverse ? Math.atan2(-p.tx, -p.tz) : Math.atan2(p.tx, p.tz);
  v.scale = v._fadeIn ? 0 : 1;
}
export const flyTo = (v, to, mins, ease = true) => { v._fly = { x0: v.x, y0: v.y, z0: v.z, to, t: 0, T: mins, ease }; };

export function stepVehicles(sim, h) {
  const list = sim.vehicles;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v.type === 'helicopter') {
      v.rotor += clamp(v._rotorWant - v.rotor, -0.45 * h, 0.45 * h);
      const f = v._fly;
      if (f) {
        f.t = Math.min(f.T, f.t + h);
        const u = f.t / f.T, e = f.ease ? u * u * (3 - 2 * u) : u;
        v.x = f.x0 + (f.to.x - f.x0) * e; v.y = f.y0 + (f.to.y - f.y0) * e; v.z = f.z0 + (f.to.z - f.z0) * e;
        if (u >= 1) v._fly = null;
      }
      continue;
    }
    if (!v._moving) continue;
    const remain = v._end - v._s;
    let want = v._cruise;
    if (v._brake) want = Math.min(want, Math.sqrt(2 * DEC * Math.max(remain, 0)) + 0.35);
    // Simple car following, so nothing drives through anything else on the shared lanes.
    const fx = v._rev ? -Math.sin(v.heading) : Math.sin(v.heading), fz = v._rev ? -Math.cos(v.heading) : Math.cos(v.heading);
    if (v._stall < 5) {
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (o === v || o.type === 'helicopter') continue;
        const dx = o.x - v.x, dz = o.z - v.z, ahead = dx * fx + dz * fz;
        if (ahead < 0.5 || ahead > 11) continue;
        if (Math.abs(dx * fz - dz * fx) > 1.5) continue;
        want = Math.min(want, ahead < 6.5 ? 0 : Math.max(o._vel, 2));
      }
    }
    v._vel += clamp(want - v._vel, -DEC * 2 * h, ACC * h);
    if (v._vel < 0.05) v._stall += h; else v._stall = 0;
    v._s = Math.min(v._end, v._s + v._vel * h);
    const p = sample(v._track, v._s);
    v.x = p.x; v.z = p.z;
    const aim = v._rev ? Math.atan2(-p.tx, -p.tz) : Math.atan2(p.tx, p.tz);
    v.heading = wrap(v.heading + clamp(wrap(aim - v.heading), -(1.2 + v._vel * 0.3) * h, (1.2 + v._vel * 0.3) * h));
    if (v._fadeIn) v.scale = Math.min(1, v._s / 5);
    if (v._fadeOut) v.scale = Math.min(1, (v._track.len - v._s) / 5);
    if (remain <= 0.02) { v._moving = false; v._vel = 0; }
  }
}

export function* trafficCar(sim, track) {
  const v = addVehicle(sim, 'car', 'Car');
  drive(v, track, { speed: sim.rng.range(7.5, 9.5), v0: 8, brake: false, fadeIn: true, fadeOut: true });
  yield until(() => !v._moving, 60);
  removeVehicle(sim, v);
}
