// Reads the built hospital. Everything spatial in the twin comes from here: plan.js gives walls, doors and portals,
// shell.placed + CATALOG give beds, seats and work spots. Nothing in the sim hard-codes a furniture position.
import { ROOMS, DOORS, PORTALS, ZONES, SITE, BUILDING, roomAt, roomById } from '../world/plan.js';
import { CATALOG } from '../props/registry.js';
import { NavGrid } from './nav.js';
import { fixturePlaced } from './fixture.js';

const DEG = Math.PI / 180;
const WALL_CLEAR = 0.3;
const PROP_GROW = 0.15;
// Hard ground people may use outside. Lawns and the road stay off limits, and the two strips join up the paved islands.
const OUTDOOR = (() => {
  const { plaza, dropoff, apron, spur, parking, helipad, garden } = ZONES;
  return [plaza, dropoff, apron, spur, parking, helipad, garden, { x: 44, z: 3, w: 4, d: 12 }, { x: 38, z: 25, w: 2, d: 4 }];
})();
const EQUIP = {
  mriScanner: { prefix: 'MRI', type: 'mri', name: 'MRI scanner' },
  ctScanner: { prefix: 'CT', type: 'ct', name: 'CT scanner' },
  xrayMachine: { prefix: 'XRAY', type: 'xray', name: 'X-ray machine' },
  ventilator: { prefix: 'VENT', type: 'ventilator', name: 'Ventilator' },
  analyzer: { prefix: 'AN', type: 'analyzer', name: 'Blood analyser', idOnly: true },
  pillRobot: { prefix: 'ROBOT', type: 'pillRobot', name: 'Pharmacy robot', idOnly: true },
  crashCart: { prefix: 'CRASH', type: 'crashCart', name: 'Crash cart', idOnly: true },
};
// Where a patient lies on each scanner, in the prop's local metres. Tables slide out toward +Z.
export const SCAN_TABLE = { mriScanner: [0, 1.15], ctScanner: [0, 1.0], xrayMachine: [0, 0.05] };
const STAFF_SEATS = new Set(['receptionDesk', 'nurseStation', 'triageDesk', 'workstation', 'controlDesk']);

const toWorld = (it, lx, lz) => ({ x: it.x + lx * it.cos + lz * it.sin, z: it.z - lx * it.sin + lz * it.cos });
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

function normalise(p, i) {
  const name = p.name ?? p.entry?.p;
  const meta = p.meta ?? CATALOG[name];
  if (!meta || !p.world) return null;
  // entry.r is the authored value and always degrees; `heading` is only the fallback for placements without one.
  const rot = p.entry?.r !== undefined ? p.entry.r * DEG : (p.heading ?? 0);
  const floor = p.floor ?? 0;
  return {
    key: i, name, meta, id: p.entry?.id ?? null, opts: p.entry?.o ?? {},
    roomId: p.roomId === 'exterior' ? null : (p.roomId ?? roomAt(floor, p.world.x, p.world.z)?.id ?? null),
    floor, x: p.world.x, z: p.world.z, rot, sin: Math.sin(rot), cos: Math.cos(rot),
  };
}

function wallRuns(floor) {
  const doors = DOORS.filter((d) => d.floor === floor);
  const segs = [];
  const run = (x0, z0, x1, z1) => {
    const along = z0 === z1;
    const cuts = doors
      .filter((d) => (along ? d.axis === 'x' && Math.abs(d.z - z0) < 1e-3 : d.axis === 'z' && Math.abs(d.x - x0) < 1e-3))
      .map((d) => (along ? [d.x - d.w / 2, d.x + d.w / 2] : [d.z - d.w / 2, d.z + d.w / 2]))
      .sort((a, b) => a[0] - b[0]);
    let s = along ? Math.min(x0, x1) : Math.min(z0, z1);
    const e = along ? Math.max(x0, x1) : Math.max(z0, z1);
    const add = (a, b) => { if (b - a > 1e-3) segs.push(along ? [a, z0, b, z0] : [x0, a, x0, b]); };
    for (const [a, b] of cuts) { if (b <= s || a >= e) continue; add(s, a); s = Math.max(s, b); }
    add(s, e);
  };
  for (const r of ROOMS) {
    if (r.floor !== floor) continue;
    const { x, z, w, d } = r.rect;
    run(x, z, x + w, z); run(x, z + d, x + w, z + d); run(x, z, x, z + d); run(x + w, z, x + w, z + d);
  }
  return segs;
}

