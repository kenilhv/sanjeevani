// The chunky little figures: proportions, shared geometry and who wears what.
// Every part is one geometry shared by one InstancedMesh, so details live in vertex colours,
// which multiply with the per-instance tint and cost no extra draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../style/palette.js';
import { makeProp, hasProp } from '../props/registry.js';

const { sin, cos, PI, pow, max, min, abs, floor } = Math;
const TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Rig units: an average adult is scaled by about 1.12 to stand 1.7 m tall. Hip height = ankle + shin + thigh.
export const RIG = {
  ankle: 0.075, shin: 0.225, thigh: 0.225, hipX: 0.122,
  shoulderX: 0.268, shoulderY: 0.395, neckY: 0.47, headUp: 0.235, headR: 0.275,
  upperArm: 0.215, foreArm: 0.2, hand: 0.074,
  armD: 0.138, foreD: 0.128, thighD: 0.208, shinD: 0.178,
  shoeW: 0.08, shoeL: 0.15, shoeH: 0.068,
  eyeX: 0.108, eyeY: -0.015, eyeZ: 0.2565, mouthY: -0.098, mouthZ: 0.262,
  seat: 0.49, pillow: 0.84, gurneyPillow: 0.96, orPillow: 1.02, tablePillow: 0.92, headToBedCentre: -0.72,
};
RIG.legs = RIG.ankle + RIG.shin + RIG.thigh;

function paint(g, hex = '#ffffff') {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
const merge = (...g) => mergeGeometries(g.flat(), false);

// The skull is a plump ellipsoid; hair, caps and masks use the same mapping so they hug it exactly.
function onSkull(th, phi, r) {
  const x = r * sin(th) * sin(phi), y = r * cos(th), z = r * sin(th) * cos(phi);
  const k = smooth(0.1, -0.7, y / RIG.headR);
  return [x * (1 + 0.06 * k) * 1.05, y * 0.97, z * (1 + 0.03 * k)];
}

/** Capsule with its top pole at y=0 and bottom pole at y=-1, unit diameter. Scale to any limb. */
export function limbGeo(q) {
  const g = new THREE.CapsuleGeometry(0.5, 1, q ? 2 : 1, q ? 8 : 6);
  g.translate(0, -1, 0); g.scale(1, 0.5, 1);
  return paint(g);
}
export const dotGeo = (q) => paint(new THREE.SphereGeometry(1, q ? 9 : 6, q ? 7 : 4));

export function headGeo(q) {
  const R = RIG.headR, sw = q ? 24 : 12, sh = q ? 16 : 8;
  const skull = new THREE.SphereGeometry(R, sw, sh);
  const p = skull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / R, k = smooth(0.1, -0.7, y);
    p.setXYZ(i, p.getX(i) * (1 + 0.06 * k) * 1.05, p.getY(i) * 0.97, p.getZ(i) * (1 + 0.03 * k));
  }
  const parts = [paint(skull)];
  for (const sx of [-1, 1]) {
    const d = new THREE.Vector3(sx * 0.62, -0.3, 0.72).normalize();
    const cheek = new THREE.SphereGeometry(1, q ? 10 : 6, q ? 6 : 4).scale(0.06, 0.039, 0.012);
    cheek.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d));
    cheek.translate(d.x * R * 1.13, d.y * R * 1.0, d.z * R * 1.015);
    parts.push(paint(cheek, '#ffcfc4'));
    parts.push(paint(new THREE.SphereGeometry(0.062, q ? 10 : 6, q ? 8 : 4).scale(0.6, 1, 0.8).translate(sx * R * 1.1, -0.03, 0), '#ffeee6'));
  }
  const smile = new THREE.TorusGeometry(0.04, 0.0092, q ? 6 : 3, q ? 12 : 5, PI).rotateZ(PI).rotateX(0.36).translate(0, RIG.mouthY + 0.03, RIG.mouthZ);
  parts.push(paint(smile, '#5a3030'));
  if (q) parts.push(paint(new THREE.SphereGeometry(0.027, 10, 8).scale(1.1, 0.8, 0.8).translate(0, -0.05, R * 1.0), '#ffdcd2'));
  return merge(parts);
}

