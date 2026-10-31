// Beds, the heroes of the diorama: soft white frames on chunky castors, a thick foot roll and a sky-blue turn-down,
// straight from the reference. The blanket is one morphing mesh that eases from neatly made to pulled up over a person.
import * as THREE from 'three';
import { CATALOG, registerProp } from './registry.js';
import { group, contact, panel, pill, canvasTex } from '../style/kit.js';
import { C } from '../style/palette.js';
import {
  HP, STEEL, STEEL_DARK, once, put, sbox, chip, drum, rod, hose, slab, cushion, castor, fourCastors, roundShape, slotPath,
  dyn, damp, smooth, nextSeed, lightMat, lightColor, pulseMat, halo, stillScreen,
} from './clinical-kit.js';

const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
export const BEDS = [];

const lerp = (a, b, k) => a + (b - a) * k;
const tint = (hex) => new THREE.Color(hex);

/**
 * Blanket grid laid over a mattress, y = 0 at the mattress top. Morph 0 is the neat made bed,
 * morph 1 is pulled up to the chest with the soft shape of a body underneath.
 */
function blanketGeo({ W, zMade, zPull, zFoot, band, body, key }) {
  return once(`blanket|${key}|${W}|${zMade}|${zPull}|${zFoot}|${band}|${body}`, () => {
    const half = [[W, -0.085], [W, -0.04], [W - 0.003, -0.004], [W - 0.016, 0.014], [W - 0.05, 0.027], [W - 0.13, 0.034], [0.2, 0.038], [0.11, 0.04], [0.045, 0.04], [0, 0.04]];
    const across = [...half.map(([x, y]) => [-x, y]), ...half.slice(0, -1).reverse()];
    const rows = [0, 0.012, 0.035, 0.08, 0.14, 0.2, 0.207, 0.25, 0.33, 0.45, 0.58, 0.7, 0.82, 0.92, 1];
    const cols = across.length, N = cols * rows.length;
    const made = new Float32Array(N * 3), pull = new Float32Array(N * 3), color = new Float32Array(N * 3);
    const bandC = tint(band), bodyC = tint(body), side = tint(band).lerp(tint(body), 0.55), c = new THREE.Color();
    rows.forEach((t, j) => across.forEach(([x, y0], i) => {
      const k = j * cols + i, roll = smooth(0, 0.03, t), layer = 1 - smooth(0.195, 0.206, t);
      const y = y0 * roll + (y0 > 0 ? 0.016 * layer * roll : 0) - smooth(0.92, 1, t) * 0.09;
      const za = lerp(zMade, zFoot, t), zb = lerp(zPull, zFoot, t);
      made.set([x, y, za], k * 3);
      const s = lerp(0.25, 0.15, smooth(-0.3, 0.8, zb));
      const rise = 0.1 * smooth(zPull + 0.04, zPull + 0.34, zb) * (1 - 0.6 * smooth(0.5, 0.92, zb)) * (1 - smooth(0.9, 1, t));
      const legs = 0.035 * smooth(0.12, 0.34, zb) * Math.exp(-((x / 0.055) ** 2));
      pull.set([x, y + rise * Math.exp(-((x / s) ** 2)) - legs * Math.min(1, rise * 12), zb], k * 3);
      c.copy(t <= 0.2 ? bandC : bodyC);
      if (y0 < 0.02) c.lerp(side, 0.6);
      color.set([c.r, c.g, c.b], k * 3);
    }));
    const idx = [];
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(made, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geo.computeVertexNormals();
    const up = new THREE.BufferGeometry();
    up.setIndex(idx);
    up.setAttribute('position', new THREE.BufferAttribute(pull, 3));
    up.computeVertexNormals();
    geo.morphAttributes.position = [up.attributes.position];
    geo.morphAttributes.normal = [up.attributes.normal];
    return geo;
  });
}

function boardShape(w, h, r, slot) {
  const s = roundShape(w, h, r, 0.04);
  if (slot) s.holes.push(slotPath(slot[0], slot[1], h - slot[2]));
  return s;
}
/** Closed side-rail loop in the YZ plane. */
function sideRail(x, z0, z1, y0, y1, color = C.white) {
  const r = 0.06, k = r * 0.29;
  const p = [[z0 + r, y0], [z1 - r, y0], [z1 - k, y0 + k], [z1, y0 + r], [z1, y1 - r], [z1 - k, y1 - k], [z1 - r, y1], [z0 + r, y1], [z0 + k, y1 - k], [z0, y1 - r], [z0, y0 + r], [z0 + k, y0 + k]].map(([z, y]) => [x, y, z]);
  const zm = (z0 + z1) / 2;
  return [
    hose(p, 0.014, color, { seg: 32, radial: 4, closed: true }),
    rod([x, (y0 + y1) / 2, z0 + 0.02], [x, (y0 + y1) / 2, z1 - 0.02], 0.009, color, { seg: 4 }),
    rod([x, y0, zm - 0.14], [x, y0 - 0.14, zm - 0.14], 0.011, STEEL, { seg: 5 }),
    rod([x, y0, zm + 0.14], [x, y0 - 0.14, zm + 0.14], 0.011, STEEL, { seg: 5 }),
  ];
}
const chartMat = () => once('chartMat', () => new THREE.MeshStandardMaterial({
  roughness: 0.7,
  map: canvasTex(100, 136, (x, w, h) => {
    x.fillStyle = '#fbfcfe'; x.fillRect(0, 0, w, h);
    x.fillStyle = C.info; x.fillRect(0, 0, w, 22);
    x.fillStyle = '#c4ccd8';
    for (let i = 0; i < 7; i++) x.fillRect(10, 34 + i * 13, i % 3 === 2 ? 46 : 80, 4);
    x.strokeStyle = C.coralDeep; x.lineWidth = 2; x.beginPath();
    [[12, 124], [28, 112], [44, 120], [60, 106], [88, 114]].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.stroke();
  }),
}));

/** Wires up status + blanket + alarm. Beds and the OR table share this: setState is safe to call every frame. */
function bedState(g, { cloth, light, glow, onMorph }) {
  let k = 0, want = 0, status = null, alarm = null, level = null;
  const ud = g.userData;
  ud.setState = (b) => {
    ud.live = b;
    want = b.status === 'occupied' ? 1 : 0;
    if (b.status === status && (b.alarm ?? null) === alarm) return;
    status = b.status; alarm = b.alarm ?? null;
    level = alarm ? lightColor(alarm) : null;
    light.material = level ? pulseMat(level) : lightMat(status);
    if (!alarm) light.scale.setScalar(1);
    for (const h of glow) h.visible = h.material.color.equals(tint(level ?? '#000'));
  };
  ud.tick = (dt, t) => {
    if (k !== want) {
      k = Math.abs(want - k) < 0.002 ? want : damp(k, want, 2.6, dt);
      if (cloth) cloth.morphTargetInfluences[0] = k;
      onMorph?.(k);
    }
    if (alarm) {
      const p = 0.5 + 0.5 * Math.sin(t * (alarm === 'critical' ? 8 : 4));
      pulseMat(level).emissiveIntensity = 1.2 + p * 2.6;
      light.scale.setScalar(1 + p * 0.45);
      for (const h of glow) if (h.visible) h.scale.setScalar(0.45 + p * 0.5);
    }
  };
  ud.settle = () => { k = want; if (cloth) cloth.morphTargetInfluences[0] = k; onMorph?.(k); };
  ud.setState({ status: 'free', alarm: null });
}

function buildBed(kind, opts = {}) {
  const icu = kind === 'icu';
  const { fp: [W, D], h: H } = CATALOG[icu ? 'icuBed' : 'bed'];
  const hd = D / 2, hx = W / 2, top = 0.68, seed = nextSeed();
  const trim = icu ? C.teal : C.blanketDeep;
  const g = group(contact(W * 0.94, D * 0.96, 0.5));
  // Four telescoping columns: the adjustable part, and the same stance on castors as the reference.
  const lx = hx - 0.1, lz = hd - 0.22;
  for (const [a, b, yaw] of [[-1, -1, seed * 6], [1, -1, 1.1 + seed], [-1, 1, 2.6 - seed], [1, 1, 4 + seed * 2]]) {
    g.add(castor(a * lx, b * lz, { r: 0.064, yaw }));
    g.add(drum(0.016, 0.016, 0.2, STEEL, { x: a * lx, z: b * lz, y: 0.13, seg: 8, open: true }));
    g.add(drum(0.03, 0.03, 0.17, C.white, { x: a * lx, z: b * lz, y: 0.28, seg: 10 }));
  }
  g.add(rod([-lx, 0.15, -lz], [-lx, 0.15, lz], 0.017, C.plastic), rod([lx, 0.15, -lz], [lx, 0.15, lz], 0.017, C.plastic));
  g.add(rod([-lx, 0.15, 0], [lx, 0.15, 0], 0.014, STEEL_DARK), rod([-lx, 0.15, lz], [lx, 0.15, lz], 0.014, C.plastic), rod([-lx, 0.15, -lz], [lx, 0.15, -lz], 0.014, C.plastic));
  g.add(sbox(0.42, 0.11, 0.56, C.plastic, { y: 0.33, r: 0.03 }));
  g.add(chip(0.17, 0.018, 0.07, C.charcoal, { y: 0.14, z: lz + 0.045 }));
  // Deck and mattress
  g.add(chip(W - 0.08, 0.02, D - 0.26, STEEL, { y: 0.425 }));
  g.add(sbox(W - 0.02, 0.08, D - 0.2, C.white, { y: 0.44, r: 0.034 }));
  g.add(sbox(W - 0.115, 0.175, D - 0.26, C.sheet, { y: top - 0.175, r: 0.06, seg: 2 }));
  // Head and foot boards
  g.add(slab(`head${W}`, () => boardShape(W - 0.02, H - 0.36, 0.2, [0.46, 0.05, 0.1]), 0.07, C.white, { y: 0.36, z: -hd + 0.042, bevel: 0.02 }));
  g.add(slab(`foot${W}`, () => boardShape(W - 0.02, 0.36, 0.1), 0.055, C.white, { y: 0.39, z: hd - 0.034, bevel: 0.016, bs: 1 }));
  for (const a of [-1, 1]) {
    g.add(chip(0.05, 0.05, 0.12, C.plastic, { x: a * (hx - 0.16), y: 0.45, z: -hd + 0.1 }));
    g.add(chip(0.05, 0.05, 0.12, C.plastic, { x: a * (hx - 0.16), y: 0.45, z: hd - 0.09 }));
  }
  // Bedding: pillow and the thick white roll at the foot, as in the reference
  const zHead = -hd + 0.36;
  g.add(cushion(W - 0.36, 0.17, 0.42, C.pillow, { y: top + 0.075, z: zHead + 0.04, rx: 0.1, ry: 0.06 * (seed - 0.5) }));
  g.add(pill(0.074, W - 0.15, C.white, { rz: HP, y: top + 0.04 - (W - 0.15) / 2, z: hd - 0.2, seg: 10 }));
  const cloth = dyn(put(blanketGeo({
    W: (W - 0.115) / 2 + 0.012, zMade: -0.2, zPull: -hd + 0.62, zFoot: hd - 0.12,
    band: opts.band ?? (icu ? C.tealLight : C.blanketDeep), body: opts.blanket ?? '#d8eefa', key: kind,
  }), clothMat, { y: top, shadow: false }));
  g.add(cloth);
  // Side rails. The ward bed keeps the head half guarded like the reference, ICU is railed the full length.
  for (const a of [-1, 1]) {
    const x = a * (hx - 0.016);
    if (icu) {
      g.add(...sideRail(x, -hd + 0.2, -0.04, 0.63, 0.93, C.white), ...sideRail(x, 0.04, hd - 0.24, 0.63, 0.93, C.white));
      g.add(chip(0.012, 0.09, 0.2, trim, { x, y: 0.74, z: -0.4 }));
    } else g.add(...sideRail(x, -hd + 0.26, 0.02, 0.63, 0.88));
  }
  // Rewards for zooming in: chart on the foot board, hand control on a curly lead
  const cx = icu ? -0.22 : 0;
  g.add(panel(0.17, 0.23, chartMat(), { x: cx, z: hd - 0.004, y: 0.46 }));
  g.add(chip(0.07, 0.018, 0.012, C.steelDeep, { x: cx, y: 0.68, z: hd - 0.004 }));
  g.add(sbox(0.03, 0.13, 0.05, C.steelDeep, { x: hx - 0.016, y: 0.66, z: 0.14, r: 0.008 }));
  g.add(hose([[hx - 0.016, 0.79, 0.14], [hx - 0.02, 0.86, 0.08], [hx - 0.02, 0.76, 0.0]], 0.0045, C.steelDeep, { seg: 8, radial: 3 }));
  if (icu) {
    g.add(sbox(0.3, 0.1, 0.01, C.ink, { x: 0.24, y: 0.56, z: hd - 0.005, r: 0.004 }));
    g.add(panel(0.27, 0.075, stillScreen('icuFoot', 135, 38, (x, w, h) => {
      x.fillStyle = '#16323a'; x.fillRect(0, 0, w, h);
      x.fillStyle = C.teal; x.fillRect(7, 7, 40, 24);
      x.fillStyle = C.screenGlow; x.fillRect(56, 9, 70, 5); x.fillRect(56, 22, 46, 5);
    }), { x: 0.24, y: 0.572, z: hd + 0.0005 }));
  }
  // State light on the top of the foot board
  const glow = [C.watch, C.danger].map((c) => { const h = halo(c, 0.7); h.position.set(0, 0.8, hd - 0.03); return h; });
  const light = dyn(put(once('footLight', () => new THREE.CapsuleGeometry(0.02, 0.12, 3, 8).rotateZ(HP)), lightMat('free'), { y: 0.757, z: hd - 0.034, shadow: false }));
  g.add(light, ...glow);
  bedState(g, { cloth, light, glow });
  BEDS.push(g);
  if (opts.status) { g.userData.setState({ status: opts.status, alarm: opts.alarm ?? null }); g.userData.settle(); }
  return g;
}

function gurney() {
  const { fp: [W, D] } = CATALOG.gurney;
  const hd = D / 2, hx = W / 2, deck = 0.68;
  const g = group(contact(W * 0.92, D * 0.94, 0.44));
  g.add(...fourCastors(W - 0.14, D - 0.42, { r: 0.075 }));
  const lx = hx - 0.07, lz = hd - 0.21;
  // Scissor lift between the base rails and the deck
  for (const a of [-1, 1]) {
    g.add(rod([a * (lx - 0.06), 0.17, -lz], [a * (lx - 0.06), 0.17, lz], 0.02, C.plastic));
    g.add(rod([a * (lx - 0.08), 0.18, -lz + 0.1], [a * (lx - 0.08), deck, lz - 0.1], 0.018, STEEL));
    g.add(rod([a * (lx - 0.08), 0.18, lz - 0.1], [a * (lx - 0.08), deck, -lz + 0.1], 0.018, STEEL));
  }
  g.add(rod([-(lx - 0.08), 0.43, 0], [lx - 0.08, 0.43, 0], 0.016, STEEL_DARK));
  g.add(sbox(W - 0.24, 0.05, 1.1, C.plastic, { y: 0.22, r: 0.02 }));
  g.add(sbox(W - 0.08, 0.06, D - 0.1, C.white, { y: deck, r: 0.028, seg: 2 }));
  g.add(sbox(W - 0.17, 0.085, D - 0.26, C.sheet, { y: deck + 0.06, r: 0.04, seg: 2 }));
  g.add(cushion(W - 0.3, 0.1, 0.32, C.pillow, { y: deck + 0.178, z: -hd + 0.33, rx: 0.1 }));
  g.add(sbox(W - 0.2, 0.05, 0.44, C.blanket, { y: deck + 0.14, z: hd - 0.45, r: 0.024 }));
  g.add(sbox(W - 0.22, 0.03, 0.12, C.blanketDeep, { y: deck + 0.185, z: hd - 0.6, r: 0.014 }));
  for (const a of [-1, 1]) g.add(...sideRail(a * (hx - 0.018), -0.62, 0.62, deck + 0.04, deck + 0.24, C.steel));
  g.add(hose([[-0.24, deck + 0.02, hd - 0.03], [-0.25, deck + 0.2, hd - 0.02], [-0.16, deck + 0.235, hd - 0.02], [0.16, deck + 0.235, hd - 0.02], [0.25, deck + 0.2, hd - 0.02], [0.24, deck + 0.02, hd - 0.03]], 0.014, C.steel, { seg: 14, radial: 4 }));
  g.add(hose([[-0.24, deck + 0.02, -hd + 0.03], [-0.25, deck + 0.2, -hd + 0.02], [-0.16, deck + 0.235, -hd + 0.02], [0.16, deck + 0.235, -hd + 0.02], [0.25, deck + 0.2, -hd + 0.02], [0.24, deck + 0.02, -hd + 0.03]], 0.014, C.steel, { seg: 14, radial: 4 }));
  return g;
}

export function registerBeds() {
  registerProp('bed', (o) => buildBed('ward', o));
  registerProp('icuBed', (o) => buildBed('icu', o));
  registerProp('gurney', gurney);
}
export { bedState, blanketGeo, clothMat };
