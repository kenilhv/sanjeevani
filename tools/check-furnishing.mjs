#!/usr/bin/env node
// Proves the set dressing is physically sane and walkable. Plain node, no DOM.
//   node tools/check-furnishing.mjs            errors exit 1, warnings do not
//   node tools/check-furnishing.mjs --quiet    prints only problems and the verdict
import { FURNISHING } from '../src/world/furnishing.js';
import { CATALOG } from '../src/props/registry.js';
import { ROOMS, DOORS, PORTALS, ZONES, SITE, BUILDING, ROUTES, WALL, roomAt, roomById } from '../src/world/plan.js';

const quiet = process.argv.includes('--quiet');
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const round = (n) => Math.round(n * 100) / 100;

const WALL_FACE = WALL.thick / 2;
const FRONT_MIN = 1.2;      // metres of free floor kept either side of every door gap
const BODY = 0.15;          // matches PROP_GROW in src/sim/world.js
const WALL_CLEAR = 0.3;     // matches src/sim/world.js: cells this close to a wall line are solid
const AISLE = 0.6;          // walkway pass: half of the 1.2 m walkway
const LAST_STEP = 1.9;      // a spot may sit this far off the 1.2 m walkway: the final steps into a bedside
const LIFT = { w: 2.4, d: 2.8 };

const rad = (d) => (d * Math.PI) / 180;
/** Local prop point to world offset, matching a THREE rotation about Y of r degrees. */
const turn = (lx, lz, r) => {
  const s = Math.sin(rad(r)), c = Math.cos(rad(r));
  return [lx * c + lz * s, -lx * s + lz * c];
};
const boxOf = (name, x, z, r) => {
  const [w, d] = CATALOG[name].fp;
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([a, b]) => turn(a, b, r));
  const xs = corners.map((c) => c[0]), zs = corners.map((c) => c[1]);
  return { x0: x + Math.min(...xs), x1: x + Math.max(...xs), z0: z + Math.min(...zs), z1: z + Math.max(...zs) };
};
const hit = (a, b, gap = 0) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.z0 < b.z1 + gap && a.z1 > b.z0 - gap;
const inside = (b, x, z, m = 0) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m;
const distBox = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const blocks = (m) => m.nav !== false && !m.wall;
const label = (e) => `${e.roomId}/${e.id ?? e.p}@${round(e.x)},${round(e.z)}`;

// Door gaps resolved to a box that spans the wall line.
const doorBox = (d, reach = 0) => (d.axis === 'x'
  ? { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - reach, z1: d.z + reach }
  : { x0: d.x - reach, x1: d.x + reach, z0: d.z - d.w / 2, z1: d.z + d.w / 2 });

// ── structure ──────────────────────────────────────────────────────────────
for (const r of ROOMS) if (!Array.isArray(FURNISHING[r.id])) err(`room ${r.id} has no placement list`);
for (const k of Object.keys(FURNISHING)) if (k !== 'exterior' && !roomById(k)) err(`unknown room key ${k}`);
if (!Array.isArray(FURNISHING.exterior)) err('exterior list missing');

const all = [];
for (const [roomId, list] of Object.entries(FURNISHING)) {
  const room = roomById(roomId);
  for (const e of list ?? []) {
    const meta = CATALOG[e.p];
    if (!meta) { err(`${roomId}: unknown prop ${e.p}`); continue; }
    if (![e.x, e.z].every(Number.isFinite)) { err(`${roomId}/${e.p}: bad coordinates`); continue; }
    const r = e.r ?? 0;
    const wx = (room?.rect.x ?? 0) + e.x, wz = (room?.rect.z ?? 0) + e.z;
    all.push({ ...e, r, roomId, room, meta, wx, wz, floor: room?.floor ?? 0, box: boxOf(e.p, wx, wz, r) });
  }
}

const ids = new Map();
for (const e of all) {
  if (e.meta.bed && !e.id) err(`${label(e)}: bed without an id`);
  if (!e.id) continue;
  if (ids.has(e.id)) err(`duplicate id ${e.id}: ${label(ids.get(e.id))} and ${label(e)}`);
  ids.set(e.id, e);
}
const need = [
  ...[1, 2, 3, 4, 5].map((n) => `ER${n}`), ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`A${n}`, `B${n}`, `ICU${n}`]), ...[1, 2, 3, 4].map((n) => `C${n}`),
  'OR1', 'OR2', 'MRI1', 'CT1', 'XRAY1', 'VENT1', 'VENT2', 'VENT3',
];
for (const id of need) if (!ids.has(id)) err(`missing required entity ${id}`);

