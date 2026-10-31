// The building and its site. Everything here is derived from plan.js, themed from palette.js, and furnished from furnishing.js.
import * as THREE from 'three';
import { THEMES } from '../style/palette.js';
import { makeProp, CATALOG } from '../props/registry.js';
import { FURNISHING } from './furnishing.js';
import { BUILDING, DOORS, FLOOR_HEIGHT, ROOMS, WALL, roomById, roomsOnFloor } from './plan.js';
import { archMaterial, damp, follower, nightUniform } from './shell-geo.js';
import { bake } from './shell-bake.js';
import { CAP, buildWalls, frostMaterial } from './shell-walls.js';
import { GROUND_Y, buildIsland } from './shell-site.js';
import { buildFloorAO, buildFloorMeshes, buildPlate, nightFloors } from './shell-floors.js';
import { buildDoors, buildPortal } from './shell-doors.js';
import { VOID, buildLanding, buildLifts, buildStairs } from './shell-core.js';
import { createTints, lightPools, roomLayers, roomPools } from './shell-overlays.js';

const SIDE_ORDER = ['S', 'E', 'N', 'W'];
const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
// A material that renders nothing keeps the mesh visible to raycasters, which a hidden mesh may not be, at zero draw cost.
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
const deg = THREE.MathUtils.degToRad;

const sheetMesh = (sheet, material, { cast = true, receive = true } = {}) => {
  const m = new THREE.Mesh(sheet.geometry(), material);
  m.castShadow = cast; m.receiveShadow = receive; m.userData.dynamic = true;
  return m;
};

const sideOfWall = (wx, wz) => {
  const d = [['N', wz], ['S', BUILDING.d - wz], ['W', wx], ['E', BUILDING.w - wx]].sort((a, b) => a[1] - b[1])[0];
  return d[1] < 0.9 ? d[0] : null;
};

/** What must stay clear of windows on a side: anything hung on that wall, and tall furniture standing against it. */
function blockers(floor) {
  const out = { N: [], S: [], E: [], W: [] };
  for (const room of roomsOnFloor(floor)) for (const e of FURNISHING[room.id] ?? []) {
    const meta = CATALOG[e.p];
    if (!meta) continue;
    const wx = room.rect.x + e.x, wz = room.rect.z + e.z, side = sideOfWall(wx, wz);
    // Slim poles (monitors, IV stands) don't block a window, or Level 1 loses most of its curtains.
    if (!side || !(meta.wall || (meta.h >= 1.5 && Math.max(...meta.fp) >= 0.9))) continue;
    const across = Math.abs(((e.r ?? 0) % 180)) === 90, half = (across ? meta.fp[1] : meta.fp[0]) / 2, u = side === 'N' || side === 'S' ? wx : wz;
    out[side].push({ u0: u - half, u1: u + half });
  }
  out.E.push({ u0: 0, u1: 3.3 });
  return out;
}

