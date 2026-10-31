// Vertical circulation: the two lifts on every floor, the stair flight on floor 0, the railed void it arrives through on floor 1.
import * as THREE from 'three';
import { C, THEMES } from '../style/palette.js';
import { WALL, FLOOR_HEIGHT, PORTALS } from './plan.js';
import { canvasTex, panel } from '../style/kit.js';
import { Sheet, rgb, tint, archMaterial, damp, follower, SANS } from './shell-geo.js';
import { paint, interiorBands, lbox } from './shell-walls.js';

const stairP = PORTALS.find((p) => p.kind === 'stairs');
const lifts = PORTALS.filter((p) => p.kind === 'lift');
export const VOID = { x0: stairP.x - stairP.w / 2 - 0.03, x1: stairP.x + stairP.w / 2 + 0.03, z0: stairP.z - stairP.d / 2, z1: stairP.z + stairP.d / 2 + 0.05 };

const BX0 = 32.1, BX1 = 37.9, BZ0 = 0.1, BZ1 = 2.85, DW = 1.34, DH = 2.14;

function indicatorMat(label) {
  const t = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#1c2530'; x.beginPath(); x.roundRect(0, 0, w, h, 26); x.fill();
    x.fillStyle = '#ffb45a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 92px ${SANS}`;
    x.fillText(label, w * 0.32, h / 2 + 5);
    x.beginPath(); x.moveTo(w * 0.72, h * 0.22); x.lineTo(w * 0.84, h * 0.46); x.lineTo(w * 0.6, h * 0.46); x.closePath(); x.fill();
    x.fillStyle = '#7b6a54'; x.beginPath(); x.moveTo(w * 0.72, h * 0.8); x.lineTo(w * 0.84, h * 0.56); x.lineTo(w * 0.6, h * 0.56); x.closePath(); x.fill();
  });
  return new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.4 });
}

function leafGeometry() {
  const s = new Sheet(), a = rgb('#d7dbe3'), b = rgb('#b9bec8'), g = 0.3;
  s.box(0, 0, -0.012, 1, DH - 0.01, 0.012, a, { g, low: b });
  s.box(0.93, 0.02, 0.012, 0.97, DH - 0.03, 0.016, b, { g });
  return s.geometry();
}