// ── rooms: containment, overlaps, doors, wall props ────────────────────────
const interiorOf = (room) => ({
  x0: room.rect.x + WALL_FACE, x1: room.rect.x + room.rect.w - WALL_FACE,
  z0: room.rect.z + WALL_FACE, z1: room.rect.z + room.rect.d - WALL_FACE,
});
const indoor = all.filter((e) => e.room);
const contained = (b, o) => b.x0 >= o.x0 - 1e-6 && b.x1 <= o.x1 + 1e-6 && b.z0 >= o.z0 - 1e-6 && b.z1 <= o.z1 + 1e-6;

for (const room of ROOMS) {
  const list = indoor.filter((e) => e.roomId === room.id);
  const io = interiorOf(room);
  for (const e of list) {
    if (e.meta.wall) continue;
    if (!contained(e.box, io)) err(`${label(e)}: footprint leaves the room (${[e.box.x0, e.box.x1, e.box.z0, e.box.z1].map(round)})`);
  }
  const solid = list.filter((e) => blocks(e.meta));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    if (hit(solid[i].box, solid[j].box, -0.005)) err(`${label(solid[i])} overlaps ${label(solid[j])}`);
  }
  for (const d of DOORS.filter((d) => d.floor === room.floor && d.rooms.includes(room.id))) {
    const zone = doorBox(d, FRONT_MIN);
    for (const e of solid) if (hit(e.box, zone)) err(`${label(e)} blocks door ${d.id}`);
  }
  if (room.circulation) {
    for (const p of PORTALS.filter((p) => inside({ x0: room.rect.x, x1: room.rect.x + room.rect.w, z0: room.rect.z, z1: room.rect.z + room.rect.d }, p.x, p.z))) {
      const box = p.kind === 'lift'
        ? { x0: p.x - LIFT.w / 2, x1: p.x + LIFT.w / 2, z0: p.z - LIFT.d / 2, z1: p.z + LIFT.d / 2 }
        : { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 };
      for (const e of solid) {
        if (hit(e.box, box)) err(`${label(e)} blocks portal ${p.id}`);
        for (const s of [p.stand, p.standTop].filter(Boolean)) if (distBox(e.box, s.x, s.z) < 0.7) err(`${label(e)} crowds portal stand ${p.id}`);
      }
    }
  }
}

// A wall line exists on an edge wherever no door gap interrupts it.
const edgeOf = (e) => {
  const { x, z, w, d } = e.room.rect;
  const faces = [
    { side: 'N', r: 0, gap: Math.abs(e.wz - z), along: e.wx, lo: x, hi: x + w, line: z, axis: 'x' },
    { side: 'S', r: 180, gap: Math.abs(e.wz - (z + d)), along: e.wx, lo: x, hi: x + w, line: z + d, axis: 'x' },
    { side: 'W', r: 90, gap: Math.abs(e.wx - x), along: e.wz, lo: z, hi: z + d, line: x, axis: 'z' },
    { side: 'E', r: 270, gap: Math.abs(e.wx - (x + w)), along: e.wz, lo: z, hi: z + d, line: x + w, axis: 'z' },
  ];
  return faces.sort((a, b) => a.gap - b.gap)[0];
};
const hung = [];
for (const e of indoor.filter((e) => e.meta.wall)) {
  const f = edgeOf(e);
  const half = e.meta.fp[0] / 2;
  if (f.gap > 0.25) err(`${label(e)}: wall prop is ${round(f.gap)} m off the wall`);
  if ((((e.r - f.r) % 360) + 360) % 360 !== 0) err(`${label(e)}: faces the wrong way for the ${f.side} wall (r should be ${f.r})`);
  if (f.along - half < f.lo + WALL_FACE - 1e-6 || f.along + half > f.hi - WALL_FACE + 1e-6) err(`${label(e)}: runs off the end of the ${f.side} wall`);
  if (!Number.isFinite(e.y)) err(`${label(e)}: wall prop has no y`);
  else if (e.y < 1.2 || e.y > 2.6) warn(`${label(e)}: y ${e.y} is outside the 1.2..2.6 hanging band`);
  for (const d of DOORS.filter((d) => d.floor === e.floor && d.axis === f.axis && (f.axis === 'x' ? d.z : d.x) === f.line)) {
    const c = f.axis === 'x' ? d.x : d.z;
    if (Math.abs(f.along - c) < half + d.w / 2) err(`${label(e)}: hangs across door ${d.id}`);
  }
  if (f.side === 'S' || f.side === 'E') warn(`${label(e)}: on a ${f.side} wall, the default camera never sees it`);
  hung.push({ e, f, half });
}
for (let i = 0; i < hung.length; i++) for (let j = i + 1; j < hung.length; j++) {
  const a = hung[i], b = hung[j];
  if (a.e.roomId === b.e.roomId && a.f.side === b.f.side && Math.abs(a.f.along - b.f.along) < a.half + b.half) err(`${label(a.e)} overlaps ${label(b.e)} on the wall`);
}

