// Outdoor props: vehicles, planting and street furniture.
// Vehicles never go through the floor bake, so each one bakes itself and only its moving parts stay separate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeStatic, canvasTex, contact, cyl, group, mat, matGloss, panel, pill } from '../style/kit.js';
import { C } from '../style/palette.js';
import { HOSPITAL_NAME } from '../world/plan.js';
import { registerProp } from './registry.js';
import { applyNight, chip, creased, dot, flat, live, mesh, nextSeed, nightLamp, once, onNight, plump, ribbon, rng, roundRect, sideExtrude, sign, slab, soft, tube } from './furniture.js';

const TAU = Math.PI * 2;
const table = new Map();
const prop = (name, build) => table.set(name, build);
const ease = (k) => k * k * (3 - 2 * k);

// ── shared light ─────────────────────────────────────────
const glowTex = () => once('glowTex', () => canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.28, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.clearRect(0, 0, w, w); x.fillStyle = g; x.fillRect(0, 0, w, w);
}));
const additive = (color, opacity = 0) => new THREE.MeshBasicMaterial({
  map: glowTex(), color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
});
// Crossed at 45° so one quad always faces whichever of the four camera azimuths is active, for a halo with no per-frame billboarding.
const crossGeo = () => once('cross', () => {
  const a = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 4), b = new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 4);
  return mergeGeometries([a, b], false);
});
const halo = (size, material, o = {}) => mesh(crossGeo(), material, { shadow: false, receive: false, ...o, s: size });

const nightKit = () => once('nightKit', () => {
  const kit = {
    halo: additive('#ffd9a0'), pool: additive('#ffcf96'),
    head: new THREE.MeshStandardMaterial({ color: '#fdf7e6', emissive: '#fff0c8', emissiveIntensity: 0, roughness: 0.3 }),
    tail: new THREE.MeshStandardMaterial({ color: '#d8434d', emissive: '#ff3a44', emissiveIntensity: 0, roughness: 0.4 }),
    beam: additive('#fff0cf'),
    pad: new THREE.MeshStandardMaterial({ color: '#c9f5e0', emissive: '#7cf0c8', emissiveIntensity: 0, roughness: 0.4 }),
    letters: null,
  };
  onNight((k) => {
    kit.halo.opacity = k * 0.62; kit.pool.opacity = k * 0.42; kit.beam.opacity = k * 0.2;
    kit.head.emissiveIntensity = k * 3; kit.tail.emissiveIntensity = 0.1 + k * 1.6; kit.pad.emissiveIntensity = k * 2.4;
    kit.halo.visible = kit.pool.visible = kit.beam.visible = k > 0.01;
  });
  kit.halo.visible = kit.pool.visible = kit.beam.visible = false;
  return kit;
});

/** Decal on a transparent canvas. */
const decal = (name, w, h, paint) => once(`decal|${name}`, () => new THREE.MeshStandardMaterial({
  map: canvasTex(w, h, (x) => { x.clearRect(0, 0, w, h); paint(x, w, h); }), transparent: true, roughness: 0.45, depthWrite: false,
}));
function starOfLife(x, cx, cy, s, color = '#2d6fd2', rod = '#ffffff') {
  x.save(); x.translate(cx, cy); x.fillStyle = color;
  for (let i = 0; i < 3; i++) { x.save(); x.rotate((i * Math.PI) / 3); x.beginPath(); x.roundRect(-s * 0.2, -s, s * 0.4, s * 2, s * 0.05); x.fill(); x.restore(); }
  x.strokeStyle = rod; x.lineCap = 'round'; x.lineWidth = s * 0.055;
  x.beginPath(); x.moveTo(0, -s * 0.74); x.lineTo(0, s * 0.74); x.stroke();
  x.lineWidth = s * 0.04; x.beginPath(); x.moveTo(-s * 0.05, s * 0.6);
  x.bezierCurveTo(s * 0.26, s * 0.42, -s * 0.26, s * 0.24, 0, s * 0.08); x.bezierCurveTo(s * 0.26, -s * 0.08, -s * 0.26, -s * 0.24, 0, -s * 0.4); x.bezierCurveTo(s * 0.12, -s * 0.48, s * 0.12, -s * 0.6, 0, -s * 0.62); x.stroke();
  x.restore();
}
const starMat = () => decal('star', 256, 256, (x, w) => {
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(w / 2, w / 2, w * 0.49, 0, TAU); x.fill();
  starOfLife(x, w / 2, w / 2, w * 0.4);
});

// ── vehicle parts ────────────────────────────────────────
const tyreGeo = () => once('tyre', () => new THREE.LatheGeometry([[0.001, -0.5], [0.84, -0.5], [1, -0.34], [1, 0.34], [0.84, 0.5], [0.001, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 16).rotateZ(Math.PI / 2));
function wheel(x, y, z, r, w, rim = C.plastic) {
  const hub = once('hub', () => new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2));
  return group(
    mesh(tyreGeo(), '#2f333c', { x, y, z, sx: w, sy: r, sz: r }),
    mesh(hub, rim, { x: x + Math.sign(x) * 0.012, y, z, sx: w, sy: r * 0.62, sz: r * 0.62 }),
    mesh(hub, C.steelDeep, { x: x + Math.sign(x) * 0.02, y, z, sx: w, sy: r * 0.22, sz: r * 0.22 }),
  );
}
const glassMat = () => once('vehicleGlass', () => new THREE.MeshStandardMaterial({
  roughness: 0.16, metalness: 0.25,
  map: canvasTex(64, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8fb9cf'); g.addColorStop(0.5, '#3f6176'); g.addColorStop(1, '#27404f');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }),
}));
const bakeDoor = (d) => { bakeStatic(d); d.traverse((m) => { if (m.isMesh) m.frustumCulled = false; }); return d; };
function strobe(color, emissive) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.1, roughness: 0.32 });
}
const silhouette = (build) => { const s = new THREE.Shape(); build(s); return s; };

