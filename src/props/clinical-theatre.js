// Operating theatre: the table, the great lamps on their boom, the anaesthesia tower and the scrub trough.
import * as THREE from 'three';
import { CATALOG, registerProp } from './registry.js';
import { group, contact, panel, mat, matGlow, matGlass, canvasTex, ball } from '../style/kit.js';
import { C } from '../style/palette.js';
import {
  HP, STEEL, STEEL_DARK, CHROME, STAINLESS, once, put, sbox, chip, drum, rod, hose, hoop, turned, dot, disc, cushion, fourCastors,
  dyn, damp, nextSeed, lightMat, halo, sharedScreen, pump, MONO,
} from './clinical-kit.js';
import { bedState, blanketGeo, clothMat } from './clinical-bed.js';
import { ventPaint } from './clinical-care.js';

const PAD = C.tealDeep;
const SURGICAL = '#7fc8a9';

function orTable(opts = {}) {
  const { fp: [W, D] } = CATALOG.orTable;
  const hd = D / 2, top = 0.885, seed = nextSeed();
  const g = group(contact(0.74, 1.5, 0.46));
  // Heavy pedestal, the unmistakable silhouette of a surgical table
  g.add(sbox(0.66, 0.07, 1.22, C.white, { y: 0.015, z: 0.1, r: 0.03, seg: 2 }));
  g.add(sbox(0.44, 0.05, 1.0, STEEL, { y: 0.08, z: 0.1, r: 0.02 }));
  g.add(turned([[0.2, 0], [0.19, 0.08], [0.145, 0.15], [0.135, 0.56], [0.17, 0.6]], C.white, { y: 0.1, z: 0.1, seg: 14 }));
  g.add(hoop(0.14, 0.008, C.tealLight, { rx: HP, y: 0.52, z: 0.1, seg: 14, tseg: 3 }));
  g.add(sbox(0.5, 0.075, 0.74, C.plastic, { y: 0.69, z: 0.1, r: 0.03 }));
  // Foot pedals on the plinth
  for (const a of [-1, 1]) g.add(chip(0.14, 0.012, 0.09, C.charcoal, { x: a * 0.17, y: 0.086, z: 0.62 }));
  // Articulated top: head, back, seat and leg sections over steel rails
  const rail = W - 0.16;
  g.add(chip(rail - 0.05, 0.04, D - 0.34, STEEL_DARK, { y: 0.76, z: 0.04 }));
  for (const a of [-1, 1]) g.add(rod([(a * rail) / 2, 0.8, -hd + 0.34], [(a * rail) / 2, 0.8, hd - 0.1], 0.0125, CHROME, { seg: 6 }));
  const sect = [[-hd + 0.14, 0.26, 0.44], [-hd + 0.45, 0.68, W - 0.2], [0.08, 0.5, W - 0.2], [0.6, 0.47, W - 0.2]];
  for (const [z0, len, w] of sect) {
    g.add(chip(w - 0.04, 0.025, len - 0.03, STEEL, { y: 0.8, z: z0 + len / 2 }));
    g.add(sbox(w, 0.06, len - 0.018, PAD, { y: 0.82, z: z0 + len / 2, r: 0.026, seg: 2 }));
  }
  // Arm board folded out on one side
  g.add(rod([W / 2 - 0.16, 0.81, -0.34], [W / 2 - 0.02, 0.81, -0.34], 0.012, STEEL, { seg: 5 }));
  // Sterile drape eases in when a patient is on the table
  const drape = dyn(put(blanketGeo({ W: (W - 0.2) / 2 + 0.01, zMade: -0.2, zPull: -hd + 0.6, zFoot: hd - 0.06, band: '#58b28d', body: SURGICAL, key: 'or' }), clothMat, { y: top, shadow: false }));
  drape.visible = false;
  g.add(drape);
  const glow = [C.watch, C.danger].map((c) => { const h = halo(c, 0.7); h.position.set(0, 0.2, 0.72); return h; });
  const light = dyn(put(once('orLight', () => new THREE.CapsuleGeometry(0.018, 0.12, 3, 8).rotateZ(HP)), lightMat('free'), { y: 0.098, z: 0.68, shadow: false }));
  g.add(light, ...glow);
  bedState(g, { cloth: drape, light, glow, onMorph: (k) => { drape.visible = k > 0.01; drape.position.y = top - 0.05 + 0.05 * Math.min(1, k * 3); } });
  if (opts.status) { g.userData.setState({ status: opts.status, alarm: opts.alarm ?? null }); g.userData.settle(); }
  return g;
}

