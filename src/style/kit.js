// Shared modelling kit. Every 3D builder uses these so the whole diorama shares one look:
// soft rounded forms, matte pastel plastic, cached geometry and materials, one bake step.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const mats = new Map();
const key = (...a) => a.join('|');

/** Matte pastel material. Cached by colour, so baking merges everything that shares a colour. */
export function mat(color, { rough = 0.74, metal = 0, emissive, emissiveIntensity = 1, side } = {}) {
  const k = key('std', color, rough, metal, emissive, emissiveIntensity, side);
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: metal,
      ...(emissive ? { emissive, emissiveIntensity } : {}),
      ...(side !== undefined ? { side } : {}),
    }));
  }
  return mats.get(k);
}
export const matGloss = (color) => mat(color, { rough: 0.28 });
export const matMetal = (color) => mat(color, { rough: 0.38, metal: 0.65 });
/** Unlit-looking glow, for screens, lamps, status lights. Excluded from bakeStatic merging only if dynamic. */
export const matGlow = (color, intensity = 1.4) => mat(color, { emissive: color, emissiveIntensity: intensity, rough: 0.5 });
/** Tinted glass. Never casts shadow. */
export function matGlass(color = '#d9f0fa', opacity = 0.26) {
  const k = key('glass', color, opacity);
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.12, metalness: 0.05, depthWrite: false }));
  }
  return mats.get(k);
}

const asMat = (m) => (typeof m === 'string' ? mat(m) : m);
const geos = new Map();
function cachedGeo(k, make) { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); }

function finish(mesh, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, shadow = true, receive = true } = {}) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Rounded box. x/z = centre, y = BOTTOM of the box (so stacking is just adding heights). */
export function box(w, h, d, color, o = {}) {
  const r = Math.min(o.r ?? 0.035, Math.min(w, h, d) * 0.48);
  const g = cachedGeo(key('box', w, h, d, r), () => new RoundedBoxGeometry(w, h, d, r > 0.06 ? 4 : 2, r));
  const m = finish(new THREE.Mesh(g, asMat(color)), o);
  m.position.y = (o.y ?? 0) + h / 2;
  return m;
}
/** Cylinder or cone. y = BOTTOM. */
export function cyl(rTop, rBot, h, color, o = {}) {
  const seg = o.seg ?? 20;
  const g = cachedGeo(key('cyl', rTop, rBot, h, seg), () => new THREE.CylinderGeometry(rTop, rBot, h, seg));
  const m = finish(new THREE.Mesh(g, asMat(color)), o);
  m.position.y = (o.y ?? 0) + h / 2;
  return m;
}
/** Sphere (or squashed sphere with sx/sy/sz). y = CENTRE. */
export function ball(r, color, o = {}) {
  const seg = o.seg ?? 18;
  const g = cachedGeo(key('ball', r, seg), () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.75)));
  const m = finish(new THREE.Mesh(g, asMat(color)), o);
  if (o.sx || o.sy || o.sz) m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  return m;
}
/** Capsule along Y. y = BOTTOM. len = total height. */
export function pill(r, len, color, o = {}) {
  const seg = o.seg ?? 12;
  const g = cachedGeo(key('pill', r, len, seg), () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, seg));
  const m = finish(new THREE.Mesh(g, asMat(color)), o);
  m.position.y = (o.y ?? 0) + len / 2;
  return m;
}
/** Torus lying flat (XZ plane) by default; pass rx to tilt. y = CENTRE. */
export function ring(R, tube, color, o = {}) {
  const seg = o.seg ?? 32;
  const g = cachedGeo(key('ring', R, tube, seg), () => new THREE.TorusGeometry(R, tube, 10, seg));
  const m = finish(new THREE.Mesh(g, asMat(color)), { rx: Math.PI / 2, ...o });
  return m;
}
/** Thin flat panel facing +Z, for screens, signs and art. y = BOTTOM. */
export function panel(w, h, material, o = {}) {
  const g = cachedGeo(key('panel', w, h), () => new THREE.PlaneGeometry(w, h));
  const m = finish(new THREE.Mesh(g, material), { shadow: false, ...o });
  m.position.y = (o.y ?? 0) + h / 2;
  return m;
}
export function group(...children) { const g = new THREE.Group(); children.flat().forEach((c) => c && g.add(c)); return g; }

// Soft blob under furniture: this is what gives the diorama its grounded, ambient-occluded feel.
let blobTex;
function blob() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,34,60,.55)'); g.addColorStop(0.6, 'rgba(40,34,60,.28)'); g.addColorStop(1, 'rgba(40,34,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c); blobTex.colorSpace = THREE.SRGBColorSpace;
  return blobTex;
}
const contactMats = new Map();
/** Soft contact shadow, footprint w×d, at floor level. Add one to every prop that touches the floor. */
export function contact(w, d, opacity = 0.42) {
  const k = opacity.toFixed(2);
  if (!contactMats.has(k)) contactMats.set(k, new THREE.MeshBasicMaterial({ map: blob(), transparent: true, opacity, depthWrite: false }));
  const g = cachedGeo('contactPlane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const m = new THREE.Mesh(g, contactMats.get(k));
  m.scale.set(w * 1.35, 1, d * 1.35);
  m.position.y = 0.012;
  m.renderOrder = 1;
  m.userData.contact = true;
  return m;
}

/** Draw into a canvas and get an sRGB texture. */
export function canvasTex(w, h, draw, { repeat, nearest } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}
/** Sign face: rounded plate with text. Returns a material for panel(). */
export function signMat(text, { bg = '#ffffff', fg = '#2c2f38', w = 512, h = 128, font = '600 64px Inter, system-ui, sans-serif', radius = 28 } = {}) {
  const t = canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, radius); x.fill();
    x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4);
  });
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 });
}

/**
 * Merge every static mesh under `root` by material, in place. Call after a floor or room is assembled.
 * Children (and their subtrees) flagged userData.dynamic = true are left alone, so moving parts survive.
 * Shadow flags are grouped too. This is what keeps the draw-call count small.
 */
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const doomed = [];
  const walk = (o) => {
    if (o !== root && o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) {
      const k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + o.renderOrder;
      if (!buckets.has(k)) buckets.set(k, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, geos: [] });
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      buckets.get(k).geos.push(g);
      doomed.push(o);
    }
    o.children.slice().forEach(walk);
  };
  walk(root);
  doomed.forEach((m) => m.parent?.remove(m));
  // Drop now-empty static groups, keep anything still holding dynamic content.
  const prune = (o) => { o.children.slice().forEach(prune); if (o !== root && o.isGroup && !o.children.length && !o.userData.dynamic) o.parent?.remove(o); };
  prune(root);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.order; m.userData.baked = true;
    root.add(m);
  }
  return root;
}
