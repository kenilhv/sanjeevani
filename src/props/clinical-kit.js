// Low-poly siblings of the shared kit. Clinical props are dense with tiny parts, so these primitives spend a
// fraction of the kit's triangles (a soft box here is 108, the kit's is 300+) and keep the heroes inside budget.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, matGlow, canvasTex, bakeStatic } from '../style/kit.js';
import { C } from '../style/palette.js';

export const HP = Math.PI / 2;
const geos = new Map();
export const once = (k, make) => { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); };
const paint = (m) => (typeof m === 'string' ? mat(m) : m);

export const STEEL = mat(C.steel, { rough: 0.42, metal: 0.3 });
export const STEEL_DARK = mat(C.steelDeep, { rough: 0.45, metal: 0.3 });
export const CHROME = mat('#dfe4ec', { rough: 0.22, metal: 0.45 });
export const STAINLESS = mat('#d6dbe3', { rough: 0.34, metal: 0.18 });

export function put(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, paint(material));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}

/** Soft box, y = bottom. `seg: 2` for big forms that catch light on the bevel. */
export function sbox(w, h, d, color, o = {}) {
  const seg = o.seg ?? 1, r = Math.min(o.r ?? 0.02, Math.min(w, h, d) * 0.48);
  const g = once(`sbox|${w}|${h}|${d}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r));
  return put(g, color, { ...o, y: (o.y ?? 0) + h / 2 });
}
/** Hard 12-triangle block for parts too small to show a bevel. y = bottom. */
export function chip(w, h, d, color, o = {}) {
  return put(once(`chip|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), color, { ...o, y: (o.y ?? 0) + h / 2 });
}
/** Cylinder or cone, y = bottom. `open` drops the caps. */
export function drum(rTop, rBot, h, color, o = {}) {
  const seg = o.seg ?? 10, open = !!o.open;
  const g = once(`drum|${rTop}|${rBot}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open));
  return put(g, color, { ...o, y: (o.y ?? 0) + h / 2 });
}
const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
/** Open-ended bar between two points. */
export function rod(a, b, r, color, { seg = 6, ...o } = {}) {
  dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const g = once(`rod|${len.toFixed(3)}|${r}|${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg, 1, true));
  const m = put(g, color, { ...o, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 });
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
/** Smooth tube through points, for cables, hoses and rails. */
export function hose(pts, r, color, { seg = 20, radial = 5, closed = false, ...o } = {}) {
  const g = once(`hose|${pts.flat().join()}|${r}|${seg}|${radial}|${closed}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
    return new THREE.TubeGeometry(curve, seg, r, radial, closed);
  });
  return put(g, color, o);
}
/** Torus facing +Z (axis along Z), y = centre. */
export function hoop(R, t, color, { seg = 24, tseg = 6, arc = Math.PI * 2, ...o } = {}) {
  return put(once(`hoop|${R}|${t}|${seg}|${tseg}|${arc}`, () => new THREE.TorusGeometry(R, t, tseg, seg, arc)), color, o);
}
/** Lathe from [[radius, y], ...], y offset in options. */
export function turned(profile, color, { seg = 12, ...o } = {}) {
  const g = once(`turned|${profile.flat().join()}|${seg}`, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg));
  return put(g, color, o);
}
/** Flat disc facing +Z, y = centre. */
export function dot(r, color, { seg = 8, ...o } = {}) {
  return put(once(`dot|${r}|${seg}`, () => new THREE.CircleGeometry(r, seg)), color, { shadow: false, ...o });
}
/** Flat disc facing +Y. */
export function disc(r, color, { seg = 24, ...o } = {}) {
  return put(once(`disc|${r}|${seg}`, () => new THREE.CircleGeometry(r, seg).rotateX(-HP)), color, { shadow: false, ...o });
}

const arc = (cx, cy, r, a0, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (HP * i) / n;
  return new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
});
/** Rounded outline as explicit points. Shape curves tie corner detail to hole detail, this keeps them independent. */
export function roundShape(w, h, rTop, rBot = rTop, y0 = 0, n = 5) {
  const x = w / 2;
  return new THREE.Shape([
    ...arc(x - rBot, y0 + rBot, rBot, -HP, n),
    ...arc(x - rTop, y0 + h - rTop, rTop, 0, n),
    ...arc(-x + rTop, y0 + h - rTop, rTop, HP, n),
    ...arc(-x + rBot, y0 + rBot, rBot, Math.PI, n),
  ]);
}
export function circlePath(cx, cy, R, n = 28) {
  return new THREE.Path(Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + Math.cos((i / n) * Math.PI * 2) * R, cy + Math.sin((i / n) * Math.PI * 2) * R)));
}
/** Capsule-shaped hole, for carry slots in head and foot boards. */
export function slotPath(w, h, cy) {
  const r = h / 2, x = w / 2 - r, pts = [];
  for (let i = 0; i <= 6; i++) { const a = -HP + (i / 6) * Math.PI; pts.push(new THREE.Vector2(x + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  for (let i = 0; i <= 6; i++) { const a = HP + (i / 6) * Math.PI; pts.push(new THREE.Vector2(-x + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  return new THREE.Path(pts);
}
/** Extruded outline, centred on z, faces +Z. Creased normals keep the bevel soft: raw extrusions are flat shaded. */
export function slab(key, shape, depth, color, { bevel = 0.015, bs = 2, ...o } = {}) {
  const g = once(`slab|${key}|${depth}|${bevel}|${bs}`, () => {
    const raw = new THREE.ExtrudeGeometry(typeof shape === 'function' ? shape() : shape, {
      depth: depth - bevel * 2, curveSegments: 4,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: bs,
    });
    raw.translate(0, 0, -depth / 2 + bevel);
    return toCreasedNormals(raw, 0.75);
  });
  return put(g, color, o);
}
/** Plump cushion from a superellipsoid, y = centre. Analytic normals avoid the sphere seam. */
export function cushion(w, h, d, color, o = {}) {
  const g = once(`cushion|${w}|${h}|${d}`, () => {
    const s = new THREE.SphereGeometry(1, 14, 10), p = s.attributes.position, n = s.attributes.normal;
    const pow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
    const ex = 0.5, ey = 1.15, a = w / 2, b = h / 2, c = d / 2, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
      p.setXYZ(i, pow(X, ex) * a, pow(Y, ey) * b, pow(Z, ex) * c);
      v.set(pow(X, 2 - ex) / a, pow(Y, 2 - ey) / b, pow(Z, 2 - ex) / c).normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
    return s;
  });
  return put(g, color, o);
}

/** One castor on the floor: tyre, chrome hub, fork. `lite` for the tiny ones under poles. */
export function castor(x, z, { r = 0.05, yaw = 0, lite = false } = {}) {
  const w = r * 0.85, g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  g.add(drum(r, r, w, C.charcoal, { rz: HP, y: r - w / 2, seg: lite ? 8 : 12 }));
  if (lite) { g.add(chip(w * 1.2, r * 1.1, r * 0.9, C.steelDeep, { y: r * 1.2 })); return g; }
  g.add(drum(r * 0.5, r * 0.5, w * 1.2, STEEL, { rz: HP, y: r - w * 0.6, seg: 8 }));
  g.add(chip(w * 1.35, r * 0.75, r * 1.05, C.plastic, { y: r * 1.25, z: -r * 0.12 }));
  g.add(drum(r * 0.26, r * 0.26, r * 0.7, STEEL, { y: r * 1.9, seg: 6, open: true }));
  return g;
}
export function fourCastors(w, d, o = {}) {
  return [[-1, -1, 0.5], [1, -1, 2.1], [-1, 1, 3.6], [1, 1, 5.2]].map(([a, b, yaw]) => castor((a * w) / 2, (b * d) / 2, { yaw, ...o }));
}
/** Five-star rolling base for poles. */
export function starBase(R = 0.2) {
  const parts = [drum(0.04, 0.05, 0.05, C.plastic, { y: 0.1, seg: 10 })];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, x = Math.cos(a) * R, z = Math.sin(a) * R;
    parts.push(rod([0, 0.12, 0], [x, 0.075, z], 0.011, STEEL_DARK));
    parts.push(castor(x, z, { r: 0.026, yaw: a * 2.3, lite: true }));
  }
  return parts;
}

// ── moving parts ────────────────────────────────────────────
/** Marks a moving part. A group's own static children merge, so it costs one draw call per material. */
export function dyn(o) {
  o.userData.dynamic = true;
  if (o.isGroup) bakeStatic(o);
  return o;
}
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
let uid = 0;
/** Stable per-instance phase, so a row of identical machines never moves in lockstep. */
export const nextSeed = () => (++uid * 0.618034) % 1;

// ── status lights ───────────────────────────────────────────
const LIGHT = {
  free: C.free, occupied: C.busy, cleaning: C.watch, reserved: C.purple, idle: C.ok, 'in-use': C.info,
  maintenance: C.watch, fault: C.danger, watch: C.watch, critical: C.danger,
};
export const lightColor = (k) => LIGHT[k] ?? C.steel;
export const lightMat = (k) => matGlow(lightColor(k), 2);
const pulses = new Map();
/** Pulsing glow shared by every light of a colour, so a ward full of alarms stays in step and costs one uniform. */
export function pulseMat(color) {
  if (!pulses.has(color)) pulses.set(color, mat(color, { emissive: color, emissiveIntensity: 2, rough: 0.5 }).clone());
  return pulses.get(color);
}
let haloTex;
const halos = new Map();
/** Soft glow around an alarm. Hidden sprites cost nothing, so every light can carry one. */
export function halo(color, size = 0.6) {
  haloTex ??= canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.35, 'rgba(255,255,255,.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });
  if (!halos.has(color)) halos.set(color, new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, depthWrite: false, depthTest: false }));
  const s = new THREE.Sprite(halos.get(color));
  s.scale.setScalar(size);
  s.visible = false;
  s.renderOrder = 3;
  s.raycast = () => {};
  s.userData.dynamic = true;
  return s;
}

// ── screens ─────────────────────────────────────────────────
export const screenOf = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
/** A canvas we redraw often: no mipmaps, CPU-backed, so uploading it stays cheap. */
export function liveCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return { ctx, tex, mat: screenOf(tex), w, h };
}
const shared = new Map();
/** One canvas per machine type. Every instance shares the material, so screens bake into a single draw call. */
export function sharedScreen(key, w, h, draw, hz = 6) {
  if (!shared.has(key)) {
    const s = liveCanvas(w, h);
    draw(s.ctx, w, h, 0);
    shared.set(key, { ...s, draw, step: 1 / hz, last: 0 });
  }
  return shared.get(key);
}
export function pump(s, t) {
  if (t - s.last < s.step) return;
  s.last = t;
  s.draw(s.ctx, s.w, s.h, t);
  s.tex.needsUpdate = true;
}
const stills = new Map();
/** A painted, unmoving display face, cached by key. */
export function stillScreen(key, w, h, draw) {
  if (!stills.has(key)) stills.set(key, screenOf(canvasTex(w, h, draw)));
  return stills.get(key);
}
export const MONO = '"JetBrains Mono Variable", ui-monospace, Menlo, monospace';
export const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