const lampFace = () => once('lampFace', () => new THREE.MeshBasicMaterial({
  toneMapped: false,
  map: canvasTex(128, 128, (x) => {
    x.fillStyle = '#fff4d4'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#ffffff';
    for (let r = 0; r < 4; r++) {
      const n = r ? r * 6 : 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r * 0.3, R = r * 19;
        x.beginPath(); x.arc(64 + Math.cos(a) * R, 64 + Math.sin(a) * R, 7.5, 0, 7); x.fill();
      }
    }
  }),
}));
const beamMat = () => once('beamMat', () => new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: false,
  map: canvasTex(4, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,246,222,.26)'); g.addColorStop(0.65, 'rgba(255,246,222,.06)'); g.addColorStop(1, 'rgba(255,246,222,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }),
}));
function lampHead(R) {
  const h = new THREE.Group();
  h.add(turned([[R, 0], [R * 0.96, 0.05], [R * 0.7, 0.12], [0.05, 0.168], [0, 0.17]], C.white, { seg: 20 }));
  h.add(hoop(R, 0.016, matGlow('#fff0c6', 1.5), { rx: HP, seg: 24, tseg: 4, shadow: false }));
  h.add(disc(R, lampFace(), { rx: Math.PI, y: -0.002, seg: 20 }));
  h.add(drum(0.022, 0.03, 0.09, C.tealLight, { y: -0.09, seg: 8 }));
  h.add(drum(0.036, 0.04, 0.05, C.white, { y: 0.16, seg: 8 }));
  const beam = drum(R * 0.92, R * 1.5, 1.1, beamMat(), { y: -1.11, seg: 18, open: true, shadow: false, receive: false });
  h.add(beam);
  return h;
}
function orLight() {
  const { h: H } = CATALOG.orLight;
  const g = new THREE.Group();
  const hub = H - 0.3;
  g.add(drum(0.2, 0.2, 0.024, C.white, { y: H - 0.03, seg: 18 }));
  g.add(drum(0.06, 0.09, 0.26, C.white, { y: hub + 0.03, seg: 12 }));
  g.add(drum(0.1, 0.1, 0.05, C.plastic, { y: hub, seg: 14 }));
  const lamps = [[0.42, 0.26, 2.0, -0.3, 0.2], [-0.4, -0.3, 2.06, 0.34, -0.22]];
  lamps.forEach(([x, z, y, rz, rx], i) => {
    const elbow = [x * 0.55, hub + 0.08 + i * 0.02, z * 0.55];
    g.add(hose([[0, hub + 0.03, 0], [x * 0.22, hub + 0.1, z * 0.22], elbow, [x * 0.86, hub - 0.02, z * 0.86], [x, y + 0.26, z]], 0.024, C.white, { seg: 20, radial: 6 }));
    g.add(ball(0.04, C.plastic, { x: elbow[0], y: elbow[1], z: elbow[2], seg: 8 }));
    const lamp = lampHead(i ? 0.33 : 0.36);
    lamp.position.set(x, y, z);
    lamp.rotation.set(rx, 0, rz);
    g.add(lamp);
  });
  // A tiny contact stain on the floor keeps a ceiling-hung prop from feeling weightless.
  g.add(contact(1.2, 1.2, 0.12));
  return g;
}