prop('ambulance', (o = {}) => {
  const g = group(contact(2.2, 5.6, 0.5)), night = nightKit(), seed = (o.seed ?? nextSeed()) * 0.37, roofY = 2.46;
  const white = mat(C.white, { rough: 0.34 }), coral = mat(C.coral, { rough: 0.4 }), trim = '#3b404b';
  const red = strobe('#e2454e', '#ff2a33'), blue = strobe('#4c86e6', '#2a6dff');
  const haloR = additive('#ff4a50'), haloB = additive('#3f8cff'), washR = additive('#ff3a44'), washB = additive('#3a7dff');

  // Cab and rear skirt are one silhouette with true wheel arches.
  g.add(sideExtrude(silhouette((s) => {
    s.moveTo(-2.76, 0.46); s.lineTo(-1.85, 0.46); s.absarc(-1.35, 0.46, 0.5, Math.PI, 0, true);
    s.lineTo(1.25, 0.46); s.absarc(1.75, 0.46, 0.5, Math.PI, 0, true); s.lineTo(2.6, 0.46);
    s.quadraticCurveTo(2.76, 0.46, 2.76, 0.62); s.lineTo(2.76, 0.96); s.quadraticCurveTo(2.74, 1.2, 2.46, 1.27);
    s.lineTo(2.2, 1.34); s.lineTo(1.76, 2.1); s.quadraticCurveTo(1.72, 2.17, 1.62, 2.17); s.lineTo(0.9, 2.18); s.lineTo(0.9, 1.02); s.lineTo(-2.76, 1.02);
  }), 2.0, white, { key: 'ambBody', bevel: 0.07, curve: 7 }));

  // The rear box is a real shell, so opening the doors reveals an interior. Its seam with the skirt sits under the coral stripe.
  g.add(mesh(once('ambShell', () => {
    const w = 1.06, h = 1.46, r = 0.17, t = 0.07, s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(-w, h - r); s.quadraticCurveTo(-w, h, -w + r, h); s.lineTo(w - r, h); s.quadraticCurveTo(w, h, w, h - r); s.lineTo(w, 0);
    s.lineTo(w - t, 0); s.lineTo(w - t, h - r); s.quadraticCurveTo(w - t, h - t, w - r, h - t); s.lineTo(-w + r, h - t); s.quadraticCurveTo(-w + t, h - t, -w + t, h - r); s.lineTo(-w + t, 0);
    return creased(new THREE.ExtrudeGeometry(s, { depth: 3.68, curveSegments: 5, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelOffset: -0.02, bevelSegments: 1 }), 0.7, 4);
  }), white, { y: 1.0, z: -2.74 }));
  g.add(soft(1.98, 0.04, 3.62, C.plastic, { y: 1.0, z: -0.92, r: 0.012 }), chip(1.96, 1.4, 0.05, '#dcebf4', { y: 1.02, z: 0.92 }));
  g.add(soft(0.36, 1.1, 2.5, C.wainscot, { x: -0.76, y: 1.04, z: -0.65, r: 0.02 }), soft(0.36, 0.3, 2.2, C.offWhite, { x: 0.76, y: 1.04, z: -0.9, r: 0.02 }), soft(0.36, 0.08, 2.2, C.teal, { x: 0.76, y: 1.34, z: -0.9, r: 0.03 }));
  for (let i = 0; i < 4; i++) g.add(chip(0.012, 0.42, 0.52, C.white, { x: -0.575, y: 1.62, z: 0.28 - i * 0.6 }));
  g.add(chip(0.5, 0.012, 2.8, mat('#f6fcff', { emissive: '#e9f7ff', emissiveIntensity: 0.9 }), { y: 2.385, z: -1.0 }));
  g.add(soft(0.62, 0.11, 1.9, C.white, { y: 1.3, z: -1.35, x: 0.02, r: 0.04 }), soft(0.6, 0.05, 0.9, C.coral, { y: 1.4, z: -1.1, x: 0.02, r: 0.02 }), plump(0.44, 0.1, 0.3, C.white, { y: 1.4, z: -2.05, x: 0.02 }));
  g.add(chip(0.5, 0.26, 0.05, C.steelDeep, { x: 0.02, y: 1.04, z: -0.6 }), chip(0.5, 0.26, 0.05, C.steelDeep, { x: 0.02, y: 1.04, z: -2.1 }));

  // Stripes, door lines, handles.
  for (const m of [-1, 1]) {
    g.add(soft(0.02, 0.3, 3.72, coral, { x: m * 1.066, y: 0.93, z: -0.9, r: 0.008 }), soft(0.02, 0.05, 3.72, C.lineYellow, { x: m * 1.066, y: 1.26, z: -0.9, r: 0.006 }));
    g.add(soft(0.02, 0.26, 1.72, coral, { x: m * 0.995, y: 0.97, z: 1.82, r: 0.008 }), soft(0.02, 0.05, 1.72, C.lineYellow, { x: m * 0.995, y: 1.26, z: 1.82, r: 0.006 }));
    g.add(chip(0.006, 1.08, 0.02, '#c6ccd6', { x: m * 1.001, y: 0.98, z: 1.04 }), chip(0.006, 0.86, 0.02, '#c6ccd6', { x: m * 1.001, y: 1.2, z: 2.2 - 0.14, rx: 0.5 }));
    g.add(soft(0.03, 0.035, 0.16, trim, { x: m * 1.012, y: 1.36, z: 1.16, r: 0.012 }));
    // Mirror on a short arm, the toy-truck detail that sells the scale.
    g.add(chip(0.1, 0.03, 0.03, trim, { x: m * 1.045, y: 1.78, z: 1.76 }), plump(0.07, 0.3, 0.17, trim, { x: m * 1.08, y: 1.52, z: 1.76 }));
    g.add(soft(0.03, 0.54, 0.74, glassMat(), { x: m * 1.066, y: 1.62, z: 0.34, r: 0.012 }));
    g.add(panel(2.5, 1.11, decal('ambSide', 1024, 456, (x, w, h) => {
      starOfLife(x, 210, h / 2 - 10, 170);
      x.fillStyle = '#e4606a'; x.font = '800 92px Inter, system-ui, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('AMBULANCE', 680, h / 2 - 66);
      x.fillStyle = '#5c6474'; x.font = '600 50px Inter, system-ui, sans-serif'; x.fillText(HOSPITAL_NAME, 680, h / 2 + 44);
    }), { x: m * 1.0665, y: 1.28, z: -1.45, ry: (m * Math.PI) / 2 }));
    g.add(wheel(m * 0.885, 0.42, -1.35, 0.42, 0.28), wheel(m * 0.885, 0.42, 1.75, 0.42, 0.28));
    g.add(chip(0.3, 0.03, 0.04, '#3a3f4a', { x: m * 0.85, y: 0.42, z: -1.84 }), plump(0.34, 0.2, 0.05, night.head, { x: m * 0.68, y: 0.84, z: 2.745 }), chip(0.26, 0.2, 0.02, night.tail, { x: m * 0.74, y: 0.66, z: -2.77 }));
    g.add(plump(0.2, 0.09, 0.05, m < 0 ? red : blue, { x: m * 0.86, y: 2.35, z: -2.72 }), plump(0.16, 0.06, 0.03, m < 0 ? red : blue, { x: m * 0.28, y: 1.08, z: 2.75 }));
  }
  // Cab glass: one full-width extrusion for both side windows, a tilted slab for the screen.
  g.add(sideExtrude(silhouette((s) => { s.moveTo(1.06, 1.4); s.lineTo(2.03, 1.4); s.lineTo(1.66, 2.03); s.lineTo(1.06, 2.03); }), 2.012, glassMat(), { key: 'ambSide', curve: 1 }));
  g.add(soft(1.76, 0.82, 0.03, glassMat(), { y: 1.33, z: 1.985, rx: -0.53, r: 0.012 }));
  g.add(soft(1.9, 0.24, 0.05, trim, { y: 0.74, z: 2.74, r: 0.02 }));
  g.add(soft(2.0, 0.17, 0.2, trim, { y: 0.47, z: 2.67, r: 0.05 }), soft(1.96, 0.1, 0.24, C.steelDeep, { y: 0.5, z: -2.66, r: 0.03 }));
  g.add(soft(1.5, 0.5, 2.55, '#b6bcc7', { y: 0.28, z: 0.2, r: 0.04 }));

  // Roof: visible first from the isometric camera, so it carries the star, the bar and the vents.
  g.add(flat(1.5, 1.5, starMat(), { y: roofY + 0.008, z: -1.0, receive: false }));
  g.add(soft(0.86, 0.1, 0.56, C.offWhite, { y: roofY, z: -2.3, r: 0.04 }), chip(0.6, 0.012, 0.3, C.steel, { y: roofY + 0.1, z: -2.3 }));
  g.add(soft(0.42, 0.05, 0.42, C.plastic, { x: 0.58, y: roofY, z: 0.06, r: 0.02 }));
  g.add(soft(1.74, 0.05, 0.32, trim, { y: roofY, z: 0.68, r: 0.02 }), soft(0.26, 0.09, 0.26, C.white, { y: roofY + 0.04, z: 0.68, r: 0.03 }));
  g.add(plump(0.72, 0.15, 0.28, red, { x: -0.5, y: roofY + 0.04, z: 0.68, e: 0.6 }), plump(0.72, 0.15, 0.28, blue, { x: 0.5, y: roofY + 0.04, z: 0.68, e: 0.6 }));
  g.add(halo(2.1, haloR, { x: -0.5, y: roofY + 0.1, z: 0.68 }), halo(2.1, haloB, { x: 0.5, y: roofY + 0.1, z: 0.68 }));
  g.add(flat(8, 11, washR, { x: -1.4, y: 0.03, order: 2 }), flat(8, 11, washB, { x: 1.4, y: 0.03, order: 2 }));
  g.add(flat(4.2, 7, night.beam, { y: 0.03, z: 6.0, order: 2 }));
  washR.visible = washB.visible = haloR.visible = haloB.visible = false;

  // Rear doors swing about the shell's rear corners.
  const door = (side) => {
    const d = group(
      soft(1.0, 1.42, 0.05, white, { x: -side * 0.5, r: 0.02 }),
      soft(0.54, 0.44, 0.02, glassMat(), { x: -side * 0.5, y: 0.74, z: -0.03, r: 0.01 }),
      soft(0.98, 0.3, 0.012, coral, { x: -side * 0.5, y: 0.0, z: -0.032, r: 0.004 }),
      soft(0.98, 0.05, 0.012, C.lineYellow, { x: -side * 0.5, y: 0.34, z: -0.032, r: 0.004 }),
      chip(0.03, 0.2, 0.03, trim, { x: -side * 0.1, y: 0.48, z: -0.04 }),
    );
    d.position.set(side * 1.02, 1.02, -2.78);
    d.userData.dynamic = true;
    g.add(d);
    return bakeDoor(d);
  };
  const doorL = door(-1), doorR = door(1);

  let lights = !!o.lights, want = o.doors ? 1 : 0, open = want, power = lights ? 1 : 0;
  doorL.rotation.y = ease(open) * 1.9; doorR.rotation.y = -ease(open) * 1.9;
  g.userData.setState = (s) => { lights = !!s.lights; want = s.doors ? 1 : 0; };
  bakeStatic(g);
  return live(g, (dt, t, ctx) => {
    applyNight(ctx?.night);
    power += ((lights ? 1 : 0) - power) * Math.min(1, dt * 9);
    if (power > 0.01) {
      // A real bar double-flashes one side, then the other. Hard on-off reads as a strobe where a sine reads as a pulse.
      const p = (t * 1.45 + seed) % 1, side = p < 0.5, f = (((side ? p : p - 0.5) * 2) * 3) % 1, on = f < 0.55 && (side ? p : p - 0.5) * 2 < 0.72 ? power : 0;
      const n = ctx?.night ?? 0, r = side ? on : 0, b = side ? 0 : on, wash = 0.16 + n * 0.5;
      red.emissiveIntensity = 0.1 + r * 4.5; blue.emissiveIntensity = 0.1 + b * 4.5;
      haloR.opacity = r * 0.9; haloB.opacity = b * 0.9; washR.opacity = r * wash; washB.opacity = b * wash;
      haloR.visible = haloB.visible = washR.visible = washB.visible = true;
    } else if (haloR.visible) {
      red.emissiveIntensity = blue.emissiveIntensity = 0.1;
      haloR.visible = haloB.visible = washR.visible = washB.visible = false;
    }
    if (open !== want) {
      open = want > open ? Math.min(want, open + dt * 0.9) : Math.max(want, open - dt * 0.9);
      const a = ease(open) * 1.9;
      doorL.rotation.y = a; doorR.rotation.y = -a;
    }
  });
});

