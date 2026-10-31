// Laboratory and pharmacy: bright little worlds of tubes, racks and boxes. These are the props that reward the closest zoom.
import * as THREE from 'three';
import { CATALOG, registerProp } from './registry.js';
import { group, contact, panel, mat, matGlow, matGlass, canvasTex, ball } from '../style/kit.js';
import { C } from '../style/palette.js';
import {
  HP, STEEL, STEEL_DARK, CHROME, once, put, sbox, chip, drum, rod, hose, hoop, turned, dot, disc, fourCastors, castor,
  dyn, damp, nextSeed, lightMat, pulseMat, halo, sharedScreen, pump, stillScreen, MONO, SANS,
} from './clinical-kit.js';

const GLASS = matGlass('#e4f4ff', 0.55);
const FLUIDS = [C.coralDeep, C.stripe, C.teal, C.purple, C.info, C.leafLight];

function microscope(x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.add(sbox(0.15, 0.022, 0.2, C.white, { z: 0.01, r: 0.01 }));
  g.add(sbox(0.05, 0.14, 0.05, C.white, { z: -0.06, y: 0.02, r: 0.018 }));
  g.add(hose([[0, 0.14, -0.065], [0, 0.22, -0.055], [0, 0.26, 0.0]], 0.024, C.white, { seg: 6, radial: 6 }));
  g.add(chip(0.1, 0.01, 0.09, C.charcoal, { y: 0.1, z: 0.03 }));
  g.add(chip(0.05, 0.002, 0.022, C.coral, { y: 0.11, z: 0.03 }));
  g.add(drum(0.03, 0.022, 0.05, STEEL, { y: 0.2, z: 0.03, seg: 8 }));
  g.add(drum(0.008, 0.01, 0.04, C.charcoal, { y: 0.165, z: 0.03, x: 0.012, seg: 6 }));
  g.add(drum(0.008, 0.01, 0.036, C.charcoal, { y: 0.168, z: 0.03, x: -0.014, seg: 6 }));
  g.add(drum(0.018, 0.018, 0.09, C.charcoal, { y: 0.245, z: 0.04, rx: 0.55, seg: 8 }));
  g.add(drum(0.022, 0.022, 0.012, STEEL_DARK, { x: 0.03, y: 0.1, z: -0.045, rz: HP, seg: 8 }));
  g.add(drum(0.03, 0.03, 0.01, C.tealDeep, { y: 0.05, z: -0.1, seg: 8 }));
  return g;
}
function tubeRack(x, z, colors, n = 6) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const w = n * 0.034 + 0.03;
  g.add(sbox(w, 0.012, 0.075, C.white, { r: 0.005 }));
  g.add(sbox(w, 0.012, 0.075, C.white, { y: 0.058, r: 0.005 }));
  for (const a of [-1, 1]) g.add(chip(0.008, 0.06, 0.07, C.white, { x: (a * (w - 0.01)) / 2 }));
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
    const tx = -w / 2 + 0.032 + i * 0.034, tz = r ? 0.018 : -0.018, c = colors[(i + r * 2) % colors.length];
    if ((i + r) % 5 === 4) continue;
    g.add(drum(0.0108, 0.0108, 0.1, GLASS, { x: tx, y: 0.012, z: tz, seg: 5, open: true, shadow: false }));
    g.add(drum(0.0095, 0.0095, 0.05, c, { x: tx, y: 0.012, z: tz, seg: 5, open: true, shadow: false }));
    g.add(drum(0.0125, 0.0125, 0.018, c, { x: tx, y: 0.112, z: tz, seg: 5 }));
  }
  return g;
}
function pipetteStand(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(sbox(0.14, 0.014, 0.1, C.white, { r: 0.006 }));
  g.add(chip(0.012, 0.2, 0.012, STEEL, { z: -0.035, y: 0.014 }));
  g.add(sbox(0.13, 0.012, 0.04, C.white, { y: 0.17, z: -0.015, r: 0.004 }));
  [C.coral, C.teal, C.stripe].forEach((c, i) => {
    const px = -0.042 + i * 0.042;
    g.add(drum(0.0085, 0.0085, 0.1, C.white, { x: px, y: 0.1, seg: 6 }));
    g.add(drum(0.0035, 0.008, 0.07, C.plastic, { x: px, y: 0.032, seg: 5 }));
    g.add(drum(0.0098, 0.0098, 0.018, c, { x: px, y: 0.2, seg: 6 }));
  });
  return g;
}
function flask(x, z, fluid) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(turned([[0.05, 0], [0.058, 0.01], [0.022, 0.09], [0.018, 0.13], [0.022, 0.135]], GLASS, { seg: 10, shadow: false }));
  g.add(turned([[0.046, 0.002], [0.054, 0.012], [0.036, 0.055], [0, 0.055]], fluid, { seg: 10, shadow: false }));
  return g;
}
function beaker(x, z, fluid, r = 0.04, h = 0.095) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(drum(r, r * 0.96, h, GLASS, { seg: 10, open: true, shadow: false }));
  g.add(drum(r * 0.9, r * 0.88, h * 0.55, fluid, { y: 0.004, seg: 10, shadow: false }));
  return g;
}

