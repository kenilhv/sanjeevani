// Vertex-coloured geometry sheets for architecture. Walls change colour per face and per metre, so a texture or a
// material per colour would cost hundreds of draw calls. One sheet, one material, one call, however many rooms it paints.
import * as THREE from 'three';

const linear = new Map();
export function rgb(hex) {
  if (!linear.has(hex)) { const c = new THREE.Color(hex); linear.set(hex, [c.r, c.g, c.b]); }
  return linear.get(hex);
}
export const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const isList = (c) => Array.isArray(c[0]);

export class Sheet {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.glow = []; }
  get empty() { return this.pos.length === 0; }
  vert(p, n, c, g) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c[0], c[1], c[2]); this.glow.push(g); }
  /** Corners in loop order, either direction: winding is corrected here so callers never think about it. */
  quad(a, b, c, d, n, color, g = 0) {
    const cs = isList(color) ? color : [color, color, color, color];
    const ns = isList(n) ? n : [n, n, n, n];
    const avg = isList(n) ? [ns[0][0] + ns[2][0], ns[0][1] + ns[2][1], ns[0][2] + ns[2][2]] : n;
    const flip = dot(cross(sub(b, a), sub(c, a)), avg) < 0;
    const P = flip ? [a, d, c, b] : [a, b, c, d];
    const C = flip ? [cs[0], cs[3], cs[2], cs[1]] : cs;
    const N = flip ? [ns[0], ns[3], ns[2], ns[1]] : ns;
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(P[i], N[i], C[i], g);
  }
  /** Axis box. `low` shades the bottom of the side faces, `top` recolours the lid, `skip` drops faces ('b','t','n','s','e','w'). */
  box(x0, y0, z0, x1, y1, z1, color, { g = 0, low, top, skip = '' } = {}) {
    const lo = low ?? color, sides = [lo, lo, color, color];
    if (!skip.includes('t')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top ?? color, g);
    if (!skip.includes('b')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], lo, g);
    if (!skip.includes('s')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], sides, g);
    if (!skip.includes('n')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], sides, g);
    if (!skip.includes('e')) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], sides, g);
    if (!skip.includes('w')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], sides, g);
  }
  /** Round bar between two points, smooth shaded. */
  tube(p, q, r, color, { n = 6, g = 0 } = {}) {
    const d = unit(sub(q, p)), ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = unit(cross(d, ref)), v = cross(d, u);
    const dir = (a) => [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a), u[2] * Math.cos(a) + v[2] * Math.sin(a)];
    for (let i = 0; i < n; i++) {
      const n0 = dir((i / n) * Math.PI * 2), n1 = dir(((i + 1) / n) * Math.PI * 2);
      const off = (o, k) => [o[0] + k[0] * r, o[1] + k[1] * r, o[2] + k[2] * r];
      this.quad(off(p, n0), off(p, n1), off(q, n1), off(q, n0), [n0, n1, n1, n0], color, g);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    return g;
  }
}

/** World-space uniform: every architecture material reads it, so night is one number, not a material walk. */
export const nightUniform = { value: 0 };

// aGlow vertex codes: 0 outside surface · 0.1–0.9 inside the building, warm fill at night by that amount
// · 1.0–1.45 outward face of a window, warm at night, the fraction varies it per window · 2 inward face of a window, dark at night.
const GLOW = /* glsl */ `
  if (vGlow > 1.5) {
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.028, .05, .115), uNight);
    totalEmissiveRadiance += diffuseColor.rgb * mix(.62, .9, uNight);
  } else if (vGlow > .95) {
    float lit = .5 + .5 * fract(vGlow * 19.0);
    totalEmissiveRadiance += mix(diffuseColor.rgb * .55, vec3(1., .67, .36) * 1.8 * lit, uNight);
  } else if (vGlow > .05) {
    totalEmissiveRadiance += diffuseColor.rgb * vec3(1., .78, .56) * uNight * vGlow;
  }`;

export function archMaterial(plane, { rough = 0.82 } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0 });
  if (plane) { m.clippingPlanes = [plane]; m.clipShadows = true; }
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = nightUniform;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', 'attribute float aGlow;\nvarying float vGlow;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', 'uniform float uNight;\nvarying float vGlow;\n#include <common>')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLOW}`);
  };
  m.customProgramCacheKey = () => 'shell-arch';
  return m;
}

/** Rounded rectangle in (x, -z), so rotateX(-90°) lands it on the XZ plane facing up. */
export function roundedShape(x0, z0, x1, z1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, -z0);
  s.lineTo(x1 - r, -z0); s.quadraticCurveTo(x1, -z0, x1, -z0 - r);
  s.lineTo(x1, -z1 + r); s.quadraticCurveTo(x1, -z1, x1 - r, -z1);
  s.lineTo(x0 + r, -z1); s.quadraticCurveTo(x0, -z1, x0, -z1 + r);
  s.lineTo(x0, -z0 - r); s.quadraticCurveTo(x0, -z0, x0 + r, -z0);
  return s;
}

/** Critically damped follow: starts and stops with zero velocity, and can be retargeted mid-flight without a jolt. */
export function damp(s, target, dt, omega = 7) {
  const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const c = s.v0 - target, tmp = (s.vel + omega * c) * dt;
  s.vel = (s.vel - omega * tmp) * e;
  s.v0 = target + (c + tmp) * e;
  return s.v0;
}
export const follower = (v0 = 0) => ({ v0, vel: 0 });

/** Plane in XZ cut into nine patches so rounded corners keep their radius at any room size. uv corners occupy 0..0.5 of the texture. */
export function nineSlice(w, d, r) {
  const xs = [0, r, w - r, w], zs = [0, r, d - r, d], us = [0, 0.5, 0.5, 1], pos = [], uv = [], idx = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { pos.push(xs[i], 0, zs[j]); uv.push(us[i], 1 - us[j]); }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const a = j * 4 + i; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Stable pseudo random, so the plate looks identical on every load and in every screenshot. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Run a callback once the display fonts exist, because a canvas drawn before they load keeps the fallback face forever. */
export function whenFonts(cb) {
  const f = document.fonts;
  if (!f?.load) return;
  Promise.all([f.load('700 64px "Inter Variable"'), f.load('italic 64px "Instrument Serif"')]).then(cb, () => {});
}
export const SANS = '"Inter Variable", "Segoe UI", system-ui, sans-serif';
export const SERIF = '"Instrument Serif", Georgia, serif';