function anesPaint(c, w, h, t) {
  ventPaint(c, w, h, t);
  c.fillStyle = C.purpleLight; c.font = `700 11px ${MONO}`; c.fillText('MAC 1.1', 4, 12);
}
function anesthesiaCart() {
  const { fp: [W, D], h: H } = CATALOG.anesthesiaCart;
  const g = group(contact(W * 0.92, D * 0.92, 0.46), ...fourCastors(W - 0.12, D - 0.12, { r: 0.05 }));
  const w = W - 0.04, d = D - 0.06, topY = 0.86;
  g.add(sbox(w, 0.05, d, C.plastic, { y: 0.1, r: 0.02 }));
  g.add(sbox(w - 0.04, 0.7, d - 0.04, C.white, { y: 0.14, r: 0.04, seg: 2 }));
  for (let i = 0; i < 3; i++) {
    const y = 0.17 + i * 0.22;
    g.add(sbox(w - 0.16, 0.2, 0.016, C.offWhite, { y, z: (d - 0.04) / 2 + 0.002, r: 0.01 }));
    g.add(sbox(0.2, 0.014, 0.014, C.tealDeep, { y: y + 0.14, z: (d - 0.04) / 2 + 0.012, r: 0.005 }));
  }
  g.add(sbox(W, 0.035, D, C.tileSage, { y: topY - 0.02, r: 0.014 }));
  // Tower with two screens
  const z0 = -0.14;
  g.add(sbox(0.5, H - topY - 0.02, 0.26, C.white, { y: topY, x: 0.14, z: z0, r: 0.036, seg: 2 }));
  const scr = sharedScreen('anes', 130, 96, anesPaint, 6);
  const face = new THREE.Group();
  face.position.set(0.14, topY + 0.18, z0 + 0.135);
  face.rotation.x = -0.1;
  for (const [y, s] of [[0.18, 0.21], [-0.1, 0.21]]) {
    face.add(sbox(0.42, s + 0.03, 0.02, C.ink, { y: y - 0.015, r: 0.012 }));
    face.add(panel(0.39, s, scr.mat, { y, z: 0.0105 }));
  }
  g.add(face);
  // Vaporisers and flow tubes, the bright bits on the shelf
  for (const [x, col] of [[-0.3, C.purple], [-0.15, C.stripe]]) {
    g.add(sbox(0.12, 0.2, 0.15, col, { x, y: topY + 0.015, z: -0.15, r: 0.03 }));
    g.add(drum(0.04, 0.04, 0.03, C.white, { x, y: topY + 0.215, z: -0.15, seg: 10 }));
    g.add(dot(0.02, C.white, { x, y: topY + 0.12, z: -0.074 }));
  }
  g.add(sbox(0.3, 0.3, 0.03, C.white, { x: -0.22, y: topY + 0.28, z: -0.2, r: 0.016 }));
  for (let i = 0; i < 3; i++) {
    const x = -0.31 + i * 0.09;
    g.add(drum(0.014, 0.014, 0.22, matGlass('#dff3ff', 0.55), { x, y: topY + 0.32, z: -0.18, seg: 6, shadow: false }));
    g.add(ball(0.012, [C.leafLight, C.info, C.watch][i], { x, y: topY + 0.38 + i * 0.05, z: -0.18, seg: 6 }));
  }
  // Bellows jar on the front shelf
  g.add(drum(0.1, 0.1, 0.24, matGlass('#d7f2ff', 0.3), { x: -0.24, y: topY + 0.015, z: 0.17, seg: 14, open: true, shadow: false }));
  g.add(hoop(0.1, 0.007, C.plastic, { rx: HP, x: -0.24, y: topY + 0.255, z: 0.17, seg: 14, tseg: 3 }));
  g.add(drum(0.106, 0.106, 0.01, matGlass('#d7f2ff', 0.3), { x: -0.24, y: topY + 0.255, z: 0.17, seg: 14, shadow: false }));
  const bell = dyn(put(once('bellowsS', () => {
    const p = [[0, 0.002], [0.066, 0.002]];
    for (let i = 0; i < 5; i++) p.push([0.058, 0.016 + i * 0.03], [0.074, 0.03 + i * 0.03]);
    p.push([0.058, 0.165], [0, 0.172]);
    return new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  }), C.tealDeep, { x: -0.24, y: topY + 0.016, z: 0.17, shadow: false }));
  g.add(bell);
  g.add(sbox(0.2, 0.12, 0.16, C.offWhite, { x: 0.28, y: topY + 0.015, z: 0.22, r: 0.02 }));
  g.add(hose([[-0.34, topY + 0.12, 0.17], [-0.43, topY + 0.3, 0.27], [-0.16, topY + 0.1, 0.33], [0.1, topY + 0.34, 0.33], [0.4, topY + 0.15, 0.3]], 0.015, C.blanketDeep, { seg: 24, radial: 5 }));
  // Cylinders strapped to the back
  g.add(turned([[0.05, 0], [0.05, 0.56], [0.036, 0.6], [0.014, 0.63]], C.leafLight, { x: -0.3, y: 0.14, z: -D / 2 + 0.05, seg: 8 }));
  g.add(turned([[0.05, 0], [0.05, 0.56], [0.036, 0.6], [0.014, 0.63]], C.info, { x: -0.16, y: 0.14, z: -D / 2 + 0.05, seg: 8 }));
  const led = dyn(dot(0.009, matGlow(C.ok, 2.2), { x: 0.36, y: topY + 0.1, z: 0.301 }));
  g.add(led);
  const seed = nextSeed() * 6;
  g.userData.tick = (dt, t) => {
    pump(scr, t);
    const p = ((t + seed) * 0.26) % 1;
    const breath = p < 0.42 ? 0.5 - 0.5 * Math.cos((p / 0.42) * Math.PI) : 0.5 + 0.5 * Math.cos(((p - 0.42) / 0.58) * Math.PI);
    bell.scale.y = 1 - breath * 0.5;
    led.visible = (t + seed) % 2.4 > 0.15;
  };
  return g;
}

