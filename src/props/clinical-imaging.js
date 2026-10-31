// Imaging suite. Big soft-shelled machines with glowing rings, tables that really slide in, and a part that spins.
import * as THREE from 'three';
import { CATALOG, registerProp } from './registry.js';
import { group, contact, panel, mat, matGlow, matGlass, signMat } from '../style/kit.js';
import { C } from '../style/palette.js';
import {
  HP, STEEL, STEEL_DARK, once, put, sbox, chip, drum, rod, hose, hoop, turned, dot, slab, cushion, roundShape, circlePath,
  fourCastors, dyn, damp, smooth, nextSeed, lightMat, lightColor, pulseMat, halo, sharedScreen, pump, stillScreen, MONO, SANS,
} from './clinical-kit.js';

const LILAC = C.tileLilac;
const inner = (color, glow = 0.3) => mat(color, { side: THREE.BackSide, emissive: color, emissiveIntensity: glow, rough: 0.6 });

function consoleFace(x, w, h, c2) {
  x.fillStyle = '#10202c'; x.fillRect(0, 0, w, h);
  x.fillStyle = c2; x.fillRect(8, 8, w - 16, 12);
  x.fillStyle = '#2d4a5c';
  for (let i = 0; i < 4; i++) x.fillRect(8, 28 + i * 13, (w - 16) * (i % 2 ? 0.6 : 0.85), 6);
}
/** Shared behaviour of scanners: eased table, spinner that spools up, ring breath, state light with alarm halo. */
function wireScanner(g, opts, { cradle, travel, spinner, ring, lamp, glow, scr }) {
  let k = 0, want = 0, speed = 0.3, status = null, fault = false, top = 0.3;
  const seed = nextSeed() * 7;
  g.userData.setState = (e) => {
    if (e.status === status) return;
    status = e.status; fault = status === 'fault';
    want = status === 'in-use' ? 1 : 0;
    top = want ? 3.4 : status === 'idle' ? 0.3 : 0;
    lamp.material = fault ? pulseMat(C.danger) : lightMat(status);
    glow.visible = fault;
  };
  g.userData.tick = (dt, t) => {
    if (scr) pump(scr, t);
    if (k !== want) {
      k = Math.abs(want - k) < 0.001 ? want : damp(k, want, 1.1, dt);
      cradle.position.z = -travel * smooth(0, 1, k);
    }
    speed = damp(speed, top, 1.2, dt);
    spinner.rotation.z += speed * dt;
    const p = 0.5 + 0.5 * Math.sin(t * (want ? 3.2 : 1.1) + seed);
    ring.emissiveIntensity = fault ? 0.3 : (want ? 2.2 : 1.1) + p * (want ? 1.2 : 0.5);
    if (fault) {
      pulseMat(C.danger).emissiveIntensity = 1.2 + 2.6 * p;
      glow.scale.setScalar(0.7 + p * 0.5);
    }
  };
  g.userData.setState({ status: opts.status ?? 'idle' });
  if (opts.status === 'in-use') { k = 1; cradle.position.z = -travel; }
}
/** Sliding patient cradle: pad, headrest, folded blanket. */
function cradleOf(len, w, y, headZ, withCoil) {
  const c = new THREE.Group();
  const mid = headZ + len / 2;
  c.add(sbox(w, 0.06, len, C.white, { y, z: mid, r: 0.028, seg: 2 }));
  c.add(sbox(w - 0.1, 0.055, len - 0.08, LILAC, { y: y + 0.05, z: mid, r: 0.024 }));
  c.add(cushion(w - 0.24, 0.1, 0.3, C.pillow, { y: y + 0.13, z: headZ + 0.22, rx: 0.08 }));
  c.add(sbox(w - 0.1, 0.05, 0.44, C.blanket, { y: y + 0.1, z: headZ + len - 0.36, r: 0.024 }));
  c.add(sbox(w - 0.12, 0.022, 0.1, C.blanketDeep, { y: y + 0.145, z: headZ + len - 0.54, r: 0.01 }));
  for (const a of [-1, 1]) c.add(chip(0.02, 0.012, len - 0.3, STEEL, { x: (a * w) / 2, y: y + 0.024, z: mid }));
  if (withCoil) {
    c.add(hoop(0.17, 0.022, C.plastic, { arc: Math.PI, seg: 10, tseg: 5, y: y + 0.11, z: headZ + 0.16 }));
    c.add(hoop(0.17, 0.022, C.plastic, { arc: Math.PI, seg: 10, tseg: 5, y: y + 0.11, z: headZ + 0.34 }));
    for (const a of [-0.7, 0, 0.7]) c.add(rod([Math.sin(a) * 0.17, y + 0.11 + Math.cos(a) * 0.17, headZ + 0.16], [Math.sin(a) * 0.17, y + 0.11 + Math.cos(a) * 0.17, headZ + 0.34], 0.012, LILAC, { seg: 5 }));
  }
  return c;
}