export function torsoGeo(q) {
  const pts = [[0, -0.135], [0.1, -0.125], [0.19, -0.085], [0.24, -0.01], [0.252, 0.1], [0.246, 0.22], [0.225, 0.32], [0.18, 0.405], [0.115, 0.46], [0.05, 0.485], [0, 0.49]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const profile = new THREE.SplineCurve(pts).getPoints(q ? 14 : 7);
  for (const v of profile) v.x = max(0, v.x);
  profile[0].x = 0; profile[profile.length - 1].x = 0;
  return paint(new THREE.LatheGeometry(profile, q ? 16 : 9).scale(1, 1, 0.84));
}

/** Open-front long coat, pivot at the collar so a scale in Y only moves the hem. Doubles as cardigan and gown. */
export function coatGeo(q) {
  const nu = q ? 20 : 11, nv = q ? 9 : 5, top = 0.45, hem = -0.33;
  const rad = new THREE.SplineCurve([[0, 0.165], [0.08, 0.232], [0.2, 0.272], [0.42, 0.286], [0.62, 0.298], [1, 0.345]].map(([a, b]) => new THREE.Vector2(a, b)));
  const gap = new THREE.SplineCurve([[0, 0.8], [0.15, 0.42], [0.36, 0.13], [0.6, 0.1], [1, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)));
  const pos = [], col = [], idx = [], c = new THREE.Color(), edgeC = new THREE.Color('#dde3ec'), white = new THREE.Color('#ffffff');
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, y = lerp(top, hem, v), r = rad.getPoint(v).y, g = gap.getPoint(v).y;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, th = g + (TAU - 2 * g) * u;
      pos.push(r * sin(th), y - top, r * 0.86 * cos(th));
      c.copy(white).lerp(edgeC, smooth(0.86, 0.98, abs(2 * u - 1)));
      col.push(c.r, c.g, c.b);
    }
  }
  const w = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * w + i, b = a + w, d = a + 1, e = b + 1;
    idx.push(a, b, d, d, b, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  if (!q) return g;
  const pocket = (sx) => paint(new THREE.BoxGeometry(0.125, 0.105, 0.012).rotateY(sx * 0.6).translate(sx * 0.178, -0.16 - top, 0.238), '#e2e8f1');
  return merge(g, pocket(-1), pocket(1));
}