function instrumentTable() {
  const { fp: [W, D], h: H } = CATALOG.instrumentTable;
  const g = group(contact(W * 0.9, D * 0.9, 0.4), ...fourCastors(W - 0.16, D - 0.12, { r: 0.04 }));
  const lx = (W - 0.16) / 2, lz = (D - 0.12) / 2, y = H - 0.1;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(rod([a * lx, 0.08, b * lz], [a * lx, y, b * lz], 0.0135, STEEL, { seg: 8 }));
  g.add(sbox(W - 0.1, 0.018, D - 0.08, STEEL, { y: 0.32, r: 0.008 }));
  g.add(sbox(0.34, 0.08, 0.26, C.plastic, { x: -0.24, y: 0.34, r: 0.02 }));
  g.add(drum(0.09, 0.065, 0.075, STEEL, { x: 0.22, y: 0.34, seg: 10 }));
  g.add(sbox(W, 0.03, D, STEEL, { y, r: 0.014 }));
  g.add(sbox(W - 0.03, 0.012, D - 0.03, mat('#8fd0b5'), { y: y + 0.028, r: 0.005 }));
  g.add(sbox(W - 0.5, 0.05, 0.02, mat('#8fd0b5'), { x: 0.0, y: y - 0.05, z: D / 2 + 0.0 - 0.012, r: 0.006 }));
  // Tiny tools, laid out the way a scrub nurse would: scalpels, scissors, clamps, forceps, then the dish and gauze
  const surf = y + 0.041, sharp = CHROME;
  const tool = (x) => g.add(chip(0.008, 0.004, 0.11, sharp, { x, y: surf + 0.002, z: -0.13 }), chip(0.012, 0.004, 0.09, STEEL_DARK, { x, y: surf + 0.002, z: -0.03 }));
  [-0.42, -0.385, -0.35].forEach(tool);
  for (const x of [-0.29, -0.22, -0.15]) {
    g.add(rod([x - 0.02, surf + 0.004, -0.17], [x + 0.016, surf + 0.004, 0.03], 0.0028, sharp, { seg: 3 }));
    g.add(rod([x + 0.02, surf + 0.004, -0.17], [x - 0.016, surf + 0.004, 0.03], 0.0028, sharp, { seg: 3 }));
    g.add(hoop(0.015, 0.003, sharp, { rx: HP, x: x - 0.022, y: surf + 0.004, z: 0.045, seg: 8, tseg: 3 }));
    g.add(hoop(0.015, 0.003, sharp, { rx: HP, x: x + 0.022, y: surf + 0.004, z: 0.045, seg: 8, tseg: 3 }));
  }
  for (const x of [-0.08, -0.03]) g.add(rod([x - 0.006, surf + 0.003, -0.16], [x + 0.008, surf + 0.003, 0.05], 0.0032, sharp, { seg: 3 }), rod([x + 0.008, surf + 0.003, -0.16], [x - 0.006, surf + 0.003, 0.05], 0.0032, sharp, { seg: 3 }));
  g.add(turned([[0.105, 0.036], [0.09, 0.012], [0.05, 0.002], [0, 0]], STEEL, { x: 0.36, y: surf, z: -0.1, seg: 12, sz: 0.62 }));
  g.add(sbox(0.16, 0.035, 0.13, C.white, { x: 0.14, y: surf, z: -0.1, r: 0.012 }));
  g.add(sbox(0.15, 0.03, 0.12, C.offWhite, { x: 0.145, y: surf + 0.03, z: -0.095, r: 0.012, ry: 0.1 }));
  for (const x of [0.06, 0.12, 0.18]) {
    g.add(drum(0.0095, 0.0095, 0.12, matGlass('#e4f4ff', 0.7), { x, y: surf + 0.012, z: 0.11, rx: HP, seg: 6, shadow: false }));
    g.children[g.children.length - 1].position.y = surf + 0.012;
    g.add(chip(0.008, 0.008, 0.05, C.plastic, { x, y: surf + 0.008, z: 0.2 }));
  }
  g.add(sbox(0.16, 0.022, 0.1, C.tileSky, { x: 0.38, y: surf, z: 0.12, r: 0.008 }));
  return g;
}

