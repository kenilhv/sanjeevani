// Doors: frames go into the floor's wall sheet, leaves are instanced so all of a floor's doors cost one draw call.
import * as THREE from 'three';
import { C } from '../style/palette.js';
import { WALL, HOSPITAL_NAME } from './plan.js';
import { box, cyl, panel, canvasTex, matGlass } from '../style/kit.js';
import { Sheet, rgb, tint, archMaterial, damp, follower, whenFonts, SANS, SERIF } from './shell-geo.js';
import { lbox, P, JAMB, HT, glassTop } from './shell-walls.js';

const LEAF_H = WALL.door - 0.085;
const SWING = 1.72;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** One metre wide leaf, hinge on x = 0. Instances stretch it to each door, which only widens the small window a little. */
function leafGeometry() {
  const s = new Sheet(), y = rgb(C.door), deep = rgb(C.doorDeep), g = 0.3, d = 0.03, white = rgb(C.doorFrame), steel = rgb(C.steel), sky = rgb('#cfeaf6'), skyHi = rgb('#eef9fc');
  s.box(0, 0, -d, 1, LEAF_H, d, y, { g, low: tint(y, 0.92), top: deep });
  for (const sg of [1, -1]) {
    const a = sg * d, b = sg * (d + 0.006), z0 = Math.min(a, b), z1 = Math.max(a, b);
    s.box(0.29, 1.2, z0, 0.71, 1.93, z1, white, { g });
    const c = sg * (d + 0.009), cz0 = Math.min(b, c), cz1 = Math.max(b, c);
    s.box(0.34, 1.26, cz0, 0.66, 1.87, cz1, sky, { g: 1.2, low: skyHi });
    s.box(0.07, 0.03, z0, 0.93, 0.2, z1, steel, { g });
    const h = sg * (d + 0.035), hz0 = Math.min(a, h), hz1 = Math.max(a, h);
    s.box(0.84, 1.02, hz0, 0.9, 1.08, hz1, steel, { g });
    s.box(0.72, 1.03, Math.min(h, h + sg * 0.012), 0.92, 1.07, Math.max(h, h + sg * 0.012), steel, { g });
  }
  return s.geometry();
}

function slideFrameGeometry(h) {
  const s = new Sheet(), c = rgb(C.steel), hi = rgb(C.white), d = 0.03, g = 0.3;
  s.box(0, 0, -d, 0.035, h, d, c, { g }); s.box(0.965, 0, -d, 1, h, d, c, { g });
  s.box(0, 0, -d, 1, 0.075, d, c, { g }); s.box(0, h - 0.06, -d, 1, h, d, c, { g });
  s.box(0.82, 0.92, -d - 0.02, 0.86, 1.3, d + 0.02, hi, { g });
  return s.geometry();
}

function slidePaneGeometry(h) {
  return new THREE.BoxGeometry(0.93, h - 0.13, 0.016).translate(0.5, 0.075 + (h - 0.13) / 2, 0);
}

const yaw = (axis, first) => (axis === 'x' ? (first ? 0 : Math.PI) : first ? -Math.PI / 2 : Math.PI / 2);