function mriScanner(opts = {}) {
  const { fp: [W, D], h: H } = CATALOG.mriScanner;
  const g = group(contact(W * 0.95, D * 0.95, 0.46));
  const cy = 1.09, zc = -1.2, R = 0.5, hd = D / 2;
  // Calm floor mat that marks the magnet's zone
  g.add(slab('mriMat', () => roundShape(W, D, 0.34, 0.34, -D / 2), 0.016, C.white, { rx: -HP, y: 0.012, bevel: 0.004, bs: 1 }));
  g.add(slab('mriMat2', () => roundShape(W - 0.16, D - 0.16, 0.28, 0.28, -D / 2 + 0.08), 0.014, LILAC, { rx: -HP, y: 0.016, bevel: 0, bs: 1 }));
  // Stacked shells: rear drum, lilac waist, chunky front cowl
  const body = (w, h, r, hole) => () => { const s = roundShape(w, h, r, 0.14, 0, 6); s.holes.push(circlePath(0, cy, hole, 32)); return s; };
  g.add(slab('mriRear', body(2.3, 2.06, 0.62, 0.53), 1.06, C.plastic, { z: zc - 0.34, y: 0.02, bevel: 0.04, bs: 1 }));
  g.add(slab('mriWaist', body(2.38, 2.1, 0.66, 0.53), 0.1, C.purpleLight, { z: zc + 0.17, y: 0.02, bevel: 0.012, bs: 1 }));
  g.add(slab('mriCowl', body(W - 0.06, H - 0.03, 0.72, 0.56), 0.62, C.white, { z: zc + 0.52, y: 0.02, bevel: 0.075, bs: 2 }));
  const front = zc + 0.83;
  // Bore: bright liner, soft trumpet mouth
  const bore = drum(R, R, 1.74, inner(C.tileLilac, 0.45), { rx: HP, seg: 28, open: true, shadow: false });
  bore.position.set(0, cy, zc - 0.04);
  g.add(bore);
  g.add(turned([[0.64, 0.088], [0.565, 0.075], [0.52, 0.05], [0.5, 0]], C.purpleLight, { rx: HP, y: cy, z: front - 0.086, seg: 28 }));
  // Glowing ring around the mouth
  const ringMat = matGlow(C.tealLight, 1.4).clone();
  g.add(dyn(hoop(0.665, 0.019, ringMat, { y: cy, z: front + 0.002, seg: 36, tseg: 5, shadow: false })));
  // Rotating inner element seen down the bore: three arcs of light that spool up when a scan starts
  const spin = new THREE.Group();
  spin.position.set(0, cy, front - 0.2);
  const beads = matGlow(C.tealLight, 2.2);
  for (let i = 0; i < 3; i++) spin.add(hoop(0.486, 0.011, beads, { arc: 1.1, seg: 10, tseg: 4, rz: (i * Math.PI * 2) / 3, shadow: false }));
  g.add(dyn(spin));
  // Front furniture: touch console, button cluster, name plate, state light
  g.add(sbox(0.3, 0.24, 0.05, C.ink, { x: -0.96, y: 1.08, z: front - 0.002, r: 0.02 }));
  g.add(panel(0.262, 0.2, stillScreen('mriConsole', 131, 100, (x, w, h) => consoleFace(x, w, h, C.purple)), { x: -0.96, y: 1.1, z: front + 0.025 }));
  for (let i = 0; i < 3; i++) g.add(dot(0.024, [C.ok, C.watch, C.danger][i], { x: 0.84 + i * 0.075, y: 1.17, z: front + 0.002, seg: 10 }));
  g.add(sbox(0.24, 0.1, 0.03, C.offWhite, { x: 0.92, y: 0.96, z: front - 0.004, r: 0.012 }));
  g.add(panel(0.42, 0.12, signMat('MRI', { bg: C.purpleLight, fg: '#4b3a86', font: `700 72px ${SANS}`, w: 400, h: 112 }), { y: 1.86, z: front + 0.003 }));
  const lamp = dyn(put(once('scanLamp', () => new THREE.CapsuleGeometry(0.022, 0.3, 3, 8).rotateZ(HP)), lightMat('idle'), { y: 1.81, z: front + 0.012, shadow: false }));
  const glow = halo(C.danger, 1.1);
  glow.position.set(0, 1.84, front + 0.06);
  g.add(lamp, glow);
  // Rear service bump and cables
  g.add(sbox(1.2, 0.9, 0.34, C.plastic, { y: 0.02, z: -hd + 0.17, r: 0.1, seg: 2 }));
  g.add(sbox(0.5, 0.12, 0.02, STEEL_DARK, { y: 0.7, z: -hd + 0.0 + 0.012, r: 0.006 }));
  // Table
  const tz = front + 0.02, tl = hd - tz - 0.05;
  const mid = tz + tl / 2;
  g.add(sbox(0.86, 0.09, tl, C.plastic, { y: 0.02, z: mid, r: 0.04, seg: 2 }));
  g.add(sbox(0.72, 0.6, tl - 0.08, C.white, { y: 0.1, z: mid - 0.02, r: 0.1, seg: 2 }));
  g.add(sbox(0.72, 0.09, tl - 0.2, C.purpleLight, { y: 0.42, z: mid, r: 0.03, sx: 1.015 }));
  g.add(sbox(0.2, 0.09, 0.012, C.ink, { y: 0.3, z: hd - 0.092, r: 0.005 }));
  for (let i = 0; i < 3; i++) g.add(dot(0.01, [C.ok, C.teal, C.stripe][i], { x: -0.05 + i * 0.05, y: 0.345, z: hd - 0.085, seg: 8 }));
  g.add(sbox(0.66, 0.05, tl, C.plastic, { y: 0.7, z: mid, r: 0.02 }));
  const clen = 2.04, c0 = hd - 0.06 - clen;
  const cradle = dyn(cradleOf(clen, 0.62, 0.755, c0, true));
  g.add(cradle);
  // Squeeze bulb on its lead, the patient's call button
  g.add(hose([[0.34, 0.75, 1.3], [0.42, 0.64, 1.4], [0.41, 0.5, 1.46]], 0.006, C.steelDeep, { seg: 8, radial: 3 }));
  wireScanner(g, opts, { cradle, travel: 1.72, spinner: spin, ring: ringMat, lamp, glow });
  return g;
}