function scrubSink() {
  const { fp: [W, D], h: H } = CATALOG.scrubSink;
  const g = group(contact(W * 0.92, D * 0.9, 0.42));
  const rim = 0.86, back = -D / 2 + 0.03;
  // Stainless trough on a soft plinth, tiled splash back behind
  g.add(sbox(W, H, 0.05, C.white, { z: back, r: 0.02, seg: 2 }));
  g.add(chip(W - 0.12, 0.022, 0.012, C.tealLight, { y: 1.02, z: back + 0.028 }));
  g.add(sbox(W - 0.2, 0.52, D - 0.2, C.plastic, { y: 0.02, z: -0.04, r: 0.05 }));
  g.add(chip(W - 0.34, 0.1, 0.012, C.charcoal, { y: 0.03, z: D / 2 - 0.135 }));
  g.add(sbox(W - 0.04, 0.36, D - 0.09, STAINLESS, { y: rim - 0.34, z: 0.012, r: 0.04, seg: 2 }));
  const basin = mat(C.steel, { rough: 0.3, metal: 0.12 });
  for (const x of [-0.42, 0.42]) {
    g.add(sbox(0.72, 0.012, D - 0.2, basin, { x, y: rim + 0.018, z: 0.012, r: 0.005 }));
    g.add(drum(0.03, 0.03, 0.006, C.charcoal, { x, y: rim + 0.029, z: 0.05, seg: 10 }));
    // Gooseneck tap
    g.add(drum(0.022, 0.026, 0.03, CHROME, { x, y: rim + 0.022, z: back + 0.07, seg: 8 }));
    g.add(hose([[x, rim + 0.04, back + 0.07], [x, rim + 0.2, back + 0.07], [x, rim + 0.27, back + 0.13], [x, rim + 0.2, back + 0.21], [x, rim + 0.14, back + 0.21]], 0.0095, CHROME, { seg: 14, radial: 5 }));
    for (const a of [-1, 1]) {
      g.add(rod([x + a * 0.025, rim + 0.05, back + 0.07], [x + a * 0.11, rim + 0.07, back + 0.09], 0.0065, CHROME, { seg: 4 }));
      g.add(ball(0.012, a < 0 ? C.coralDeep : C.info, { x: x + a * 0.115, y: rim + 0.072, z: back + 0.09, seg: 6 }));
    }
    // Knee and foot pedal
    g.add(sbox(0.15, 0.022, 0.09, C.charcoal, { x, y: 0.02, z: D / 2 - 0.05, r: 0.008 }));
  }
  // Soap, brushes, timer on the splash back
  g.add(sbox(0.12, 0.2, 0.06, C.white, { x: 0, y: 0.92, z: back + 0.04, r: 0.02 }));
  g.add(chip(0.04, 0.05, 0.05, C.plastic, { x: 0, y: 0.89, z: back + 0.05 }));
  g.add(chip(0.08, 0.05, 0.004, C.tealLight, { x: 0, y: 1.02, z: back + 0.072 }));
  g.add(sbox(0.2, 0.09, 0.04, C.plastic, { x: -0.76, y: 1.02, z: back + 0.04, r: 0.012 }));
  for (let i = 0; i < 4; i++) g.add(sbox(0.03, 0.1, 0.025, [C.rose, C.tealLight, C.stripe, C.purpleLight][i], { x: -0.82 + i * 0.04, y: 1.04, z: back + 0.07, r: 0.008 }));
  g.add(sbox(0.2, 0.09, 0.016, C.ink, { x: 0.76, y: 1.02, z: back + 0.03, r: 0.006 }));
  const scr = sharedScreen('scrubTimer', 80, 36, (c, w, h, t) => {
    c.fillStyle = '#0c1a20'; c.fillRect(0, 0, w, h);
    c.fillStyle = C.screenGlow; c.font = `700 24px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const left = 300 - Math.floor(t % 300);
    c.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, w / 2, h / 2 + 1);
  }, 1);
  g.add(panel(0.18, 0.075, scr.mat, { x: 0.76, y: 1.027, z: back + 0.0395 }));
  const drip = dyn(ball(0.006, mat('#9bdcfa', { rough: 0.15 }), { x: -0.42, y: rim + 0.13, z: back + 0.21, seg: 6, shadow: false }));
  g.add(drip);
  const seed = nextSeed() * 3;
  g.userData.tick = (dt, t) => {
    pump(scr, t);
    const p = (t * 0.33 + seed) % 1;
    drip.position.y = rim + 0.135 - 0.1 * (p * p);
    drip.visible = p < 0.9;
  };
  return g;
}

export function registerTheatre() {
  registerProp('orTable', orTable);
  registerProp('orLight', orLight);
  registerProp('anesthesiaCart', anesthesiaCart);
  registerProp('instrumentTable', instrumentTable);
  registerProp('scrubSink', scrubSink);
}
