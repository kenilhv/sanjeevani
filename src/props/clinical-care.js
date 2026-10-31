// Everything around the bed: monitors, IV stands, carts, wheelchairs, ventilators and the soft pleated curtains.
import * as THREE from 'three';
import { CATALOG, registerProp } from './registry.js';
import { group, contact, panel, mat, matGlow, matGlass, matGloss, ball } from '../style/kit.js';
import { C } from '../style/palette.js';
import {
  HP, STEEL, STEEL_DARK, CHROME, once, put, sbox, chip, drum, rod, hose, hoop, turned, dot, slab, cushion, roundShape,
  fourCastors, castor, starBase, dyn, damp, nextSeed, lightMat, pulseMat, halo, liveCanvas, sharedScreen, pump, MONO, SANS,
} from './clinical-kit.js';
import { BEDS } from './clinical-bed.js';

// ── small furniture ─────────────────────────────────────────
function bedsideTable() {
  const g = group(contact(0.48, 0.48, 0.46));
  g.add(sbox(0.46, 0.5, 0.46, C.white, { y: 0.03, r: 0.05, seg: 2 }));
  g.add(sbox(0.5, 0.03, 0.5, C.offWhite, { y: 0.52, r: 0.014 }));
  for (const [y, h] of [[0.3, 0.17], [0.08, 0.2]]) {
    g.add(sbox(0.39, h, 0.016, C.offWhite, { y, z: 0.232, r: 0.008 }));
    g.add(sbox(0.11, 0.016, 0.014, C.tealDeep, { y: y + h - 0.045, z: 0.244, r: 0.006 }));
  }
  for (const a of [-1, 1]) g.add(chip(0.008, 0.46, 0.008, C.tealDeep, { x: a * 0.205, y: 0.05, z: 0.232 }));
  // Bedside lamp from the reference: teal stem, white shade
  g.add(turned([[0, 0], [0.05, 0], [0.042, 0.012], [0.012, 0.03], [0.011, 0.11]], C.tealDeep, { y: 0.55, x: -0.09, z: -0.08, seg: 10 }));
  g.add(turned([[0.046, 0], [0.066, 0], [0.05, 0.085], [0.03, 0.09]], mat(C.white, { emissive: '#ffe9c2', emissiveIntensity: 0.4 }), { y: 0.65, x: -0.09, z: -0.08, seg: 10, shadow: false }));
  g.add(drum(0.03, 0.026, 0.075, matGlass('#cfeeff', 0.5), { x: 0.13, y: 0.55, z: 0.1, seg: 8, shadow: false }));
  g.add(sbox(0.13, 0.05, 0.09, C.blanket, { x: 0.1, y: 0.55, z: -0.12, r: 0.012 }));
  g.add(sbox(0.05, 0.012, 0.026, C.white, { x: 0.1, y: 0.598, z: -0.12, r: 0.004 }));
  return g;
}