// ── spots: everything a person must reach ──────────────────────────────────
const spots = [];
const addSpot = (e, kind, lx, lz) => {
  const [dx, dz] = turn(lx, lz, e.r);
  const [w, d] = e.meta.fp;
  const inOwn = Math.abs(lx) < w / 2 && Math.abs(lz) < d / 2;
  // Seats and staff positions drawn inside a footprint are reached from its nearest open edge.
  const out = (a, b) => { const [ox, oz] = turn(a, b, e.r); return { x: e.wx + ox, z: e.wz + oz }; };
  const m = 0.34;
  const ways = !inOwn ? [out(lx, lz)]
    : lz < 0 ? [out(lx, -d / 2 - m), out(-w / 2 - m, lz), out(w / 2 + m, lz)]
    : [out(lx, d / 2 + m), out(-w / 2 - m, lz), out(w / 2 + m, lz), out(lx, -d / 2 - m)];
  spots.push({ e, kind, x: e.wx + dx, z: e.wz + dz, ways, inOwn });
};
for (const e of indoor) {
  const { use, seats, bed } = e.meta;
  if (use) addSpot(e, bed ? 'bed side' : 'use', use[0], use[1]);
  if (use && bed) addSpot(e, 'far bed side', -use[0], use[1]);
  for (const s of seats ?? []) addSpot(e, 'seat', s[0], s[1]);
}

// ── flood fills ────────────────────────────────────────────────────────────
const wallsOf = (floor) => {
  const segs = [], doors = DOORS.filter((d) => d.floor === floor);
  const run = (x0, z0, x1, z1) => {
    const along = z0 === z1;
    const cuts = doors.filter((d) => (along ? d.axis === 'x' && d.z === z0 : d.axis === 'z' && d.x === x0))
      .map((d) => (along ? [d.x - d.w / 2, d.x + d.w / 2] : [d.z - d.w / 2, d.z + d.w / 2])).sort((a, b) => a[0] - b[0]);
    let s = along ? x0 : z0;
    const e = along ? x1 : z1;
    const add = (a, b) => { if (b > a) segs.push(along ? [a, z0, b, z0] : [x0, a, x0, b]); };
    for (const [a, b] of cuts) { if (b <= s || a >= e) continue; add(s, a); s = Math.max(s, b); }
    add(s, e);
  };
  for (const r of ROOMS.filter((r) => r.floor === floor)) {
    const { x, z, w, d } = r.rect;
    run(x, z, x + w, z); run(x, z + d, x + w, z + d); run(x, z, x, z + d); run(x + w, z, x + w, z + d);
  }
  return segs;
};
const WALLS = [wallsOf(0), wallsOf(1)];
const nearWall = (floor, x, z) => WALLS[floor].some(([x0, z0, x1, z1]) => Math.hypot(x - Math.max(x0, Math.min(x1, x)), z - Math.max(z0, Math.min(z1, z))) <= WALL_CLEAR);