const PASTELS = ['#ffb4a2', '#a9d8ee', '#ffd97d', '#b8e6c8', '#cdb9ee', '#f6efe4', '#ff9fae', '#9fe0dc'];
let carN = 0;
prop('car', (o = {}) => {
  const tone = o.color ?? PASTELS[carN++ % PASTELS.length], paint = mat(tone, { rough: 0.3 });
  const g = group(contact(1.9, 4.3, 0.5)), night = nightKit(), trim = '#3b404b';
  g.add(sideExtrude(silhouette((s) => {
    s.moveTo(-2.05, 0.34); s.lineTo(-1.74, 0.34); s.absarc(-1.3, 0.34, 0.44, Math.PI, 0, true);
    s.lineTo(0.86, 0.34); s.absarc(1.3, 0.34, 0.44, Math.PI, 0, true); s.lineTo(2.0, 0.34);
    s.quadraticCurveTo(2.14, 0.34, 2.14, 0.48); s.lineTo(2.13, 0.68); s.quadraticCurveTo(2.08, 0.84, 1.8, 0.88);
    s.quadraticCurveTo(1.2, 0.95, 0.72, 1.0); s.lineTo(-1.6, 1.0); s.quadraticCurveTo(-2.02, 0.98, -2.1, 0.78); s.lineTo(-2.13, 0.5); s.quadraticCurveTo(-2.13, 0.34, -2.05, 0.34);
  }), 1.82, paint, { key: 'carBody', bevel: 0.08, curve: 6 }));
  const roofline = silhouette((s) => { s.moveTo(-1.62, 0.98); s.lineTo(-1.3, 1.43); s.quadraticCurveTo(-1.24, 1.47, -1.16, 1.47); s.lineTo(0.14, 1.47); s.quadraticCurveTo(0.24, 1.47, 0.3, 1.42); s.lineTo(0.88, 0.98); });
  g.add(sideExtrude(roofline, 1.52, glassMat(), { key: 'carGlass', bevel: 0.05, curve: 4, bevelSeg: 1 }));
  g.add(plump(1.5, 0.09, 1.48, paint, { y: 1.42, z: -0.52 }));
  for (const m of [-1, 1]) {
    g.add(wheel(m * 0.8, 0.36, -1.3, 0.36, 0.26), wheel(m * 0.8, 0.36, 1.3, 0.36, 0.26));
    g.add(soft(0.03, 0.46, 0.09, paint, { x: m * 0.74, y: 0.98, z: -0.34, r: 0.012 }));
    g.add(chip(0.006, 0.54, 0.018, mix(tone), { x: m * 0.912, y: 0.42, z: -0.32 }), chip(0.006, 0.5, 0.018, mix(tone), { x: m * 0.912, y: 0.44, z: 0.86 }));
    g.add(soft(0.02, 0.03, 0.13, trim, { x: m * 0.916, y: 0.84, z: 0.5, r: 0.01 }), soft(0.02, 0.03, 0.13, trim, { x: m * 0.916, y: 0.84, z: -0.72, r: 0.01 }));
    g.add(plump(0.36, 0.11, 0.06, night.head, { x: m * 0.64, y: 0.62, z: 2.125 }), plump(0.36, 0.12, 0.05, night.tail, { x: m * 0.64, y: 0.72, z: -2.13 }));
    g.add(plump(0.05, 0.1, 0.16, paint, { x: m * 0.92, y: 0.98, z: 0.72 }));
  }
  g.add(soft(1.72, 0.14, 0.14, trim, { y: 0.34, z: 2.09, r: 0.05 }), soft(1.72, 0.14, 0.14, trim, { y: 0.36, z: -2.09, r: 0.05 }));
  g.add(soft(0.8, 0.08, 0.03, trim, { y: 0.58, z: 2.135, r: 0.012 }), soft(0.3, 0.09, 0.012, C.white, { y: 0.5, z: -2.165, r: 0.004 }));
  g.add(flat(3, 5, night.beam, { y: 0.03, z: 4.4, order: 2 }));
  bakeStatic(g);
  return live(g, (dt, t, ctx) => { applyNight(ctx?.night); });
});
// Door seams a shade under the paint, so they read on any pastel without a dark outline.
function mix(hex) { return `#${new THREE.Color(hex).multiplyScalar(0.72).getHexString()}`; }