function labBench() {
  const { fp: [W, D] } = CATALOG.labBench;
  const g = group(contact(W * 0.97, D * 0.92, 0.46));
  const top = 0.88, d = D - 0.03;
  g.add(sbox(W - 0.05, 0.06, d - 0.1, C.plastic, { y: 0.0 + 0.012, z: -0.03, r: 0.02 }));
  // Cabinet run: drawers left and right, an open knee hole in the middle where someone can pull up a stool
  g.add(sbox(1.1, top - 0.075, 0.05, C.plastic, { y: 0.07, z: -d / 2 + 0.06, r: 0.012 }));
  for (const [x, w] of [[-1.05, 1.0], [1.05, 1.0]]) {
    g.add(sbox(w, top - 0.075, d - 0.06, C.white, { x, y: 0.07, z: -0.01, r: 0.024 }));
    for (let i = 0; i < 2; i++) for (let r = 0; r < 3; r++) {
      const wd = (w - 0.06) / 2, dx = x - wd / 2 + wd * i, y = 0.095 + r * 0.24;
      g.add(sbox(wd - 0.02, 0.22, 0.014, r === 2 ? C.tileSky : C.offWhite, { x: dx, y, z: (d - 0.06) / 2 - 0.006, r: 0.008 }));
      g.add(chip(0.14, 0.012, 0.012, C.info, { x: dx, y: y + 0.17, z: (d - 0.06) / 2 + 0.006 }));
    }
  }
  g.add(sbox(W, 0.04, d, mat(C.offWhite, { rough: 0.32 }), { y: top - 0.015, r: 0.016, seg: 2 }));
  g.add(sbox(W - 0.02, 0.1, 0.03, C.tileSky, { y: top + 0.02, z: -d / 2 + 0.02, r: 0.012 }));
  const y = top + 0.025;
  const at = (o) => { o.position.y = y; g.add(o); return o; };
  at(microscope(-1.26, -0.04, 0.2));
  at(microscope(0.34, -0.02, -0.25));
  at(tubeRack(-0.82, 0.12, [C.coralDeep, C.stripe, C.teal], 7));
  at(tubeRack(-0.82, -0.1, [C.purple, C.info, C.stripe], 7));
  at(tubeRack(1.2, 0.12, [C.leafLight, C.coralDeep, C.purple], 6));
  at(pipetteStand(-0.42, -0.14));
  at(flask(-0.16, -0.12, mat(C.tealLight, { rough: 0.2 })));
  at(flask(-0.02, -0.17, mat(C.rose, { rough: 0.2 })));
  at(beaker(-0.2, 0.1, mat(C.stripe, { rough: 0.2 })));
  at(beaker(-0.09, 0.14, mat(C.purpleLight, { rough: 0.2 }), 0.03, 0.075));
  // Hot plate with a stirrer, a little LED that says it is on
  g.add(sbox(0.2, 0.05, 0.2, C.white, { x: 0.82, y, z: 0.0, r: 0.018 }));
  g.add(drum(0.08, 0.08, 0.006, C.charcoal, { x: 0.82, y: y + 0.05, z: 0, seg: 12 }));
  at(beaker(0.82, 0, mat(C.tealLight, { rough: 0.2 }), 0.05, 0.1)).position.y = y + 0.056;
  const stir = dyn(chip(0.04, 0.006, 0.008, C.white, { x: 0.82, y: y + 0.066 }));
  g.add(stir);
  const led = dyn(dot(0.0065, matGlow(C.watch, 2.2), { x: 0.76, y: y + 0.024, z: 0.102 }));
  g.add(led);
  // Lab notebook, gloves, reagent bottles along the back
  g.add(sbox(0.24, 0.012, 0.17, C.tileButter, { x: 0.46 + 0.14, y, z: 0.2, r: 0.005, ry: 0.15 }));
  g.add(sbox(0.2, 0.07, 0.1, C.tileSky, { x: 1.28, y, z: -0.16, r: 0.012 }));
  g.add(chip(0.06, 0.004, 0.02, C.info, { x: 1.28, y: y + 0.07, z: -0.16 }));
  [[1.0, C.woodDeep], [1.09, C.info], [-1.02, C.white], [-0.96, C.stripe]].forEach(([x, c]) => {
    g.add(drum(0.032, 0.032, 0.1, c, { x, y, z: -0.2, seg: 8 }));
    g.add(drum(0.016, 0.022, 0.03, C.charcoal, { x, y: y + 0.1, z: -0.2, seg: 6 }));
  });
  const seed = nextSeed() * 5;
  g.userData.tick = (dt, t) => {
    stir.rotation.y += dt * 9;
    led.visible = (t + seed) % 1.8 > 0.3;
  };
  return g;
}