export function buildLifts(floor, solid, parent) {
  const th = THEMES.core, top = WALL.full - 0.08, bands = interiorBands(th, top), g = 0.3;
  const frontRun = { axis: 'x', c: BZ1 }, holes = lifts.map((p) => ({ u0: p.x - DW / 2, u1: p.x + DW / 2, y0: 0, y1: DH }));
  paint(solid, frontRun, 1, BX0, BX1, 0, top, bands, { holes, v: 0, g, ao: { a: BX0, b: BX1, k: 0.1 } });
  paint(solid, { axis: 'z', c: BX0 }, -1, BZ0, BZ1, 0, top, bands, { v: 0, g });
  paint(solid, { axis: 'z', c: BX1 }, 1, BZ0, BZ1, 0, top, bands, { v: 0, g });
  paint(solid, { axis: 'x', c: BZ0 }, -1, BX0, BX1, 0, top, bands, { v: 0, g });
  // The top of the block is seen on every view, so it gets the plant-room detail instead of a blank lid.
  const white = rgb(C.white), lid = rgb('#eceef2');
  solid.box(BX0 - 0.03, top, BZ0, BX1 + 0.03, top + 0.08, BZ1 + 0.03, white, { top: lid, skip: 'b' });
  for (const p of lifts) {
    solid.box(p.x - 0.82, top + 0.08, 0.5, p.x + 0.82, top + 0.2, 2.35, rgb('#d8dbe2'), { top: rgb('#c9ced7'), skip: 'b' });
    solid.box(p.x - 0.42, top + 0.2, 0.9, p.x + 0.42, top + 0.42, 1.65, rgb(C.steel), { top: rgb('#a9afbb'), skip: 'b' });
    solid.tube([p.x - 0.32, top + 0.45, 1.27], [p.x + 0.32, top + 0.45, 1.27], 0.05, rgb(C.steelDeep), { n: 8 });
    const fw = 0.11, yc = rgb(C.door), deep = rgb(C.doorDeep), u0 = p.x - DW / 2, u1 = p.x + DW / 2, v = 0.045;
    lbox(solid, frontRun, u0 - fw, u0, 0, DH + fw, -0.03, v, yc, { g, low: deep });
    lbox(solid, frontRun, u1, u1 + fw, 0, DH + fw, -0.03, v, yc, { g, low: deep });
    lbox(solid, frontRun, u0, u1, DH, DH + fw, -0.03, v, yc, { g });
    // Lit cabin behind the doors.
    const cab = rgb('#f6efe2'), cabLo = rgb('#e6dccb'), zb = BZ0 + 0.3, yg = 0.75;
    solid.quad([u0, 0, zb], [u1, 0, zb], [u1, DH, zb], [u0, DH, zb], [0, 0, 1], [cabLo, cabLo, cab, cab], yg);
    solid.quad([u0, 0, zb], [u0, 0, BZ1], [u0, DH, BZ1], [u0, DH, zb], [1, 0, 0], [cabLo, cabLo, cab, cab], yg);
    solid.quad([u1, 0, zb], [u1, 0, BZ1], [u1, DH, BZ1], [u1, DH, zb], [-1, 0, 0], [cabLo, cabLo, cab, cab], yg);
    solid.quad([u0, 0.004, zb], [u1, 0.004, zb], [u1, 0.004, BZ1], [u0, 0.004, BZ1], [0, 1, 0], rgb('#b9bec8'), yg);
    solid.quad([u0, DH, zb], [u1, DH, zb], [u1, DH, BZ1], [u0, DH, BZ1], [0, -1, 0], rgb('#fff6e6'), 1);
    solid.tube([u0 + 0.03, 0.92, zb + 0.06], [u1 - 0.03, 0.92, zb + 0.06], 0.016, rgb(C.steel), { g: yg });
    const px = u1 + fw + 0.14;
    lbox(solid, frontRun, px, px + 0.13, 0.98, 1.3, 0, 0.012, rgb(C.steel), { g });
    lbox(solid, frontRun, px + 0.04, px + 0.09, 1.17, 1.22, 0.012, 0.02, rgb('#ffd27a'), { g: 0.95 });
    lbox(solid, frontRun, px + 0.04, px + 0.09, 1.06, 1.11, 0.012, 0.02, rgb('#dfe3ea'), { g });
    solid.box(p.x - 0.86, 0, BZ1 + 0.1, p.x + 0.86, 0.006, BZ1 + 0.24, rgb(C.lineYellow), { skip: 'b', g: 0.2 });
    parent.add(panel(0.56, 0.28, indicatorMat(floor === 0 ? 'G' : '1'), { x: p.x, y: DH + 0.16, z: BZ1 + 0.05, shadow: false }));
  }
  const pad = new THREE.Group();
  const mesh = new THREE.InstancedMesh(leafGeometry(), archMaterial(), lifts.length * 2);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.dynamic = true;
  pad.userData.dynamic = true; pad.add(mesh); parent.add(pad);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(DW / 2 - 0.004, 1, 1), p3 = new THREE.Vector3();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const state = lifts.map((p, i) => ({ p, i, f: follower(0) }));
  const write = (st) => {
    const { p, i, f } = st, slide = f.v0 * (DW / 2 - 0.09);
    mesh.setMatrixAt(i * 2, m.compose(p3.set(p.x - DW / 2 + 0.004 - slide, 0.005, BZ1 - 0.016), q.identity(), s));
    mesh.setMatrixAt(i * 2 + 1, m.compose(p3.set(p.x + DW / 2 - 0.004 + slide, 0.005, BZ1 - 0.016), flip, s));
    mesh.instanceMatrix.needsUpdate = true;
  };
  state.forEach(write);
  return {
    update(dt, actors) {
      for (const st of state) {
        let near = false;
        if (actors) for (const a of actors) {
          if (a.floor !== floor || a.hidden) continue;
          const dx = a.x - st.p.stand.x, dz = a.z - st.p.stand.z;
          if (dx * dx + dz * dz < 2.4) { near = true; break; }
        }
        const target = near ? 1 : 0;
        if (target === st.f.v0 && Math.abs(st.f.vel) < 1e-4) continue;
        damp(st.f, target, dt, near ? 5.5 : 3.6);
        if (Math.abs(st.f.v0 - target) < 0.001 && Math.abs(st.f.vel) < 0.002) { st.f.v0 = target; st.f.vel = 0; }
        write(st);
      }
    },
  };
}