export function buildShell(engine) {
  const { ground, floors } = engine;
  if (engine.renderer) engine.renderer.localClippingEnabled = true;
  const rooms = new Map(), entities = new Map(), placed = [], ticks = [[], [], []], frost = frostMaterial();
  const exterior = FURNISHING.exterior ?? [];
  const sideStates = [], floorSets = [], signs = [];

  buildIsland(ground, { padProp: exterior.some((e) => e.p === 'helipad'), bayProp: exterior.some((e) => e.p === 'parkingBay') });

  const proxy = (parent, x, y, z, sx, sy, sz, ry, info) => {
    const m = new THREE.Mesh(proxyGeo, proxyMat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.userData.dynamic = true;
    parent.add(m);
    engine.addPickable?.(m, info);
    return m;
  };

  const hook = (g, into) => {
    g.traverse((o) => {
      if (o.userData.tick) into.push(o.userData.tick);
      if (o !== g && o.userData.setState && !g.userData.setState) g.userData.setState = o.userData.setState;
      if (o !== g && o.userData.anchors && !g.userData.anchors) g.userData.anchors = o.userData.anchors;
    });
  };

  const placeProp = (entry, roomId, floor, parent, ox, oz, tickList, sides) => {
    const meta = CATALOG[entry.p], g = makeProp(entry.p, entry.o ?? {});
    const x = ox + entry.x, z = oz + entry.z, y = entry.y ?? 0, heading = deg(entry.r ?? 0);
    g.position.set(x, y + (roomId === 'exterior' ? GROUND_Y : 0), z);
    g.rotation.y = heading;
    const side = meta?.wall && sides ? sideOfWall(x, z) : null;
    (side ? sides[side].attach : parent).add(g);
    if (side) sides[side].hang = Math.max(sides[side].hang, y);
    hook(g, tickList);
    const world = { x, y: floor * FLOOR_HEIGHT + y, z };
    placed.push({ name: entry.p, entry, roomId, floor, world, heading, meta });
    if (entry.id) {
      entities.set(entry.id, { group: g, entry, roomId, floor, world, heading });
      const [w, d] = meta?.fp ?? [0.8, 0.8], h = meta?.h ?? 1, type = meta?.bed ? 'bed' : 'equipment';
      proxy(parent, x, y + h / 2, z, w, h, d, heading, { type, id: entry.id, floor });
    }
  };

  for (const f of [0, 1]) {
    const plate = floors[f], arch = new THREE.Group(), floorRooms = roomsOnFloor(f), void_ = f === 1 ? VOID : null, block = blockers(f);
    arch.userData.dynamic = true;
    plate.add(arch);
    plate.add(buildPlate(f, void_));
    arch.add(buildFloorMeshes(f, void_));

    const walls = buildWalls(f, { avoid: (s) => block[s] });
    const doorSet = buildDoors(f, walls.runs, walls.solid, walls.panes, arch);
    const liftSet = buildLifts(f, walls.solid, plate);
    if (f === 0) buildStairs(walls.solid); else buildLanding(walls.solid, walls.panes);
    arch.add(buildFloorAO(walls.runs));

    const sides = {};
    for (const name of SIDE_ORDER) {
      const src = walls.sides[name];
      const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), WALL.full);
      const upper = sheetMesh(src.upper, archMaterial(clip));
      const cap = sheetMesh(src.cap, archMaterial());
      cap.position.y = WALL.full - CAP;
      const attach = new THREE.Group(); attach.userData.dynamic = true;
      arch.add(upper, cap); plate.add(attach);
      const st = { name, floor: f, upper, cap, clip, attach, hang: 0, f: follower(WALL.full), target: WALL.full, wait: 0, y: NaN };
      sides[name] = st; sideStates.push(st);
    }
    arch.add(sheetMesh(walls.solid, archMaterial()));
    if (walls.panes.pos.length) {
      const glass = new THREE.Mesh(walls.panes.geometry(), frost);
      glass.castShadow = false; glass.receiveShadow = false; glass.renderOrder = 3; glass.userData.dynamic = true;
      arch.add(glass);
    }

    if (f === 0) for (const d of DOORS.filter((q) => q.kind === 'slide')) { const p = buildPortal(d); plate.add(p.group); signs.push(p.signMat); }

    const overlays = new THREE.Group(); overlays.userData.dynamic = true; plate.add(overlays);
    const pools = lightPools(roomPools(floorRooms), 0.014); arch.add(pools);

    for (const room of floorRooms) {
      const { overlay, glow } = roomLayers(room), r = room.rect;
      overlays.add(overlay, glow);
      const centre = { x: r.x + r.w / 2, y: f * FLOOR_HEIGHT, z: r.z + r.d / 2 };
      rooms.set(room.id, { room, overlay, glowMesh: glow, centre, floor: f });
      if (!room.circulation) proxy(plate, centre.x, 0.03, centre.z, r.w, 0.06, r.d, 0, { type: 'room', id: room.id, floor: f });
    }

    for (const room of floorRooms) for (const e of FURNISHING[room.id] ?? []) placeProp(e, room.id, f, plate, room.rect.x, room.rect.z, ticks[f], sides);
    for (const s of SIDE_ORDER) if (sides[s].attach.children.length) bake(sides[s].attach);
    bake(plate);
    floorSets.push({ f, doorSet, liftSet, pools, sides });
  }

  for (const e of exterior) placeProp(e, 'exterior', 0, ground, 0, 0, ticks[2], null);
  const outdoor = lightPools([
    ...exterior.filter((e) => e.p === 'lampPost').map((e) => ({ x: e.x, z: e.z, r: 5.2 })),
    ...DOORS.filter((d) => d.kind === 'slide').map((d) => (d.axis === 'x' ? { x: d.x, z: d.z + 2, r: 7 } : { x: d.x + 2, z: d.z, r: 7 })),
    ...[...Array(10)].map((_, i) => ({ x: 2 + i * 3.8, z: 27.6, r: 2.6 })),
  ], GROUND_Y + 0.02);
  ground.add(outdoor);
  bake(ground);

  const tints = createTints(rooms);
  let azimuth = engine.azimuthIndex ?? 0, mode = engine.floorMode ?? 'ground', wallMode = 'cutaway';

  const cutFor = (az) => {
    const i = ((az % 4) + 4) % 4;
    return [['S', 'E'], ['S', 'W'], ['N', 'W'], ['N', 'E']][i];
  };
  const retarget = (instant) => {
    const cut = cutFor(azimuth);
    for (const s of sideStates) {
      const active = mode === 'stack' || (mode === 'level1' ? s.floor === 1 : s.floor === 0);
      const target = wallMode !== 'up' && active && cut.includes(s.name) ? WALL.cut : WALL.full;
      if (target === s.target) continue;
      s.target = target;
      // Walls that rise go first, so the room is never left open on three sides mid-turn.
      s.wait = target === WALL.full ? 0 : 0.1;
      if (instant) { s.f.v0 = target; s.f.vel = 0; s.wait = 0; }
    }
  };
  retarget(true);
  engine.on?.('view', (v) => {
    if (v?.azimuthIndex !== undefined) azimuth = v.azimuthIndex;
    if (v?.floorMode) mode = v.floorMode;
    retarget(false);
  });

  const updateSide = (s, dt) => {
    if (s.wait > 0) { s.wait -= dt; } else if (s.f.v0 !== s.target || s.f.vel !== 0) {
      damp(s.f, s.target, dt, 6.2);
      if (Math.abs(s.f.v0 - s.target) < 0.002 && Math.abs(s.f.vel) < 0.01) { s.f.v0 = s.target; s.f.vel = 0; }
    }
    const h = s.f.v0, wy = engine.floorY ? engine.floorY(s.floor) : floors[s.floor].position.y, c = wy + h - CAP + 0.004;
    if (c === s.y) return;
    s.y = c;
    s.clip.constant = c;
    s.cap.position.y = h - CAP;
    s.upper.visible = h > WALL.cut + 0.003;
    s.attach.visible = h > s.hang;
  };
  sideStates.forEach((s) => updateSide(s, 0));

  return {
    rooms, entities, placed,
    update(dt, t, twin) {
      const ctx = engine.ctx ?? { night: 0 }, night = ctx.night ?? 0, actors = twin?.actors;
      nightUniform.value = night;
      for (let i = 0; i < 3; i++) {
        if (i < 2 && engine.floorVisible && !engine.floorVisible(i)) continue;
        for (const f of ticks[i]) f(dt, t, ctx);
      }
      for (const s of sideStates) updateSide(s, dt);
      for (const fs of floorSets) {
        fs.doorSet.update(dt, actors);
        fs.liftSet.update(dt, actors);
        fs.pools.visible = night > 0.01;
        fs.pools.material.opacity = night * 0.2;
      }
      outdoor.visible = night > 0.01; outdoor.material.opacity = night * 0.34;
      for (const m of nightFloors) m.emissiveIntensity = night * 0.1;
      for (const m of signs) m.emissiveIntensity = 0.16 + night * 1.15;
      tints.update(dt, t);
    },
    setRoomTint: (id, color, a) => tints.setTint(id, color, a),
    highlightRoom: (id) => tints.highlight(id),
    setWallMode(m) { wallMode = m; retarget(false); },
  };
}