function analyzerPaint(c, w, h, t) {
  c.fillStyle = '#0f1f2a'; c.fillRect(0, 0, w, h);
  c.fillStyle = C.info; c.fillRect(0, 0, w, 12);
  for (let i = 0; i < 5; i++) {
    const y = 18 + i * 14, p = (t * (0.07 + i * 0.023) + i * 0.31) % 1;
    c.fillStyle = '#1e3a4a'; c.fillRect(8, y, w - 40, 7);
    c.fillStyle = FLUIDS[i]; c.fillRect(8, y, (w - 40) * p, 7);
    c.fillStyle = p > 0.9 ? C.screenGlow : '#3f6476'; c.fillRect(w - 26, y, 18, 7);
  }
}
function analyzer() {
  const { fp: [W, D], h: H } = CATALOG.analyzer;
  const g = group(contact(W * 0.95, D * 0.92, 0.46));
  const scr = sharedScreen('analyzer', 120, 90, analyzerPaint, 4);
  g.add(sbox(W - 0.02, 0.06, D - 0.03, C.plastic, { y: 0.01, r: 0.024 }));
  g.add(sbox(W - 0.03, 0.9, D - 0.04, C.white, { y: 0.06, r: 0.05, seg: 2 }));
  g.add(sbox(W - 0.03, 0.05, 0.42, C.tileSky, { y: 0.9, z: 0.2, r: 0.02 }));
  // Doors and a stripe of LEDs
  for (const x of [-0.31, 0.31]) {
    g.add(sbox(0.56, 0.56, 0.014, C.offWhite, { x, y: 0.12, z: D / 2 - 0.018, r: 0.01 }));
    g.add(sbox(0.012, 0.16, 0.012, C.info, { x: x + (x < 0 ? 0.24 : -0.24), y: 0.34, z: D / 2 - 0.004, r: 0.004 }));
  }
  g.add(sbox(W - 0.12, 0.13, 0.012, C.ink, { y: 0.72, z: D / 2 - 0.018, r: 0.006 }));
  const leds = [];
  [C.ok, C.info, C.watch, C.ok, C.teal].forEach((c, i) => {
    g.add(dot(0.011, mat(C.steelDeep), { x: -0.5 + i * 0.05, y: 0.785, z: D / 2 - 0.01 }));
    const led = dyn(dot(0.011, matGlow(c, 2.6), { x: -0.5 + i * 0.05, y: 0.785, z: D / 2 - 0.008 }));
    leds.push(led); g.add(led);
  });
  g.add(sbox(0.3, 0.02, 0.014, C.plastic, { x: 0.32, y: 0.77, z: D / 2 - 0.01, r: 0.004 }));
  g.add(chip(0.26, 0.05, 0.003, '#fbfcfe', { x: 0.32, y: 0.73, z: D / 2 - 0.004 }));
  // Upper reagent deck with a glass hood and a sample carousel that turns
  const deckY = 0.95;
  g.add(sbox(W - 0.03, 0.46, 0.4, C.white, { y: deckY, z: -0.2, r: 0.05, seg: 2 }));
  g.add(sbox(W - 0.08, 0.34, 0.012, matGlass('#cdeaf9', 0.34), { y: deckY + 0.02, z: 0.39, r: 0.005, shadow: false }));
  g.add(chip(W - 0.08, 0.018, 0.4, matGlass('#cdeaf9', 0.34), { y: deckY + 0.35, z: 0.19, shadow: false }));
  for (const x of [-(W - 0.06) / 2, (W - 0.06) / 2]) g.add(chip(0.014, 0.35, 0.4, matGlass('#cdeaf9', 0.34), { x, y: deckY + 0.015, z: 0.19, shadow: false }));
  const car = new THREE.Group();
  car.position.set(-0.26, deckY + 0.008, 0.18);
  car.add(drum(0.14, 0.15, 0.03, C.plastic, { seg: 16 }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, x = Math.cos(a) * 0.115, z = Math.sin(a) * 0.115;
    car.add(drum(0.0105, 0.0105, 0.1, FLUIDS[i % FLUIDS.length], { x, z, y: 0.03, seg: 6, shadow: false }));
    car.add(drum(0.012, 0.012, 0.014, C.white, { x, z, y: 0.13, seg: 6, shadow: false }));
  }
  g.add(dyn(car));
  // Pipetting head travelling over the tray
  const head = new THREE.Group();
  head.position.set(0.28, deckY + 0.31, 0.18);
  head.add(sbox(0.09, 0.05, 0.16, C.plastic, { r: 0.012 }));
  head.add(drum(0.005, 0.01, 0.14, STEEL, { y: -0.13, seg: 5 }));
  g.add(rod([-0.05, deckY + 0.33, 0.18], [0.54, deckY + 0.33, 0.18], 0.01, STEEL, { seg: 5 }));
  g.add(dyn(head));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.add(drum(0.024, 0.024, 0.05, FLUIDS[(i + j) % 5 + 0], { x: 0.14 + i * 0.09, y: deckY + 0.014, z: 0.13 + j * 0.09, seg: 6, shadow: false }));
  // Screen set into the reagent tower, looking out over the deck
  const seed = nextSeed() * 8, sz = -0.2 + 0.2 + 0.002;
  g.add(sbox(W - 0.03, 0.04, 0.42, C.white, { y: H - 0.04, z: -0.2, r: 0.018 }));
  g.add(sbox(0.46, 0.34, 0.012, C.ink, { x: 0.3, y: deckY + 0.05, z: sz, r: 0.006 }));
  g.add(panel(0.43, 0.31, scr.mat, { x: 0.3, y: deckY + 0.065, z: sz + 0.0065 }));
  g.userData.tick = (dt, t) => {
    pump(scr, t);
    car.rotation.y += dt * 0.6;
    head.position.x = 0.28 + 0.2 * Math.sin((t + seed) * 0.7);
    for (let i = 0; i < 5; i++) leds[i].visible = Math.sin((t + seed) * (1.1 + i * 0.37) + i) > -0.2;
  };
  return g;
}

function centrifuge() {
  const { fp: [W, D] } = CATALOG.centrifuge;
  const g = group(contact(W * 0.92, D * 0.92, 0.44));
  const top = 0.82;
  g.add(...fourCastors(W - 0.14, D - 0.14, { r: 0.034 }));
  g.add(sbox(W - 0.03, top - 0.06, D - 0.03, C.white, { y: 0.07, r: 0.07, seg: 2 }));
  g.add(sbox(W - 0.03, 0.09, D - 0.03, C.tileSky, { y: 0.68, r: 0.024, sx: 1.002, sz: 1.002 }));
  g.add(sbox(W - 0.03, 0.03, D - 0.03, C.info, { y: 0.11, r: 0.012 }));
  // Rotor bowl below a clear dome, spinning cycle by cycle
  g.add(turned([[0.27, 0.11], [0.25, 0.1], [0.236, 0.05], [0.2, 0.01], [0, 0]], mat(C.steelDeep, { rough: 0.4, metal: 0.3 }), { y: top - 0.09, seg: 22, shadow: false }));
  const rotor = new THREE.Group();
  rotor.position.y = top - 0.03;
  rotor.add(drum(0.05, 0.075, 0.05, STEEL, { seg: 12 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rotor.add(rod([0, 0.02, 0], [Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17], 0.018, STEEL, { seg: 5 }));
    rotor.add(drum(0.022, 0.022, 0.05, FLUIDS[i], { x: Math.cos(a) * 0.17, y: 0.04, z: Math.sin(a) * 0.17, seg: 8 }));
  }
  g.add(dyn(rotor));
  g.add(hoop(0.272, 0.018, C.white, { rx: HP, y: top + 0.02, seg: 24, tseg: 5 }));
  g.add(turned([[0.27, 0], [0.25, 0.05], [0.16, 0.09], [0, 0.1]], matGlass('#d7f2ff', 0.34), { y: top + 0.02, seg: 22, shadow: false }));
  g.add(drum(0.02, 0.024, 0.016, C.info, { y: top + 0.11, seg: 8 }));
  const scr = sharedScreen('spinTime', 96, 40, (c, w, h, t) => {
    c.fillStyle = '#0f1f2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = C.screenGlow; c.font = `700 22px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${(3500 + (Math.sin(t) * 40) | 0)}`, w / 2, h / 2 + 1);
  }, 2);
  g.add(sbox(0.3, 0.13, 0.012, C.ink, { y: 0.48, z: D / 2 - 0.012, r: 0.006 }));
  g.add(panel(0.27, 0.11, scr.mat, { y: 0.49, z: D / 2 - 0.0045 }));
  for (let i = 0; i < 3; i++) g.add(dot(0.016, [C.ok, C.info, C.coralDeep][i], { x: -0.1 + i * 0.1, y: 0.41, z: D / 2 - 0.0135, seg: 10 }));
  const lamp = dyn(dot(0.012, lightMat('idle'), { x: 0.2, y: 0.74, z: D / 2 - 0.014 }));
  g.add(lamp);
  let speed = 0;
  const seed = nextSeed() * 13;
  g.userData.tick = (dt, t) => {
    pump(scr, t);
    const on = (t + seed) % 13 < 9;
    speed = damp(speed, on ? 17 : 0, on ? 0.9 : 0.7, dt);
    rotor.rotation.y += speed * dt;
  };
  return g;
}

function labFridge() {
  const { fp: [W, D], h: H } = CATALOG.labFridge;
  const g = group(contact(W * 0.95, D * 0.92, 0.46));
  g.add(...fourCastors(W - 0.14, D - 0.14, { r: 0.034 }));
  const zf = D / 2 - 0.05, iw = W - 0.16, y0 = 0.28, ih = 1.48;
  g.add(sbox(W - 0.03, H - 0.09, D - 0.12, C.white, { y: 0.08, z: -0.05, r: 0.05, seg: 2 }));
  g.add(sbox(W - 0.03, 0.12, 0.09, C.plastic, { y: 0.1, z: zf - 0.03, r: 0.016 }));
  // Lit interior as one painted panel, with real shelves in front for parallax
  const inside = once('fridgeIn', () => new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTex(190, 296, (x, w, h) => {
      x.fillStyle = '#eaf7ff'; x.fillRect(0, 0, w, h);
      for (let r = 0; r < 5; r++) {
        const base = (h / 5) * (r + 1) - 6;
        for (let i = 0; i < 15; i++) {
          const tx = 8 + i * 12, c = FLUIDS[(i * 7 + r * 3) % FLUIDS.length], th = 34 - ((i * 13 + r * 5) % 3) * 3;
          if ((i + r * 2) % 11 === 10) continue;
          x.fillStyle = '#ffffff'; x.fillRect(tx, base - th, 9, th);
          x.fillStyle = c; x.fillRect(tx + 1, base - th * 0.6, 7, th * 0.6);
          x.fillStyle = c; x.fillRect(tx - 0.5, base - th - 5, 10, 6);
        }
        x.fillStyle = '#bcd6e6'; x.fillRect(0, base, w, 6);
      }
    }),
  }));
  g.add(panel(iw, ih, inside, { y: y0, z: zf - 0.038 }));
  for (let i = 1; i < 5; i++) g.add(chip(iw, 0.01, 0.05, C.white, { y: y0 + (ih * i) / 5 - 0.012, z: zf - 0.016 }));
  // Door frame, glass and handle
  const fw = 0.05;
  g.add(chip(W - 0.03, fw, 0.05, C.white, { y: y0 - fw, z: zf }), chip(W - 0.03, fw, 0.05, C.white, { y: y0 + ih, z: zf }));
  for (const a of [-1, 1]) g.add(chip(fw, ih + 0.02, 0.05, C.white, { x: (a * (W - 0.03 - fw)) / 2, y: y0 - 0.01, z: zf }));
  g.add(chip(iw + 0.02, ih + 0.02, 0.008, matGlass('#cdeefc', 0.16), { y: y0 - 0.01, z: zf + 0.012, shadow: false }));
  g.add(panel(0.1, ih, matGlass('#ffffff', 0.22), { x: -0.18, y: y0, z: zf + 0.018 }));
  g.add(sbox(0.03, 0.56, 0.03, STEEL, { x: W / 2 - 0.05, y: 0.75, z: zf + 0.024, r: 0.012 }));
  // Header with a temperature readout
  g.add(sbox(0.34, 0.09, 0.01, C.ink, { y: H - 0.145, z: -0.05 + (D - 0.12) / 2, r: 0.004 }));
  g.add(panel(0.3, 0.075, stillScreen('fridgeTemp', 120, 30, (x, w, h) => {
    x.fillStyle = '#0c1a20'; x.fillRect(0, 0, w, h);
    x.fillStyle = C.screenGlow; x.font = `700 22px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('4.0 C', w / 2, h / 2 + 1);
  }), { y: H - 0.1375, z: -0.05 + (D - 0.12) / 2 + 0.0055 }));
  const led = dyn(dot(0.01, matGlow(C.ok, 2.4), { x: 0.3, y: H - 0.1, z: -0.05 + (D - 0.12) / 2 + 0.003 }));
  g.add(led);
  const seed = nextSeed() * 4;
  g.userData.tick = (dt, t) => { led.visible = (t + seed) % 3 > 0.2; };
  return g;
}

// ── pharmacy ────────────────────────────────────────────────
const TILES = 8;
const pharmaMat = () => once('pharmaMat', () => {
  const S = 64, N = TILES;
  const base = [C.coral, C.teal, C.stripe, C.purple, C.info, C.leafLight, C.rose, C.white, C.cartBlue, C.tileButter, C.purpleLight, C.tealLight, C.coralDeep, C.tileMint, C.tileSky, C.leaf];
  const tex = canvasTex(S * N, S * N, (x) => {
    for (let i = 0; i < N * N; i++) {
      const u = (i % N) * S, v = Math.floor(i / N) * S, col = base[(i * 5) % base.length], style = i % 4;
      x.fillStyle = col; x.fillRect(u, v, S, S);
      x.fillStyle = 'rgba(255,255,255,.9)';
      if (style === 0) x.fillRect(u, v + 30, S, 26);
      if (style === 1) x.fillRect(u + 6, v + 14, S - 12, 34);
      if (style === 2) { x.beginPath(); x.arc(u + S / 2, v + 34, 15, 0, 7); x.fill(); }
      if (style === 3) x.fillRect(u, v + 12, S, 14);
      x.fillStyle = 'rgba(44,47,56,.55)';
      x.fillRect(u + 12, v + 36, 40, 4); x.fillRect(u + 12, v + 44, 26, 3);
      x.fillStyle = col;
      if (style !== 3) { x.fillRect(u + S / 2 - 3, v + 19, 6, 14); x.fillRect(u + S / 2 - 7, v + 23, 14, 6); }
    }
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 });
});
/** Boxes as one atlas-mapped geometry: five visible faces each, one material, so a crammed shelf stays a single draw. */
function stockGeo(W, levels, depth, variant) {
  return once(`stock|${W}|${variant}`, () => {
    const pos = [], nor = [], uv = [], T = 1 / TILES;
    let n = variant * 91 + 7;
    const rnd = () => { n = (n * 16807) % 2147483647; return (n % 1000) / 1000; };
    const quad = (a, b, c, d, nx, ny, nz, u0, v0, u1, v1) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) nor.push(nx, ny, nz);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    };
    for (const [y, gap] of levels) {
      let x = -W / 2 + 0.05;
      while (x < W / 2 - 0.12) {
        const w = 0.07 + rnd() * 0.11, h = Math.min(gap - 0.05, 0.13 + rnd() * 0.17), d = depth - rnd() * 0.08, z = -depth / 2 + d, t = Math.floor(rnd() * TILES * TILES);
        if (rnd() < 0.12) { x += 0.03 + rnd() * 0.05; continue; }
        const u = (t % TILES) * T, v = 1 - (Math.floor(t / TILES) + 1) * T;
        const su = u + T * 0.06, sv = v + T * 0.92;
        const x0 = x, x1 = x + w, y1 = y + h, z0 = -depth / 2, z1 = z;
        quad([x0, y, z1], [x1, y, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, u + T * 0.02, v + T * 0.02, u + T * 0.98, v + T * 0.98);
        quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, su, sv, su + 0.002, sv + 0.002);
        quad([x1, y, z1], [x1, y, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, su, sv, su + 0.002, sv + 0.002);
        quad([x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, su, sv, su + 0.002, sv + 0.002);
        x += w + 0.004;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  });
}
function bottle(x, y, z, body, cap) {
  return [
    turned([[0.034, 0], [0.036, 0.09], [0.022, 0.115], [0.016, 0.12]], body, { x, y, z, seg: 7 }),
    drum(0.019, 0.019, 0.026, cap, { x, y: y + 0.118, z, seg: 7 }),
    chip(0.05, 0.05, 0.002, C.white, { x, y: y + 0.03, z: z + 0.036 }),
  ];
}
let shelves = 0;
function pharmacyShelf() {
  const { fp: [W, D], h: H } = CATALOG.pharmacyShelf;
  const g = group(contact(W * 0.97, D * 0.9, 0.46));
  const d = D - 0.03, gap = 0.37, y0 = 0.14;
  const levels = Array.from({ length: 5 }, (_, i) => [y0 + 0.03 + i * gap, gap - 0.03]);
  g.add(sbox(W, 0.12, d, C.leafLight, { y: 0.012, r: 0.024 }));
  g.add(sbox(W - 0.04, H - 0.06, 0.02, C.offWhite, { y: 0.02, z: -d / 2 + 0.012, r: 0.008 }));
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02, -W / 6, W / 6]) g.add(sbox(0.035, H - 0.02, d - 0.01, C.white, { x, y: 0.01, r: 0.012 }));
  for (const [y] of levels) {
    g.add(sbox(W - 0.03, 0.028, d, C.white, { y: y - 0.028, r: 0.01 }));
    g.add(chip(W - 0.06, 0.016, 0.004, C.tileMint, { y: y - 0.024, z: d / 2 + 0.001 }));
  }
  g.add(sbox(W + 0, 0.05, d + 0, C.white, { y: H - 0.05, r: 0.02 }));
  g.add(chip(W - 0.08, 0.018, 0.004, C.leafLight, { y: H - 0.034, z: d / 2 + 0.001 }));
  const v = shelves++ % 3;
  g.add(put(stockGeo(W, levels, d - 0.06, v), pharmaMat()));
  // Round bottles standing in the gaps, the part that shows at a glancing angle
  let n = 11 + v * 7;
  const pairs = [[C.info, C.white], [C.white, C.coralDeep], [C.stripeDeep, C.white], [C.leafLight, C.white]];
  levels.forEach(([y], i) => {
    for (let k = 0; k < 2; k++) {
      n = (n * 37 + 11) % 101;
      const x = -W / 2 + 0.2 + ((n % 88) / 100) * (W - 0.4), [b, c] = pairs[(n + i) % 4];
      g.add(...bottle(x, y, d / 2 - 0.05, b, c));
    }
  });
  return g;
}

function robotBack() {
  return once('robotBack', () => new THREE.MeshStandardMaterial({
    roughness: 0.6,
    map: canvasTex(400, 190, (x, w, h) => {
      x.fillStyle = '#e8f3ec'; x.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) {
        const y = 6 + r * 46;
        x.fillStyle = '#c6d8cd'; x.fillRect(0, y + 38, w, 5);
        for (let i = 0; i < 26; i++) {
          const c = [C.coral, C.teal, C.stripe, C.purple, C.info, C.leafLight, C.rose][(i * 3 + r * 5) % 7];
          x.fillStyle = c; x.beginPath(); x.roundRect(5 + i * 15, y + 12, 12, 26, 3); x.fill();
          x.fillStyle = '#ffffff'; x.fillRect(5 + i * 15, y + 22, 12, 9);
          x.fillStyle = '#f4f6f9'; x.fillRect(6 + i * 15, y + 6, 10, 6);
        }
      }
    }),
  }));
}
function pillRobot(opts = {}) {
  const { fp: [W, D], h: H } = CATALOG.pillRobot;
  const g = group(contact(W * 0.96, D * 0.94, 0.46));
  const base = 0.72, roof = H - 0.14, d = D - 0.04;
  g.add(sbox(W - 0.02, base, d, C.white, { y: 0.02, r: 0.06, seg: 2 }));
  g.add(sbox(W, 0.05, d + 0.02, C.leafLight, { y: 0.03, r: 0.02 }));
  // Roof is an open frame with a glass lid: the camera looks down, and the moving arm is the whole point of this machine.
  for (const b of [-1, 1]) g.add(sbox(W - 0.01, H - roof - 0.01, 0.1, C.white, { y: roof, z: (b * (d - 0.1)) / 2, r: 0.03 }));
  for (const a of [-1, 1]) g.add(sbox(0.1, H - roof - 0.01, d, C.white, { x: (a * (W - 0.11)) / 2, y: roof, r: 0.03 }));
  g.add(chip(W - 0.16, 0.008, d - 0.16, matGlass('#d4f0f5', 0.14), { y: H - 0.06, shadow: false }));
  g.add(sbox(W - 0.5, 0.03, 0.012, matGlow(C.tealLight, 1.5), { y: roof + 0.05, z: d / 2 + 0.001, r: 0.008 }));
  // Service door, output chute, touch panel
  g.add(sbox(0.7, 0.42, 0.012, C.offWhite, { x: -0.54, y: 0.14, z: d / 2 + 0.0, r: 0.008 }));
  g.add(sbox(0.2, 0.012, 0.014, C.leaf, { x: -0.54, y: 0.46, z: d / 2 + 0.01, r: 0.004 }));
  g.add(sbox(0.4, 0.2, 0.02, C.ink, { x: 0.46, y: 0.32, z: d / 2 + 0.0, r: 0.016 }));
  g.add(sbox(0.34, 0.14, 0.05, C.plastic, { x: 0.46, y: 0.35, z: d / 2 - 0.004, r: 0.012, sz: 0.25 }));
  g.add(sbox(0.3, 0.1, 0.09, C.tileMint, { x: 0.46, y: 0.17, z: d / 2 - 0.01, r: 0.02 }));
  g.add(panel(0.3, 0.17, stillScreen('robotPanel', 150, 85, (x, w, h) => {
    x.fillStyle = '#0f2422'; x.fillRect(0, 0, w, h);
    x.fillStyle = C.leafLight; x.fillRect(10, 10, 60, 10);
    x.fillStyle = '#2f5a52'; for (let i = 0; i < 3; i++) x.fillRect(10, 30 + i * 14, 120 - i * 26, 7);
    x.fillStyle = C.screenGlow; x.beginPath(); x.arc(126, 16, 7, 0, 7); x.fill();
  }), { x: -0.02, y: 0.53, z: d / 2 + 0.003 }));
  // The glass case: stocked back wall, rails, and panes
  const room = roof - base - 0.04;
  g.add(panel(W - 0.14, room, robotBack(), { y: base + 0.02, z: -d / 2 + 0.06 }));
  g.add(chip(W - 0.14, 0.012, d - 0.1, C.plastic, { y: base + 0.02 }));
  const hx = W / 2 - 0.05, hz = d / 2 - 0.03;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(sbox(0.05, room + 0.1, 0.05, C.white, { x: a * hx, y: base - 0.02, z: b * hz, r: 0.014 }));
  const pane = matGlass('#d4f0f5', 0.2);
  g.add(chip(2 * hx, room + 0.04, 0.008, pane, { y: base, z: hz, shadow: false }));
  for (const a of [-1, 1]) g.add(chip(0.008, room + 0.04, 2 * hz, pane, { x: a * hx, y: base, shadow: false }));
  g.add(panel(0.16, room, matGlass('#ffffff', 0.16), { x: -0.4, y: base + 0.02, z: hz + 0.006 }));
  g.add(panel(0.07, room, matGlass('#ffffff', 0.16), { x: -0.26, y: base + 0.02, z: hz + 0.006 }));
  const railY = roof - 0.12, railZ = -0.05;
  g.add(rod([-hx + 0.03, railY, railZ], [hx - 0.03, railY, railZ], 0.016, CHROME, { seg: 8 }));
  g.add(rod([-hx + 0.03, railY, railZ - 0.08], [hx - 0.03, railY, railZ - 0.08], 0.016, CHROME, { seg: 8 }));
  g.add(sbox(2 * hx - 0.1, 0.02, 0.2, C.plastic, { y: base + 0.024, r: 0.006 }));
  for (let i = 0; i < 6; i++) g.add(sbox(0.13, 0.05, 0.16, [C.tileMint, C.tileSky, C.tileButter][i % 3], { x: -0.62 + i * 0.25, y: base + 0.042, r: 0.012 }));
  // Carriage on the rail, telescoping arm, gripper with a tiny canister
  const carriage = new THREE.Group();
  carriage.position.set(0, 0, railZ);
  carriage.add(sbox(0.17, 0.09, 0.17, C.white, { y: railY - 0.045, z: -0.04, r: 0.024 }));
  carriage.add(dot(0.008, matGlow(C.teal, 2.2), { x: 0.05, y: railY, z: 0.047 }));
  carriage.add(drum(0.03, 0.03, 0.42, STEEL, { y: railY - 0.46, seg: 8, open: true }));
  const arm = new THREE.Group();
  arm.position.y = railY - 0.42;
  arm.add(drum(0.018, 0.018, 0.34, CHROME, { y: -0.3, seg: 8, open: true }));
  arm.add(sbox(0.09, 0.05, 0.09, C.leafLight, { y: -0.34, r: 0.016 }));
  arm.add(chip(0.012, 0.05, 0.04, STEEL_DARK, { x: -0.03, y: -0.38 }), chip(0.012, 0.05, 0.04, STEEL_DARK, { x: 0.03, y: -0.38 }));
  arm.add(drum(0.02, 0.02, 0.05, C.coral, { y: -0.39, seg: 7 }));
  arm.add(drum(0.021, 0.021, 0.012, C.white, { y: -0.34 - 0.003, seg: 7 }));
  carriage.add(dyn(arm));
  g.add(dyn(carriage));
  const lamp = dyn(dot(0.016, lightMat('idle'), { x: 0.86, y: roof + 0.065, z: d / 2 + 0.003 }));
  g.add(lamp);
  const stops = [-0.72, 0.1, -0.3, 0.62, -0.05, 0.34];
  let at = 0, from = stops[0], to = stops[1], phase = nextSeed(), pace = 0.28, status = null;
  g.userData.setState = (e) => {
    if (e.status === status) return;
    status = e.status;
    lamp.material = status === 'fault' ? pulseMat(C.danger) : lightMat(status === 'idle' ? 'idle' : status);
    pace = status === 'fault' || status === 'maintenance' ? 0 : status === 'in-use' ? 0.5 : 0.28;
  };
  g.userData.tick = (dt) => {
    phase += dt * pace;
    if (phase >= 1) { phase -= 1; at = (at + 1) % stops.length; from = stops[at]; to = stops[(at + 1) % stops.length]; }
    // Travel for the first half of each beat, reach down to pick for the second.
    const move = Math.min(1, phase / 0.55), e = move * move * (3 - 2 * move);
    carriage.position.x = from + (to - from) * e;
    const dip = phase > 0.55 ? Math.sin(((phase - 0.55) / 0.45) * Math.PI) : 0;
    arm.position.y = railY - 0.42 + 0.14 - dip * 0.1;
  };
  g.userData.setState({ status: opts.status ?? 'idle' });
  return g;
}

export function registerLab() {
  registerProp('labBench', labBench);
  registerProp('analyzer', analyzer);
  registerProp('centrifuge', centrifuge);
  registerProp('labFridge', labFridge);
  registerProp('pharmacyShelf', pharmacyShelf);
  registerProp('pillRobot', pillRobot);
}