function buildGrid(floor, items) {
  const g = floor === 0
    ? new NavGrid(0, SITE.x0, SITE.z0, SITE.x1, SITE.z1)
    : new NavGrid(1, 0, 0, BUILDING.w, BUILDING.d);
  for (const r of ROOMS) if (r.floor === floor) g.paint(0, () => true, r.rect.x, r.rect.z, r.rect.x + r.rect.w - 1e-6, r.rect.z + r.rect.d - 1e-6);
  if (floor === 0) for (const z of OUTDOOR) g.paint(0, () => true, z.x, z.z, z.x + z.w - 1e-6, z.z + z.d - 1e-6);
  for (const [x0, z0, x1, z1] of wallRuns(floor)) {
    g.paint(1, (x, z) => {
      const cx = Math.max(x0, Math.min(x1, x)), cz = Math.max(z0, Math.min(z1, z));
      return Math.hypot(x - cx, z - cz) <= WALL_CLEAR;
    }, x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  }
  for (const p of PORTALS) {
    if (p.kind === 'lift') g.rect(1, p.x, p.z, 2.4, 2.6, 0, 1, 0.1);
    else g.rect(1, p.x, p.z, p.w, p.d, 0, 1, 0.05);
  }
  for (const it of items) {
    if (it.floor !== floor || it.meta.nav === false || it.meta.wall) continue;
    const [w, d] = it.meta.fp;
    // Trees block by trunk, not canopy.
    const grow = it.meta.owner === 'outdoor' ? 0 : PROP_GROW;
    const fw = it.name.startsWith('tree') ? 0.6 : w, fd = it.name.startsWith('tree') ? 0.6 : d;
    g.rect(1, it.x, it.z, fw, fd, it.sin, it.cos, grow);
    // The nurse station is a curved counter open at the back: staff stand inside it.
    if (it.name === 'nurseStation') g.rect(0, it.x, it.z, fw, fd, it.sin, it.cos, 0, -w / 2 + 0.34, w / 2 - 0.34, -d / 2 - 0.3, 0.3);
  }
  const seed = floor === 0 ? { x: 7.5, z: 20 } : { x: 16, z: 12.5 };
  g.flood(seed.x, seed.z);
  return g;
}

function makeSpot(world, it, kind, lx, lz, extra = {}) {
  const g = world.grids[it.floor];
  const p = toWorld(it, lx, lz);
  const inFree = g.free(p.x, p.z);
  const [, depth] = it.meta.fp;
  // Seats sit inside their own footprint: come at them from the front edge.
  const from = !inFree && kind === 'seat' ? toWorld(it, lx, depth / 2 + 0.4) : p;
  const ap = g.point(from.x, from.z) ?? p;
  const heading = kind === 'seat' ? it.rot : facing(p, it);
  const spot = {
    kind, prop: it.name, propKey: it.key, roomId: it.roomId, floor: it.floor, x: p.x, z: p.z, ax: ap.x, az: ap.z, heading, by: null, ...extra,
  };
  // A work spot that landed on a blocked cell moves to the nearest clear one, because nothing should stand inside a cabinet.
  if (kind !== 'seat' && !inFree) { spot.x = ap.x; spot.z = ap.z; spot.heading = facing(ap, it); }
  return spot;
}

function makeBed(world, it, index) {
  const kind = it.name === 'orTable' ? 'or' : it.roomId === 'icu' || it.name === 'icuBed' ? 'icu' : it.roomId === 'er' ? 'er' : 'ward';
  const id = it.id ?? `${kind.toUpperCase()}${index + 1}`;
  const [ux, uz] = it.meta.use ?? [1, 0];
  const bed = {
    id, roomId: it.roomId, floor: it.floor, x: it.x, z: it.z, heading: it.rot, kind, status: 'free', patientId: null,
    vitals: { hr: 0, spo2: 0, rr: 0, sys: 0, dia: 0, temp: 0 }, alarm: null,
    _item: it, _for: null, _surge: false, _cleanJob: false,
  };
  bed._use = makeSpot(world, it, 'bedside', ux, uz);
  bed._use2 = makeSpot(world, it, 'bedside', -ux, uz);
  bed._foot = makeSpot(world, it, 'bedside', 0, it.meta.fp[1] / 2 + 0.5);
  bed._spots = [bed._use, bed._use2, bed._foot];
  return bed;
}

export function readWorld(shell) {
  let placed = shell?.placed ?? [];
  let usingFixture = false;
  if (!placed.length) {
    console.warn('[sim] shell.placed is empty, running on the built-in fixture so the twin stays alive.');
    placed = fixturePlaced();
    usingFixture = true;
  }
  const items = placed.map(normalise).filter(Boolean);
  const world = { items, usingFixture, grids: [], beds: new Map(), rooms: new Map(), equipment: new Map(), spots: [], seats: [], uses: [], portals: PORTALS };
  world.grids = [buildGrid(0, items), buildGrid(1, items)];

  const counts = {}, equipIds = new Set(items.map((i) => i.id).filter(Boolean));
  for (const it of items) {
    const { meta, name } = it;
    if (meta.bed) { const bed = makeBed(world, it, world.beds.size); world.beds.set(bed.id, bed); }
    for (const [lx, lz] of meta.seats ?? []) {
      const s = makeSpot(world, it, 'seat', lx, lz, { staff: STAFF_SEATS.has(name) });
      world.spots.push(s);
      if (!s.staff) world.seats.push(s);
      else world.uses.push(s);
    }
    if (meta.use && !meta.bed) {
      const s = makeSpot(world, it, 'use', meta.use[0], meta.use[1]);
      world.spots.push(s); world.uses.push(s);
    }
    const eq = EQUIP[name];
    if (eq && !(eq.idOnly && !it.id)) {
      counts[name] = (counts[name] ?? 0) + 1;
      let id = it.id;
      if (!id) { do { id = `${eq.prefix}${counts[name]++}`; } while (equipIds.has(id)); equipIds.add(id); }
      const many = items.filter((o) => o.name === name).length > 1;
      world.equipment.set(id, {
        id, roomId: it.roomId, type: eq.type, name: many ? `${eq.name} ${id.replace(/\D+/, '')}` : eq.name,
        status: 'idle', health: 1, note: '', _item: it, _by: null, _spot: meta.use ? makeSpot(world, it, 'use', meta.use[0], meta.use[1]) : null,
      });
    }
  }

  for (const r of ROOMS) {
    const beds = [...world.beds.values()].filter((b) => b.roomId === r.id);
    const seats = world.seats.filter((s) => s.roomId === r.id);
    const work = world.uses.filter((s) => s.roomId === r.id);
    world.rooms.set(r.id, {
      id: r.id, name: r.name, dept: r.dept, floor: r.floor,
      capacity: beds.length || seats.length || work.length || 1,
      occupied: 0, occupancy: 0, status: 'calm', waiting: 0, staffIds: [], patientIds: [],
    });
  }

  const g0 = world.grids[0];
  const desk = items.find((i) => i.name === 'receptionDesk');
  const inside = g0.point(7.5, 23.8), outside = g0.point(7.5, 28.2);
  world.entry = { outside: { floor: 0, ...outside }, inside: { floor: 0, ...inside } };
  world.kerb = { floor: 0, ...g0.point(8, 29.3) };
  world.plazaEnds = [{ floor: 0, ...g0.point(0.7, 27.9) }, { floor: 0, ...g0.point(37.2, 27.9) }];
  world.queue = [];
  if (desk) {
    const [, d] = desk.meta.fp, front = d / 2 + 0.45;
    for (const [lx, lz] of [[-1.3, front], [1.3, front], [0, front + 0.7], [0, front + 1.5], [0, front + 2.3], [0, front + 3.1]]) {
      const p = toWorld(desk, lx, lz), ap = g0.point(p.x, p.z);
      world.queue.push({ kind: 'queue', floor: 0, roomId: desk.roomId, x: ap.x, z: ap.z, ax: ap.x, az: ap.z, heading: desk.rot + Math.PI, by: null });
    }
  }
  const triage = items.find((i) => i.name === 'triageDesk');
  if (triage) {
    const p = toWorld(triage, 0, triage.meta.fp[1] / 2 + 0.42), ap = g0.point(p.x, p.z);
    world.triageFront = { kind: 'front', floor: 0, roomId: triage.roomId, x: ap.x, z: ap.z, ax: ap.x, az: ap.z, heading: triage.rot + Math.PI, by: null };
  }
  const door = DOORS.find((d) => d.id === 'd_ambu');
  world.ambulanceDoor = { floor: 0, ...g0.point(door.x + 1.2, door.z) };
  return world;
}

/** Local helper for scanners: where the patient actually lies. */
export function tableSpot(eq) {
  const it = eq._item, table = SCAN_TABLE[it.name] ?? [0, 0];
  const p = toWorld(it, table[0], table[1]);
  return { floor: it.floor, x: p.x, z: p.z, ax: eq._spot?.ax ?? p.x, az: eq._spot?.az ?? p.z, heading: it.rot, roomId: it.roomId };
}

export { toWorld, roomById };