function makeGrid(floor, cell) {
  const nx = Math.round(BUILDING.w / cell), nz = Math.round(BUILDING.d / cell);
  const solids = indoor.filter((e) => e.floor === floor && blocks(e.meta)).map((e) => e.box);
  for (const p of PORTALS) {
    if (p.kind === 'lift') solids.push({ x0: p.x - LIFT.w / 2, x1: p.x + LIFT.w / 2, z0: p.z - LIFT.d / 2, z1: p.z + LIFT.d / 2 });
    else solids.push({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 });
  }
  const at = (i, j) => ({ x: (i + 0.5) * cell, z: (j + 0.5) * cell });
  return { floor, cell, nx, nz, solids, at, roomOf: (i, j) => { const c = at(i, j); return roomAt(floor, c.x, c.z); } };
}
/** May a walker step between two neighbouring cells? Same room, or through a door gap on the shared wall. */
function stepOK(g, ax, az, bx, bz, ra, rb) {
  if (ra === rb) return true;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  return DOORS.some((d) => d.floor === g.floor && d.rooms.includes(ra.id) && d.rooms.includes(rb.id) && inside(doorBox(d, g.cell), mx, mz, -0.05));
}
function flood(g, seeds, body) {
  const seen = new Uint8Array(g.nx * g.nz), id = (i, j) => j * g.nx + i;
  const free = (i, j) => { const c = g.at(i, j); return !!roomAt(g.floor, c.x, c.z) && !nearWall(g.floor, c.x, c.z) && !g.solids.some((b) => inside(b, c.x, c.z, body)); };
  const stack = [];
  for (const s of seeds) {
    const i = Math.floor(s.x / g.cell), j = Math.floor(s.z / g.cell);
    if (free(i, j)) { seen[id(i, j)] = 1; stack.push([i, j]); } else err(`floor ${g.floor}: flood seed ${s.x},${s.z} is blocked`);
  }
  while (stack.length) {
    const [i, j] = stack.pop(), a = g.at(i, j), ra = g.roomOf(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz || seen[id(ni, nj)] || !free(ni, nj)) continue;
      const b = g.at(ni, nj), rb = g.roomOf(ni, nj);
      if (!stepOK(g, a.x, a.z, b.x, b.z, ra, rb)) continue;
      seen[id(ni, nj)] = 1; stack.push([ni, nj]);
    }
  }
  return { seen, near(x, z, within) {
    let best = Infinity;
    const span = Math.ceil(within / g.cell) + 1, ci = Math.floor(x / g.cell), cj = Math.floor(z / g.cell);
    for (let j = cj - span; j <= cj + span; j++) for (let i = ci - span; i <= ci + span; i++) {
      if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !seen[id(i, j)]) continue;
      const c = g.at(i, j);
      best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    }
    return best;
  } };
}

const entries = [
  [{ x: 7.5, z: 25.2 }, { x: 37.2, z: 20 }],    // ground: main doors and ambulance doors
  [{ x: 33.6, z: 3.4 }, { x: 36.4, z: 3.4 }],   // level 1: out of the lifts
];
const passes = [0, 1].map((f) => ({ grid: makeGrid(f, 0.5), fill: null }));
passes.forEach((p, f) => { p.fill = flood(p.grid, entries[f], BODY); });

for (const s of spots) {
  const pass = passes[s.e.floor];
  const where = roomAt(s.e.floor, s.x, s.z);
  if (!s.inOwn) {
    if (!where) { err(`${label(s.e)} ${s.kind}: spot ${round(s.x)},${round(s.z)} is outside the building`); continue; }
    if (where.id !== s.e.roomId) err(`${label(s.e)} ${s.kind}: spot ${round(s.x)},${round(s.z)} lands in ${where.id}`);
    const on = indoor.find((o) => o !== s.e && o.floor === s.e.floor && blocks(o.meta) && inside(o.box, s.x, s.z));
    if (on) err(`${label(s.e)} ${s.kind}: spot ${round(s.x)},${round(s.z)} is inside ${label(on)}`);
  }
  // Half a cell of slack: the 0.5 m grid is coarser than the gaps it is proving.
  const ok = s.ways.some((w) => pass.fill.near(w.x, w.z, 0.5) <= 0.6);
  if (!ok) err(`${label(s.e)} ${s.kind}: unreachable at ${round(s.x)},${round(s.z)}`);
}