function ctScanner(opts = {}) {
  const { fp: [W, D], h: H } = CATALOG.ctScanner;
  const g = group(contact(W * 0.92, D * 0.95, 0.44));
  const cy = 1.0, R = 0.92, hole = 0.42, zc = -1.15, hd = D / 2, depth = 0.86;
  // Keyhole outline: a big ring standing on a plinth
  const outer = (rad, wBase) => () => {
    const pts = [], a0 = Math.asin((0.35 - cy) / rad) , a1 = Math.PI - a0;
    pts.push(new THREE.Vector2(wBase / 2, 0.02), new THREE.Vector2(wBase / 2, 0.3));
    for (let i = 0; i <= 44; i++) { const a = a0 + ((a1 - a0) * i) / 44; pts.push(new THREE.Vector2(Math.cos(a) * rad, cy + Math.sin(a) * rad)); }
    pts.push(new THREE.Vector2(-wBase / 2, 0.3), new THREE.Vector2(-wBase / 2, 0.02));
    const s = new THREE.Shape(pts);
    s.holes.push(circlePath(0, cy, hole + 0.02, 30));
    return s;
  };
  g.add(slab('ctOuter', outer(R, 1.86), depth, C.white, { z: zc, bevel: 0.07, bs: 2 }));
  g.add(sbox(2.0, 0.08, 1.12, C.plastic, { y: 0.01, z: zc, r: 0.036, seg: 2 }));
  // Lilac face ring and bright bore
  const fz = zc + depth / 2;
  g.add(turned([[hole + 0.27, 0.002], [hole + 0.2, 0.012], [hole + 0.1, 0.012], [hole + 0.02, 0]], C.purpleLight, { rx: HP, y: cy, z: fz - 0.006, seg: 30 }));
  const ringMat = matGlow(C.tealLight, 1.4).clone();
  g.add(dyn(hoop(hole + 0.3, 0.016, ringMat, { y: cy, z: fz - 0.008, seg: 36, tseg: 5, shadow: false })));
  const bore = drum(hole + 0.02, hole + 0.02, depth - 0.02, inner(C.offWhite, 0.4), { rx: HP, seg: 28, open: true, shadow: false });
  bore.position.set(0, cy, zc);
  g.add(bore);
  // Rotating gantry: tube head and detector arc, visible through the bore's mouth
  const spin = new THREE.Group();
  spin.position.set(0, cy, zc + 0.05);
  spin.add(hoop(hole + 0.008, 0.02, C.purpleLight, { seg: 30, tseg: 4, shadow: false }));
  spin.add(sbox(0.13, 0.07, 0.16, C.purple, { y: hole - 0.07, z: -0.08, r: 0.02, shadow: false }));
  spin.add(chip(0.05, 0.012, 0.06, matGlow(C.info, 2.4), { y: hole - 0.082, z: -0.08, shadow: false }));
  for (let i = 0; i < 5; i++) { const a = -HP + (i - 2) * 0.22; spin.add(chip(0.068, 0.03, 0.12, STEEL_DARK, { x: Math.cos(a) * (hole - 0.02), y: Math.sin(a) * (hole - 0.02), z: -0.06, rz: a + HP, shadow: false })); }
  g.add(dyn(spin));
  // Control pods either side of the bore
  for (const a of [-1, 1]) {
    g.add(sbox(0.18, 0.14, 0.04, C.offWhite, { x: a * 0.66, y: 1.34, z: fz - 0.012, r: 0.016, ry: 0, rz: -a * 0.35 }));
    g.add(dot(0.014, a < 0 ? C.ok : C.watch, { x: a * 0.62, y: 1.42, z: fz + 0.012, seg: 8 }));
    g.add(dot(0.014, C.info, { x: a * 0.68, y: 1.4, z: fz + 0.012, seg: 8 }));
  }
  g.add(panel(0.24, 0.16, stillScreen('ctConsole', 120, 80, (x, w, h) => consoleFace(x, w, h, C.teal)), { y: 0.33, z: fz + 0.002 }));
  const lamp = dyn(put(once('scanLamp', () => new THREE.CapsuleGeometry(0.022, 0.3, 3, 8).rotateZ(HP)), lightMat('idle'), { y: H - 0.32, z: fz - 0.016, shadow: false, sx: 0.8 }));
  const glow = halo(C.danger, 1);
  glow.position.set(0, H - 0.28, fz + 0.04);
  g.add(lamp, glow);
  // Table on a slim pedestal
  const tz = fz + 0.02, tl = hd - tz - 0.1, mid = tz + tl / 2;
  g.add(sbox(0.62, 0.07, tl, C.plastic, { y: 0.015, z: mid, r: 0.03 }));
  g.add(sbox(0.42, 0.56, 1.1, C.white, { y: 0.08, z: mid + 0.15, r: 0.1, seg: 2 }));
  g.add(sbox(0.44, 0.07, 0.9, C.purpleLight, { y: 0.4, z: mid + 0.15, r: 0.03 }));
  g.add(sbox(0.5, 0.05, tl + 0.04, C.plastic, { y: 0.64, z: mid - 0.02, r: 0.02 }));
  const clen = 1.8, c0 = hd - 0.04 - clen;
  const cradle = dyn(cradleOf(clen, 0.52, 0.68, c0, false));
  g.add(cradle);
  wireScanner(g, opts, { cradle, travel: 1.3, spinner: spin, ring: ringMat, lamp, glow });
  return g;
}