const liveryTex = () => once('heliLivery', () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#fbfcfd'; x.fillRect(0, 0, w, h);
  // u runs round the body starting at the belly: both ends of the canvas meet underneath.
  for (const [a, b] of [[0, 0.17], [0.83, 1]]) { x.fillStyle = C.coral; x.fillRect(a * w, 0, (b - a) * w, h); }
  x.fillStyle = C.lineYellow;
  x.fillRect(0.175 * w, 0, 0.018 * w, h); x.fillRect(0.807 * w, 0, 0.018 * w, h);
}));
prop('helicopter', (o = {}) => {
  const g = group(contact(2.5, 8.2, 0.42)), white = mat(C.white, { rough: 0.34 }), trim = '#3b404b', glass = glassMat();
  const body = once('heliBody', () => new THREE.MeshStandardMaterial({ map: liveryTex(), roughness: 0.34 }));
  const pod = once('heliPod', () => new THREE.LatheGeometry(
    [[0.12, -2.4], [0.34, -2.0], [0.62, -1.3], [0.86, -0.3], [0.95, 0.7], [0.92, 1.7], [0.76, 2.5], [0.5, 3.1], [0.2, 3.46], [0.001, 3.54]].map(([x, y]) => new THREE.Vector2(x, y)), 16, -Math.PI, TAU,
  ).rotateX(Math.PI / 2));
  g.add(mesh(pod, body, { y: 1.42, sx: 0.82 }));
  g.add(plump(1.14, 1.16, 2.1, glass, { y: 1.2, z: 2.2, e: 0.85 }));
  g.add(plump(0.26, 0.5, 2.5, white, { y: 1.7, z: 2.3 - 0.9, sx: 1 }));
  for (const m of [-1, 1]) {
    g.add(plump(0.05, 0.58, 0.9, glass, { x: m * 0.71, y: 1.46, z: 0.62, rz: m * -0.22, e: 0.5 }), plump(0.05, 0.5, 0.74, glass, { x: m * 0.72, y: 1.48, z: -0.42, rz: m * -0.2, e: 0.5 }));
    g.add(chip(0.012, 1.0, 0.02, '#c6ccd6', { x: m * 0.79, y: 0.9, z: 0.08 }));
    g.add(panel(0.72, 0.72, starMat(), { x: m * 0.5, y: 1.34, z: -1.62, ry: (m * Math.PI) / 2 + m * 0.34 }));
    g.add(tube([[m * 1.04, 0.09, -1.8], [m * 1.04, 0.09, 1.9], [m * 1.04, 0.14, 2.5], [m * 1.04, 0.3, 2.85]], 0.045, trim, { seg: 14, radial: 7 }));
    for (const z of [-0.8, 1.1]) g.add(tube([[m * 1.04, 0.1, z], [m * 0.95, 0.5, z], [m * 0.46, 0.66, z]], 0.035, trim, { seg: 6, radial: 5 }));
  }
  g.add(plump(1.04, 0.56, 2.7, white, { y: 2.0, z: 0.25, e: 0.7 }));
  for (const m of [-1, 1]) g.add(cyl(0.09, 0.11, 0.3, C.charcoal, { x: m * 0.3, y: 2.08, z: -1.12, rx: 1.2, seg: 8 }));
  g.add(cyl(0.065, 0.1, 0.42, C.steelDeep, { y: 2.48, z: 0.7, seg: 10 }));
  g.add(mesh(once('heliBoom', () => new THREE.CylinderGeometry(0.34, 0.13, 3.9, 12).rotateX(Math.PI / 2)), white, { y: 1.72, z: -3.45 }));
  g.add(sideExtrude(silhouette((s) => { s.moveTo(-4.72, 1.68); s.lineTo(-5.42, 2.96); s.quadraticCurveTo(-5.46, 3.1, -5.3, 3.1); s.lineTo(-5.06, 3.1); s.lineTo(-4.82, 2.1); s.lineTo(-4.2, 1.8); s.lineTo(-4.2, 1.68); }), 0.09, C.coral, { key: 'heliFin', bevel: 0.02, curve: 3, bevelSeg: 1 }));
  g.add(soft(1.9, 0.045, 0.34, white, { y: 1.8, z: -4.35, r: 0.02 }));
  for (const m of [-1, 1]) g.add(soft(0.03, 0.28, 0.36, C.coral, { x: m * 0.95, y: 1.68, z: -4.35, r: 0.012 }));
  g.add(panel(2.4, 0.42, decal('heliText', 512, 88, (x, w, h) => {
    x.fillStyle = '#e4606a'; x.font = '800 54px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('AIR AMBULANCE', w / 2, h / 2 + 2);
  }), { x: 0.281, y: 1.51, z: -3.0, ry: Math.PI / 2 + 0.03 }));

  const blurMat = new THREE.MeshBasicMaterial({ map: once('rotorTex', () => canvasTex(256, 256, (x, w) => {
    const r = w / 2, g2 = x.createRadialGradient(r, r, r * 0.1, r, r, r);
    g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.2, 'rgba(255,255,255,.55)'); g2.addColorStop(0.92, 'rgba(255,255,255,.75)'); g2.addColorStop(0.96, 'rgba(255,138,122,.9)'); g2.addColorStop(1, 'rgba(255,138,122,0)');
    x.fillStyle = g2; x.fillRect(0, 0, w, w);
  })), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  blurMat.visible = false;
  g.add(mesh(once('rotorDisc', () => new THREE.CircleGeometry(4.46, 36).rotateX(-Math.PI / 2)), blurMat, { y: 2.96, z: 0.7, shadow: false, receive: false, order: 3 }));

  const head = group(cyl(0.2, 0.26, 0.12, C.steelDeep, { y: 0.0, seg: 12 }), cyl(0.05, 0.05, 0.16, C.charcoal, { y: 0.1, seg: 8 }));
  for (let i = 0; i < 4; i++) {
    const b = group(soft(0.3, 0.034, 4.2, white, { z: 2.28, r: 0.014 }), chip(0.3, 0.036, 0.46, C.coral, { z: 4.2 }), soft(0.1, 0.05, 0.3, C.steelDeep, { z: 0.2, r: 0.012 }));
    b.rotation.y = (i * Math.PI) / 2;
    b.children[0].rotation.z = 0.05;
    head.add(b);
  }
  head.position.set(0, 2.86, 0.7);
  head.rotation.y = (o.seed ?? nextSeed()) * 0.7;
  head.userData.dynamic = true;
  g.add(head);
  bakeStatic(head);

  const tail = group();
  for (const s of [-1, 1]) tail.add(soft(0.02, 0.62, 0.11, C.white, { y: s > 0 ? 0 : -0.62, r: 0.008 }));
  tail.add(cyl(0.05, 0.05, 0.1, C.steelDeep, { y: -0.05, x: -0.02, rz: Math.PI / 2, seg: 8 }));
  tail.position.set(0.1, 2.5, -5.14);
  tail.userData.dynamic = true;
  g.add(tail);
  bakeStatic(tail);

  let want = o.rotor ?? 0, speed = want;
  g.userData.setState = (s) => { want = s.rotor ?? 0; };
  bakeStatic(g);
  return live(g, (dt, t, ctx) => {
    applyNight(ctx?.night);
    speed += (want - speed) * Math.min(1, dt * 1.5);
    if (speed < 0.002) { blurMat.visible = false; return; }
    head.rotation.y += speed * 26 * dt;
    tail.rotation.x += speed * 44 * dt;
    const blur = Math.min(1, Math.max(0, (speed - 0.3) / 0.5));
    blurMat.visible = blur > 0;
    blurMat.opacity = blur * 0.3;
  });
});

// ── planting ─────────────────────────────────────────────
// Sway happens in the vertex shader of one shared material: every crown stays merged in the bake and costs no draw call or per-tree transform.
const breeze = { value: 0 };
function swayMat(map, amount) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.82 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uBreeze = breeze;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBreeze;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float k = smoothstep(0.3, 4.5, wp.y) * ${amount.toFixed(3)};
        transformed.x += sin(uBreeze * 1.05 + wp.x * 0.55 + wp.z * 0.4) * k;
        transformed.z += cos(uBreeze * 0.86 + wp.x * 0.45 - wp.z * 0.6) * k * 0.7; }`);
  };
  m.customProgramCacheKey = () => `sway${amount}`;
  return m;
}
const leafTex = (top, mid, low, fleck) => canvasTex(128, 128, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(1, low);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 90; i++) {
    x.fillStyle = i % 3 ? fleck : 'rgba(10,60,40,.14)';
    x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, TAU); x.fill();
  }
});
const crownMat = (tone) => once(`crown${tone}`, () => swayMat(tone
  ? leafTex('#a4de8e', '#57b86c', '#2a8a55', 'rgba(205,245,170,.2)')
  : leafTex('#6fd088', '#2f9c62', '#176242', 'rgba(170,240,170,.2)'), 0.05));
const blobGeo = (i) => once(`blob${i}`, () => {
  const g = new THREE.SphereGeometry(1, 11, 8), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k), a = Math.atan2(z, x);
    const d = 1 + 0.07 * Math.sin(a * (3 + i) + i) * Math.sqrt(Math.max(0, 1 - y * y)) + 0.05 * Math.sin(y * 5 + i * 2);
    p.setXYZ(k, x * d, y * d, z * d);
  }
  return g;
});
const CROWN = [[0, 2.92, 0, 0.92], [0.1, 3.5, -0.06, 0.66], [0.56, 2.78, 0.3, 0.52], [-0.56, 2.84, 0.18, 0.54], [0.08, 2.68, -0.58, 0.5], [-0.2, 2.54, 0.56, 0.48], [0.46, 3.24, -0.34, 0.48], [-0.42, 3.3, 0.3, 0.48]];
prop('treeRound', (o = {}) => {
  const r = rng(o.seed ?? nextSeed() * 13), tone = o.tone ?? (r() > 0.6 ? 1 : 0), spin = r() * TAU, scale = 0.94 + r() * 0.08;
  const g = group(contact(2.0, 2.0, 0.42));
  g.add(cyl(0.11, 0.2, 2.1, C.trunk, { seg: 9 }), cyl(0.2, 0.31, 0.16, C.trunk, { seg: 9 }));
  g.add(tube([[0, 1.5, 0], [0.26, 1.9, 0.1], [0.42, 2.3, 0.14]], 0.05, C.trunk, { seg: 5, radial: 5 }), tube([[0, 1.3, 0], [-0.24, 1.8, -0.1], [-0.34, 2.3, -0.12]], 0.05, C.trunk, { seg: 5, radial: 5 }));
  const c = Math.cos(spin), s = Math.sin(spin);
  CROWN.forEach(([x, y, z, b], i) => g.add(mesh(blobGeo(i % 3), crownMat(tone), { x: (x * c + z * s) * scale, y: y * (0.98 + 0.02 * scale), z: (z * c - x * s) * scale, s: b * scale * (0.96 + r() * 0.08), ry: r() * TAU })));
  return live(g, (dt, t) => { breeze.value = t; });
});
const pineMat = () => once('pineMat', () => swayMat(canvasTex(32, 128, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#125a42'); g.addColorStop(0.62, '#1f8058'); g.addColorStop(1, '#3fae74');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}), 0.06));
const pineGeo = () => once('pineTier', () => {
  const g = new THREE.ConeGeometry(1, 1, 16, 2, true), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    if (p.getY(k) > -0.49) continue;
    const a = Math.atan2(p.getZ(k), p.getX(k)), d = 1 + 0.07 * Math.cos(a * 8);
    p.setX(k, p.getX(k) * d); p.setZ(k, p.getZ(k) * d);
  }
  return g;
});
prop('treePine', (o = {}) => {
  const r = rng(o.seed ?? nextSeed() * 17), g = group(contact(1.8, 1.8, 0.42)), lean = r() * TAU, tall = 0.95 + r() * 0.05;
  g.add(cyl(0.09, 0.17, 1.1, C.trunk, { seg: 8 }));
  for (const [cy, h, b] of [[1.5, 1.8, 0.98], [2.4, 1.6, 0.82], [3.25, 1.42, 0.63], [4.05, 1.3, 0.43]]) g.add(mesh(pineGeo(), pineMat(), { y: cy * tall, sx: b, sy: h * tall, sz: b, ry: lean + cy * 2 }));
  g.add(dot(0.05, '#3fae74', { y: 4.72 * tall }));
  return live(g, (dt, t) => { breeze.value = t; });
});
prop('bush', (o = {}) => {
  const r = rng(o.seed ?? nextSeed() * 19), tone = o.tone ?? (r() > 0.5 ? 1 : 0), g = group(contact(1.0, 1.0, 0.42));
  for (const [x, y, z, b] of [[0, 0.4, 0, 0.42], [0.25, 0.3, 0.14, 0.3], [-0.26, 0.3, 0.1, 0.3], [0.04, 0.28, -0.27, 0.27], [-0.05, 0.27, 0.28, 0.25]]) g.add(mesh(blobGeo(Math.floor(r() * 3)), crownMat(tone), { x, y, z, s: b * (0.94 + r() * 0.1), ry: r() * TAU }));
  if (o.flowers ?? r() > 0.5) {
    const col = [C.rose, C.lineYellow, C.white, C.coral][Math.floor(r() * 4)];
    for (let i = 0; i < 9; i++) { const a = r() * TAU, e = 0.3 + r() * 1.1, R = 0.47; g.add(dot(0.03, col, { x: Math.cos(a) * Math.cos(e) * R, y: 0.34 + Math.sin(e) * 0.36, z: Math.sin(a) * Math.cos(e) * R })); }
  }
  return live(g, (dt, t) => { breeze.value = t; });
});
const FLOWERS = ['#ff7d93', '#ffd24f', '#ffffff', '#b28cf0', '#ff9a5c', '#ff5f7e'];
prop('flowerBed', (o = {}) => {
  const r = rng(o.seed ?? nextSeed() * 23), g = group(contact(3.2, 1.1, 0.3));
  const edge = once('bedEdge', () => { const s = roundRect(3.2, 1.1, 0.28); s.holes.push(roundRect(2.96, 0.86, 0.2)); return s; });
  g.add(slab(edge, 0.2, C.pavingDeep, { key: 'bedEdge', curve: 4, bevel: 0.02 }));
  g.add(flat(3.0, 0.9, C.soilDeep, { y: 0.16, receive: true }));
  for (let i = 0; i < 6; i++) g.add(mesh(blobGeo(i % 3), crownMat(1), { x: -1.2 + i * 0.48, y: 0.2, z: (i % 2 ? 0.14 : -0.14), sx: 0.3, sy: 0.14, sz: 0.28, ry: r() * TAU }));
  for (let i = 0; i < 38; i++) g.add(dot(0.04 + r() * 0.018, FLOWERS[i % FLOWERS.length], { x: -1.36 + r() * 2.72, y: 0.3 + r() * 0.12, z: -0.34 + r() * 0.68 }));
  return g;
});

// ── street furniture ─────────────────────────────────────
prop('bench', (o = {}) => {
  const g = group(contact(1.9, 0.6, 0.34)), wood = o.color ?? C.wood, iron = C.charcoal;
  for (const z of [0.16, 0.03, -0.1]) g.add(soft(1.86, 0.035, 0.115, wood, { y: 0.43, z, r: 0.012 }));
  for (const y of [0.56, 0.68, 0.8]) g.add(soft(1.86, 0.1, 0.03, wood, { y: y - 0.04, z: -0.2 - (y - 0.56) * 0.3, rx: -0.2, r: 0.012 }));
  for (const x of [-0.8, 0.8]) {
    g.add(tube([[x, 0, 0.22], [x, 0.3, 0.2], [x, 0.43, 0.18], [x, 0.43, -0.14], [x, 0.84, -0.27]], 0.022, iron, { seg: 12, radial: 5 }));
    g.add(tube([[x, 0, -0.22], [x, 0.3, -0.18], [x, 0.43, -0.14]], 0.022, iron, { seg: 5, radial: 5 }));
    g.add(tube([[x, 0.42, 0.17], [x, 0.62, 0.2], [x, 0.63, 0.02], [x, 0.6, -0.17]], 0.018, iron, { seg: 8, radial: 5 }));
  }
  return g;
});
prop('lampPost', () => {
  const g = group(contact(0.4, 0.4, 0.42)), night = nightKit(), iron = '#3a4252';
  g.add(cyl(0.12, 0.18, 0.22, iron, { seg: 10 }), cyl(0.05, 0.08, 3.3, iron, { y: 0.2, seg: 8 }), cyl(0.09, 0.06, 0.06, iron, { y: 3.46, seg: 10 }));
  g.add(cyl(0.15, 0.115, 0.34, nightLamp, { y: 3.52, seg: 12, shadow: false }));
  g.add(cyl(0.05, 0.2, 0.12, iron, { y: 3.86, seg: 12 }), cyl(0.012, 0.03, 0.08, iron, { y: 3.96, seg: 6 }));
  g.add(halo(2.2, night.halo, { y: 3.7 }));
  g.add(flat(8.4, 8.4, night.pool, { y: 0.03, order: 2 }));
  return live(g, (dt, t, ctx) => { applyNight(ctx?.night); });
});
prop('bollard', () => {
  const g = group(contact(0.24, 0.24, 0.36));
  g.add(pill(0.085, 0.86, '#eceef2', { seg: 10 }), cyl(0.088, 0.088, 0.1, C.coral, { y: 0.56, seg: 10 }), cyl(0.088, 0.088, 0.03, nightLamp, { y: 0.7, seg: 10, shadow: false }));
  return live(g, (dt, t, ctx) => { applyNight(ctx?.night); });
});
prop('monumentSign', (o = {}) => {
  const name = o.name ?? HOSPITAL_NAME, g = group(contact(4.2, 0.8, 0.42)), night = nightKit();
  g.add(soft(4.2, 0.24, 0.8, C.pavingDeep, { r: 0.05 }), soft(4.0, 0.06, 0.66, C.grassDeep, { y: 0.24, r: 0.02 }));
  g.add(soft(4.0, 1.8, 0.4, C.trimWarm, { y: 0.26, r: 0.07, seg: 2 }));
  g.add(soft(4.04, 0.14, 0.44, C.teal, { y: 2.06, r: 0.06 }));
  const badge = once('hBadge', () => new THREE.MeshStandardMaterial({ color: C.teal, emissive: C.teal, emissiveIntensity: 0.05, roughness: 0.4 }));
  const face = once(`monument|${name}`, () => {
    const tex = canvasTex(1024, 420, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = C.ink; x.textBaseline = 'middle'; x.textAlign = 'left';
      const words = name.split(' '), mid = Math.ceil(words.length / 2);
      x.font = '700 150px Inter, system-ui, sans-serif';
      const fit = Math.min(1, w / Math.max(x.measureText(words.slice(0, mid).join(' ')).width, x.measureText(words.slice(mid).join(' ')).width));
      x.font = `700 ${Math.floor(150 * fit)}px Inter, system-ui, sans-serif`;
      x.fillText(words.slice(0, mid).join(' '), 0, 112); x.fillText(words.slice(mid).join(' '), 0, 268);
      x.fillStyle = C.tealDeep; x.font = '600 46px Inter, system-ui, sans-serif'; x.fillText('Hospital and Emergency Care', 4, 382);
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    onNight((k) => { m.emissiveIntensity = k * 0.9; badge.emissiveIntensity = 0.05 + k * 1.1; });
    return m;
  });
  g.add(soft(1.36, 1.36, 0.08, badge, { x: -1.16, y: 0.5, z: 0.21, r: 0.2, seg: 2 }));
  g.add(soft(0.25, 0.92, 0.05, C.white, { x: -1.46, y: 0.72, z: 0.25, r: 0.05 }), soft(0.25, 0.92, 0.05, C.white, { x: -0.86, y: 0.72, z: 0.25, r: 0.05 }), soft(0.5, 0.22, 0.05, C.white, { x: -1.16, y: 1.07, z: 0.25, r: 0.02 }));
  g.add(panel(2.2, 0.9, face, { x: 0.82, y: 0.72, z: 0.206 }));
  const r = rng(41);
  for (let i = 0; i < 16; i++) g.add(dot(0.05, FLOWERS[i % FLOWERS.length], { x: -1.9 + i * 0.253 + r() * 0.05, y: 0.34, z: 0.3 + r() * 0.04 }));
  for (let i = 0; i < 5; i++) g.add(mesh(blobGeo(i % 3), crownMat(1), { x: -1.6 + i * 0.8, y: 0.3, z: 0.29, sx: 0.36, sy: 0.1, sz: 0.09 }));
  return live(g, (dt, t, ctx) => { applyNight(ctx?.night); });
});
const padTex = () => once('padTex', () => {
  const t = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2;
    x.fillStyle = '#8f99ab'; x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2;
    for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo((i * w) / 8, 0); x.lineTo((i * w) / 8, w); x.moveTo(0, (i * w) / 8); x.lineTo(w, (i * w) / 8); x.stroke(); }
    x.strokeStyle = '#f8f9fb'; x.lineWidth = 16; x.strokeRect(32, 32, w - 64, w - 64);
    x.fillStyle = '#f8f9fb'; x.beginPath(); x.arc(c, c, 440, 0, TAU); x.fill();
    x.fillStyle = '#8f99ab'; x.beginPath(); x.arc(c, c, 402, 0, TAU); x.fill();
    x.fillStyle = '#fffdf8'; x.beginPath(); x.arc(c, c, 340, 0, TAU); x.fill();
    x.fillStyle = '#ef6a5a';
    for (const [a, b, d, e] of [[c - 200, c - 230, 104, 460], [c + 96, c - 230, 104, 460], [c - 100, c - 56, 200, 112]]) { x.beginPath(); x.roundRect(a, b, d, e, 14); x.fill(); }
  });
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.82 });
});
prop('helipad', () => {
  const g = group(contact(11, 11, 0.22)), night = nightKit();
  g.add(soft(11, 0.08, 11, C.steelDeep, { r: 0.03 }));
  g.add(flat(10.9, 10.9, padTex(), { y: 0.082, receive: true }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, R = 4.8;
    g.add(cyl(0.07, 0.09, 0.05, C.charcoal, { x: Math.cos(a) * R, y: 0.08, z: Math.sin(a) * R, seg: 8 }), dot(0.06, night.pad, { x: Math.cos(a) * R, y: 0.14, z: Math.sin(a) * R }));
  }
  // Windsock on the pad corner: a small moving thing that makes the pad feel used.
  g.add(contact(0.3, 0.3, 0.3));
  g.children[g.children.length - 1].position.set(5.1, 0.09, -5.1);
  g.add(cyl(0.022, 0.03, 1.5, C.white, { x: 5.1, y: 0.08, z: -5.1, seg: 6 }));
  const sock = group();
  [[0.16, 0.135, 0.3, C.coral], [0.135, 0.11, 0.3, C.white], [0.11, 0.085, 0.3, C.coral], [0.085, 0.06, 0.3, C.white]].forEach(([a, b, len, col], i) => sock.add(cyl(b, a, len, col, { y: -0.3 * (i + 1), seg: 8, rz: 0 })));
  sock.rotation.z = 0;
  const swing = group(sock);
  swing.position.set(5.1, 1.56, -5.1);
  swing.userData.dynamic = true;
  g.add(swing);
  bakeStatic(sock);
  return live(g, (dt, t, ctx) => {
    applyNight(ctx?.night);
    swing.rotation.y = 0.9 + Math.sin(t * 0.5) * 0.3;
    swing.rotation.z = 1.32 + Math.sin(t * 1.7) * 0.1;
  });
});
prop('parkingBay', (o = {}) => {
  const g = group(), paint = o.color ?? C.lineWhite;
  for (const x of [-1.25, 1.25]) g.add(flat(0.1, 5.2, paint, { x, y: 0.014 }));
  g.add(flat(2.6, 0.1, paint, { y: 0.014, z: -2.55 }));
  g.add(soft(1.6, 0.09, 0.14, C.curb, { y: 0, z: -2.26, r: 0.03 }));
  return g;
});

export function registerOutdoorProps() {
  for (const [name, build] of table) registerProp(name, build);
}