// The 1.2 m rule: flood each room with a 1.2 m wide body from its door gaps. Every spot has to be a few steps off that walkway.
let worstLastStep = 0, worstAt = '';
for (const room of ROOMS) {
  const g = makeGrid(room.floor, 0.25);
  const io = interiorOf(room);
  g.solids = g.solids.filter((b) => hit(b, io));
  const seeds = [];
  for (const d of DOORS.filter((d) => d.floor === room.floor && d.rooms.includes(room.id))) {
    const c = { x: d.x, z: d.z };
    const toward = d.axis === 'x' ? (d.z > io.z0 + 1 ? { x: c.x, z: d.z - 0.9 } : { x: c.x, z: d.z + 0.9 }) : (d.x > io.x0 + 1 ? { x: d.x - 0.9, z: c.z } : { x: d.x + 0.9, z: c.z });
    seeds.push(toward);
  }
  const seen = new Set();
  const key = (i, j) => `${i},${j}`;
  const free = (i, j) => { const c = g.at(i, j); return c.x > io.x0 + AISLE - 0.05 && c.x < io.x1 - AISLE + 0.05 && c.z > io.z0 + AISLE - 0.05 && c.z < io.z1 - AISLE + 0.05 && !g.solids.some((b) => inside(b, c.x, c.z, AISLE - 0.02)); };
  const stack = [];
  for (const s of seeds) {
    const i = Math.floor(s.x / 0.25), j = Math.floor(s.z / 0.25);
    if (free(i, j)) { seen.add(key(i, j)); stack.push([i, j]); }
    else err(`${room.id}: no 1.2 m walkway at the door seed ${round(s.x)},${round(s.z)}`);
  }
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (seen.has(key(ni, nj)) || !free(ni, nj)) continue;
      seen.add(key(ni, nj)); stack.push([ni, nj]);
    }
  }
  const cells = [...seen].map((k) => k.split(',').map(Number)).map(([i, j]) => g.at(i, j));
  for (const s of spots.filter((s) => s.e.roomId === room.id)) {
    const best = Math.min(...s.ways.map((w) => cells.reduce((m, c) => Math.min(m, Math.hypot(c.x - w.x, c.z - w.z)), Infinity)));
    if (best > worstLastStep) { worstLastStep = best; worstAt = `${label(s.e)} ${s.kind}`; }
    if (best > LAST_STEP) err(`${label(s.e)} ${s.kind}: ${round(best)} m off the nearest 1.2 m walkway`);
  }
}