function xrayMachine(opts = {}) {
  const { fp: [W, D] } = CATALOG.xrayMachine;
  const g = group(contact(W * 0.9, D * 0.92, 0.42));
  const hx = W / 2, hd = D / 2;
  // Table
  g.add(sbox(1.0, 0.06, 1.3, C.plastic, { y: 0.01, z: 0.14, r: 0.028, seg: 2 }));
  g.add(sbox(0.46, 0.66, 0.74, C.white, { y: 0.07, z: 0.14, r: 0.1, seg: 2 }));
  g.add(sbox(0.48, 0.07, 0.56, C.purpleLight, { y: 0.34, z: 0.14, r: 0.03 }));
  g.add(sbox(0.5, 0.1, 1.4, C.plastic, { y: 0.7, z: 0.14, r: 0.03 }));
  g.add(sbox(0.86, 0.06, 2.1, C.white, { y: 0.8, z: 0.28, r: 0.028, seg: 2 }));
  g.add(sbox(0.72, 0.055, 1.96, LILAC, { y: 0.855, z: 0.28, r: 0.026 }));
  g.add(cushion(0.44, 0.09, 0.3, C.pillow, { y: 0.945, z: -0.5, rx: 0.08 }));
  g.add(sbox(0.6, 0.012, 0.8, C.white, { y: 0.74, z: 0.3, r: 0.004 }));
  g.add(chip(0.4, 0.05, 0.04, C.charcoal, { y: 0.745, z: 0.72, }));
  // Back gantry: two posts and a beam make the ceiling track readable without a ceiling
  const beamY = 2.1, bz = -hd + 0.09;
  for (const a of [-1, 1]) {
    g.add(sbox(0.14, beamY + 0.02, 0.14, C.white, { x: a * (hx - 0.1), y: 0, z: bz, r: 0.04 }));
    g.add(sbox(0.2, 0.05, 0.2, C.plastic, { x: a * (hx - 0.1), y: 0, z: bz, r: 0.02 }));
    g.add(sbox(0.075, 0.075, D - 0.14, C.plastic, { x: a * (hx - 0.1), y: beamY, z: 0.0 + 0.04 - 0.04 + (0.07 - 0.07), r: 0.024 }));
  }
  g.add(sbox(W - 0.16, 0.1, 0.12, C.white, { y: beamY, z: bz, r: 0.03 }));
  g.add(sbox(W - 0.28, 0.05, 0.05, C.purpleLight, { y: beamY + 0.022, z: bz + 0.052 + 0.0, r: 0.012 }));
  // Upright detector stand
  g.add(sbox(0.5, 0.56, 0.06, C.white, { x: 0.62, y: 0.92, z: bz + 0.12, r: 0.03, seg: 2 }));
  g.add(sbox(0.38, 0.42, 0.012, LILAC, { x: 0.62, y: 0.99, z: bz + 0.152, r: 0.006 }));
  g.add(sbox(0.06, 1.5, 0.06, C.plastic, { x: 0.62, y: 0.02, z: bz + 0.07, r: 0.016 }));
  // Travelling carriage with telescopic arm and tube head
  const carriage = new THREE.Group();
  carriage.add(sbox(W - 0.16, 0.08, 0.2, C.white, { y: beamY - 0.075, r: 0.03, seg: 2 }));
  carriage.add(sbox(0.28, 0.14, 0.26, C.plastic, { y: beamY - 0.2, r: 0.03 }));
  carriage.add(sbox(0.16, 0.26, 0.16, C.white, { y: beamY - 0.44, r: 0.03 }));
  carriage.add(sbox(0.11, 0.2, 0.11, C.plastic, { y: beamY - 0.62, r: 0.02 }));
  const head = 1.32;
  carriage.add(sbox(0.42, 0.2, 0.3, C.white, { y: head + 0.13, r: 0.08, seg: 2 }));
  carriage.add(drum(0.11, 0.11, 0.3, C.purpleLight, { y: head + 0.17, rz: HP, x: 0.0, seg: 12 }));
  carriage.children[carriage.children.length - 1].position.y = head + 0.23;
  carriage.add(sbox(0.3, 0.13, 0.3, C.offWhite, { y: head, r: 0.03 }));
  carriage.add(chip(0.21, 0.004, 0.21, matGlow('#ffe9a8', 1.3), { y: head - 0.003 }));
  const lightField = dyn(put(once('xField', () => new THREE.PlaneGeometry(0.42, 0.42).rotateX(-HP)), new THREE.MeshBasicMaterial({
    color: '#ffe9a8', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false,
  }), { y: 0.915, shadow: false }));
  lightField.visible = false;
  carriage.add(sbox(0.12, 0.07, 0.03, C.ink, { x: 0.0, y: head + 0.04, z: 0.158, r: 0.01 }));
  g.add(dyn(carriage), lightField);
  const lamp = dyn(put(once('xLamp', () => new THREE.SphereGeometry(0.03, 8, 6)), lightMat('idle'), { x: 0.14, y: head + 0.07, shadow: false }));
  carriage.add(lamp);
  const homeZ = -0.62, workZ = 0.32;
  carriage.position.z = homeZ + 0.1;
  let k = 0, want = 0, status = null, flash = 0;
  const seed = nextSeed() * 9;
  g.userData.setState = (e) => {
    if (e.status === status) return;
    status = e.status; want = status === 'in-use' ? 1 : 0;
    lamp.material = status === 'fault' ? pulseMat(C.danger) : lightMat(status);
    lightField.visible = !!want;
  };
  g.userData.tick = (dt, t) => {
    if (k !== want) k = Math.abs(want - k) < 0.001 ? want : damp(k, want, 1.2, dt);
    const z = homeZ + 0.1 + (workZ - homeZ) * smooth(0, 1, k) + (want ? 0.03 * Math.sin(t * 0.5 + seed) : 0);
    carriage.position.z = z;
    lightField.position.z = z;
    if (want) { flash = (t + seed) % 4 < 0.12 ? 1 : 0.45; lightField.material.opacity = flash; }
  };
  g.userData.setState({ status: opts.status ?? 'idle' });
  return g;
}