export function buildDoors(floor, runs, solid, panes, parent) {
  const doors = [], leaves = [], slides = [], white = rgb(C.doorFrame), g = 0.3, th = rgb('#ccd2da'), thLine = rgb(C.lineYellow), D = WALL.door;
  for (const run of runs) for (const gap of run.doors) {
    const { door, g0, g1 } = gap, o = -HT - 0.018, q = HT + 0.018;
    lbox(solid, run, g0, g1, 0, 0.01, -HT - 0.03, HT + 0.03, th, { g, skip: 'b' });
    lbox(solid, run, g0, g1, 0.01, 0.012, -0.02, 0.02, thLine, { g, skip: 'b' });
    const state = { door, run, f: follower(0), target: 0, sgn: 1, list: [], R2: Math.max(1.6, door.w / 2 + 0.9) ** 2, floor };
    if (door.kind !== 'slide') {
      lbox(solid, run, g0, g0 + JAMB, 0, glassTop, o, q, white, { g });
      lbox(solid, run, g1 - JAMB, g1, 0, glassTop, o, q, white, { g });
    }
    if (door.kind === 'swing' || door.kind === 'double') {
      lbox(solid, run, g0 + JAMB, g1 - JAMB, D - 0.07, D, o, q, white, { g });
      panes.pane(run, g0 + JAMB, g1 - JAMB, D, glassTop - 0.046);
      lbox(solid, run, g0 + JAMB, g1 - JAMB, glassTop - 0.046, glassTop, -0.024, 0.024, white, { g });
      const u0 = g0 + JAMB + 0.006, u1 = g1 - JAMB - 0.006, n = door.kind === 'double' ? 2 : 1, w = (u1 - u0) / n - (n > 1 ? 0.004 : 0);
      for (let i = 0; i < n; i++) {
        const first = i === 0, p = P(run, first ? u0 : u1, 0.006, 0);
        const leaf = { index: leaves.length, pos: new THREE.Vector3(...p), base: yaw(run.axis, first), sign: first ? 1 : -1, w };
        leaves.push(leaf); state.list.push(leaf);
      }
      doors.push(state);
    } else if (door.kind === 'open') {
      lbox(solid, run, g0 + JAMB, g1 - JAMB, glassTop - 0.085, glassTop, o, q, white, { g });
    } else {
      const w = (g1 - g0) / 2 - 0.03, m = (g0 + g1) / 2;
      for (const first of [true, false]) {
        const leaf = { index: slides.length, base: run.axis === 'x' ? 0 : -Math.PI / 2, run, u: first ? g0 + 0.02 : m + 0.01, dir: first ? -1 : 1, w };
        slides.push(leaf); state.list.push(leaf);
      }
      state.slide = true;
      doors.push(state);
    }
  }
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), scale = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  let swingMesh = null, frameMesh = null, paneMesh = null;
  if (leaves.length) {
    swingMesh = new THREE.InstancedMesh(leafGeometry(), archMaterial(), leaves.length);
    swingMesh.castShadow = swingMesh.receiveShadow = true; swingMesh.frustumCulled = false; swingMesh.userData.dynamic = true;
    parent.add(swingMesh);
  }
  if (slides.length) {
    const h = WALL.door - 0.02;
    frameMesh = new THREE.InstancedMesh(slideFrameGeometry(h), archMaterial(), slides.length);
    paneMesh = new THREE.InstancedMesh(slidePaneGeometry(h), matGlass('#e4f4fb', 0.38), slides.length);
    frameMesh.frustumCulled = paneMesh.frustumCulled = false;
    frameMesh.castShadow = true; paneMesh.renderOrder = 3;
    frameMesh.userData.dynamic = paneMesh.userData.dynamic = true;
    parent.add(frameMesh, paneMesh);
  }
  const writeSwing = (d) => {
    for (const l of d.list) {
      q.setFromAxisAngle(Y_AXIS, l.base + l.sign * d.sgn * d.f.v0 * SWING);
      scale.x = l.w;
      swingMesh.setMatrixAt(l.index, m.compose(l.pos, q, scale));
    }
    swingMesh.instanceMatrix.needsUpdate = true;
  };
  const writeSlide = (d) => {
    for (const l of d.list) {
      const shift = l.dir * d.f.v0 * l.w * 0.92;
      pos.set(...P(l.run, l.u + shift, 0.01, 0));
      q.setFromAxisAngle(Y_AXIS, l.base);
      scale.x = l.w;
      m.compose(pos, q, scale);
      frameMesh.setMatrixAt(l.index, m); paneMesh.setMatrixAt(l.index, m);
    }
    frameMesh.instanceMatrix.needsUpdate = true; paneMesh.instanceMatrix.needsUpdate = true;
  };
  for (const d of doors) (d.slide ? writeSlide : writeSwing)(d);
  return {
    doors,
    update(dt, actors) {
      for (const d of doors) {
        const c = d.door;
        let near = false, side = 0;
        if (actors) for (const a of actors) {
          if (a.floor !== floor || a.hidden) continue;
          const dx = a.x - c.x, dz = a.z - c.z;
          if (dx * dx + dz * dz < d.R2) { near = true; side = c.axis === 'x' ? dz : -dx; break; }
        }
        // A leaf only picks its swing direction while shut, so it never whips through the wall to change sides.
        if (near && d.f.v0 < 0.04) d.sgn = side >= 0 ? 1 : -1;
        const target = near ? 1 : 0;
        if (target === d.f.v0 && Math.abs(d.f.vel) < 1e-4) continue;
        damp(d.f, target, dt, near ? 7 : 4.2);
        if (Math.abs(d.f.v0 - target) < 0.001 && Math.abs(d.f.vel) < 0.002) { d.f.v0 = target; d.f.vel = 0; }
        (d.slide ? writeSlide : writeSwing)(d);
      }
    },
  };
}