// A hair shell is a sphere cap whose lower edge follows line(phi), the polar angle of the hairline
// at each azimuth (phi 0 = forehead, PI = nape). Its rim dives under the skull so no open edge shows.
function shell(line, { puff = 0.07, nu = 26, nv = 10, bump = null }) {
  const R = RIG.headR, pos = [...onSkull(0, 0, R * (1 + puff))], idx = [];
  for (let j = 1; j <= nv; j++) for (let i = 0; i < nu; i++) {
    const v = j / nv, phi = (i / nu) * TAU, th = v * line(phi), tuck = smooth(0.8, 1, v);
    const r = R * (1 + puff * (1 - tuck) - 0.05 * tuck * tuck) + (bump ? bump(th, phi) * (1 - tuck) : 0);
    pos.push(...onSkull(th, phi, r));
  }
  const at = (j, i) => 1 + (j - 1) * nu + ((i + nu) % nu);
  for (let i = 0; i < nu; i++) idx.push(0, at(1, i), at(1, i + 1));
  for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(j, i), b = at(j + 1, i), c = at(j, i + 1), d = at(j + 1, i + 1);
    idx.push(a, b, c, c, b, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const faceward = (phi) => (1 + cos(phi)) / 2;

/** Hair styles: 0 tidy crop with a side parting, 1 rounded bob, 2 top bun, 3 soft curls. */
export function hairGeos(q) {
  const S = { nu: q ? 28 : 12, nv: q ? 11 : 6 };
  const crop = (phi) => { const f = pow(faceward(phi), 1.5); return lerp(2.05, 1.0, f) + 0.22 * sin(phi) * f; };
  const bob = (phi) => lerp(2.5, 0.98, smooth(0.4, 0.9, faceward(phi))) + 0.1 * sin(phi) * smooth(0.8, 1, faceward(phi));
  const tied = (phi) => lerp(1.9, 1.06, pow(faceward(phi), 1.3));
  const curl = (phi) => lerp(2.12, 1.12, pow(faceward(phi), 1.4));
  // Bumps come from the 3D direction, not the angles, so nothing pinches at the crown.
  const curlBump = (th, phi) => 0.03 * sin(sin(th) * sin(phi) * 9.1 + 1) * sin(cos(th) * 9.3 + 2) * sin(sin(th) * cos(phi) * 9.7 + 0.5);
  const knot = new THREE.SphereGeometry(0.105, q ? 14 : 8, q ? 10 : 6).scale(1, 0.92, 1).translate(0, 0.292, -0.1);
  knot.deleteAttribute('uv');
  return [
    paint(shell(crop, { ...S, puff: 0.075 })),
    paint(shell(bob, { ...S, puff: 0.115 })),
    paint(merge(shell(tied, { ...S, puff: 0.06 }), knot)),
    paint(shell(curl, { ...S, puff: 0.16, bump: curlBump })),
  ];
}

/** Theatre cap and mask in one piece, coloured in vertices so the tint stays white. */
export function surgicalGeo(q) {
  const S = { nu: q ? 30 : 13, nv: q ? 11 : 6 };
  const line = (phi) => lerp(1.98, 1.2, pow(faceward(phi), 1.2));
  const cap = paint(shell(line, { ...S, puff: 0.1, bump: (th) => 0.006 * sin(th * 14) }), '#6fc09b');
  const R = RIG.headR * 1.045, nu = q ? 16 : 7, nv = q ? 7 : 3, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu - 0.5, v = j / nv, phi = u * 2.1, th = lerp(1.6, 2.42, v) - 0.1 * (2 * abs(u)) * (2 * abs(u));
    pos.push(...onSkull(th, phi, R + 0.012 * sin(v * PI) * cos(u * PI)));
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + nu + 1, c = a + 1, d = b + 1;
    idx.push(a, b, c, c, b, d);
  }
  const mask = new THREE.BufferGeometry();
  mask.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mask.setIndex(idx); mask.computeVertexNormals();
  return merge(cap, paint(mask, '#d9f0f6'));
}

/** Stethoscope or lanyard: a soft loop that falls from behind the neck onto the chest. */
export function neckGeo(q) {
  const pts = [[-0.05, 0.19, 0.242], [-0.11, 0.3, 0.222], [-0.15, 0.42, 0.13], [-0.09, 0.485, -0.03], [0, 0.5, -0.09], [0.09, 0.485, -0.03], [0.15, 0.42, 0.13], [0.11, 0.3, 0.222], [0.05, 0.19, 0.242]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), q ? 30 : 12, 0.0125, q ? 6 : 3, false);
  return paint(g);
}

/** A tablet: the one thing almost everyone in a modern hospital carries. Pivot at its centre. */
export function heldGeo() {
  const body = paint(new THREE.BoxGeometry(0.21, 0.28, 0.02), '#47505f');
  const screen = paint(new THREE.BoxGeometry(0.18, 0.245, 0.006).translate(0, 0, 0.012), '#a4efe2');
  return merge(body, screen);
}

/**
 * Turns a registered prop into one vertex-coloured geometry, so a real gurney or wheelchair can be instanced
 * for one draw call instead of the dozens its own group would cost.
 */
export function bakeProp(name, fallback) {
  if (!hasProp(name)) return fallback();
  const g = makeProp(name, {}), geos = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!o.isMesh || o.userData.contact || m?.transparent || !m?.color) return;
    const part = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(part.attributes)) if (k !== 'position' && k !== 'normal') part.deleteAttribute(k);
    part.morphAttributes = {};
    part.applyMatrix4(o.matrixWorld);
    geos.push(paint(part, m.color));
  });
  return geos.length ? merge(geos) : fallback();
}

/** Used only when a prop has not been registered: a plain trolley, so nobody ever floats. */
export function plainTrolley() {
  const deck = paint(new THREE.BoxGeometry(0.72, 0.1, 1.95).translate(0, 0.72, 0), '#f2f3f6');
  const base = paint(new THREE.BoxGeometry(0.5, 0.05, 1.3).translate(0, 0.22, 0), '#b9bec8');
  const post = paint(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(0, 0.46, 0), '#b9bec8');
  return merge(deck, base, post);
}