export function buildStairs(s) {
  const p = stairP, n = 18, H = FLOOR_HEIGHT, rise = H / n, step = p.d / n, x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, zB = p.z + p.d / 2, zT = p.z - p.d / 2, side = 0.1, g = 0.3;
  const tread = rgb('#4f5461'), hi = rgb('#6d7380'), riser = rgb('#3e424d'), wall = rgb(C.upper), wallLo = rgb(C.upperDeep), white = rgb(C.white), stripe = rgb(C.stripe);
  const yAt = (z) => ((zB - z) / p.d) * H + 0.26, len = Math.hypot(step, rise), slope = [0, step / len, rise / len];
  for (let i = 0; i < n; i++) {
    const z1 = zB - i * step, z0 = z1 - step, y = (i + 1) * rise;
    s.box(x0 + side, y - 0.05, z0, x1 - side, y, z1, tread, { skip: 'bns', g });
    s.box(x0 + side, y - 0.052, z1 - 0.04, x1 - side, y + 0.004, z1 + 0.012, hi, { skip: 'b', g });
    s.box(x0 + side, y - rise, z1 - 0.018, x1 - side, y - 0.05, z1, riser, { skip: 'bt', g });
    for (const [xo, xi, nx] of [[x0, x0 + side, -1], [x1, x1 - side, 1]]) {
      const a = yAt(z0), b = yAt(z1);
      // Solid outer cheek in wall colour, thin mustard pinstripe following the rake, white coping on top.
      for (const f of [xo, xi]) {
        const nn = f === xo ? nx : -nx, mid = (t) => [t * 0.72, t * 0.72 + 0.2 * 0];
        s.quad([f, 0, z1], [f, 0, z0], [f, a - 0.19, z0], [f, b - 0.19, z1], [nn, 0, 0], [wallLo, wallLo, wall, wall], g);
        s.quad([f, a - 0.19, z0], [f, b - 0.19, z1], [f, b - 0.13, z1], [f, a - 0.13, z0], [nn, 0, 0], stripe, g);
        s.quad([f, a - 0.13, z0], [f, b - 0.13, z1], [f, b, z1], [f, a, z0], [nn, 0, 0], white, g);
        void mid;
      }
      s.quad([xo, b, z1], [xi, b, z1], [xi, a, z0], [xo, a, z0], slope, white, g);
    }
  }
  // Closed front of each cheek and a landing pier so the flight ends in something solid while level 1 is lifted away.
  for (const [a, b] of [[x0, x0 + side], [x1 - side, x1]]) s.quad([a, 0, zB], [b, 0, zB], [b, yAt(zB), zB], [a, yAt(zB), zB], [0, 0, 1], white, g);
  s.box(x0, 0, zT - 0.5, x1, H, zT, wall, { low: wallLo, top: tread, skip: 'b', g });
  const yTop = yAt(zT);
  for (const cx of [x0 + side / 2, x1 - side / 2]) {
    const rail = (z) => [cx, yAt(z) + 0.92, z];
    s.tube(rail(zB - 0.08), rail(zT), 0.028, white, { g, n: 8 });
    for (let k = 0; k <= 6; k++) {
      const z = zB - 0.08 - (k / 6) * (p.d - 0.08);
      s.tube([cx, yAt(z), z], rail(z), 0.016, white, { g });
    }
  }
  void yTop;
}

export function buildLanding(s, panes) {
  const v = VOID, off = 0.05, white = rgb(C.white), g = 0.3, y = 1.08;
  const edge = (a, b, n) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), posts = Math.max(2, Math.round(L / 1.25));
    s.tube([a[0], y, a[1]], [b[0], y, b[1]], 0.026, white, { g, n: 8 });
    for (let i = 0; i <= posts; i++) {
      const t = i / posts, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      s.tube([x, 0, z], [x, y, z], 0.016, white, { g });
    }
    s.tube([a[0], 0.1, a[1]], [b[0], 0.1, b[1]], 0.012, white, { g });
    panes.rawQuad([a[0], 0.12, a[1]], [b[0], 0.12, b[1]], [b[0], y - 0.04, b[1]], [a[0], y - 0.04, a[1]], n, L);
  };
  edge([v.x0 - off, v.z0], [v.x0 - off, v.z1 + off], [1, 0, 0]);
  edge([v.x0 - off, v.z1 + off], [v.x1 + off, v.z1 + off], [0, 0, 1]);
  edge([v.x1 + off, v.z1 + off], [v.x1 + off, v.z0], [1, 0, 0]);
  s.box(v.x0, 0, v.z0 - 0.17, v.x1, 0.006, v.z0 - 0.03, rgb(C.lineYellow), { skip: 'b', g: 0.2 });
  s.box(v.x0, -0.5, v.z0 - 0.004, v.x1, 0, v.z0, tint(rgb(C.steel), 0.9), { skip: 'n' });
}