function cross(x, cx, cy, s, fg) {
  const t = s * 0.36;
  x.fillStyle = fg; x.beginPath(); x.roundRect(cx - t / 2, cy - s / 2, t, s, t * 0.25); x.fill(); x.beginPath(); x.roundRect(cx - s / 2, cy - t / 2, s, t, t * 0.25); x.fill();
}

function signFace(kind) {
  const W = 1536, H = 178;
  const draw = (x) => {
    x.clearRect(0, 0, W, H);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.textAlign = 'left'; x.textBaseline = 'middle';
    if (kind === 'main') {
      x.font = `italic 400 148px ${SERIF}`;
      const tw = x.measureText(HOSPITAL_NAME).width, m = 112, sx = (W - tw - m - 34) / 2;
      x.fillStyle = C.teal; x.beginPath(); x.arc(sx + m / 2, H / 2, m / 2, 0, 7); x.fill();
      cross(x, sx + m / 2, H / 2, 66, '#ffffff');
      x.fillStyle = C.tealDeep; x.fillText(HOSPITAL_NAME, sx + m + 34, H / 2 + 6);
    } else {
      x.font = `700 122px ${SANS}`;
      const tw = x.measureText('Emergency').width, m = 118, sx = (W - tw - m - 38) / 2;
      x.fillStyle = C.coralDeep; x.beginPath(); x.roundRect(sx, (H - m) / 2, m, m, 26); x.fill();
      cross(x, sx + m / 2, H / 2, 74, '#ffffff');
      x.fillStyle = C.coralDeep; x.fillText('Emergency', sx + m + 38, H / 2 + 6);
    }
  };
  const tex = canvasTex(W, H, draw);
  whenFonts(() => { draw(tex.image.getContext('2d')); tex.needsUpdate = true; });
  return new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.42 });
}

/** Entrance portal: stands to full height even when its wall is cut, because the sign is what tells a buyer where the front door is. */
export function buildPortal(door) {
  const g = new THREE.Group(), w = door.w, kind = door.id === 'd_main' ? 'main' : 'er', H = WALL.full - 0.02, wh = C.white;
  g.position.set(door.x, 0, door.z);
  g.rotation.y = door.axis === 'x' ? 0 : Math.PI / 2;
  for (const s of [-1, 1]) g.add(box(0.26, H, 0.34, wh, { x: s * (w / 2 + 0.13), z: 0.02, r: 0.03 }));
  const fw = w + 3.0, fh = 0.66, fy = H - fh;
  g.add(box(fw, fh, 0.36, wh, { y: fy, z: 0.02, r: 0.05 }));
  const signMat = signFace(kind);
  g.add(panel(fw - 0.12, fh - 0.11, signMat, { y: fy + 0.055, z: 0.203 }));
  g.add(box(w + 0.1, 0.13, 0.17, C.steel, { y: fy - 0.13, z: 0 }));
  // A glass canopy: a solid one would hide the doors from the raised camera.
  const dep = 1.7, cw = w + 1.5, cy = fy - 0.06;
  g.add(box(cw, 0.03, dep, matGlass('#dff2fa', 0.36), { y: cy + 0.05, z: dep / 2 + 0.16, shadow: false, receive: false, r: 0.01 }));
  g.add(box(cw + 0.08, 0.075, 0.08, wh, { y: cy, z: 0.2 + dep, r: 0.03 }));
  for (const s of [-1, 1]) {
    g.add(box(0.075, 0.075, dep, wh, { x: s * (cw / 2), y: cy, z: dep / 2 + 0.2, r: 0.03 }));
    g.add(cyl(0.034, 0.034, cy, wh, { x: s * (cw / 2), z: dep + 0.2, seg: 10 }));
  }
  return { group: g, signMat };
}