/** Mop: shaft pivot at the floor head, standing along +Y. */
export function mopGeo() {
  const shaft = paint(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 6).translate(0, 0.72, 0), '#c9ced8');
  const head = paint(new THREE.BoxGeometry(0.42, 0.05, 0.13).translate(0, 0.045, 0), '#5cc3d6');
  const fuzz = paint(new THREE.BoxGeometry(0.46, 0.05, 0.16).translate(0, 0.012, 0), '#f6f8fb');
  return merge(shaft, head, fuzz);
}

// ── Who wears what ──────────────────────────────────────────────

export const rng = (seed, k) => { const x = sin((seed + 1.37) * 127.1 + k * 311.7) * 43758.5453; return x - floor(x); };
const pick = (list, r) => list[min(list.length - 1, floor(r * list.length))];
const rgb = (hex) => { const k = new THREE.Color(hex); return [k.r, k.g, k.b]; };
const shade = (hex, dl) => { const k = new THREE.Color(hex); k.offsetHSL(0, 0, dl); return [k.r, k.g, k.b]; };
const idHash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };

const NAVY = '#55617f', SLATE = '#6b7690', DENIM = ['#54709a', '#41567e', '#7b8aa6'], CHINO = ['#c9b79a', '#8a8f9c', '#6f5a4a', '#a58f77'];
const CASUAL = ['#e98f98', '#f0bf3e', '#7aa7d9', '#a58be0', '#7cc8a4', '#f4efe6', '#e4606a', '#5fb0c9', '#f6a85c', '#d9a7c7'];
const CARDIGAN = [C.rose, '#e6b84f', C.tealDeep, C.purple, C.coralDeep];

