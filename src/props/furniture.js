// Furniture props, plus the small modelling helpers outdoor.js shares.
// The kit's rounded box costs 300 to 970 triangles, so the bulk of a room is built from cheaper soft primitives here.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ball, canvasTex, contact, cyl, group, mat, matGlass, matGloss, matGlow, matMetal, panel, ring, signMat } from '../style/kit.js';
import { C } from '../style/palette.js';
import { registerProp } from './registry.js';

const TAU = Math.PI * 2;
const table = new Map();
const prop = (name, build) => table.set(name, build);
const asMat = (m) => (typeof m === 'string' ? mat(m) : m);
const geos = new Map();
export const once = (k, make) => { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); };
export const rng = (seed) => { let s = (seed * 48271 + 11) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
let seeds = 0;
export const nextSeed = () => ++seeds;
export const smooth = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s, sx, sy, sz, shadow = true, receive = true, order } = {}) {
  const m = new THREE.Mesh(geo, asMat(material));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) m.scale.setScalar(s);
  if (sx || sy || sz) m.scale.set(sx ?? 1, sy ?? 1, sz ?? 1);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  if (order !== undefined) m.renderOrder = order;
  return m;
}

/** One-step rounded box, 108 triangles (kit box: 300+). y = bottom. seg 2 for large forms seen up close. */
export function soft(w, h, d, color, o = {}) {
  const r = Math.min(o.r ?? 0.03, Math.min(w, h, d) * 0.48), seg = o.seg ?? 1;
  const g = once(`soft|${w}|${h}|${d}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r));
  return mesh(g, color, { ...o, y: (o.y ?? 0) + h / 2 });
}
/** Plain 12-triangle box for details too small to show a bevel. y = bottom. */
export function chip(w, h, d, color, o = {}) {
  return mesh(once('chip', () => new THREE.BoxGeometry(1, 1, 1)), color, { ...o, y: (o.y ?? 0) + h / 2, sx: w, sy: h, sz: d });
}
/** Floor-parallel quad facing up. y = its height. */
export function flat(w, d, material, o = {}) {
  return mesh(once('flat', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), material, { shadow: false, ...o, sx: w, sy: 1, sz: d });
}
// Superellipsoid with analytic normals: reads as a stuffed cushion for 140 triangles.
const plumpGeo = (e) => once(`plump${e}`, () => {
  const g = new THREE.SphereGeometry(1, 10, 8), p = g.attributes.position, n = g.attributes.normal;
  const pow = (v, k) => Math.sign(v) * Math.abs(v) ** k, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i), b = p.getY(i), c = p.getZ(i);
    p.setXYZ(i, pow(a, e) / 2, pow(b, e) / 2, pow(c, e) / 2);
    v.set(pow(a, 2 - e), pow(b, 2 - e), pow(c, 2 - e)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
});
/** Stuffed cushion, w×h×d. y = bottom. e: lower is boxier. */
export function plump(w, h, d, color, o = {}) {
  return mesh(plumpGeo(o.e ?? 0.5), color, { ...o, y: (o.y ?? 0) + h / 2, sx: w, sy: h, sz: d });
}
/** Unit-sphere dot for flowers, snacks and bulbs: 20 triangles, smooth normals. y = centre. */
export function dot(r, color, o = {}) {
  const g = once('dot', () => { const i = new THREE.IcosahedronGeometry(1, 0); i.setAttribute('normal', i.attributes.position.clone()); return i; });
  return mesh(g, color, { shadow: false, ...o, s: r });
}
/** Smooth tube through [x, y, z] points. */
export function tube(pts, r, color, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(c, o.seg ?? 14, r, o.radial ?? 6, false), color, o);
}
// toCreasedNormals hashes vertices to 1 cm, so small forms are scaled up first to keep their folds apart.
export function creased(g, angle = 0.7, up = 10) {
  g.scale(up, up, up);
  const out = toCreasedNormals(g, angle);
  return out.scale(1 / up, 1 / up, 1 / up);
}
/** Extrude a plan shape upward. Shape coordinates are (x, -z). y = bottom. */
export function slab(shape, h, color, o = {}) {
  const make = () => {
    const b = o.bevel ?? 0;
    const e = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * b, curveSegments: o.curve ?? 6, bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelOffset: -b, bevelSegments: 1 });
    return creased(e.translate(0, 0, b).rotateX(-Math.PI / 2));
  };
  return mesh(o.key ? once(`slab|${o.key}`, make) : make(), color, o);
}
/** Extrude a side silhouette (shape x = world z, shape y = world y) across the width, centred on x = 0. */
export function sideExtrude(shape, width, color, o = {}) {
  const make = () => {
    const b = o.bevel ?? 0;
    const e = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * b, curveSegments: o.curve ?? 6, bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelOffset: -b, bevelSegments: o.bevelSeg ?? 2 });
    return creased(e.translate(0, 0, -width / 2 + b).rotateY(-Math.PI / 2), o.crease ?? 0.7);
  };
  return mesh(o.key ? once(`side|${o.key}`, make) : make(), color, o);
}
/** Rounded-rectangle plan shape, centred. */
export function roundRect(w, d, r) {
  const s = new THREE.Shape(), x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}
/** Plan shape of a band of width t along a polyline of [x, z] points, with round end caps. */
export function ribbon(pts, t) {
  const L = [], R = [], n = pts.length, h = t / 2;
  let a = 0, a0 = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(i - 1, 0)], q = pts[Math.min(i + 1, n - 1)], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz);
    const nx = -dz / l, nz = dx / l;
    L.push([pts[i][0] + nx * h, pts[i][1] + nz * h]);
    R.push([pts[i][0] - nx * h, pts[i][1] - nz * h]);
    a = Math.atan2(nz, nx);
    if (i === 0) a0 = a;
  }
  const cap = (c, from) => Array.from({ length: 5 }, (_, i) => { const k = from - ((i + 1) / 6) * Math.PI; return [c[0] + Math.cos(k) * h, c[1] + Math.sin(k) * h]; });
  const line = [...L, ...cap(pts[n - 1], a), ...R.reverse(), ...cap(pts[0], a0 + Math.PI)];
  return new THREE.Shape(line.map(([x, z]) => new THREE.Vector2(x, -z)));
}

/** Open curved strip on a circle, for trim lines and curved sign plates. y = centre; deg = half angle. */
export function arcStrip(R, h, deg, color, o = {}) {
  const a = (deg * Math.PI) / 180, seg = o.seg ?? 22;
  const g = once(`arc|${R}|${h}|${deg}|${seg}`, () => new THREE.CylinderGeometry(R, R, h, seg, 1, true, -a, a * 2));
  return mesh(g, color, { shadow: false, ...o });
}

/** Keeps a prop root alive through bakeStatic's prune, so traversal still finds its tick hook. */
export function live(g, tick) {
  const keep = new THREE.Group();
  keep.userData.dynamic = true;
  g.add(keep);
  g.userData.tick = tick;
  return g;
}

// One shared glow per lamp type: baked meshes keep their material, so all of them brighten together for a single write.
export const nightLamp = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 0.4 });
const nightStrip = new THREE.MeshStandardMaterial({ color: C.tealLight, emissive: C.tealLight, emissiveIntensity: 0.5, roughness: 0.5 });
const nightListeners = [];
export const onNight = (fn) => nightListeners.push(fn);
let nightWas = -1;
export function applyNight(n = 0) {
  if (n === nightWas) return;
  nightWas = n;
  const k = smooth(0.2, 0.55, n);
  nightLamp.emissiveIntensity = k * 2.4;
  nightStrip.emissiveIntensity = 0.5 + k * 1.4;
  for (const fn of nightListeners) fn(k);
}

const signs = new Map();
let meas;
/** Cached signMat, with the type sized to fit the plate. */
export function sign(text, { w = 512, h = 128, weight = 600, size, ...rest } = {}) {
  const k = JSON.stringify([text, w, h, weight, size, rest]);
  if (!signs.has(k)) {
    meas ??= document.createElement('canvas').getContext('2d');
    meas.font = `${weight} 100px Inter, system-ui, sans-serif`;
    const px = Math.min(size ?? h * 0.56, ((w * 0.88) / meas.measureText(text).width) * 100);
    signs.set(k, signMat(text, { w, h, font: `${weight} ${Math.floor(px)}px Inter, system-ui, sans-serif`, ...rest }));
  }
  return signs.get(k);
}
/** Unlit sign face, for anything backlit. */
export function glowSign(text, { w = 512, h = 128, bg = C.white, fg = C.ink, font = '700 72px Inter, system-ui, sans-serif' } = {}) {
  return once(`glowsign|${text}|${bg}|${fg}`, () => new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4); }),
  }));
}

// Live desk screens. Every monitor of one kind shares a canvas, repainted in turn a few times a second.
const feeds = [];
function feed(name, paint, w = 256, h = 160) {
  return once(`feed|${name}`, () => {
    const tex = canvasTex(w, h, (x) => paint(x, w, h, 0));
    feeds.push({ tex, x: tex.image.getContext('2d'), w, h, paint });
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  });
}
let feedSlot = -1;
function pumpFeeds(t) {
  const s = Math.floor(t * 4);
  if (s === feedSlot || !feeds.length) return;
  feedSlot = s;
  const f = feeds[s % feeds.length];
  f.paint(f.x, f.w, f.h, t);
  f.tex.needsUpdate = true;
}
const paintBoard = (x, w, h, t) => {
  x.fillStyle = '#12232e'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1fa3a6'; x.fillRect(0, 0, w, 20);
  x.fillStyle = '#e8fbf6'; x.fillRect(8, 7, 74, 6); x.fillRect(w - 44, 7, 36, 6);
  const hot = Math.floor(t * 0.7) % 7;
  for (let i = 0; i < 7; i++) {
    const y = 27 + i * 19;
    x.fillStyle = i === hot ? '#265265' : '#182f3c'; x.fillRect(6, y, w - 12, 15);
    x.fillStyle = i % 3 === 0 ? '#f5b43a' : '#2fbf8f'; x.beginPath(); x.arc(16, y + 7.5, 4, 0, TAU); x.fill();
    x.fillStyle = '#a6c2cf'; x.fillRect(27, y + 5, 64 + ((i * 37) % 62), 5);
    x.fillStyle = '#5a7686'; x.fillRect(w - 62, y + 5, 46, 5);
  }
};
const beat = (u) => { const k = u % 1; return k < 0.06 ? Math.sin(k * 52) * 0.14 : k < 0.1 ? -0.2 : k < 0.135 ? 1 : k < 0.17 ? -0.34 : k > 0.3 && k < 0.42 ? Math.sin((k - 0.3) * 26) * 0.2 : 0; };
const paintVitals = (x, w, h, t) => {
  x.fillStyle = '#0d1b24'; x.fillRect(0, 0, w, h);
  const rows = [['#7cf0c8', 34], ['#7cc8ff', 84], ['#ffd27c', 132]];
  x.lineWidth = 2;
  for (let r = 0; r < 3; r++) {
    x.strokeStyle = rows[r][0]; x.beginPath();
    for (let px = 0; px <= 176; px += 2) {
      const v = beat(px / 62 + t * (0.9 + r * 0.13) + r * 0.3), y = rows[r][1] - v * 22;
      if (px) x.lineTo(px + 6, y); else x.moveTo(6, y);
    }
    x.stroke();
    x.fillStyle = rows[r][0]; x.fillRect(196, rows[r][1] - 16, 46, 22);
    x.fillStyle = '#0d1b24'; x.fillRect(200, rows[r][1] - 12, 38, 14);
    x.fillStyle = rows[r][0]; x.fillRect(204, rows[r][1] - 8, 8 + ((r * 13 + Math.floor(t)) % 22), 6);
  }
};
const paintChart = (x, w, h, t) => {
  x.fillStyle = '#10222e'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#7fe0dc'; x.fillRect(10, 10, 80, 7);
  for (let i = 0; i < 11; i++) {
    const v = 0.35 + 0.3 * Math.sin(i * 1.3 + t * 0.5) + 0.2 * Math.sin(i * 2.7), bar = 24 + v * 84;
    x.fillStyle = i === 7 ? '#ffb46a' : '#2fc4c4'; x.fillRect(12 + i * 15, 142 - bar, 10, bar);
  }
  x.lineWidth = 9;
  x.strokeStyle = '#21404f'; x.beginPath(); x.arc(208, 56, 26, 0, TAU); x.stroke();
  x.strokeStyle = '#a58be0'; x.beginPath(); x.arc(208, 56, 26, -1.57, -1.57 + 3.6 + Math.sin(t * 0.4) * 0.6); x.stroke();
  x.fillStyle = '#a6c2cf'; x.fillRect(180, 106, 56, 6); x.fillRect(180, 120, 40, 6);
};
const screens = () => ({ board: feed('board', paintBoard), vitals: feed('vitals', paintVitals), chart: feed('chart', paintChart) });

/** Slim desk monitor; the screen faces local +Z. */
function monitor(screen, { x = 0, y = 0, z = 0, ry = 0, w = 0.52, h = 0.32, stand = 0.11 } = {}) {
  const g = group(
    soft(0.2, 0.012, 0.14, C.charcoal, { r: 0.005 }),
    chip(0.035, stand + 0.04, 0.02, C.charcoal, { z: -0.03 }),
    soft(w, h, 0.03, '#454b57', { y: stand, r: 0.012, z: -0.008 }),
    chip(w * 0.5, h * 0.55, 0.03, '#59606d', { y: stand + h * 0.2, z: -0.03 }),
    panel(w - 0.028, h - 0.028, screen, { y: stand + 0.014, z: 0.0085 }),
  );
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}
const keyboard = (x, y, z, ry = 0) => group(
  soft(0.36, 0.016, 0.12, '#e3e6ec', { x, y, z, ry, r: 0.006 }),
  chip(0.32, 0.003, 0.085, '#c4c9d3', { x, y: y + 0.016, z, ry }),
  soft(0.05, 0.016, 0.08, '#e3e6ec', { x: x + Math.cos(ry) * 0.25, y, z: z - Math.sin(ry) * 0.25, r: 0.007 }),
);
const mug = (x, y, z, color = C.teal) => group(
  cyl(0.036, 0.032, 0.08, color, { x, y, z, seg: 8 }),
  cyl(0.03, 0.03, 0.004, C.woodDeep, { x, y: y + 0.074, z, seg: 8, shadow: false }),
);
/** Office chair at a seat point. Seats sit just outside the desk footprint, and a seated person needs something under them. */
function deskChair(x, z, ry = 0, color = C.teal) {
  const g = group(
    contact(0.55, 0.55, 0.28),
    chip(0.5, 0.03, 0.06, C.charcoal, { y: 0.05 }), chip(0.06, 0.03, 0.5, C.charcoal, { y: 0.05 }),
    cyl(0.024, 0.024, 0.32, C.steel, { y: 0.08, seg: 8 }),
    plump(0.47, 0.09, 0.45, color, { y: 0.41 }),
    chip(0.05, 0.3, 0.03, C.charcoal, { y: 0.42, z: -0.22 }),
    plump(0.43, 0.43, 0.075, color, { y: 0.54, z: -0.235, rx: -0.09 }),
  );
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  return g;
}

// ── plants ───────────────────────────────────────────────
const bladeMat = () => once('bladeMat', () => new THREE.MeshStandardMaterial({
  side: THREE.DoubleSide, roughness: 0.56,
  map: canvasTex(32, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#176b3e'); g.addColorStop(0.45, '#23934f'); g.addColorStop(1, '#4ec86e');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(190,240,170,.42)'; x.fillRect(w / 2 - 1.5, 0, 3, h);
    x.fillStyle = 'rgba(10,50,30,.24)'; x.fillRect(0, 0, 4, h); x.fillRect(w - 4, 0, 4, h);
  }),
}));
// A blade rises, then arches over, with a V-fold along the midrib so each side catches a different tone.
function blade(len, width, a0, a1, n = 5) {
  const pos = [], uv = [], idx = [];
  let y = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = a0 + (a1 - a0) * s * s;
    const hw = (width / 2) * Math.min(1, 0.35 + s * 3.2) * (1 - s ** 2.4), fold = hw * 0.55, ny = Math.sin(a), nz = -Math.cos(a);
    pos.push(-hw, y + ny * fold, z + nz * fold, 0, y, z, hw, y + ny * fold, z + nz * fold);
    uv.push(0, s, 0.5, s, 1, s);
    y += (Math.cos(a) * len) / n;
    z += (Math.sin(a) * len) / n;
    if (i < n) { const k = i * 3; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A fountain of blades. k runs from the upright core to the drooping outer ring. */
function tuftGeo(name, count, len, width, droop = 1) {
  return once(`tuft|${name}`, () => {
    const r = rng(count + name.length * 7), parts = [];
    for (let i = 0; i < count; i++) {
      const k = (i + 0.5) / count;
      const b = blade(len * (0.74 + 0.3 * Math.sin(k * Math.PI) + r() * 0.1), width * (0.85 + r() * 0.3), 0.1 + k * 0.62, (0.42 + k * 1.5) * droop);
      b.rotateY(i * 2.39996 + r() * 0.4);
      parts.push(b);
    }
    return mergeGeometries(parts, false);
  });
}
// A soft-shouldered lathed pot: the cream planter every plant in the reference stands in.
const potGeo = () => once('pot', () => new THREE.LatheGeometry(
  [[0.001, 0], [0.62, 0], [0.7, 0.04], [0.82, 0.42], [0.9, 0.82], [0.9, 0.9], [1, 0.92], [1, 1], [0.93, 1], [0.85, 0.94]].map(([x, y]) => new THREE.Vector2(x, y)), 14,
));
const pot = (r, h, color = C.pot) => group(
  mesh(potGeo(), mat(color, { rough: 0.5 }), { sx: r, sy: h, sz: r }),
  cyl(r * 0.86, r * 0.86, 0.01, '#6d4c3a', { y: h * 0.9, seg: 12, shadow: false }),
);

prop('plantBig', (o = {}) => {
  const g = group(contact(0.72, 0.72, 0.42), pot(o.potR ?? 0.27, 0.4, o.pot ?? C.pot)), lean = rng(nextSeed());
  const stems = [[-0.06, 0.03, 0.58, -0.05, 0], [0.07, -0.05, 0.84, 0.06, 1], [0, 0.07, 1.2, 0.02, 2]];
  const spin = lean() * TAU;
  for (const [x, z, top, tip, i] of stems) {
    g.add(tube([[x, 0.34, z], [x + tip * 0.5, top * 0.6, z], [x + tip, top, z - tip]], 0.018, C.trunk, { seg: 4, radial: 5 }));
    g.add(mesh(tuftGeo(`big${i}`, i === 2 ? 18 : 16, i === 2 ? 0.74 : 0.62, 0.085), bladeMat(), { x: x + tip, y: top, z: z - tip, ry: spin + i * 1.4 }));
  }
  return g;
});
prop('plantSmall', (o = {}) => {
  const g = group(contact(0.34, 0.34, 0.4), pot(0.15, 0.24, o.pot ?? C.pot));
  g.add(mesh(tuftGeo('small', 15, 0.5, 0.075, 0.9), bladeMat(), { y: 0.2, ry: nextSeed() * 1.7 }));
  return g;
});

// ── seating ──────────────────────────────────────────────
const feet = (g, xs, zs, color = C.woodDeep) => { for (const x of xs) for (const z of zs) g.add(cyl(0.036, 0.024, 0.09, color, { x, z, seg: 8 })); };

prop('sofa', (o = {}) => {
  const body = o.color ?? '#27c3cc', seat = o.cushion ?? '#5ddfe0', deep = o.deep ?? C.tealDeep;
  const g = group(contact(2.1, 0.9, 0.46));
  feet(g, [-0.9, 0.9], [-0.33, 0.33]);
  g.add(soft(2.0, 0.2, 0.82, deep, { y: 0.08, r: 0.06 }));
  g.add(plump(2.08, 0.72, 0.32, body, { y: 0.12, z: -0.28 }));
  for (const x of [-0.92, 0.92]) g.add(plump(0.26, 0.54, 0.88, body, { x, y: 0.1 }));
  for (const x of [-0.4, 0.4]) {
    g.add(plump(0.81, 0.24, 0.68, seat, { x, y: 0.26, z: 0.08 }));
    g.add(plump(0.79, 0.44, 0.22, body, { x, y: 0.42, z: -0.13, rx: -0.14 }));
  }
  g.add(plump(0.34, 0.33, 0.12, o.pillow ?? '#ffd978', { x: -0.66, y: 0.48, z: 0.02, rx: -0.35, ry: 0.42, rz: 0.16 }));
  return g;
});
prop('armchair', (o = {}) => {
  const body = o.color ?? '#f1e7da', deep = o.deep ?? '#dccdbb';
  const g = group(contact(0.95, 0.9, 0.44));
  feet(g, [-0.36, 0.36], [-0.34, 0.34]);
  g.add(soft(0.86, 0.17, 0.8, deep, { y: 0.08, r: 0.05 }));
  g.add(plump(0.94, 0.72, 0.3, body, { y: 0.12, z: -0.3 }));
  for (const x of [-0.355, 0.355]) g.add(plump(0.24, 0.5, 0.86, body, { x, y: 0.11 }));
  g.add(plump(0.54, 0.24, 0.64, body, { y: 0.25, z: 0.09 }));
  g.add(plump(0.33, 0.33, 0.13, o.pillow ?? C.teal, { y: 0.46, z: -0.08, rx: -0.3, rz: 0.12 }));
  return g;
});
prop('chair', (o = {}) => {
  const pad = o.color ?? C.teal, frame = o.frame ?? C.woodDeep;
  const g = group(contact(0.48, 0.48, 0.34));
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) g.add(cyl(0.02, 0.014, 0.42, frame, { x, z, seg: 6, rx: z * 0.32, rz: -x * 0.32 }));
  g.add(soft(0.44, 0.03, 0.42, C.white, { y: 0.4, r: 0.014 }));
  g.add(plump(0.44, 0.075, 0.42, pad, { y: 0.42 }));
  g.add(plump(0.42, 0.37, 0.07, pad, { y: 0.48, z: -0.19, rx: -0.11 }));
  return g;
});
prop('waitingRow', (o = {}) => {
  const pad = o.color ?? C.teal;
  const g = group(contact(2.5, 0.65, 0.34));
  g.add(soft(2.42, 0.05, 0.09, C.steelDeep, { y: 0.34, z: -0.04, r: 0.02 }));
  for (const x of [-1.0, 1.0]) g.add(chip(0.07, 0.36, 0.07, C.steel, { x, z: -0.04 }), chip(0.09, 0.03, 0.56, C.steelDeep, { x, z: -0.03 }));
  for (const x of [-0.8, 0, 0.8]) {
    g.add(chip(0.66, 0.03, 0.48, C.white, { x, y: 0.385, z: 0.05 }));
    g.add(plump(0.68, 0.085, 0.5, pad, { x, y: 0.405, z: 0.05 }));
    g.add(plump(0.66, 0.38, 0.075, pad, { x, y: 0.46, z: -0.235, rx: -0.13 }));
  }
  for (const x of [-1.2, -0.4, 0.4, 1.2]) g.add(chip(0.05, 0.03, 0.32, C.charcoal, { x, y: 0.6, z: 0.0 }), chip(0.03, 0.18, 0.03, C.steel, { x, y: 0.42, z: -0.05 }));
  return g;
});
prop('coffeeTable', (o = {}) => {
  const g = group(contact(1.15, 0.6, 0.32));
  for (const x of [-0.5, 0.5]) for (const z of [-0.23, 0.23]) g.add(cyl(0.025, 0.018, 0.36, C.woodDeep, { x, z, seg: 8 }));
  g.add(soft(1.2, 0.055, 0.65, o.color ?? C.wood, { y: 0.365, r: 0.024 }));
  g.add(soft(1.0, 0.018, 0.46, C.woodLight, { y: 0.14, r: 0.008 }));
  g.add(soft(0.3, 0.012, 0.22, C.coral, { x: -0.26, y: 0.42, ry: 0.22, r: 0.004 }), soft(0.27, 0.012, 0.2, C.white, { x: -0.25, y: 0.432, ry: -0.1, r: 0.004 }));
  g.add(mug(0.28, 0.42, 0.08, C.white));
  return g;
});
prop('tableRound', (o = {}) => {
  const g = group(contact(0.72, 0.72, 0.34));
  g.add(cyl(0.3, 0.32, 0.03, C.steelDeep, { seg: 16 }), cyl(0.035, 0.05, 0.68, C.steel, { y: 0.03, seg: 10 }));
  g.add(cyl(0.55, 0.53, 0.04, o.color ?? C.trimWarm, { y: 0.71, seg: 24 }), cyl(0.532, 0.51, 0.016, C.woodDeep, { y: 0.694, seg: 24 }));
  g.add(mug(0.14, 0.75, 0.1, C.teal), mug(-0.18, 0.75, -0.06, C.coral), cyl(0.05, 0.05, 0.11, C.woodLight, { y: 0.75, z: -0.22, x: 0.12, seg: 8 }));
  return g;
});

// ── counters ─────────────────────────────────────────────
const LEDGE = '#14b4bd';
function bowPlan(w, d, bow) {
  const s = new THREE.Shape(), r = 0.14, x = w / 2, back = d / 2, side = -(d / 2 - bow);
  s.moveTo(-x + r, back); s.lineTo(x - r, back); s.quadraticCurveTo(x, back, x, back - r);
  s.lineTo(x, side + r); s.quadraticCurveTo(x, side, x - r, side - bow * 0.09);
  s.quadraticCurveTo(0, -(d / 2 + bow) + bow * 0.1, -x + r, side - bow * 0.09);
  s.quadraticCurveTo(-x, side, -x, side + r); s.lineTo(-x, back - r); s.quadraticCurveTo(-x, back, -x + r, back);
  return s;
}
/** Bow-fronted counter: white body, wood worktop behind a raised band, chunky coloured ledge, curved sign plate. */
function counter(g, { w, d, bow, h = 1.1, band = 0.32, accent = LEDGE, deep = C.tealDeep, stripe = C.stripe, label, plateW = 2.2, plateH = 0.4 }) {
  const id = `${w}|${d}|${bow}|${h}`, plan = bowPlan(w, d, bow), top = h - 0.1, work = 0.74;
  const front = (t) => Array.from({ length: 17 }, (_, i) => {
    const x = (i / 16 - 0.5) * (w - t - 0.04);
    return [x, d / 2 - bow * ((2 * x) / w) ** 2 - t / 2 - 0.004];
  });
  const R = (w * w * 0.25 + bow * bow) / (2 * bow), a = plateW / R;
  g.add(slab(plan, 0.1, deep, { key: `toe${id}`, sx: 0.985, sz: 0.96 }));
  g.add(slab(plan, work - 0.1, C.white, { key: `body${id}`, y: 0.1 }));
  g.add(slab(plan, 0.04, C.woodLight, { key: `work${id}`, y: work, bevel: 0.01 }));
  g.add(slab(ribbon(front(band), band), top - work, C.white, { key: `band${id}`, y: work + 0.02 }));
  g.add(slab(ribbon(front(band + 0.03), band + 0.03), 0.028, stripe, { key: `stripe${id}`, y: work - 0.03 }));
  g.add(slab(ribbon(front(band + 0.1), band + 0.1), 0.1, accent, { key: `ledge${id}`, y: top, bevel: 0.03 }));
  // Under-counter glow strip: reads as premium at night and keeps a dark floor line off the white body.
  g.add(arcStrip(R - 0.006, 0.018, (w / R / 2) * (180 / Math.PI) * 0.92, nightStrip, { y: 0.09, z: d / 2 - R }));
  for (const x of [-w * 0.3, 0, w * 0.3]) g.add(soft(w * 0.2, work - 0.16, 0.03, C.offWhite, { x, y: 0.12, z: -d / 2 - 0.002, r: 0.012 }));
  if (label) {
    g.add(arcStrip(R + 0.014, plateH, (a / 2) * (180 / Math.PI), sign(label, { w: 1024, h: Math.round((1024 * plateH) / plateW), bg: '#ffffff', fg: '#4f62a0', radius: 34 }), { y: 0.41, z: d / 2 - R, seg: 14 }));
  }
}
const welcomeScreen = () => once('welcome', () => new THREE.MeshBasicMaterial({
  toneMapped: false,
  map: canvasTex(128, 96, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2fc4c4'); g.addColorStop(1, '#7fe0dc');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 62); x.bezierCurveTo(30, 40, 40, 16, 64, 30); x.bezierCurveTo(88, 16, 98, 40, 64, 62); x.fill();
    x.fillRect(38, 74, 52, 6);
  }),
}));
const tablet = (x, y, z) => group(
  chip(0.12, 0.02, 0.1, C.charcoal, { x, y, z }),
  soft(0.26, 0.19, 0.016, C.ink, { x, y: y + 0.03, z, rx: -0.5, r: 0.006 }),
  panel(0.235, 0.165, welcomeScreen(), { x, y: y + 0.046, z: z + 0.016, rx: -0.5 }),
);
const vase = (x, y, z) => {
  const g = group(cyl(0.05, 0.035, 0.13, C.white, { seg: 8 }), tube([[0, 0.1, 0], [0.02, 0.2, 0.01], [0.05, 0.27, 0]], 0.005, C.leafDeep, { seg: 4, radial: 4 }), tube([[0, 0.1, 0], [-0.03, 0.2, 0], [-0.04, 0.25, 0.03]], 0.005, C.leafDeep, { seg: 4, radial: 4 }));
  for (const [a, b, c, col] of [[0.05, 0.28, 0, C.coral], [-0.04, 0.26, 0.03, C.lineYellow], [0.01, 0.24, -0.03, C.rose]]) g.add(dot(0.032, col, { x: a, y: b, z: c }));
  g.position.set(x, y, z);
  return g;
};
const paperTray = (x, y, z, ry = 0) => group(soft(0.3, 0.05, 0.23, C.steelDeep, { x, y, z, ry, r: 0.01 }), chip(0.27, 0.02, 0.2, C.white, { x, y: y + 0.04, z, ry }));

prop('receptionDesk', (o = {}) => {
  const g = group(contact(5.2, 1.5, 0.36)), s = screens();
  counter(g, { w: 5.2, d: 1.5, bow: 0.4, h: 1.1, band: 0.32, label: o.label ?? 'Reception', plateW: 2.3, plateH: 0.5 });
  for (const [x, ry] of [[-1.3, Math.PI + 0.1], [1.3, Math.PI - 0.1]]) {
    g.add(monitor(s.board, { x, y: 0.78, z: -0.12, ry }));
    g.add(keyboard(x, 0.78, -0.48));
  }
  g.add(monitor(s.chart, { x: 0.68, y: 0.78, z: -0.02, ry: Math.PI + 0.38, w: 0.42, h: 0.27 }));
  g.add(paperTray(-0.3, 0.78, -0.3, 0.12), soft(0.22, 0.05, 0.16, C.charcoal, { x: 0.15, y: 0.78, z: -0.42, r: 0.012 }), chip(0.05, 0.03, 0.15, C.ink, { x: 0.23, y: 0.82, z: -0.42 }));
  g.add(mug(-0.9, 0.78, -0.52, C.coral), mug(1.85, 0.78, -0.42, C.white));
  g.add(tablet(-1.25, 1.1, 0.42), tablet(1.25, 1.1, 0.42));
  g.add(vase(-2.1, 1.1, 0.12), cyl(0.05, 0.06, 0.03, C.steel, { x: 0.28, y: 1.1, z: 0.5, seg: 10 }), ball(0.042, matMetal('#e8c76a'), { x: 0.28, y: 1.15, z: 0.5, seg: 10 }));
  if (o.chairs !== false) for (const x of [-1.3, 1.3]) g.add(deskChair(x, -0.95));
  return live(g, (dt, t, ctx) => { pumpFeeds(t); applyNight(ctx?.night); });
});

prop('nurseStation', (o = {}) => {
  const g = group(contact(5.0, 2.5, 0.26)), s = screens(), cz = -1.3;
  const arc = (R, deg = 83, n = 22) => Array.from({ length: n + 1 }, (_, i) => { const a = ((i / n - 0.5) * 2 * deg * Math.PI) / 180; return [R * Math.sin(a), cz + R * Math.cos(a)]; });
  const at = (deg, r, y, z = 0) => { const a = (deg * Math.PI) / 180; return { x: r * Math.sin(a), y, z: cz + r * Math.cos(a) + z, ry: a + Math.PI }; };
  g.add(slab(ribbon(arc(2.46), 0.26), 0.1, C.plastic, { key: 'ns0' }));
  g.add(slab(ribbon(arc(2.455), 0.28), 0.9, C.white, { key: 'ns1', y: 0.1, curve: 4 }));
  g.add(arcStrip(2.604, 0.026, 81, C.teal, { y: 0.15, z: cz, seg: 44 }));
  g.add(slab(ribbon(arc(2.385), 0.43), 0.1, LEDGE, { key: 'ns2', y: 1.0, bevel: 0.03 }));
  g.add(slab(ribbon(arc(2.07, 85), 0.62), 0.04, C.woodLight, { key: 'ns3', y: 0.74, bevel: 0.01 }));
  g.add(slab(ribbon(arc(2.28, 83), 0.3), 0.72, C.offWhite, { key: 'ns4', y: 0.02, curve: 4 }));
  // Glow line along the toe, same as the reception counter.
  g.add(arcStrip(2.585, 0.02, 81, nightStrip, { y: 0.09, z: cz, seg: 44 }));
  g.add(arcStrip(2.616, 0.42, 25, sign(o.label ?? 'Nurse on duty', { w: 1024, h: 186, bg: '#ffffff', fg: '#4f62a0', radius: 40, size: 118 }), { y: 0.62, z: cz, seg: 18 }));
  for (const [deg, screen] of [[-66, s.vitals], [-37, s.board], [37, s.vitals], [66, s.chart]]) g.add(monitor(screen, at(deg, 2.2, 0.76)));
  for (const deg of [-50, 50]) { const p = at(deg, 1.95, 0.78); g.add(keyboard(p.x, p.y, p.z, p.ry)); }
  { const p = at(-11, 2.1, 0.78); g.add(paperTray(p.x, p.y, p.z, p.ry)); }
  { const p = at(11, 2.08, 0.78); g.add(soft(0.22, 0.05, 0.16, C.charcoal, { ...p, r: 0.012 }), mug(p.x + 0.3, 0.78, p.z + 0.02, C.coral)); }
  { const p = at(-24, 2.42, 1.1); g.add(vase(p.x, p.y, p.z)); }
  { const p = at(21, 2.4, 1.1); g.add(soft(0.24, 0.015, 0.31, C.white, { x: p.x, y: p.y, z: p.z, ry: 0.3, r: 0.005 }), chip(0.08, 0.02, 0.05, C.steelDeep, { x: p.x - 0.03, y: p.y + 0.01, z: p.z + 0.13, ry: 0.3 })); }
  if (o.chairs !== false) for (const x of [-1.2, 1.2]) g.add(deskChair(x, -0.3, 0, C.tealLight));
  return live(g, (dt, t, ctx) => { pumpFeeds(t); applyNight(ctx?.night); });
});

prop('triageDesk', (o = {}) => {
  const g = group(contact(2.4, 0.9, 0.36)), s = screens();
  counter(g, { w: 2.4, d: 0.9, bow: 0.2, h: 1.05, band: 0.2, accent: C.coral, deep: C.coralDeep, label: o.label ?? 'Triage', plateW: 1.3, plateH: 0.46 });
  g.add(monitor(s.vitals, { x: -0.3, y: 0.78, z: -0.02, ry: Math.PI + 0.1, w: 0.46, h: 0.28 }), keyboard(-0.3, 0.78, -0.3), paperTray(0.72, 0.78, -0.16, 0.1), mug(0.35, 0.78, -0.22, C.white));
  if (o.chairs !== false) g.add(deskChair(0, -0.75, 0, C.coral));
  return live(g, (dt, t, ctx) => { pumpFeeds(t); applyNight(ctx?.night); });
});

const deskFrame = (g, w, d, h, top = C.woodLight) => {
  g.add(soft(w, 0.045, d, top, { y: h - 0.045, r: 0.018 }));
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) g.add(soft(0.05, h - 0.045, d - 0.08, C.offWhite, { x, r: 0.014 }));
  g.add(chip(w - 0.14, 0.32, 0.02, C.offWhite, { y: h - 0.39, z: d / 2 - 0.1 }));
};
const pedestal = (g, x, z, h = 0.68) => {
  g.add(soft(0.42, h, 0.5, C.offWhite, { x, z, y: 0.02, r: 0.018 }));
  for (let i = 0; i < 3; i++) g.add(soft(0.38, h / 3 - 0.02, 0.012, C.plastic, { x, z: z - 0.252, y: 0.03 + (i * h) / 3, r: 0.005 }), chip(0.14, 0.012, 0.012, C.steelDeep, { x, z: z - 0.26, y: 0.03 + (i + 0.72) * (h / 3) }));
};
prop('workstation', (o = {}) => {
  const g = group(contact(1.5, 0.75, 0.34)), s = screens();
  deskFrame(g, 1.5, 0.75, 0.74);
  pedestal(g, 0.46, 0.05);
  g.add(monitor(o.screen === 'vitals' ? s.vitals : s.board, { y: 0.74, z: 0.14, ry: Math.PI, w: 0.62, h: 0.37 }));
  g.add(keyboard(-0.04, 0.74, -0.14), mug(0.42, 0.74, -0.08, C.coral), paperTray(-0.5, 0.74, 0.03, -0.12));
  g.add(tube([[0.04, 0.78, 0.26], [0.2, 0.72, 0.36], [0.3, 0.3, 0.34], [0.2, 0.03, 0.3]], 0.008, C.ink, { seg: 10, radial: 4 }));
  if (o.chairs !== false) g.add(deskChair(0, -0.7));
  return live(g, (dt, t) => { pumpFeeds(t); });
});
const i3 = (x) => matGlow(x < 0 ? C.ok : x > 0 ? C.info : C.watch, 1.2);
prop('controlDesk', (o = {}) => {
  const g = group(contact(2.8, 0.85, 0.36)), s = screens();
  g.add(soft(2.8, 0.7, 0.62, C.offWhite, { z: 0.115, r: 0.03 }), chip(2.5, 0.02, 0.6, C.steelDeep, { y: 0.05, z: 0.11 }));
  g.add(soft(2.8, 0.05, 0.85, C.charcoal, { y: 0.7, r: 0.02 }));
  g.add(soft(2.6, 0.13, 0.3, C.plastic, { y: 0.75, z: 0.25, r: 0.025 }));
  for (const x of [-0.93, 0, 0.93]) {
    g.add(soft(0.84, 0.5, 0.012, C.plastic, { x, y: 0.12, z: 0.426, r: 0.006 }));
    for (let i = 0; i < 4; i++) g.add(chip(0.5, 0.012, 0.004, C.steelDeep, { x, y: 0.2 + i * 0.05, z: 0.433 }));
    g.add(chip(0.05, 0.05, 0.004, i3(x), { x: x + 0.33, y: 0.53, z: 0.433 }));
  }
  const panelMat = once('consoleKeys', () => new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTex(256, 32, (x, w, h) => {
      x.fillStyle = '#2c333e'; x.fillRect(0, 0, w, h);
      const c = ['#7cf0c8', '#ffd27c', '#7cc8ff', '#ff8a7a'];
      for (let i = 0; i < 26; i++) { x.fillStyle = c[(i * 7) % 4]; x.fillRect(8 + i * 9, 8 + (i % 2) * 9, 6, 6); }
    }),
  }));
  g.add(panel(0.9, 0.11, panelMat, { y: 0.755, z: -0.102, ry: Math.PI }));
  const list = [[-0.98, s.vitals, 0.2], [-0.34, s.chart, 0.06], [0.34, s.board, -0.06], [0.98, s.vitals, -0.2]];
  for (const [x, feed, turn] of list) g.add(monitor(feed, { x, y: 0.88, z: 0.24, ry: Math.PI + turn, w: 0.6, h: 0.34, stand: 0.03 }));
  g.add(keyboard(-0.7, 0.75, -0.2), keyboard(0.7, 0.75, -0.2), mug(0.1, 0.75, -0.22, C.white));
  if (o.chairs !== false) for (const x of [-0.7, 0.7]) g.add(deskChair(x, -0.8));
  return live(g, (dt, t) => { pumpFeeds(t); });
});

// ── storage ──────────────────────────────────────────────
// A folded stack as one extruded side profile with a bulge per layer: reads as separate towels for one rounded box's cost.
const towelGeo = (layers) => once(`towel${layers}`, () => {
  const t = 0.058, d = 0.44, w = 0.38, s = new THREE.Shape(), H = layers * t;
  s.moveTo(-d / 2, 0); s.lineTo(d / 2 - 0.012, 0);
  for (let i = 0; i < layers; i++) s.quadraticCurveTo(d / 2 + 0.014, (i + 0.5) * t, d / 2 - 0.012, (i + 1) * t);
  s.quadraticCurveTo(d / 2 - 0.02, H + 0.008, d / 2 - 0.05, H + 0.008);
  s.lineTo(-d / 2 + 0.03, H + 0.004); s.quadraticCurveTo(-d / 2, H, -d / 2, H - 0.02);
  const e = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 2 });
  return creased(e.translate(0, 0, -w / 2).rotateY(-Math.PI / 2), 0.85, 20);
});
const wireMat = () => once('wire', () => new THREE.MeshStandardMaterial({
  roughness: 0.6, metalness: 0.2,
  map: canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#3c414c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c9ced8';
    for (let i = 0; i < 8; i++) x.fillRect(0, 4 + i * 8, w, 3);
  }, { repeat: [1, 1] }),
}));
prop('linenShelf', (o = {}) => {
  const g = group(contact(2.4, 0.6, 0.42)), r = rng(o.seed ?? nextSeed()), post = C.plastic, W = 2.36, D = 0.54;
  for (const x of [-1.15, -0.385, 0.385, 1.15]) for (const z of [-0.26, 0.26]) g.add(cyl(0.017, 0.017, 1.95, post, { x, z, seg: 6 }));
  for (const x of [-1.15, 1.15]) {
    for (const y of [0.3, 1.0]) g.add(tube([[x, y, -0.26], [x, y + 0.7, 0.26]], 0.006, C.steel, { seg: 1, radial: 4 }));
    g.add(ball(0.024, post, { x, y: 1.95, z: 0.26, seg: 8 }), ball(0.024, post, { x, y: 1.95, z: -0.26, seg: 8 }));
  }
  const levels = [0.12, 0.47, 0.82, 1.17, 1.52];
  for (const y of levels) {
    g.add(flat(W, D, wireMat(), { y: y + 0.012, receive: true }));
    g.add(chip(W, 0.024, 0.02, post, { y, z: 0.268 }), chip(W, 0.024, 0.02, post, { y, z: -0.268 }));
    for (const x of [-1.15, -0.385, 0.385, 1.15]) g.add(chip(0.02, 0.024, D, C.steel, { x, y }));
    for (let i = 0; i < 5; i++) {
      const pick = r(), size = r(), color = pick < 0.05 ? '#86b7c9' : pick < 0.11 ? '#d3e2ec' : '#fbfcfe';
      const layers = size > 0.62 ? 3 : size > 0.16 ? 2 : 4;
      g.add(mesh(towelGeo(layers), mat(color, { rough: 0.92 }), { x: -0.94 + i * 0.47 + (r() - 0.5) * 0.03, y: y + 0.022, z: (r() - 0.5) * 0.05, ry: (r() - 0.5) * 0.09 }));
    }
  }
  return g;
});
const lockerFace = () => once('lockerFace', () => new THREE.MeshStandardMaterial({
  transparent: true, roughness: 0.5,
  map: canvasTex(512, 480, (x, w) => {
    x.font = '700 22px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx = (w / 4) * (i + 0.5);
      x.fillStyle = 'rgba(40,70,100,.45)';
      for (let k = 0; k < 5; k++) { x.beginPath(); x.roundRect(cx - 40, 34 + k * 13, 80, 7, 3); x.fill(); }
      x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(cx - 30, 118, 60, 34, 8); x.fill();
      x.fillStyle = C.ink; x.fillText(String(i + 11), cx, 136);
    }
  }),
}));
prop('locker', (o = {}) => {
  const g = group(contact(1.9, 0.55, 0.4));
  g.add(soft(1.9, 1.95, 0.5, C.offWhite, { z: -0.025, r: 0.03 }));
  g.add(chip(1.82, 0.08, 0.05, C.steelDeep, { y: 0, z: 0.21 }));
  const w = 0.445;
  for (let i = 0; i < 4; i++) {
    const x = -0.8925 + w * (i + 0.5);
    g.add(soft(w - 0.022, 1.78, 0.04, o.color ?? (i % 2 ? C.wainscot : C.wainscotDeep), { x, y: 0.1, z: 0.24, r: 0.012 }));
    g.add(soft(0.03, 0.2, 0.03, C.steelDeep, { x: x + 0.15, y: 0.86, z: 0.262, r: 0.012 }));
  }
  g.add(panel(1.78, 1.68, lockerFace(), { y: 0.15, z: 0.2615 }));
  return g;
});
prop('vending', () => {
  const g = group(contact(1.05, 0.85, 0.44)), body = '#f0766c', wx = -0.12;
  g.add(soft(1.04, 1.93, 0.58, body, { y: 0.02, z: -0.13, r: 0.05, seg: 2 }));
  g.add(soft(1.04, 0.44, 0.3, body, { y: 0.02, z: 0.27, r: 0.04 }), soft(1.04, 0.25, 0.3, body, { y: 1.7, z: 0.27, r: 0.04 }));
  g.add(soft(0.3, 1.32, 0.3, body, { x: 0.37, y: 0.42, z: 0.27, r: 0.03 }), soft(0.06, 1.32, 0.3, body, { x: -0.49, y: 0.42, z: 0.27, r: 0.02 }));
  g.add(panel(0.74, 1.3, matGlow('#ffdfb0', 0.5), { x: wx, y: 0.43, z: 0.165 }));
  const tones = ['#ff4f5e', '#12b3b8', '#ffbe1f', '#2f7fea', '#7d55dc', '#ff6d9c', '#2fc46c', '#ff8a3c'], r = rng(29);
  for (let row = 0; row < 5; row++) {
    const y = 0.5 + row * 0.245;
    g.add(chip(0.72, 0.012, 0.22, '#dfe3ea', { x: wx, y: y - 0.012, z: 0.28 }), chip(0.72, 0.008, 0.012, matGlow('#ffffff', 1.2), { x: wx, y: y + 0.205, z: 0.37 }));
    for (let i = 0; i < 5; i++) {
      const c = tones[Math.floor(r() * tones.length)], h = 0.12 + r() * 0.05, x = wx - 0.28 + i * 0.14;
      const look = mat(c, { emissive: c, emissiveIntensity: 0.22, rough: 0.5 });
      if (row % 2) g.add(cyl(0.05, 0.05, h, look, { x, y, z: 0.29, seg: 8 }));
      else g.add(chip(0.118, h, 0.09, look, { x, y, z: 0.29 }));
    }
  }
  g.add(panel(0.74, 1.3, matGlass('#eaf6ff', 0.07), { x: wx, y: 0.43, z: 0.415, receive: false }));
  g.add(soft(0.2, 1.06, 0.02, C.offWhite, { x: 0.37, y: 0.54, z: 0.42, r: 0.008 }));
  g.add(panel(0.15, 0.09, glowSign('2.50', { w: 128, h: 80, bg: '#14262f', fg: '#7cf0c8', font: '700 44px "JetBrains Mono Variable", ui-monospace, monospace' }), { x: 0.37, y: 1.44, z: 0.4315 }));
  for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) g.add(chip(0.034, 0.028, 0.008, a === 3 && b === 2 ? C.ok : C.steelDeep, { x: 0.32 + b * 0.05, y: 1.14 + a * 0.05, z: 0.432 }));
  g.add(chip(0.1, 0.014, 0.008, C.ink, { x: 0.37, y: 1.05, z: 0.432 }), chip(0.12, 0.06, 0.008, C.ink, { x: 0.37, y: 0.74, z: 0.432 }));
  g.add(soft(0.72, 0.24, 0.02, C.charcoal, { x: wx, y: 0.13, z: 0.415, r: 0.012 }), soft(0.62, 0.14, 0.02, '#4e5461', { x: wx, y: 0.18, z: 0.42, rx: 0.08, r: 0.01 }));
  g.add(panel(0.94, 0.17, glowSign('Snacks', { w: 512, h: 90, bg: '#fff6e4', fg: '#e4606a', font: '800 62px Inter, system-ui, sans-serif' }), { y: 1.76, z: 0.4215 }));
  return g;
});

// ── kiosk ────────────────────────────────────────────────
const plankMat = () => once('planks', () => new THREE.MeshStandardMaterial({
  roughness: 0.7,
  map: canvasTex(512, 256, (x, w, h) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      x.fillStyle = ['#c79a6b', '#bd8e60', '#d0a678', '#c39467'][i % 4]; x.fillRect((i * w) / n, 0, w / n, h);
      x.fillStyle = 'rgba(90,55,30,.5)'; x.fillRect((i * w) / n, 0, 2, h);
    }
  }),
}));
const menuMat = () => once('menu', () => new THREE.MeshStandardMaterial({
  roughness: 0.75,
  map: canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#2c3a3c'; x.fillRect(0, 0, w, h);
    x.strokeStyle = C.woodLight; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    x.fillStyle = '#fff6e4'; x.textAlign = 'left'; x.font = 'italic 46px "Instrument Serif", Georgia, serif'; x.fillText('Today', 32, 60);
    x.font = '500 27px Inter, system-ui, sans-serif';
    [['Flat white', '3.40'], ['Filter coffee', '2.60'], ['Chai latte', '3.60'], ['Lemon cake', '3.20']].forEach(([a, b], i) => {
      x.textAlign = 'left'; x.fillText(a, 32, 104 + i * 40); x.textAlign = 'right'; x.fillText(b, w - 32, 104 + i * 40);
    });
  }),
}));
const cupStack = (x, y, z, n = 3) => { const g = group(); for (let i = 0; i < n; i++) g.add(cyl(0.05, 0.04, 0.07, C.white, { x, y: y + i * 0.04, z, seg: 8 })); return g; };
const scallop = () => once('scallop', () => new THREE.CircleGeometry(0.16, 8, Math.PI, Math.PI));

prop('coffeeKiosk', (o = {}) => {
  const g = group(contact(3.2, 1.6, 0.36));
  g.add(soft(3.14, 0.94, 0.58, plankMat(), { z: 0.46, r: 0.03 }));
  g.add(chip(3.1, 0.07, 0.56, C.woodDeep, { z: 0.46 }));
  g.add(soft(3.2, 0.06, 0.72, C.trimWarm, { y: 0.94, z: 0.42, r: 0.024 }));
  g.add(soft(3.14, 0.9, 0.34, C.offWhite, { z: -0.6, r: 0.03 }), soft(3.18, 0.04, 0.38, C.woodLight, { y: 0.9, z: -0.6, r: 0.014 }));
  g.add(soft(3.18, 2.12, 0.05, '#bfe9e2', { z: -0.775, y: 0.02, r: 0.02 }));
  g.add(panel(1.16, 0.58, menuMat(), { y: 1.2, z: -0.748 }));
  for (const x of [-1.05, 1.05]) {
    g.add(soft(0.82, 0.03, 0.2, C.woodDeep, { x, y: 1.42, z: -0.65, r: 0.012 }), soft(0.82, 0.03, 0.2, C.woodDeep, { x, y: 1.14, z: -0.65, r: 0.012 }));
    g.add(cupStack(x - 0.26, 1.45, -0.65), cupStack(x - 0.1, 1.45, -0.65, 2));
    g.add(cyl(0.06, 0.06, 0.16, '#d9b080', { x: x + 0.13, y: 1.17, z: -0.65, seg: 8 }), cyl(0.06, 0.06, 0.16, '#8a5a36', { x: x - 0.04, y: 1.17, z: -0.65, seg: 8 }), cyl(0.062, 0.062, 0.03, C.woodLight, { x: x + 0.13, y: 1.33, z: -0.65, seg: 8 }));
    g.add(mesh(tuftGeo('shelf', 9, 0.2, 0.05, 1.1), bladeMat(), { x: x + 0.3, y: 1.47, z: -0.65 }), cyl(0.05, 0.04, 0.07, C.coral, { x: x + 0.3, y: 1.45, z: -0.65, seg: 8 }));
  }
  // Espresso machine with a chrome face, group heads, pressure gauge and cups warming on top.
  g.add(soft(0.72, 0.32, 0.4, matMetal(C.steel), { x: -0.8, y: 1.0, z: 0.34, r: 0.04 }));
  g.add(soft(0.74, 0.06, 0.42, C.coralDeep, { x: -0.8, y: 1.27, z: 0.34, r: 0.02 }));
  g.add(soft(0.6, 0.03, 0.26, C.charcoal, { x: -0.8, y: 1.0, z: 0.47, r: 0.01 }));
  for (const x of [-0.97, -0.63]) g.add(cyl(0.05, 0.055, 0.05, C.charcoal, { x, y: 1.1, z: 0.54, seg: 8 }), chip(0.03, 0.03, 0.15, C.ink, { x, y: 1.1, z: 0.64 }));
  g.add(cyl(0.05, 0.05, 0.016, C.white, { x: -0.8, y: 1.2, z: 0.545, rx: Math.PI / 2, seg: 12 }));
  g.add(cupStack(-1.0, 1.33, 0.3, 2), cupStack(-0.84, 1.33, 0.3, 2), cupStack(-0.68, 1.33, 0.3, 2));
  // Glass pastry case.
  g.add(soft(0.92, 0.04, 0.42, C.woodDeep, { x: 0.74, y: 1.0, z: 0.42, r: 0.014 }));
  g.add(soft(0.9, 0.34, 0.4, matGlass('#e8f6ff', 0.2), { x: 0.74, y: 1.04, z: 0.42, r: 0.05, shadow: false }));
  for (let i = 0; i < 4; i++) g.add(cyl(0.08, 0.09, 0.08, ['#e0a875', '#f3d7b5', '#c98a5c', '#f6b6c0'][i], { x: 0.46 + i * 0.19, y: 1.05, z: 0.42, seg: 8 }), dot(0.024, i % 2 ? C.coral : C.lineYellow, { x: 0.46 + i * 0.19, y: 1.14, z: 0.42 }));
  g.add(soft(0.26, 0.2, 0.2, C.charcoal, { x: -0.1, y: 1.0, z: 0.42, r: 0.02 }), soft(0.2, 0.1, 0.012, C.ink, { x: -0.1, y: 1.1, z: 0.525, rx: -0.2, r: 0.005 }));
  // Posts and a striped awning with a scalloped edge.
  for (const x of [-1.5, 1.5]) g.add(cyl(0.04, 0.05, 1.08, C.woodDeep, { x, y: 1.0, z: 0.68, seg: 8 }));
  const stripes = 10, sw = 3.2 / stripes, A = '#28bcc0', B = '#fff8ec', slope = 0.215;
  for (let i = 0; i < stripes; i++) {
    const x = -1.6 + sw * (i + 0.5), c = i % 2 ? B : A;
    g.add(chip(sw, 0.03, 1.62, c, { x, y: 2.16, z: 0.0, rx: slope }));
    g.add(mesh(scallop(), mat(c, { side: THREE.DoubleSide }), { x, y: 2.005, z: 0.79, sx: sw / 0.32, sy: 0.9, sz: 1 }));
  }
  g.add(soft(3.2, 0.05, 0.06, A, { y: 2.33, z: -0.78, r: 0.02 }));
  // Warm string lights under the awning, on the shared night lamp.
  for (let i = 0; i <= 8; i++) {
    const x = -1.42 + i * 0.355;
    g.add(dot(0.028, nightLamp, { x, y: 1.84 + 0.05 * Math.cos((x * Math.PI) / 0.75), z: 0.66 }));
  }
  g.add(tube([[-1.5, 1.92, 0.66], [-0.75, 1.82, 0.66], [0, 1.9, 0.66], [0.75, 1.82, 0.66], [1.5, 1.92, 0.66]], 0.005, C.ink, { seg: 16, radial: 3 }));
  g.add(soft(1.5, 0.5, 0.04, C.woodDeep, { y: 0.24, z: 0.755, r: 0.02 }));
  g.add(panel(1.42, 0.42, sign(o.label ?? 'Coffee', { w: 720, h: 213, bg: '#fff8ec', fg: '#7a5136', weight: 700, radius: 26 }), { y: 0.28, z: 0.777 }));
  // Steam from the wand: three puffs on a loop, one draw call each.
  const puffs = [0, 1, 2].map((i) => {
    const p = ball(0.05, matGlass('#ffffff', 0.34), { x: -0.8, y: 1.35, z: 0.3, seg: 8, shadow: false });
    p.userData.dynamic = true;
    p.userData.phase = i / 3;
    g.add(p);
    return p;
  });
  return live(g, (dt, t, ctx) => {
    applyNight(ctx?.night);
    for (const p of puffs) {
      const k = (t * 0.22 + p.userData.phase) % 1;
      p.position.set(-0.8 + Math.sin(k * 7 + p.userData.phase * 9) * 0.05, 1.42 + k * 0.42, 0.3);
      p.scale.setScalar(0.5 + k * 1.3);
      p.visible = k < 0.92;
    }
  });
});

prop('waterCooler', () => {
  const g = group(contact(0.42, 0.42, 0.42));
  g.add(soft(0.36, 0.84, 0.36, C.offWhite, { r: 0.04, seg: 2 }));
  g.add(soft(0.26, 0.26, 0.012, C.steelDeep, { y: 0.42, z: 0.178, r: 0.01 }), soft(0.22, 0.02, 0.1, C.charcoal, { y: 0.42, z: 0.14, r: 0.008 }));
  g.add(soft(0.05, 0.05, 0.05, C.danger, { x: -0.07, y: 0.61, z: 0.18, r: 0.016 }), soft(0.05, 0.05, 0.05, C.info, { x: 0.07, y: 0.61, z: 0.18, r: 0.016 }));
  g.add(cyl(0.024, 0.03, 0.14, C.white, { x: 0.09, y: 0.44, z: 0.14, seg: 8 }));
  g.add(cyl(0.16, 0.17, 0.05, C.steel, { y: 0.84, seg: 14 }));
  const jug = once('jug', () => new THREE.LatheGeometry([[0.05, 0], [0.11, 0.02], [0.15, 0.06], [0.155, 0.2], [0.145, 0.27], [0.1, 0.33], [0.045, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 14));
  const water = once('jugWater', () => new THREE.LatheGeometry([[0.04, 0.01], [0.135, 0.06], [0.14, 0.19], [0.13, 0.24], [0.001, 0.24]].map(([x, y]) => new THREE.Vector2(x, y)), 12));
  g.add(mesh(water, matGlass('#6cc5f0', 0.55), { y: 0.89, shadow: false, order: 2 }), mesh(jug, matGlass('#bfe6fa', 0.3), { y: 0.89, shadow: false, order: 3 }));
  const bubbles = [0, 0.5].map((phase) => {
    const b = ball(0.02, mat('#eaf8ff', { rough: 0.25 }), { y: 0.95, seg: 8, shadow: false });
    b.userData.dynamic = true;
    b.renderOrder = 3;
    g.add(b);
    return { b, phase };
  });
  return live(g, (dt, t) => {
    for (const { b, phase } of bubbles) {
      const k = (t * 0.28 + phase) % 1;
      b.position.set(Math.sin(k * 11 + phase * 7) * 0.024, 0.93 + k * 0.17, Math.cos(k * 9) * 0.02);
      b.scale.setScalar(0.5 + k * 0.7);
    }
  });
});
prop('trashBin', (o = {}) => {
  const g = group(contact(0.38, 0.38, 0.4));
  g.add(cyl(0.175, 0.145, 0.5, o.color ?? C.steel, { seg: 14 }));
  g.add(cyl(0.18, 0.178, 0.03, C.teal, { y: 0.36, seg: 14 }));
  g.add(cyl(0.178, 0.182, 0.04, C.charcoal, { y: 0.5, seg: 14 }), cyl(0.09, 0.17, 0.06, C.charcoal, { y: 0.54, seg: 14 }));
  g.add(chip(0.1, 0.018, 0.09, C.ink, { y: 0.02, z: 0.16 }));
  return g;
});

const rugMat = () => once('rug', () => new THREE.MeshStandardMaterial({
  roughness: 0.96,
  map: canvasTex(1024, 704, (x, w, h) => {
    x.fillStyle = '#f4ebdc'; x.fillRect(0, 0, w, h);
    const inset = (m, c, lw) => { x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); x.roundRect(m, m, w - m * 2, h - m * 2, 26); x.stroke(); };
    inset(30, '#27b9bd', 28); inset(62, '#f0c04a', 6); inset(88, '#27b9bd', 5);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) {
      const cx = 170 + i * 98 + (j % 2 ? 49 : 0), cy = 160 + j * 96;
      if (cx > w - 130) continue;
      x.fillStyle = (i + j) % 3 === 0 ? '#f6a79c' : (i + j) % 3 === 1 ? '#7fd9d6' : '#f6d27c';
      x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.beginPath(); x.roundRect(-26, -26, 52, 52, 12); x.fill();
      x.fillStyle = '#f4ebdc'; x.beginPath(); x.roundRect(-11, -11, 22, 22, 6); x.fill(); x.restore();
    }
    x.fillStyle = 'rgba(120,90,60,.08)';
    for (let i = 0; i < 1400; i++) x.fillRect((i * 397) % w, (i * 211) % h, 2, 2);
  }),
}));
prop('rug', () => group(contact(3.2, 2.2, 0.16), soft(3.2, 0.03, 2.2, rugMat(), { r: 0.012, shadow: false })));

// ── wall pieces ──────────────────────────────────────────
function butterfly(x, cx, cy, s, fill, ink, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  for (const m of [-1, 1]) {
    x.save(); x.scale(m, 1); x.fillStyle = fill; x.strokeStyle = ink; x.lineWidth = 0.05;
    x.beginPath(); x.moveTo(0, -0.08); x.bezierCurveTo(0.22, -0.66, 0.86, -0.78, 0.98, -0.46); x.bezierCurveTo(1.04, -0.14, 0.52, 0.06, 0, 0.03); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(0, 0.03); x.bezierCurveTo(0.44, 0.0, 0.8, 0.2, 0.66, 0.54); x.bezierCurveTo(0.54, 0.8, 0.14, 0.62, 0, 0.14); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 0.022; x.beginPath(); x.moveTo(0.02, -0.04); x.lineTo(0.72, -0.5); x.moveTo(0.02, -0.02); x.lineTo(0.84, -0.26); x.moveTo(0.02, 0.06); x.lineTo(0.5, 0.4); x.stroke();
    x.fillStyle = ink; x.beginPath(); x.arc(0.8, -0.5, 0.05, 0, TAU); x.arc(0.88, -0.32, 0.04, 0, TAU); x.fill();
    x.lineWidth = 0.02; x.beginPath(); x.moveTo(0, -0.24); x.quadraticCurveTo(0.1, -0.44, 0.22, -0.5); x.stroke();
    x.restore();
  }
  x.fillStyle = ink; x.beginPath(); x.ellipse(0, 0.02, 0.04, 0.27, 0, 0, TAU); x.fill();
  x.restore();
}
const heartPath = (x, cx, cy, s) => { x.beginPath(); x.moveTo(cx, cy + s * 0.8); x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.7, cy - s, cx, cy - s * 0.38); x.bezierCurveTo(cx + s * 0.7, cy - s, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.8); x.closePath(); };
const ART = {
  gold: { frame: '#3f4450', paint: (x, s) => butterfly(x, s / 2, s / 2, s * 0.29, '#f6c83a', '#2c2f38') },
  trio: { frame: '#d3d7de', bg: '#23262e', paint: (x, s) => { butterfly(x, s * 0.38, s * 0.36, s * 0.15, '#fff', '#fff', -0.5); butterfly(x, s * 0.65, s * 0.42, s * 0.16, '#fff', '#fff', 0.4); butterfly(x, s * 0.5, s * 0.7, s * 0.12, '#fff', '#fff', 0.7); } },
  mono: { frame: C.ink, paint: (x, s) => butterfly(x, s / 2, s / 2, s * 0.17, '#2c2f38', '#2c2f38', -0.2) },
  teal: { frame: C.ink, paint: (x, s) => { butterfly(x, s * 0.3, s * 0.34, s * 0.13, '#27b9bd', '#16797c', 0.2); butterfly(x, s * 0.68, s * 0.5, s * 0.15, '#6aa8f0', '#2a62aa', -0.3); butterfly(x, s * 0.36, s * 0.7, s * 0.11, '#27b9bd', '#16797c', -0.5); } },
  heart: { frame: '#3f4450', paint: (x, s) => { x.fillStyle = C.coralDeep; heartPath(x, s / 2, s / 2, s * 0.25); x.fill(); } },
  leaf: { frame: C.woodDeep, bg: '#f6f4ec', paint: (x, s) => {
    x.strokeStyle = C.leafDeep; x.lineWidth = s * 0.012; x.lineCap = 'round';
    x.beginPath(); x.moveTo(s * 0.42, s * 0.8); x.quadraticCurveTo(s * 0.52, s * 0.5, s * 0.6, s * 0.2); x.stroke();
    for (let i = 0; i < 7; i++) {
      const k = i / 6.5, px = s * (0.43 + 0.16 * k), py = s * (0.74 - 0.5 * k), m = i % 2 ? 1 : -1;
      x.fillStyle = i % 3 ? C.leaf : C.leafLight;
      x.save(); x.translate(px, py); x.rotate(m * 1.0 + 0.25); x.beginPath(); x.ellipse(0, -s * 0.09, s * 0.042, s * 0.1, 0, 0, TAU); x.fill(); x.restore();
    }
  } },
  sun: { frame: C.wood, bg: '#fdf2dc', paint: (x, s) => {
    x.fillStyle = '#f7b04a'; x.beginPath(); x.arc(s * 0.5, s * 0.46, s * 0.15, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.rect(s * 0.14, s * 0.14, s * 0.72, s * 0.72); x.clip();
    x.fillStyle = '#7fd0c8'; x.beginPath(); x.moveTo(0, s * 0.72); x.quadraticCurveTo(s * 0.35, s * 0.46, s * 0.7, s * 0.66); x.quadraticCurveTo(s * 0.86, s * 0.74, s, s * 0.62); x.lineTo(s, s); x.lineTo(0, s); x.fill();
    x.fillStyle = '#ee8f86'; x.beginPath(); x.moveTo(0, s * 0.84); x.quadraticCurveTo(s * 0.5, s * 0.62, s, s * 0.82); x.lineTo(s, s); x.lineTo(0, s); x.fill(); x.restore();
  } },
};
const artMat = (kind) => once(`art|${kind}`, () => new THREE.MeshStandardMaterial({
  roughness: 0.55,
  map: canvasTex(384, 384, (x, w, h) => {
    const a = ART[kind];
    x.fillStyle = a.bg ?? '#fdfcf9'; x.fillRect(0, 0, w, h);
    a.paint(x, w);
    x.strokeStyle = a.bg ? 'rgba(255,255,255,.14)' : 'rgba(70,70,90,.16)'; x.lineWidth = 3; x.strokeRect(w * 0.06, w * 0.06, w * 0.88, h * 0.88);
  }),
}));
let butterflies = 0;
prop('wallArt', (o = {}) => {
  const style = o.style ?? 'butterfly';
  // The reference hangs a mixed gallery, so plain 'butterfly' placements cycle through its frames.
  const kind = ART[style] ? style : ['gold', 'trio', 'mono', 'teal'][butterflies++ % 4];
  const a = ART[kind];
  const g = group(soft(0.9, 0.9, 0.05, a.frame, { r: 0.012, shadow: true }));
  g.add(panel(0.76, 0.76, artMat(kind), { y: 0.07, z: 0.0262 }));
  return g;
});
const tvMat = () => once('tv', () => {
  const tex = canvasTex(1024, 256, (x, w, h) => {
    const stops = [[255, 196, 180], [127, 224, 220], [165, 139, 224], [255, 216, 120]];
    for (let i = 0; i < w; i += 2) {
      const u = (i / w) * 4, a = stops[Math.floor(u) % 4], b = stops[(Math.floor(u) + 1) % 4], k = u % 1;
      const c = (n) => Math.round(a[n] + (b[n] - a[n]) * k), top = `rgb(${c(0)},${c(1)},${c(2)})`;
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top); g.addColorStop(1, '#fdf4e8');
      x.fillStyle = g; x.fillRect(i, 0, 2, h);
      const hill = (f, p, base, amp, col) => { const y = h * (base + amp * Math.sin((i / w) * TAU * f + p)); x.fillStyle = col; x.fillRect(i, y, 2, h - y); };
      hill(3, 0.4, 0.68, 0.06, 'rgba(47,148,96,.55)');
      hill(5, 2.1, 0.8, 0.05, 'rgba(31,114,72,.72)');
    }
  }, { repeat: [0.36, 1] });
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
});
prop('wallTv', () => {
  const g = group(soft(1.3, 0.8, 0.05, C.ink, { r: 0.018 }), chip(0.5, 0.3, 0.03, C.charcoal, { y: 0.25, z: -0.03 }));
  g.add(panel(1.24, 0.74, tvMat(), { y: 0.03, z: 0.0262 }));
  g.add(chip(0.024, 0.008, 0.004, C.ok, { x: 0.56, y: 0.012, z: 0.026 }));
  const strip = tvMat().map;
  return live(g, (dt, t) => { strip.offset.x = (t * 0.008) % 1; });
});
const clockFace = () => once('clockFace', () => new THREE.MeshStandardMaterial({
  roughness: 0.4,
  map: canvasTex(256, 256, (x, w) => {
    const c = w / 2;
    x.fillStyle = '#fdfdfb'; x.fillRect(0, 0, w, w);
    x.fillStyle = C.ink; x.font = '600 30px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, q = i % 3 === 0;
      if (q) x.fillText(String(i === 0 ? 12 : i), c + Math.sin(a) * 92, c - Math.cos(a) * 92 + 1);
      else { x.beginPath(); x.arc(c + Math.sin(a) * 100, c - Math.cos(a) * 100, 4, 0, TAU); x.fill(); }
    }
  }),
}));
const minutesOf = (s) => (s == null ? null : typeof s === 'number' ? s : s.hours !== undefined ? (s.minutes < 60 && Number.isInteger(s.hours) ? s.hours * 60 + s.minutes : s.hours * 60) : s.minutes ?? null);
prop('wallClock', () => {
  const y = 0.25, z = 0.034;
  const g = group(cyl(0.25, 0.25, 0.05, C.teal, { y: y - 0.025, rx: Math.PI / 2, seg: 28 }));
  g.add(mesh(once('clockDisc', () => new THREE.CircleGeometry(0.22, 28)), clockFace(), { y, z: 0.0262, shadow: false }));
  g.add(ring(0.222, 0.012, C.white, { y, z: 0.026, rx: 0, seg: 28, shadow: false }));
  const hand = (w, len) => { const p = group(chip(w, len + 0.03, 0.006, C.ink, { y: -0.03 })); p.position.set(0, y, z); p.userData.dynamic = true; g.add(p); return p; };
  const hour = hand(0.02, 0.11), minute = hand(0.012, 0.165);
  g.add(cyl(0.016, 0.016, 0.012, C.coralDeep, { y: y - 0.006, z: 0.04, rx: Math.PI / 2, seg: 10 }));
  let own = null, shown = NaN;
  g.userData.setState = (s) => { own = minutesOf(s); };
  return live(g, (dt, t, ctx) => {
    const m = minutesOf(ctx?.minutes ?? ctx?.clock) ?? own ?? minutesOf(globalThis.__twin?.twin?.clock) ?? 540 + t;
    if (m === shown) return;
    shown = m;
    minute.rotation.z = -((m % 60) / 60) * TAU;
    hour.rotation.z = -((m % 720) / 720) * TAU;
  });
});
prop('wallSign', (o = {}) => {
  const g = group(soft(1.4, 0.4, 0.05, o.accent ?? C.teal, { r: 0.05 }));
  g.add(panel(1.35, 0.35, sign(o.text ?? 'Sanjeevani', { w: 620, h: 160, bg: o.bg ?? C.white, fg: o.fg ?? C.ink, radius: 30 }), { y: 0.025, z: 0.0262 }));
  return g;
});
const heartGeo = () => once('heart3d', () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.17); s.bezierCurveTo(-0.32, 0.02, -0.16, 0.2, 0, 0.09); s.bezierCurveTo(0.16, 0.2, 0.32, 0.02, 0, -0.17);
  return creased(new THREE.ExtrudeGeometry(s, { depth: 0.01, curveSegments: 7, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), 0.9);
});
prop('heartSign', () => {
  const g = group(soft(0.6, 0.6, 0.05, C.white, { r: 0.02 }));
  g.add(mesh(heartGeo(), matGloss('#e8404c'), { y: 0.3, z: 0.03, s: 1.15 }));
  return g;
});

export function registerFurnitureProps() {
  for (const [name, build] of table) registerProp(name, build);
}