export function ultraPaint(c, w, h, t) {
  c.fillStyle = '#0a1016'; c.fillRect(0, 0, w, h);
  const cx = w * 0.42, cy = 8, R = h - 14;
  c.save();
  c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, 0.55, Math.PI - 0.55); c.closePath(); c.clip();
  c.fillStyle = '#161c22'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const a = 0.6 + ((i * 2.4) % 1.95), r = 10 + ((i * 37.7) % (R - 10));
    const b = 80 + (Math.sin(i * 12.9 + t * 1.6) + 1) * 70;
    c.fillStyle = `rgb(${b},${b},${b + 8})`;
    c.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 1.6);
  }
  c.fillStyle = '#05080c';
  c.beginPath(); c.ellipse(cx, cy + R * 0.58, 15 + Math.sin(t * 2.6) * 3, 10, 0.3, 0, 7); c.fill();
  c.restore();
  c.fillStyle = '#2d4a5c'; for (let i = 0; i < 5; i++) c.fillRect(w - 34, 12 + i * 12, 26, 5);
  c.fillStyle = C.purpleLight; c.fillRect(w - 34, 76, 26 * (0.4 + 0.6 * ((t * 0.2) % 1)), 6);
}
function ultrasound() {
  const g = group(contact(0.54, 0.62, 0.42));
  const scr = sharedScreen('ultra', 136, 100, ultraPaint, 5);
  g.add(...fourCastors(0.46, 0.5, { r: 0.04 }));
  g.add(sbox(0.52, 0.09, 0.58, C.white, { y: 0.09, r: 0.036, seg: 2 }));
  g.add(sbox(0.3, 0.1, 0.34, C.purpleLight, { y: 0.175, r: 0.03 }));
  g.add(sbox(0.34, 0.5, 0.36, C.white, { y: 0.27, z: -0.05, r: 0.06, seg: 2 }));
  g.add(sbox(0.3, 0.1, 0.012, C.ink, { y: 0.5, z: 0.132, r: 0.004 }));
  g.add(chip(0.24, 0.02, 0.016, C.plastic, { y: 0.42, z: 0.134 }));
  // Console
  const deck = new THREE.Group();
  deck.position.set(0, 0.8, 0.02);
  deck.rotation.x = 0.15;
  deck.add(sbox(0.56, 0.05, 0.48, C.white, { y: -0.03, r: 0.022, seg: 2 }));
  deck.add(sbox(0.46, 0.012, 0.3, C.plastic, { y: 0.016, z: 0.04, r: 0.006 }));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) deck.add(chip(0.05, 0.008, 0.032, (r + c) % 5 === 0 ? C.purple : C.offWhite, { x: -0.17 + c * 0.066, y: 0.026, z: -0.04 + r * 0.044 }));
  deck.add(drum(0.03, 0.036, 0.02, C.charcoal, { x: 0.12, y: 0.024, z: 0.14, seg: 10 }));
  deck.add(chip(0.1, 0.012, 0.03, C.purple, { x: -0.12, y: 0.022, z: 0.14 }));
  g.add(deck);
  // Probes holstered on the side, cable looping to the base
  for (const [a, col] of [[-0.05, C.charcoal], [0.07, C.plastic]]) {
    g.add(sbox(0.032, 0.09, 0.05, col, { x: 0.285, y: 0.82, z: a, r: 0.012 }));
  }
  g.add(chip(0.022, 0.03, 0.2, C.plastic, { x: 0.276, y: 0.79, z: 0.01 }));
  g.add(hose([[0.285, 0.82, -0.05], [0.29, 0.62, -0.02], [0.27, 0.34, 0.12], [0.25, 0.3, -0.12], [0.2, 0.5, -0.2]], 0.0065, C.charcoal, { seg: 14, radial: 3 }));
  g.add(drum(0.022, 0.022, 0.22, C.plastic, { y: 0.84, z: -0.17, seg: 8 }));
  // Monitor
  const head = new THREE.Group();
  head.position.set(0, 1.18, -0.13);
  head.rotation.x = -0.2;
  head.add(sbox(0.5, 0.38, 0.06, C.white, { y: -0.17, r: 0.03, seg: 2 }));
  head.add(sbox(0.44, 0.31, 0.01, C.ink, { y: -0.135, z: 0.03, r: 0.004 }));
  head.add(panel(0.42, 0.29, scr.mat, { y: -0.125, z: 0.0365 }));
  g.add(head);
  const led = dyn(dot(0.008, matGlow(C.ok, 2.2), { x: 0.21, y: 0.74, z: 0.14 }));
  g.add(led);
  g.userData.tick = (dt, t) => pump(scr, t);
  return g;
}

export function registerImaging() {
  registerProp('mriScanner', mriScanner);
  registerProp('ctScanner', ctScanner);
  registerProp('xrayMachine', xrayMachine);
  registerProp('ultrasound', ultrasound);
}