function oxygenTank() {
  const g = group(contact(0.28, 0.28, 0.46));
  g.add(hoop(0.115, 0.012, C.steelDeep, { rx: HP, y: 0.07, seg: 14, tseg: 4 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(castor(Math.cos(a) * 0.115, Math.sin(a) * 0.115, { r: 0.024, yaw: a, lite: true }));
    g.add(rod([Math.cos(a) * 0.115, 0.07, Math.sin(a) * 0.115], [Math.cos(a) * 0.092, 0.34, Math.sin(a) * 0.092], 0.007, STEEL_DARK, { seg: 4 }));
  }
  g.add(hoop(0.098, 0.01, STEEL_DARK, { rx: HP, y: 0.34, seg: 14, tseg: 4 }));
  g.add(turned([[0, 0], [0.078, 0], [0.09, 0.02], [0.09, 0.84]], C.white, { y: 0.075, seg: 14 }));
  g.add(turned([[0.09, 0], [0.088, 0.05], [0.07, 0.12], [0.036, 0.165], [0.02, 0.2]], C.leafLight, { y: 0.915, seg: 14 }));
  g.add(hoop(0.0915, 0.006, C.leafLight, { rx: HP, y: 0.8, seg: 14, tseg: 3 }));
  g.add(drum(0.022, 0.024, 0.08, STEEL, { y: 1.11, seg: 8 }));
  g.add(drum(0.036, 0.036, 0.016, C.leaf, { y: 1.205, seg: 10 }));
  g.add(drum(0.008, 0.008, 0.05, STEEL, { x: 0.04, y: 1.125, rz: HP, seg: 5 }));
  g.add(drum(0.034, 0.034, 0.02, C.white, { y: 1.135, z: 0.05, rx: HP, seg: 12 }));
  g.add(dot(0.028, mat(C.ink), { y: 1.145, z: 0.0605, seg: 10 }));
  g.add(hose([[0.06, 1.15, 0], [0.13, 1.1, 0.02], [0.12, 0.9, 0.09], [0.12, 0.8, 0.1]], 0.006, C.tealLight, { seg: 10, radial: 3 }));
  return g;
}

// ── IV stand ────────────────────────────────────────────────
function saline(x, y, w, h, tintGlass, fluid, label) {
  return [
    sbox(w, h, 0.042, matGlass(tintGlass, 0.5), { x, y, r: 0.018, shadow: false }),
    sbox(w * 0.84, h * 0.72, 0.03, fluid, { x, y: y + h * 0.05, r: 0.012, shadow: false }),
    chip(w * 0.56, h * 0.3, 0.003, label, { x, y: y + h * 0.42, z: 0.022 }),
    chip(0.024, 0.04, 0.008, C.plastic, { x, y: y + h - 0.006 }),
  ];
}
function ivStand() {
  const g = group(contact(0.38, 0.38, 0.4));
  g.add(...starBase(0.19));
  g.add(drum(0.0135, 0.0135, 1.72, STEEL, { y: 0.14, seg: 8, open: true }));
  g.add(drum(0.019, 0.019, 0.22, C.white, { y: 0.14, seg: 8 }));
  g.add(drum(0.022, 0.022, 0.024, C.plastic, { y: 0.98, seg: 8 }));
  g.add(ball(0.016, CHROME, { y: 1.875, seg: 8 }));
  g.add(rod([-0.15, 1.83, 0], [0.15, 1.83, 0], 0.0095, STEEL, { seg: 6 }));
  for (const a of [-1, 1]) {
    g.add(hose([[a * 0.15, 1.83, 0], [a * 0.17, 1.85, 0], [a * 0.165, 1.885, 0]], 0.0055, C.steel, { seg: 6, radial: 3 }));
    g.add(hose([[a * 0.11, 1.83, 0], [a * 0.112, 1.8, 0.008], [a * 0.112, 1.782, 0]], 0.004, C.steel, { seg: 5, radial: 3 }));
  }
  const fluid = matGlass('#a6dcf7', 0.6);
  g.add(...saline(-0.11, 1.53, 0.135, 0.25, '#e6f6ff', fluid, C.white));
  g.add(...saline(0.11, 1.61, 0.095, 0.17, '#ffe8e2', mat(C.coralDeep, { rough: 0.4 }), C.white));
  // Drip chamber with a falling droplet, then the line down to the pump
  const cx = -0.11, top = 1.5;
  g.add(drum(0.008, 0.008, 0.03, C.plastic, { x: cx, y: top + 0.008, seg: 6, open: true }));
  g.add(drum(0.0135, 0.0135, 0.07, matGlass('#e6f6ff', 0.55), { x: cx, y: top - 0.064, seg: 8, shadow: false }));
  g.add(drum(0.0125, 0.0125, 0.024, fluid, { x: cx, y: top - 0.062, seg: 8, shadow: false }));
  const drop = dyn(ball(0.0052, mat('#7cc9f2', { rough: 0.2 }), { x: cx, y: top, seg: 6, shadow: false }));
  g.add(drop);
  g.add(hose([[cx, top - 0.064, 0], [cx - 0.015, 1.3, 0.03], [-0.13, 1.14, 0.09], [-0.02, 1.08, 0.095], [0, 1.05, 0.06]], 0.0042, matGlass('#d6efff', 0.75), { seg: 16, radial: 3, shadow: false }));
  g.add(hose([[0, 0.88, 0.06], [0.05, 0.72, 0.1], [0.12, 0.62, 0.1], [0.14, 0.72, 0.06], [0.1, 0.84, 0.03]], 0.0042, matGlass('#d6efff', 0.75), { seg: 14, radial: 3, shadow: false }));
  // Infusion pump clamped to the pole
  g.add(sbox(0.15, 0.2, 0.1, C.white, { y: 0.87, z: 0.055, r: 0.022 }));
  g.add(sbox(0.112, 0.055, 0.006, C.screen, { y: 0.995, z: 0.106, r: 0.002 }));
  g.add(dot(0.0072, matGlow(C.ok, 2), { x: -0.05, y: 0.965, z: 0.1065 }));
  g.add(chip(0.05, 0.012, 0.004, C.tealDeep, { x: 0.02, y: 0.96, z: 0.1065 }));
  const seed = nextSeed() * 2;
  g.userData.tick = (dt, t) => {
    const p = (t * 0.8 + seed) % 1;
    const fall = p < 0.72 ? 0 : (p - 0.72) / 0.28;
    drop.position.y = top + 0.002 - 0.05 * fall * fall;
    const swell = p < 0.72 ? 0.4 + p * 0.8 : 1;
    drop.scale.setScalar(swell);
  };
  return g;
}

// ── vitals monitor ──────────────────────────────────────────
const BEAT = [0, 0.02, 0.07, 0.13, 0.15, 0.1, 0.03, 0, 0, -0.12, 0.98, 0.42, -0.26, -0.04, 0, 0, 0.03, 0.08, 0.15, 0.22, 0.25, 0.2, 0.12, 0.05];
const PLETH = [0, 0.1, 0.32, 0.62, 0.86, 1, 0.94, 0.78, 0.6, 0.48, 0.44, 0.47, 0.46, 0.38, 0.28, 0.2, 0.13, 0.08, 0.04, 0.02];
const BG = '#0d1c24', TRACE_W = 100, RATE = 38;
// Monitors redraw at 10 Hz at most, and only this many per frame: a full ICU spreads out instead of all landing on one frame.
let budgetT = -1, budget = 0;
const spend = (t) => { if (t !== budgetT) { budgetT = t; budget = 5; } return budget-- > 0; };

function vitalsScreen(seed) {
  const s = liveCanvas(144, 96), c = s.ctx, H = s.h;
  let last = 0, col = 0, n = Math.floor(seed * 400), ecg = 34, pl = 78, shownHr = -1, shownSp = -1, mode = '', flashOn = false, drift = seed * 9;
  const frame = () => {
    c.fillStyle = BG; c.fillRect(0, 0, s.w, H);
    c.fillStyle = '#16303a'; c.fillRect(TRACE_W + 1, 0, 1, H);
    c.fillStyle = '#122730';
    for (let i = 12; i < TRACE_W; i += 16) c.fillRect(i, 0, 1, H);
    for (let i = 16; i < H; i += 16) c.fillRect(0, i, TRACE_W, 1);
  };
  const numbers = (hr, sp, alarm) => {
    const x = TRACE_W + 3, w = s.w - x;
    c.fillStyle = alarm && flashOn ? '#5c1c26' : BG; c.fillRect(x, 0, w, H);
    c.fillStyle = alarm ? '#ff9aa2' : C.screenGlow;
    c.font = `700 11px ${SANS}`; c.fillText('HR', x + 3, 12);
    c.font = `700 25px ${MONO}`; c.fillText(String(hr), x + 1, 40);
    c.fillStyle = '#74d7ff';
    c.font = `700 11px ${SANS}`; c.fillText('SpO2', x + 3, 58);
    c.font = `700 21px ${MONO}`; c.fillText(String(sp), x + 2, 82);
  };
  frame();
  return {
    mat: s.mat,
    /** Reads hr/spo2 from the linked bed, or a gentle drift when the monitor stands alone. */
    draw(t, hr, sp, alarm, standby) {
      if (standby) {
        if (mode !== 'standby') {
          mode = 'standby'; frame();
          c.fillStyle = '#2d5560'; c.font = `600 14px ${SANS}`; c.textAlign = 'center'; c.fillText('Ready', s.w / 2, 46); c.textAlign = 'left';
          c.fillStyle = C.ok; c.beginPath(); c.arc(s.w / 2, 62, 3, 0, 7); c.fill();
          s.tex.needsUpdate = true;
        }
        return;
      }
      if (mode !== 'live') { mode = 'live'; frame(); last = t; shownHr = -1; col = 0; }
      const steps = Math.min(14, Math.floor((t - last) * RATE));
      if (!steps) return;
      last += steps / RATE;
      const beatLen = Math.max(14, Math.round((RATE * 60) / Math.max(30, hr))), plLen = beatLen;
      c.lineWidth = 1.6; c.lineCap = 'round';
      for (let i = 0; i < steps; i++) {
        const b = n % beatLen, nextE = 36 - (BEAT[b] ?? 0) * 26;
        const q = Math.floor(((n + 6) % plLen) * (PLETH.length / plLen)), nextP = 86 - PLETH[q] * 22;
        c.fillStyle = BG; c.fillRect(col + 1, 0, 7, H);
        c.beginPath();
        c.strokeStyle = alarm === 'critical' ? '#ff7680' : C.screenGlow; c.moveTo(col, ecg); c.lineTo(col + 1, nextE); c.stroke();
        c.beginPath();
        c.strokeStyle = '#74d7ff'; c.moveTo(col, pl); c.lineTo(col + 1, nextP); c.stroke();
        ecg = nextE; pl = nextP; n++;
        if (++col >= TRACE_W - 8) { col = 0; c.fillStyle = BG; c.fillRect(TRACE_W - 8, 0, 8, H); }
      }
      flashOn = alarm ? t % 0.6 < 0.3 : false;
      const showHr = Math.round(hr), showSp = Math.round(sp);
      if (alarm || showHr !== shownHr || showSp !== shownSp) { shownHr = showHr; shownSp = showSp; numbers(showHr, showSp, alarm); }
      s.tex.needsUpdate = true;
    },
    drift: (t) => { drift = t * 0.11 + seed * 20; return drift; },
  };
}
const here = new THREE.Vector3(), there = new THREE.Vector3();
function nearestBed(g) {
  g.getWorldPosition(here);
  let best = null, bd = 6.3;
  for (const b of BEDS) {
    b.getWorldPosition(there);
    if (Math.abs(here.y - there.y) > 1.5) continue;
    const d = (here.x - there.x) ** 2 + (here.z - there.z) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function vitalsMonitor(opts = {}) {
  const g = group(contact(0.42, 0.42, 0.42));
  g.add(...starBase(0.2));
  g.add(drum(0.015, 0.015, 1.02, STEEL, { y: 0.14, seg: 8, open: true }));
  g.add(drum(0.021, 0.021, 0.16, C.white, { y: 0.14, seg: 8 }));
  g.add(sbox(0.16, 0.05, 0.1, C.plastic, { y: 0.74, z: 0.04, r: 0.016 }));
  g.add(hose([[0.05, 0.8, 0.06], [0.1, 0.93, 0.14], [0.17, 0.82, 0.13], [0.1, 0.76, 0.1], [0.14, 0.88, 0.06]], 0.0055, C.steelDeep, { seg: 14, radial: 3 }));
  const head = new THREE.Group();
  head.position.set(0, 1.21, 0.02);
  head.rotation.x = -0.14;
  head.add(sbox(0.45, 0.33, 0.1, C.white, { y: -0.15, z: -0.03, r: 0.036, seg: 2 }));
  head.add(sbox(0.37, 0.26, 0.012, C.ink, { y: -0.118, z: 0.024, r: 0.012, sz: 0.5, x: -0.022 }));
  head.add(chip(0.024, 0.2, 0.01, C.plastic, { x: 0.2, y: -0.09, z: 0.022 }));
  for (let i = 0; i < 3; i++) head.add(dot(0.0078, [C.teal, C.steel, C.stripe][i], { x: 0.2, y: -0.06 + i * 0.05, z: 0.0285 }));
  head.add(hoop(0.05, 0.007, C.plastic, { arc: Math.PI, seg: 8, tseg: 4, y: 0.17, z: -0.03 }));
  head.add(sbox(0.12, 0.09, 0.09, C.plastic, { y: -0.08, z: -0.1, r: 0.02 }));
  g.add(head);
  const seed = nextSeed();
  const scr = vitalsScreen(seed);
  head.add(dyn(panel(0.345, 0.232, scr.mat, { x: -0.022, y: -0.104, z: 0.0312 })));
  const lamp = dyn(put(once('monLamp', () => new THREE.SphereGeometry(0.03, 8, 5, 0, Math.PI * 2, 0, HP)), lightMat('free'), { y: 0.183, x: -0.15, z: -0.03, shadow: false }));
  const glow = halo(C.danger, 0.8);
  glow.position.set(-0.15, 0.2, -0.03);
  head.add(lamp, glow);
  let bed, linked = false, alarm = null, fault = false, shown = null, last = 0, wired = null;
  const rest = 64 + ((seed * 19) | 0), restSp = 96 + ((seed * 7) % 3 | 0);
  const hidden = () => { for (let p = g.parent; p; p = p.parent) if (!p.visible) return true; return false; };
  g.userData.setState = (s) => {
    if (s.vitals) wired = s;
    fault = s.status === 'fault';
    if (s.alarm !== undefined) alarm = s.alarm;
  };
  g.userData.tick = (dt, t) => {
    if (!linked) { linked = true; bed = opts.solo ? null : nearestBed(g); }
    const live = wired ?? bed?.userData.live;
    const on = live && live.vitals && live.status === 'occupied';
    const standby = !!live && !on && !wired;
    const a = fault ? 'critical' : live ? live.alarm ?? alarm : alarm;
    if (a !== shown) {
      shown = a;
      lamp.material = a ? pulseMat(a === 'critical' ? C.danger : C.watch) : lightMat(standby ? 'idle' : 'free');
      glow.visible = a === 'critical';
      if (!a) head.scale.setScalar(1);
    }
    if (a === 'critical') glow.scale.setScalar(0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * 8)));
    if (t - last < 0.1 || !spend(t) || hidden()) return;
    last = t;
    if (on) scr.draw(t, live.vitals.hr, live.vitals.spo2, a, false);
    else if (standby) scr.draw(t, 0, 0, a, true);
    else { const d = scr.drift(t); scr.draw(t, rest + Math.sin(d) * 3, restSp + Math.sin(d * 0.6), a, false); }
  };
  return g;
}

// ── carts ───────────────────────────────────────────────────
/** The reference's cart: bright side panels, dark frame, a stack of white drawers and an open tray below. */
function cartBody({ w, d, top, body, frame, drawer, handle, tags, rows }) {
  const parts = [contact(w * 0.92, d * 0.92, 0.46), ...fourCastors(w - 0.12, d - 0.1, { r: 0.045 })];
  const y0 = 0.1, shelf = 0.34;
  parts.push(sbox(w, 0.04, d, frame, { y: y0, r: 0.016 }));
  parts.push(sbox(w - 0.1, 0.022, d - 0.1, C.plastic, { y: y0 + 0.04, r: 0.008 }));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(chip(0.035, shelf - y0, 0.035, frame, { x: (a * (w - 0.05)) / 2, y: y0 + 0.02, z: (b * (d - 0.05)) / 2 }));
  parts.push(sbox(w - 0.012, top - shelf, d - 0.012, body, { y: shelf, r: 0.024 }));
  parts.push(sbox(w, 0.03, d, frame, { y: shelf - 0.012, r: 0.012 }));
  const space = (top - shelf - 0.04) / rows;
  for (let i = 0; i < rows; i++) {
    const y = shelf + 0.025 + i * space, h = space - 0.012;
    parts.push(sbox(w - 0.08, h, 0.02, drawer, { y, z: d / 2 - 0.002, r: 0.009 }));
    parts.push(sbox(0.16, 0.014, 0.016, handle, { y: y + h * 0.56, z: d / 2 + 0.012, r: 0.006 }));
    parts.push(chip(0.07, Math.min(0.03, h * 0.3), 0.002, tags[i % tags.length], { x: -(w - 0.08) / 2 + 0.07, y: y + h * 0.42, z: d / 2 + 0.009 }));
  }
  parts.push(sbox(w + 0.0, 0.035, d, C.white, { y: top - 0.005, r: 0.014 }));
  return parts;
}
function medCart() {
  const { fp: [w, d] } = CATALOG.medCart;
  const g = group(...cartBody({ w: w - 0.02, d: d - 0.02, top: 0.86, body: C.cartBlue, frame: C.charcoal, drawer: C.white, handle: C.charcoal, tags: [C.tileSky, C.tileButter, C.tileMint], rows: 4 }));
  const y = 0.89;
  g.add(sbox(0.34, 0.15, 0.3, C.white, { x: -0.1, y, z: -0.06, r: 0.03 }));
  g.add(sbox(0.3, 0.018, 0.24, C.plastic, { x: -0.1, y: y + 0.15, z: -0.06, r: 0.008 }));
  g.add(chip(0.07, 0.04, 0.003, C.cartBlueDeep, { x: -0.16, y: y + 0.07, z: 0.0915 }));
  g.add(dot(0.009, matGlow(C.watch, 1.8), { x: -0.03, y: y + 0.1, z: 0.0915 }));
  // Weekly pill organiser
  g.add(sbox(0.2, 0.028, 0.095, C.white, { x: 0.24, y, z: 0.1, r: 0.01 }));
  for (let i = 0; i < 5; i++) g.add(chip(0.03, 0.006, 0.07, [C.rose, C.stripe, C.tealLight, C.purpleLight, C.leafLight][i], { x: 0.163 + i * 0.038, y: y + 0.027, z: 0.1 }));
  g.add(drum(0.03, 0.028, 0.09, matGlass('#fff3d6', 0.72), { x: 0.2, y, z: -0.1, seg: 8, shadow: false }));
  g.add(drum(0.032, 0.032, 0.02, C.white, { x: 0.2, y: y + 0.09, z: -0.1, seg: 8 }));
  g.add(sbox(0.09, 0.05, 0.12, C.stripe, { x: 0.3, y, z: -0.1, r: 0.01 }));
  // Sharps bin on the side
  g.add(sbox(0.036, 0.18, 0.16, C.stripe, { x: -(w / 2) + 0.012, y: 0.6, r: 0.012 }));
  return g;
}
function crashCart() {
  const { fp: [w, d] } = CATALOG.crashCart;
  const red = mat(C.danger, { rough: 0.55 });
  const g = group(...cartBody({ w: w - 0.02, d: d - 0.14, top: 0.88, body: red, frame: mat('#a93744'), drawer: mat('#f47d84', { rough: 0.5 }), handle: C.white, tags: [C.white], rows: 5 }));
  const y = 0.91;
  // Defibrillator on top
  g.add(sbox(0.42, 0.17, 0.3, C.offWhite, { y, z: -0.01, r: 0.03, seg: 2 }));
  g.add(sbox(0.2, 0.12, 0.006, C.screen, { x: -0.08, y: y + 0.03, z: 0.142, r: 0.002 }));
  g.add(panel(0.18, 0.1, sharedScreen('defib', 90, 50, (c, w2, h2, t) => {
    c.fillStyle = '#0c1a20'; c.fillRect(0, 0, w2, h2);
    c.strokeStyle = C.screenGlow; c.lineWidth = 1.4; c.beginPath();
    for (let x = 0; x < w2; x++) { const p = (x + t * 26) % 30; const v = p > 13 && p < 16 ? -18 : p > 16 && p < 18 ? 8 : 0; x ? c.lineTo(x, 28 + v) : c.moveTo(x, 28); }
    c.stroke();
  }, 8).mat, { x: -0.08, y: y + 0.04, z: 0.146 }));
  g.add(dot(0.024, matGlow(C.danger, 1.5), { x: 0.1, y: y + 0.1, z: 0.1445, seg: 12 }));
  g.add(dot(0.016, C.stripe, { x: 0.1, y: y + 0.045, z: 0.1445 }));
  for (const a of [-1, 1]) g.add(sbox(0.052, 0.05, 0.12, C.charcoal, { x: 0.15 + a * 0.04, y: y + 0.165, r: 0.016 }));
  g.add(hose([[0.19, y + 0.19, 0.04], [0.26, y + 0.08, 0.1], [0.3, y - 0.03, 0.06], [0.22, y + 0.07, 0.16]], 0.0055, C.charcoal, { seg: 10, radial: 3 }));
  // Back board and an oxygen bottle clipped on
  g.add(sbox(0.5, 0.75, 0.024, mat(C.stripeDeep), { y: 0.26, z: -(d / 2) + 0.034, r: 0.012 }));
  g.add(turned([[0.042, 0], [0.042, 0.38], [0.03, 0.42], [0.014, 0.44]], C.leafLight, { x: -(w / 2) + 0.03, y: 0.45, z: 0.1, seg: 8, sx: 0.6 }));
  // Numbered seal on the top drawer, the small thing nurses actually check
  g.add(chip(0.02, 0.05, 0.004, C.stripe, { x: 0.22, y: 0.74, z: (d - 0.14) / 2 + 0.014 }));
  return g;
}
function supplyCart() {
  const { fp: [w, d], h } = CATALOG.supplyCart;
  const g = group(contact(w * 0.92, d * 0.9, 0.42), ...fourCastors(w - 0.14, d - 0.12, { r: 0.05 }));
  const levels = [0.14, 0.52, 0.9];
  for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(rod([(a * (w - 0.1)) / 2, 0.1, (b * (d - 0.08)) / 2], [(a * (w - 0.1)) / 2, h - 0.01, (b * (d - 0.08)) / 2], 0.0135, STEEL, { seg: 8 }));
  for (const a of [-1, 1]) {
    g.add(rod([(a * (w - 0.1)) / 2, h - 0.01, (d - 0.08) / 2], [(a * (w - 0.1)) / 2, h - 0.01, -(d - 0.08) / 2], 0.0135, STEEL));
    g.add(ball(0.0135, STEEL, { x: (a * (w - 0.1)) / 2, y: h - 0.01, z: (d - 0.08) / 2, seg: 6 }));
    g.add(ball(0.0135, STEEL, { x: (a * (w - 0.1)) / 2, y: h - 0.01, z: -(d - 0.08) / 2, seg: 6 }));
  }
  for (const y of levels) {
    g.add(sbox(w - 0.04, 0.03, d - 0.02, C.white, { y, r: 0.012 }));
    for (const b of [-1, 1]) g.add(rod([-(w - 0.1) / 2, y + 0.07, (b * (d - 0.06)) / 2], [(w - 0.1) / 2, y + 0.07, (b * (d - 0.06)) / 2], 0.006, STEEL, { seg: 4 }));
  }
  const bins = [[C.tealLight, C.teal], [C.purpleLight, C.purple], [C.tileButter, C.stripe], [C.rose, C.coralDeep]];
  [[0, -0.27, 0], [1, 0.0, 0], [3, 0.27, 0]].forEach(([c, x]) => {
    g.add(sbox(0.25, 0.14, 0.38, bins[c][0], { x, y: 0.55, r: 0.022 }));
    g.add(chip(0.2, 0.02, 0.33, bins[c][1], { x, y: 0.685 }));
    g.add(chip(0.1, 0.05, 0.003, C.white, { x, y: 0.59, z: 0.192 }));
  });
  for (const [x, n] of [[-0.25, 3], [0.2, 2]]) for (let i = 0; i < n; i++) g.add(sbox(0.34, 0.052, 0.34, i % 2 ? C.white : C.offWhite, { x: x + i * 0.008, y: 0.17 + i * 0.054, r: 0.024 }));
  g.add(sbox(0.2, 0.09, 0.3, C.blanket, { x: -0.26, y: 0.93, r: 0.018 }));
  g.add(sbox(0.22, 0.16, 0.26, C.woodLight, { x: 0.06, y: 0.93, r: 0.008 }));
  g.add(chip(0.03, 0.002, 0.27, C.wood, { x: 0.06, y: 1.09 }));
  g.add(drum(0.05, 0.05, 0.14, C.white, { x: 0.3, y: 0.93, z: 0.08, seg: 8 }));
  g.add(drum(0.05, 0.05, 0.14, C.tileSky, { x: 0.3, y: 0.93, z: -0.09, seg: 8 }));
  return g;
}

// ── wheelchair ──────────────────────────────────────────────
function wheelchair() {
  const g = group(contact(0.62, 0.84, 0.42));
  const seat = 0.5, wx = 0.3, wz = -0.13, R = 0.28;
  for (const a of [-1, 1]) {
    const x = a * wx;
    const wheel = new THREE.Group();
    wheel.position.set(x, R + 0.02, wz);
    wheel.rotation.y = HP;
    wheel.add(hoop(R, 0.018, C.charcoal, { seg: 26, tseg: 5 }));
    wheel.add(hoop(R - 0.036, 0.006, CHROME, { seg: 20, tseg: 3 }));
    wheel.add(drum(0.034, 0.034, 0.05, STEEL, { rx: HP, y: -0.025, seg: 8 }));
    for (let i = 0; i < 6; i++) {
      const s = (i / 6) * Math.PI;
      wheel.add(rod([Math.cos(s) * (R - 0.02), Math.sin(s) * (R - 0.02), 0], [-Math.cos(s) * (R - 0.02), -Math.sin(s) * (R - 0.02), 0], 0.0028, C.steel, { seg: 3 }));
    }
    g.add(wheel);
    g.add(castor(a * 0.21, 0.28, { r: 0.05, yaw: 0.4 * a }));
    // Frame
    g.add(rod([a * 0.215, seat - 0.02, -0.22], [a * 0.215, seat - 0.02, 0.26], 0.012, STEEL_DARK));
    g.add(rod([a * 0.215, seat - 0.02, 0.26], [a * 0.21, 0.12, 0.28], 0.012, STEEL_DARK));
    g.add(rod([a * 0.215, seat - 0.02, 0.26], [a * 0.17, 0.2, 0.41], 0.011, STEEL_DARK));
    g.add(rod([a * 0.215, 0.26, -0.17], [a * 0.215, 0.26, 0.27], 0.01, STEEL_DARK));
    g.add(rod([a * 0.215, 0.26, -0.17], [a * 0.215, 0.87, -0.26], 0.012, STEEL_DARK));
    g.add(hose([[a * 0.215, 0.86, -0.26], [a * 0.215, 0.91, -0.285], [a * 0.215, 0.91, -0.36]], 0.012, STEEL_DARK, { seg: 5, radial: 4 }));
    g.add(drum(0.017, 0.017, 0.085, C.charcoal, { x: a * 0.215, y: 0.91 - 0.0425, z: -0.34, rx: HP, seg: 6 }));
    g.add(sbox(0.12, 0.016, 0.16, C.charcoal, { x: a * 0.09, y: 0.19, z: 0.4, r: 0.006 }));
    // Armrest
    g.add(rod([a * 0.235, seat - 0.02, 0.17], [a * 0.235, 0.71, 0.17], 0.01, STEEL));
    g.add(rod([a * 0.235, 0.71, -0.2], [a * 0.235, seat - 0.02, -0.2], 0.01, STEEL));
    g.add(sbox(0.052, 0.03, 0.42, C.charcoal, { x: a * 0.235, y: 0.71, z: -0.01, r: 0.012 }));
  }
  g.add(rod([-0.215, seat - 0.02, 0.06], [0.215, seat - 0.02, 0.06], 0.01, STEEL_DARK), rod([-0.215, 0.26, -0.17], [0.215, 0.26, -0.17], 0.01, STEEL_DARK));
  g.add(sbox(0.42, 0.07, 0.42, C.teal, { y: seat, z: 0.02, r: 0.03, seg: 2 }));
  g.add(sbox(0.42, 0.34, 0.05, C.tealDeep, { y: seat + 0.08, z: -0.22, r: 0.022, rx: -0.09 }));
  return g;
}

// ── ventilator ──────────────────────────────────────────────
const wave = (t, f) => { const p = (t * f) % 1; return p < 0.35 ? Math.sin((p / 0.35) * HP) : Math.exp(-(p - 0.35) * 7); };
export function ventPaint(c, w, h, t) {
  c.fillStyle = '#0d1c24'; c.fillRect(0, 0, w, h);
  const rows = [[C.stripe, 14, 26, 0.26], ['#74d7ff', 48, 22, 0.26], [C.screenGlow, 82, 18, 0.13]], tw = w - 46;
  c.lineWidth = 1.5;
  for (const [col, base, amp, f] of rows) {
    c.strokeStyle = col; c.beginPath();
    for (let x = 0; x < tw; x += 2) { const y = base + 8 - wave(t + x / 34, f) * amp * 0.72; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.fillStyle = '#16303a'; c.fillRect(tw + 1, 0, 1, h);
  c.fillStyle = C.stripe; c.font = `700 18px ${MONO}`; c.fillText('24', tw + 8, 28);
  c.fillStyle = '#74d7ff'; c.fillText('14', tw + 8, 58);
  c.fillStyle = C.screenGlow; c.fillText('98', tw + 8, 88);
}
function bellowsGeo() {
  return once('bellows', () => {
    const p = [[0, 0.002], [0.078, 0.002]];
    for (let i = 0; i < 6; i++) p.push([0.07, 0.016 + i * 0.03], [0.086, 0.03 + i * 0.03]);
    p.push([0.07, 0.195], [0.06, 0.2], [0, 0.205]);
    return new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  });
}
function ventilator() {
  const g = group(contact(0.54, 0.54, 0.44));
  g.add(...fourCastors(0.42, 0.42, { r: 0.04 }));
  for (const [a, b] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) g.add(rod([a * 0.21, 0.08, b * 0.21], [0, 0.13, 0], 0.016, C.plastic, { seg: 6 }));
  g.add(drum(0.048, 0.06, 0.08, C.white, { y: 0.09, seg: 10 }));
  g.add(drum(0.026, 0.026, 0.42, C.plastic, { y: 0.16, seg: 8, open: true }));
  g.add(sbox(0.5, 0.42, 0.42, C.white, { y: 0.53, z: -0.02, r: 0.05, seg: 2 }));
  g.add(sbox(0.5, 0.02, 0.42, C.tealLight, { y: 0.61, z: -0.02, r: 0.008, sx: 1.002 }));
  const scr = sharedScreen('vent', 130, 96, ventPaint, 7);
  const face = new THREE.Group();
  face.position.set(0, 0.76, 0.19);
  face.rotation.x = -0.1;
  face.add(sbox(0.37, 0.27, 0.02, C.ink, { y: -0.135, r: 0.016 }));
  face.add(panel(0.335, 0.235, scr.mat, { y: -0.118, z: 0.0105 }));
  g.add(face);
  g.add(drum(0.022, 0.022, 0.018, C.charcoal, { x: 0.205, y: 0.59, z: 0.195, rx: HP, seg: 10 }));
  g.add(dot(0.01, matGlow(C.ok, 2), { x: -0.2, y: 0.585, z: 0.192 }));
  g.add(dot(0.01, C.plastic, { x: -0.165, y: 0.585, z: 0.192 }));
  // Bellows in its jar, on top where it can be seen pumping
  const jarY = 0.95;
  g.add(sbox(0.3, 0.03, 0.3, C.plastic, { y: jarY, z: -0.03, r: 0.012 }));
  g.add(drum(0.12, 0.12, 0.3, matGlass('#d7f2ff', 0.3), { y: jarY + 0.03, z: -0.03, seg: 16, open: true, shadow: false }));
  g.add(hoop(0.12, 0.008, C.plastic, { rx: HP, y: jarY + 0.33, z: -0.03, seg: 16, tseg: 4 }));
  g.add(drum(0.128, 0.128, 0.012, matGlass('#d7f2ff', 0.3), { y: jarY + 0.33, z: -0.03, seg: 16, shadow: false }));
  const bell = dyn(put(bellowsGeo(), C.teal, { y: jarY + 0.03, z: -0.03, shadow: false }));
  g.add(bell);
  // Patient circuit, looped over its holder
  const blue = C.blanketDeep;
  g.add(hose([[0.2, 0.88, 0.1], [0.27, 0.92, 0.12], [0.25, 1.1, 0.2], [0.09, 1.12, 0.26], [-0.14, 0.98, 0.25], [-0.25, 0.8, 0.2]], 0.016, blue, { seg: 20, radial: 5 }));
  g.add(hose([[0.2, 0.8, 0.1], [0.26, 0.8, 0.14], [0.25, 0.62, 0.22], [0.2, 0.5, 0.26]], 0.016, C.tealLight, { seg: 12, radial: 5 }));
  const seed = nextSeed() * 6;
  g.userData.tick = (dt, t) => {
    pump(scr, t);
    const p = ((t + seed) * 0.28) % 1;
    const breath = p < 0.4 ? 0.5 - 0.5 * Math.cos((p / 0.4) * Math.PI) : 0.5 + 0.5 * Math.cos(((p - 0.4) / 0.6) * Math.PI);
    bell.scale.y = 1 - breath * 0.52;
  };
  return g;
}

// ── curtains ────────────────────────────────────────────────
/** One pleated strip of cloth along a path: wavy in plan, pinched at the rail, flaring toward the hem like real curtain. */
function clothStrip(path, s0, s1, y0, y1, pitch, amp, rows) {
  const len = s1 - s0, pleats = Math.max(2, Math.round(len / pitch)), cols = pleats * 6, N = (cols + 1) * (rows + 1);
  const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), idx = [];
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows, a = amp(y);
    for (let c = 0; c <= cols; c++) {
      const u = c / cols, s = s0 + u * len, [px, pz, nx, nz] = path(s);
      const ph = u * pleats * Math.PI * 2 + 0.5 * Math.sin(s * 1.9);
      const off = a * Math.sin(ph) * (1 + 0.2 * Math.sin(s * 2.7));
      const k = r * (cols + 1) + c;
      pos.set([px + nx * off, y, pz + nz * off], k * 3);
      uv.set([u, r / rows], k * 2);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
const cloth = (color) => mat(color, { rough: 0.92, side: THREE.DoubleSide });
const shade = (hex, k) => `#${new THREE.Color(hex).lerp(new THREE.Color(k > 1 ? '#ffffff' : '#39415a'), k > 1 ? k - 1 : 1 - k).getHexString()}`;

function pleatedRun(key, path, s0, s1, { color, pitch, A = 0.04, y0 = 0.22, y1 = 2.14, head = 2.22 }) {
  const amp = (y) => A * (1.2 - (0.7 * (y - y0)) / (y1 - y0));
  const parts = [];
  const strip = (name, a, b, rows, material) => parts.push(put(once(`cloth|${key}|${name}|${s0}|${s1}|${pitch}|${A}`, () => clothStrip(path, s0, s1, a, b, pitch, amp, rows)), material));
  strip('hem', y0, y0 + 0.07, 1, cloth(shade(color, 0.86)));
  strip('body', y0 + 0.07, y1, 3, cloth(color));
  strip('head', y1, head, 1, cloth(shade(color, 1.55)));
  return parts;
}

function curtainBay(opts = {}) {
  const { fp: [W, D] } = CATALOG.curtainBay;
  const open = Math.min(1, Math.max(0, opts.open ?? 0.75)), color = opts.color ?? C.curtainBlue;
  const a = W / 2 - 0.09, b = D / 2 - 0.09, r = 0.16, side = 2 * b - r, curve = (Math.PI * r) / 2, back = 2 * a - 2 * r, T = 2 * side + 2 * curve + back;
  // Walks the U from the front of the east side, around the back, to the front of the west side.
  const path = (s) => {
    if (s <= side) return [a, b - s, -1, 0];
    s -= side;
    if (s <= curve) { const t = s / r; return [a - r + Math.cos(t) * r, -b + r - Math.sin(t) * r, -Math.cos(t), Math.sin(t)]; }
    s -= curve;
    if (s <= back) return [a - r - s, -b, 0, 1];
    s -= back;
    if (s <= curve) { const t = s / r; return [-a + r - Math.sin(t) * r, -b + r - Math.cos(t) * r, Math.sin(t), Math.cos(t)]; }
    s -= curve;
    return [-a, -b + r + s, 1, 0];
  };
  const g = new THREE.Group();
  const rail = 2.25, samples = [0, side * 0.5, side, side + curve * 0.5, side + curve, side + curve + back, side + curve + back + curve * 0.5, T - side, T - side * 0.5, T];
  g.add(hose(samples.map((s) => { const [x, z] = path(s); return [x, rail, z]; }), 0.016, C.white, { seg: 40, radial: 5 }));
  for (const x of [-a, a]) {
    g.add(contact(0.16, 0.16, 0.3));
    g.children[g.children.length - 1].position.set(x, 0.012, -b);
    g.add(drum(0.017, 0.017, rail, STEEL, { x, z: -b, seg: 8, open: true }));
    g.add(drum(0.06, 0.07, 0.022, C.white, { x, z: -b, seg: 12 }));
    g.add(rod([x, rail, b], [x, 2.3, b], 0.009, STEEL, { seg: 5 }), drum(0.04, 0.04, 0.012, C.white, { x, y: 2.29, z: b, seg: 10 }));
  }
  const bunch = 0.4, inset = open * (side - bunch);
  const pitch = 0.2 - open * 0.055;
  g.add(...pleatedRun(`bay${open}${color}`, path, inset, T - inset, { color, pitch }));
  for (let s = inset; s < T - inset; s += pitch * 2) {
    const [x, z] = path(s);
    g.add(chip(0.016, 0.03, 0.016, C.steel, { x, z, y: rail - 0.04 }));
  }
  return g;
}

function privacyCurtain(opts = {}) {
  const { fp: [W] } = CATALOG.privacyCurtain;
  const color = opts.color ?? C.curtainMint, hx = W / 2 - 0.05, rail = 2.16;
  const g = group(contact(W * 0.92, 0.26, 0.3));
  for (const x of [-hx, hx]) {
    g.add(sbox(0.08, 0.03, 0.2, C.white, { x, y: 0.05, r: 0.012 }));
    g.add(castor(x, 0.07, { r: 0.022, lite: true }), castor(x, -0.07, { r: 0.022, lite: true }));
    g.add(drum(0.017, 0.017, rail - 0.05, STEEL, { x, y: 0.06, seg: 8, open: true }));
    g.add(drum(0.022, 0.022, 0.1, C.white, { x, y: 0.08, seg: 8 }));
    g.add(ball(0.024, C.white, { x, y: rail + 0.01, seg: 8 }));
  }
  g.add(rod([-hx, rail, 0], [hx, rail, 0], 0.012, C.white, { seg: 6 }));
  const path = (s) => [-hx + 0.02 + s, 0, 0, 1];
  const len = 2 * hx - 0.04;
  g.add(...pleatedRun('screen' + color, path, 0, len, { color, pitch: 0.17, A: 0.04, y0: 0.3, y1: 2.07, head: 2.13 }));
  return g;
}

export function registerCare() {
  registerProp('bedsideTable', bedsideTable);
  registerProp('oxygenTank', oxygenTank);
  registerProp('ivStand', ivStand);
  registerProp('vitalsMonitor', vitalsMonitor);
  registerProp('medCart', medCart);
  registerProp('crashCart', crashCart);
  registerProp('supplyCart', supplyCart);
  registerProp('wheelchair', wheelchair);
  registerProp('ventilator', ventilator);
  registerProp('curtainBay', curtainBay);
  registerProp('privacyCurtain', privacyCurtain);
}