// ── exterior ───────────────────────────────────────────────────────────────
const zoneBox = (z) => ({ x0: z.x, x1: z.x + z.w, z0: z.z, z1: z.z + z.d });
const HARD = ['street', 'spur', 'apron', 'dropoff', 'plaza', 'parking', 'helipad'];
const MAY_STAND_ON = { helipad: ['helipad'], parkingBay: ['parking'], car: ['parking'], bollard: ['plaza'], flowerBed: ['plaza'], lampPost: ['plaza'] };
const outside = all.filter((e) => !e.room);
const siteBox = { x0: SITE.x0, x1: SITE.x1, z0: SITE.z0, z1: SITE.z1 };
const buildingBox = { x0: 0, x1: BUILDING.w, z0: 0, z1: BUILDING.d };
const polylines = Object.entries(ROUTES).filter(([, v]) => Array.isArray(v));
const routeClearance = (box, line) => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
    for (let s = 0; s <= steps; s++) best = Math.min(best, distBox(box, a.x + ((b.x - a.x) * s) / steps, a.z + ((b.z - a.z) * s) / steps));
  }
  return best;
};
const PATHS = [
  [[-0.2, 27.6], [-3.4, 27.2], [-5.2, 23.5], [-3.6, 19.5], [-5.8, 14.5], [-3.6, 10], [-5.4, 5], [-3.8, 0.4], [-3.6, -2.2], [2, -2.6]],
  [[2, -2.6], [14, -2.3], [26, -2.7], [38, -2.4], [41.4, -2]],
  [[38.75, -2.3], [38.8, 3], [38.75, 8], [38.8, 14.2]],
  [[-5.2, 23.5], [-7.2, 26.6], [-6.5, 31], [-3.8, 33.4]],
  [[-5.8, 14.5], [-7.4, 11.8], [-7.2, 7.2], [-5.4, 5]],
  [[24, 28.8], [24.2, 31], [24, 33.5]],
  [[38, 27.5], [40.5, 27.6], [43.2, 27.8]],
];
/** The painted curve is a chain of quadratics through the midpoints, so sample it the same way. */
const sampled = (pts) => {
  const out = [{ x: pts[0][0], z: pts[0][1] }];
  let from = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i], to = i === pts.length - 2 ? pts[i + 1] : [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    for (let t = 0.1; t <= 1.001; t += 0.1) out.push({ x: (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * c[0] + t ** 2 * to[0], z: (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * c[1] + t ** 2 * to[1] });
    from = to;
  }
  return out;
};
const walks = PATHS.map(sampled);
const POND = { x0: -4.4, x1: -0.8, z0: 13.4, z1: 19 };
for (const e of outside) {
  if (!contained(e.box, siteBox)) err(`${label(e)}: leaves the island`);
  if (!['parkingBay', 'helipad', 'car', 'lampPost'].includes(e.p)) {
    const trunk = e.p.startsWith('tree') ? { x0: e.wx - 0.35, x1: e.wx + 0.35, z0: e.wz - 0.35, z1: e.wz + 0.35 } : e.box;
    for (const w of walks) if (w.some((p) => distBox(trunk, p.x, p.z) < 0.5)) { err(`${label(e)}: stands on a garden path`); break; }
    if (hit(trunk, POND)) err(`${label(e)}: stands in the pond`);
  }
  if (hit(e.box, buildingBox)) err(`${label(e)}: stands inside the building`);
  for (const k of HARD) {
    if (hit(e.box, zoneBox(ZONES[k])) && !(MAY_STAND_ON[e.p] ?? []).includes(k)) err(`${label(e)}: stands on ${k}`);
  }
  if (e.p !== 'parkingBay' && e.p !== 'helipad' && e.p !== 'car') {
    for (const [name, line] of polylines) {
      if (routeClearance(e.box, line) < 1.25) err(`${label(e)}: in the path of ${name}`);
    }
  }
}
for (let i = 0; i < outside.length; i++) for (let j = i + 1; j < outside.length; j++) {
  const a = outside[i], b = outside[j];
  if (!blocks(a.meta) || !blocks(b.meta)) continue;
  if (a.p === 'car' || b.p === 'car') { if (a.p === b.p && hit(a.box, b.box)) err(`${label(a)} overlaps ${label(b)}`); }
  if (hit(a.box, b.box, -0.005)) err(`${label(a)} overlaps ${label(b)}`);
}
// Anything tall south or east of the building paints over the interior from the default camera, so keep it clear.
for (const e of outside.filter((e) => e.meta.h > 2.5)) {
  const reach = e.meta.h / Math.tan(rad(32)) / Math.SQRT2;
  const r = e.meta.fp[0] / 2;
  const tip = { x0: e.wx - reach - r, x1: e.wx - reach + r, z0: e.wz - reach - r, z1: e.wz - reach + r };
  if (e.p !== 'lampPost' && hit(tip, { x0: 0, x1: BUILDING.w, z0: 0, z1: BUILDING.d }) && (e.wx > BUILDING.w || e.wz > BUILDING.d)) warn(`${label(e)}: crown paints over the interior from the default camera`);
}

// ── report ─────────────────────────────────────────────────────────────────
if (!quiet) {
  const beds = all.filter((e) => e.meta.bed).length;
  const rows = ROOMS.map((r) => `${r.id} ${indoor.filter((e) => e.roomId === r.id).length}`).join(', ');
  console.log(`placements: ${all.length} (${indoor.length} indoor, ${outside.length} outdoor), beds ${beds}, ids ${ids.size}`);
  console.log(`rooms: ${rows}`);
  console.log(`spots proved: ${spots.length}. Longest last step off a 1.2 m walkway: ${round(worstLastStep)} m at ${worstAt}`);
}
for (const w of warnings) console.log('warn ', w);
for (const e of errors) console.log('ERROR', e);
console.log(errors.length ? `FAILED: ${errors.length} errors, ${warnings.length} warnings` : `PASSED with ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