// trim kinds, painted procedurally on the torso shader: 1 V-neck, 2 reflective bands, 3 apron bib, 4 small print, 5 tie
const ROLES = {
  nurse(L, r) {
    L.top = rgb(C.scrubNurse); L.leg = L.shin = shade(C.scrubNurse, -0.05); L.shoe = rgb('#f6f8fb');
    L.trimKind = 1; L.trim = L.skin; L.lanyard = rgb(C.coral); L.carry = r(20) > 0.72; L.work = 'tablet'; L.idles = [0, 1, 4];
  },
  doctor(L, r) {
    L.top = rgb(pick(['#cfe3f3', '#dfe6ef', '#cde6df'], r(20))); L.leg = L.shin = rgb(pick([NAVY, SLATE, '#4f6a7f'], r(21))); L.shoe = rgb(C.charcoal);
    L.coat = rgb('#fbfcfe'); L.coatLen = 1; L.sleeve = L.fore = L.coat; L.trimKind = 5; L.trim = rgb(pick([C.tealDeep, C.coralDeep, C.purple], r(22)));
    L.steth = rgb('#39414f'); L.carry = r(23) > 0.45; L.work = 'tablet'; L.idles = [0, 2, 3];
  },
  surgeon(L) {
    L.top = rgb(C.scrubSurgeon); L.leg = L.shin = shade(C.scrubSurgeon, -0.05); L.shoe = rgb('#eef4ee'); L.hand = rgb('#cfe9f4');
    L.trimKind = 1; L.trim = shade(C.scrubSurgeon, -0.12); L.cap = true; L.style = -1; L.stache = null; L.mouth = false; L.work = 'hands'; L.idles = [1, 0, 2];
  },
  tech(L) {
    L.top = rgb(C.scrubTech); L.leg = L.shin = shade(C.scrubTech, -0.05); L.shoe = rgb('#eef0f6');
    L.trimKind = 1; L.trim = L.skin; L.lanyard = rgb('#f6f8fb'); L.work = 'hands'; L.idles = [0, 3, 4];
  },
  porter(L) {
    L.top = rgb(C.scrubPorter); L.leg = L.shin = rgb(NAVY); L.shoe = rgb(C.charcoal); L.work = 'hands'; L.idles = [0, 4, 3];
  },
  paramedic(L) {
    L.top = rgb(C.paramedic); L.sleeve = L.fore = L.top; L.leg = L.shin = shade(C.paramedic, -0.09); L.shoe = rgb(C.ink);
    L.trimKind = 2; L.trim = rgb('#f3f7ee'); L.work = 'hands'; L.idles = [0, 4];
  },
  cleaner(L) {
    L.top = rgb('#f2d873'); L.leg = L.shin = rgb(SLATE); L.shoe = rgb('#eef0f6'); L.hand = rgb('#f5cc55');
    L.trimKind = 3; L.trim = rgb('#5cb6c9'); L.work = 'mop'; L.idles = [0, 4];
  },
  reception(L, r) {
    L.top = rgb('#fbf8f2'); L.coat = rgb(pick(CARDIGAN, r(20))); L.coatLen = 0.64; L.sleeve = L.fore = L.coat; L.leg = L.shin = rgb(pick([NAVY, '#5f6f92', '#74637f'], r(21))); L.shoe = rgb(C.charcoal);
    L.lanyard = rgb(C.teal); L.work = 'type'; L.idles = [1, 0];
  },
  pharmacist(L) {
    L.top = rgb(C.leafLight); L.coat = rgb('#fbfcfe'); L.coatLen = 0.82; L.sleeve = L.fore = L.coat; L.leg = L.shin = rgb(SLATE); L.shoe = rgb(C.charcoal);
    L.lanyard = rgb(C.leaf); L.work = 'hands'; L.idles = [0, 2];
  },
  patient(L, r) {
    L.top = rgb(C.gown); L.coat = rgb(C.gown); L.coatLen = 0.86; L.sleeve = L.top; L.leg = L.skin; L.shin = L.skin; L.shoe = rgb('#a9d3ea');
    L.trimKind = 4; L.trim = rgb('#9cc8e4'); L.swing = 0.65; L.stoop = 0.03 + r(21) * 0.07; L.bounce = 0.3; L.idles = [0, 1];
    if (r(22) > 0.62) { L.hair = rgb(pick(['#c9c9d2', '#a9a9b5', '#e4e4ea'], r(23))); }
  },
  visitor(L, r) {
    L.top = rgb(pick(CASUAL, r(20))); L.leg = L.shin = rgb(r(21) > 0.4 ? pick(DENIM, r(22)) : pick(CHINO, r(22))); L.shoe = rgb(pick(['#f4f6fa', C.charcoal, '#c26a5a', '#7aa7d9'], r(23)));
    L.fore = r(24) > 0.6 ? L.top : L.skin; L.idles = [0, 3, 2, 4];
    if (r(25) > 0.86) { L.s *= 0.68; L.w *= 0.94; L.bounce = 1.6; L.child = true; L.stache = null; }
  },
};

const HAIR_ODDS = [0.4, 0.64, 0.84, 1];

export function makeLook(actor) {
  const seed = actor.seed ?? idHash(actor.id), r = (k) => rng(seed, k);
  const skin = rgb(pick(C.skin, r(1)));
  const roll = r(2);
  const L = {
    role: actor.role, seed, skin,
    hair: rgb(pick(C.hair, r(3))), style: HAIR_ODDS.findIndex((p) => roll < p),
    s: 1.06 + r(4) * 0.11, w: 0.94 + r(5) * 0.18,
    top: rgb('#ffffff'), leg: rgb(NAVY), shin: rgb(NAVY), shoe: rgb(C.charcoal),
    sleeve: null, fore: skin, hand: skin,
    trim: rgb('#ffffff'), trimKind: 0,
    coat: null, coatLen: 1, steth: null, lanyard: null, cap: false, carry: false,
    stache: null, mouth: true,
    swing: 0.85 + r(7) * 0.4, bounce: 0.6 + r(8) * 0.8, waddle: 0.035 + r(9) * 0.035, stoop: r(10) * 0.025,
    blink: 0.17 + r(11) * 0.14, r: r(12),
    work: 'hands', idles: [0, 1, 2, 3],
  };
  if (r(6) > 0.88 && L.style !== 1) L.stache = L.hair;
  (ROLES[actor.role] ?? ROLES.visitor)(L, r);
  L.sleeve ??= L.top;
  return L;
}
