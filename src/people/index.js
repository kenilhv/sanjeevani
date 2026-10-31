// Everyone in the hospital, drawn by a dozen instanced meshes that are rewritten compactly each frame.
// One set lives in world space; each person's root is multiplied by their plate's matrix, so plates can
// move freely and a hidden plate simply contributes no instances.
import * as THREE from 'three';
import { contact } from '../style/kit.js';
import { C } from '../style/palette.js';
import { RIG, limbGeo, dotGeo, headGeo, torsoGeo, coatGeo, hairGeos, surgicalGeo, neckGeo, heldGeo, mopGeo, bakeProp, plainTrolley, makeLook } from './rig.js';
import {
  PX, PY, PZ, FLAT, ROLL, TWIST, LEAN, NOD, TURN, TILT, ARM_L, OUT_L, ELB_L, IN_L, ARM_R, OUT_R, ELB_R, IN_R,
  HIP_L, KNEE_L, FOOT_L, HIP_R, KNEE_R, FOOT_R, GROUND, COAT, EYES, MOUTH, HOLD, SPLAY, MOP, BREATH, CHANNELS, POSES, ANIM_ID,
} from './poses.js';
import { createBubbles } from './bubbles.js';
import { createFlow } from './flow.js';
import { createVehicles } from './vehicles.js';
import { newTrack, stepTrack, snapTrack } from './ease.js';

const { sin, cos, abs, min, max, exp, hypot, atan2, PI } = Math;
const HALF_PI = PI / 2, TAU = PI * 2;
const CAP = 140, LOD_PPM = 58;
const wrap = (a) => atan2(sin(a), cos(a));
const clamp = (x, a, b) => min(b, max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgb = (hex) => { const k = new THREE.Color(hex); return [k.r, k.g, k.b]; };
const INK = rgb('#2b2730'), WHITE = rgb('#ffffff'), STEEL = rgb('#c3cad6'), MOUTH_IN = rgb('#8c3b3f'), BLANKET = rgb(C.blanket);

const TRIM_GLSL = /* glsl */`
  if (vTrim.a > 0.5) {
    vec3 p = vBody; float m = 0.0, front = smoothstep(-0.02, 0.02, p.z), k = vTrim.a, d, aa;
    if (k < 1.5) { d = p.y - (0.312 + abs(p.x) * 1.3); aa = fwidth(d); m = smoothstep(-aa, aa, d) * front; }
    else if (k < 2.5) { d = 0.027 - min(abs(p.y - 0.19), abs(p.y - 0.035)); aa = fwidth(d); m = smoothstep(-aa, aa, d); }
    else if (k < 3.5) { d = min(min(0.165 - abs(p.x), 0.3 - p.y), p.y + 0.14); aa = fwidth(d); m = smoothstep(-aa, aa, d) * front; }
    else if (k < 4.5) { vec2 g = p.xy * 11.0; g.x += floor(g.y) * 0.5; g = fract(g) - 0.5; d = 0.16 - length(g); aa = fwidth(d); m = smoothstep(-aa, aa, d); }
    else { d = min(0.018 + (0.42 - p.y) * 0.05 - abs(p.x), p.y + 0.02); aa = fwidth(d); m = smoothstep(-aa, aa, d) * front; }
    diffuseColor.rgb = mix(diffuseColor.rgb, vTrim.rgb, m);
  }`;

function withTrim(material) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aTrim; varying vec4 vTrim; varying vec3 vBody;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrim = aTrim; vBody = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTrim; varying vec3 vBody;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${TRIM_GLSL}`);
  };
  material.customProgramCacheKey = () => 'haven-trim';
  return material;
}

function makePart(scene, geos, material, cap, { cast = false, color = true, order = 0 } = {}) {
  const mesh = new THREE.InstancedMesh(geos[0], material, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (color) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = cast; mesh.receiveShadow = false; mesh.visible = false; mesh.renderOrder = order;
  scene.add(mesh);
  return { mesh, geos, m: mesh.instanceMatrix.array, c: mesh.instanceColor?.array, n: 0 };
}

const flushAttr = (a, n) => { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; };
function flush(p) {
  const { mesh, n } = p;
  mesh.count = n; mesh.visible = n > 0;
  if (!n) return;
  flushAttr(mesh.instanceMatrix, n);
  if (p.c) flushAttr(mesh.instanceColor, n);
}

// P × T(t) × Ry·Rx·Rz: the one bone operation, written out flat because it runs about 1500 times a frame.
function bone(O, P, tx, ty, tz, rx, ry, rz) {
  const a = cos(rx), b = sin(rx), c = cos(ry), d = sin(ry), e = cos(rz), f = sin(rz), ce = c * e, cf = c * f, de = d * e, df = d * f;
  const r0 = ce + df * b, r1 = a * f, r2 = cf * b - de, r4 = de * b - cf, r5 = a * e, r6 = df + ce * b, r8 = a * d, r9 = -b, r10 = a * c;
  const p0 = P[0], p1 = P[1], p2 = P[2], p4 = P[4], p5 = P[5], p6 = P[6], p8 = P[8], p9 = P[9], p10 = P[10];
  O[0] = p0 * r0 + p4 * r1 + p8 * r2; O[1] = p1 * r0 + p5 * r1 + p9 * r2; O[2] = p2 * r0 + p6 * r1 + p10 * r2;
  O[4] = p0 * r4 + p4 * r5 + p8 * r6; O[5] = p1 * r4 + p5 * r5 + p9 * r6; O[6] = p2 * r4 + p6 * r5 + p10 * r6;
  O[8] = p0 * r8 + p4 * r9 + p8 * r10; O[9] = p1 * r8 + p5 * r9 + p9 * r10; O[10] = p2 * r8 + p6 * r9 + p10 * r10;
  O[12] = p0 * tx + p4 * ty + p8 * tz + P[12]; O[13] = p1 * tx + p5 * ty + p9 * tz + P[13]; O[14] = p2 * tx + p6 * ty + p10 * tz + P[14];
  O[3] = O[7] = O[11] = 0; O[15] = 1;
}
const scaleBasis = (m, s) => { for (let i = 0; i < 11; i++) if (i % 4 !== 3) m[i] *= s; };
const legDrop = (hip, knee) => RIG.thigh * cos(hip) + RIG.shin * cos(hip - knee) + RIG.ankle;

export function createPeople(engine) {
  const { scene, camera, floors } = engine;
  const lods = (fn) => [fn(0), fn(1)];
  const solid = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.66, vertexColors: true });
  const silky = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.46, vertexColors: true });
  const cloth = withTrim(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, vertexColors: true }));
  const sheet = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, vertexColors: true, side: THREE.DoubleSide });
  const torsoLods = lods(torsoGeo), hairLods = [hairGeos(0), hairGeos(1)];
  const trimAttr = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  for (const g of torsoLods) g.setAttribute('aTrim', trimAttr);

  const LIMB = makePart(scene, lods(limbGeo), solid, CAP * 8, { cast: true });
  const TORSO = makePart(scene, torsoLods, cloth, CAP, { cast: true });
  const HEAD = makePart(scene, lods(headGeo), solid, CAP, { cast: true });
  const DOTS = makePart(scene, lods(dotGeo), solid, CAP * 14);
  const COATS = makePart(scene, lods(coatGeo), sheet, CAP, { cast: true });
  const HAIR = [0, 1, 2, 3].map((i) => makePart(scene, [hairLods[0][i], hairLods[1][i]], silky, CAP));
  const SURG = makePart(scene, lods(surgicalGeo), solid, CAP);
  const NECK = makePart(scene, lods(neckGeo), silky, CAP);
  const held = [heldGeo(), heldGeo()], mop = [mopGeo(), mopGeo()];
  const HELD = makePart(scene, held, solid, 48);
  const MOPS = makePart(scene, mop, solid, 24);
  const shadow = contact(1, 1, 0.5);
  const DISC = makePart(scene, [shadow.geometry, shadow.geometry], shadow.material, CAP + 24, { color: false, order: 1 });
  const gurney = bakeProp('gurney', plainTrolley), wheelchair = bakeProp('wheelchair', plainTrolley);
  const GURNEY = makePart(scene, [gurney, gurney], solid, 12, { cast: true });
  const CHAIR = makePart(scene, [wheelchair, wheelchair], solid, 12, { cast: true });
  const PARTS = [LIMB, TORSO, HEAD, DOTS, COATS, ...HAIR, SURG, NECK, HELD, MOPS, DISC, GURNEY, CHAIR];
  const bubbles = createBubbles(scene, 48), flow = createFlow(engine), vehicles = createVehicles(engine);

  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color(C.teal) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uA; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0, w = fract(uT * 0.7);
        float ring = smoothstep(0.5, 0.56, d) * smoothstep(0.7, 0.62, d);
        float wave = smoothstep(w - 0.16, w, d) * smoothstep(w + 0.05, w, d) * (1.0 - w) * 0.55;
        float glow = smoothstep(1.0, 0.25, d) * 0.2;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), ring * 0.45), clamp(ring * 0.95 + wave + glow, 0.0, 1.0) * uA);
        #include <colorspace_fragment>
      }`,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9).rotateX(-HALF_PI), ringMat);
  ring.visible = false; ring.renderOrder = 3; ring.frustumCulled = false;
  scene.add(ring);

  const pickGeo = new THREE.CapsuleGeometry(0.36, 1, 2, 6).translate(0, 0.86, 0);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  const byId = new Map(), list = [];
  const mRoot = new Float64Array(16), mPelvis = new Float64Array(16), mTorso = new Float64Array(16), mHead = new Float64Array(16), mA = new Float64Array(16), mB = new Float64Array(16), mC = new Float64Array(16);
  const vp = new THREE.Matrix4(), tint = [0, 0, 0];
  let stamp = 0, frame = 0, slot = 0, selected = null, ringA = 0, hiLod = -1;

  function put(p, M, tx, ty, tz, sx, sy, sz, col) {
    const i = p.n++, o = i * 16, a = p.m;
    a[o] = M[0] * sx; a[o + 1] = M[1] * sx; a[o + 2] = M[2] * sx; a[o + 3] = 0;
    a[o + 4] = M[4] * sy; a[o + 5] = M[5] * sy; a[o + 6] = M[6] * sy; a[o + 7] = 0;
    a[o + 8] = M[8] * sz; a[o + 9] = M[9] * sz; a[o + 10] = M[10] * sz; a[o + 11] = 0;
    a[o + 12] = M[0] * tx + M[4] * ty + M[8] * tz + M[12];
    a[o + 13] = M[1] * tx + M[5] * ty + M[9] * tz + M[13];
    a[o + 14] = M[2] * tx + M[6] * ty + M[10] * tz + M[14];
    a[o + 15] = 1;
    if (col) { const c = p.c, k = i * 3; c[k] = col[0]; c[k + 1] = col[1]; c[k + 2] = col[2]; }
  }
  // Joints sit at cap centres, so a bent elbow or knee stays round with no gap on the outside.
  const limb = (M, len, d, col) => put(LIMB, M, 0, d / 2, 0, d, len + d, d, col);

  function spawn(a) {
    if (list.length >= CAP) return null;
    const look = makeLook(a);
    const P = {
      id: a.id, actor: a, look, slot: slot++, stamp, s: look.s, floor: a.floor,
      x: a.x, z: a.z, y: a.y ?? 0, vx: 0, vz: 0, h: a.heading ?? 0, spd: 0, track: newTrack(a.x, a.z),
      phase: look.r * TAU, amp: 0, stride: 0.8, seat: a.anim === 'lie' ? RIG.pillow : RIG.seat, pop: frame < 2 ? 1 : 0, popV: 0, warp: false,
      cart: 0, cartKind: 0, inBed: false, rollT: 9,
      cur: new Float32Array(CHANNELS), tgt: new Float32Array(CHANNELS), from: new Float32Array(CHANNELS), blend: 1, key: -1, sub: 0,
      bIcon: -1, bS: 0, bV: 0, wx: 0, wy: 0, wz: 0, headY: 1.6, shown: false, proxy: null,
    };
    const proxy = new THREE.Mesh(pickGeo, pickMat);
    proxy.matrixAutoUpdate = false; proxy.matrixWorldAutoUpdate = false;
    scene.add(proxy);
    engine.addPickable(proxy, { type: 'person', id: a.id });
    P.proxy = proxy;
    byId.set(a.id, P); list.push(P);
    return P;
  }
  function despawn(i) {
    const P = list[i];
    engine.removePickable(P.proxy);
    scene.remove(P.proxy);
    byId.delete(P.id);
    list[i] = list[list.length - 1]; list.pop();
  }

  function motion(P, dt, here, twin) {
    const a = P.actor, dx = a.x - P.x, dz = a.z - P.z;
    if (a.floor !== P.floor || dx * dx + dz * dz > 49) P.warp = true;
    if (P.warp && P.pop < 0.06) {
      P.x = a.x; P.z = a.z; P.vx = P.vz = 0; P.y = a.y ?? 0; P.floor = a.floor; P.h = a.heading ?? P.h; P.warp = false; P.spd = 0;
      snapTrack(P.track, a.x, a.z);
    }
    const want = !here || a.hidden || P.warp ? 0 : 1;
    if (want) { P.popV += ((1 - P.pop) * 170 - P.popV * 15) * dt; P.pop += P.popV * dt; } else { P.pop = max(0, P.pop - dt * 8); P.popV = 0; }
    if (!P.warp) {
      stepTrack(P.track, a.x, a.z, dt);
      const q = P.track, w = 13, den = 1 + 2 * w * dt + w * w * dt * dt;
      P.vx = (P.vx + dt * w * w * (q.x - P.x)) / den; P.x += dt * P.vx;
      P.vz = (P.vz + dt * w * w * (q.z - P.z)) / den; P.z += dt * P.vz;
    }
    P.spd = hypot(P.vx, P.vz);
    let anim = POSES[a.anim] ? a.anim : 'idle';
    const moving = P.spd > 0.3, rolling = P.spd > 0.12, ay = a.y ?? 0;
    if (moving && (anim === 'idle' || anim === 'talk' || anim === 'work')) anim = 'walk';
    const seated = anim === 'sit' || anim === 'lie';

    // Anyone travelling lying down or seated is on wheels. The sim only moves them, so the gurney or chair is drawn here.
    const pushed = rolling || a._followers?.length > 0, bed = anim === 'lie' && a.bedId != null ? twin.beds?.get(a.bedId) : null;
    P.rollT = pushed ? 0 : P.rollT + dt;
    P.inBed = !!bed && !pushed && abs(bed.x - a.x) + abs(bed.z - a.z) < 0.6;
    if (anim === 'lie' && pushed) P.cartKind = 1; else if (anim === 'sit' && pushed) P.cartKind = 2; else if (!seated) P.cartKind = 0;
    const cartWant = P.cartKind > 0 && P.rollT < 1 && !P.inBed;
    P.cart += ((cartWant ? 1 : 0) - P.cart) * (1 - exp(-dt * 9));
    if (P.cart < 0.01 && !cartWant) { P.cart = 0; P.cartKind = 0; }
    const pillow = P.cartKind === 1 ? RIG.gurneyPillow : !P.inBed ? RIG.tablePillow : bed.kind === 'or' ? RIG.orPillow : ay > 0.3 ? ay + 0.24 : RIG.pillow;
    const seat = anim === 'lie' ? pillow : anim === 'sit' ? (ay > 0.2 ? ay : RIG.seat) : P.seat;
    P.seat += (seat - P.seat) * (1 - exp(-dt * 10));

    P.y += ((seated ? 0 : ay) - P.y) * (1 - exp(-dt * 10));
    const th = moving && !seated ? atan2(P.vx, P.vz) : a.heading ?? P.h;
    P.h = wrap(P.h + wrap(th - P.h) * (1 - exp(-dt * (moving ? 10 : 7))));

    const v = P.spd / P.s, stride = clamp(0.66 + 0.36 * v, 0.66, 2.3);
    const ampT = Math.asin(min(0.84, stride / (4 * RIG.legs))) * smooth(0.04, 0.5, v);
    P.amp += (ampT - P.amp) * (1 - exp(-dt * 12));
    P.stride = stride * P.s;
    // Legs follow distance actually covered, so feet stay planted. The cap keeps fast-forward from blurring them.
    P.phase += min(P.spd * dt / P.stride, dt * 3.7) * TAU;
    if (P.phase > 1e4) P.phase -= TAU * 1500;
    return anim;
  }

  function pose(P, anim, dt, t) {
    const L = P.look;
    // Staff only ever sit at a desk or in a break room, and busy hands read better than folded ones.
    if (anim === 'sit' && P.actor.kind === 'staff' && P.cartKind === 0) anim = 'deskWork';
    if (anim === 'idle') {
      const n = L.idles.length, slotT = Math.floor((t + L.r * 41) / (7 + L.r * 7));
      P.sub = L.idles[Math.abs((slotT * 7 + Math.floor(L.r * 53)) % n)];
    } else P.sub = 0;
    const key = ANIM_ID[anim] * 8 + P.sub;
    POSES[anim](P.tgt, P, t);
    const { cur, tgt, from } = P;
    if (P.key < 0) { cur.set(tgt); P.key = key; P.blend = 1; return; }
    if (key !== P.key) { from.set(cur); P.blend = 0; P.key = key; }
    if (P.blend < 1) {
      P.blend = min(1, P.blend + dt / 0.25);
      const b = P.blend, e = b * b * (3 - 2 * b);
      for (let i = 0; i < CHANNELS; i++) cur[i] = from[i] + (tgt[i] - from[i]) * e;
    } else cur.set(tgt);
  }

  function arm(P, c, side, ARM, OUT, ELB, IN, hide) {
    const L = P.look;
    bone(mA, mTorso, side * RIG.shoulderX * L.w, RIG.shoulderY, 0, -c[ARM], 0, side * c[OUT]);
    if (!hide) limb(mA, RIG.upperArm, RIG.armD, L.sleeve);
    bone(mB, mA, 0, -RIG.upperArm, 0, -c[ELB], -side * c[IN], 0);
    if (hide) return;
    limb(mB, RIG.foreArm, RIG.foreD, L.fore);
    put(DOTS, mB, 0, -RIG.foreArm - 0.012, 0, RIG.hand, RIG.hand * 1.12, RIG.hand, L.hand);
    if (side > 0 && c[HOLD] > 0.04) {
      bone(mC, mB, -0.06, -RIG.foreArm - 0.02, 0.06, 1.15, 0.5, 0);
      put(HELD, mC, 0, 0, 0, c[HOLD], c[HOLD], c[HOLD], WHITE);
    }
  }

  function leg(P, c, side, HIP, KNEE, FOOT) {
    const L = P.look, hip = c[HIP], knee = c[KNEE];
    bone(mA, mPelvis, side * RIG.hipX * L.w, 0, 0, -hip, 0, -c[PX] / 0.55 + side * c[SPLAY]);
    limb(mA, RIG.thigh, RIG.thighD, L.leg);
    bone(mB, mA, 0, -RIG.thigh, 0, knee, 0, 0);
    limb(mB, RIG.shin, RIG.shinD, L.shin);
    bone(mC, mB, 0, -RIG.shin, 0, hip - knee + c[FOOT] - HALF_PI, 0, 0);
    put(DOTS, mC, 0, -0.052, -0.012, RIG.shoeW, RIG.shoeL, RIG.shoeH, L.shoe);
  }

  function skin(P, F, t) {
    const c = P.cur, L = P.look, s = P.s * max(0.001, P.pop);
    bone(mRoot, F, P.x, P.y, P.z, 0, P.h, 0); scaleBasis(mRoot, s);
    const ground = c[GROUND] > 0.001 ? c[GROUND] * max(legDrop(c[HIP_L], c[KNEE_L]), legDrop(c[HIP_R], c[KNEE_R])) : 0;
    bone(mPelvis, mRoot, c[PX], c[PY] + ground, c[PZ], -c[FLAT] * HALF_PI, -c[TWIST] * 0.4, 0);
    bone(mTorso, mPelvis, 0, 0, 0, c[LEAN], c[TWIST], c[ROLL]);
    const flat = c[FLAT], tucked = flat > 0.97, breath = 1 + c[BREATH] * 0.012;

    if (P.cart > 0.01) {
      const e = P.cart * P.pop, cart = P.cartKind === 1 ? GURNEY : CHAIR, wide = P.cartKind === 1 ? 1.15 : 0.95, long = P.cartKind === 1 ? 2.7 : 1.15;
      bone(mC, F, P.x, P.y, P.z, 0, P.h, 0);
      put(cart, mC, 0, 0, 0, e, e, e, WHITE);
      put(DISC, mC, 0, 0.016, 0, wide * e, 1, long * e, null);
    }

    // The bed's own blanket morphs over the body, so in bed only the head is drawn. Anywhere else (a gurney, a scanner
    // table) the torso instance stretches into a soft covered mound instead.
    if (!(tucked && P.inBed)) {
      let col = L.top;
      if (flat > 0.01) { for (let i = 0; i < 3; i++) tint[i] = L.top[i] + (BLANKET[i] - L.top[i]) * flat; col = tint; }
      const i = TORSO.n, k = L.w * (1 + flat * 0.62);
      put(TORSO, mTorso, 0, -0.74 * flat, -0.24 * flat, k, 1 + flat * 1.3, (1 + flat * -0.32) * breath, col);
      const tr = trimAttr.array, off = i * 4;
      tr[off] = L.trim[0]; tr[off + 1] = L.trim[1]; tr[off + 2] = L.trim[2]; tr[off + 3] = flat > 0.5 ? 0 : L.trimKind;
    }

    if (L.coat && !tucked) {
      const stride = 1 + P.amp * 0.32 * abs(sin(P.phase));
      const scale = L.coatLen * (c[COAT] < 1 ? 0.55 + 0.45 * c[COAT] : 1);
      put(COATS, mTorso, 0, 0.45, 0, L.w, scale, stride, L.coat);
    }
    arm(P, c, 1, ARM_L, OUT_L, ELB_L, IN_L, tucked);
    arm(P, c, -1, ARM_R, OUT_R, ELB_R, IN_R, tucked);
    if (!tucked) {
      leg(P, c, 1, HIP_L, KNEE_L, FOOT_L);
      leg(P, c, -1, HIP_R, KNEE_R, FOOT_R);
      if (L.steth) { put(NECK, mTorso, 0, 0, 0, L.w, 1, 1, L.steth); put(DOTS, mTorso, -0.05, 0.178, 0.25, 0.036, 0.036, 0.014, STEEL); put(DOTS, mTorso, 0.05, 0.178, 0.25, 0.022, 0.022, 0.012, L.steth); }
      else if (L.lanyard) { put(NECK, mTorso, 0, 0, 0, L.w, 1, 1, L.lanyard); put(DOTS, mTorso, 0, 0.145, 0.246, 0.05, 0.062, 0.01, WHITE); }
    }

    bone(mHead, mTorso, 0, RIG.neckY, 0, c[NOD], c[TURN], c[TILT]);
    bone(mHead, mHead, 0, RIG.headUp, 0, 0, 0, 0);
    put(HEAD, mHead, 0, 0, 0, 1, 1, 1, L.skin);
    if (L.style >= 0) put(HAIR[L.style], mHead, 0, 0, 0, 1, 1, 1, L.hair);
    if (L.cap) put(SURG, mHead, 0, 0, 0, 1, 1, 1, WHITE);
    const b = (t * L.blink + L.r * 9) % 1, open = c[EYES] * (b < 0.035 ? 0.1 : 1), e = 0.052 * max(0.14, open);
    put(DOTS, mHead, RIG.eyeX, RIG.eyeY, RIG.eyeZ, 0.037, e, 0.022, INK);
    put(DOTS, mHead, -RIG.eyeX, RIG.eyeY, RIG.eyeZ, 0.037, e, 0.022, INK);
    if (hiLod === 1 && open > 0.5) {
      put(DOTS, mHead, RIG.eyeX + 0.012, RIG.eyeY + 0.018, RIG.eyeZ + 0.016, 0.0125, 0.0125, 0.008, WHITE);
      put(DOTS, mHead, -RIG.eyeX + 0.012, RIG.eyeY + 0.018, RIG.eyeZ + 0.016, 0.0125, 0.0125, 0.008, WHITE);
    }
    if (L.stache) put(DOTS, mHead, 0, -0.078, RIG.mouthZ + 0.004, 0.058, 0.016, 0.014, L.stache);
    if (L.mouth && c[MOUTH] > 0.06) put(DOTS, mHead, 0, RIG.mouthY, RIG.mouthZ, 0.032, 0.03 * c[MOUTH], 0.01, MOUTH_IN);

    if (c[MOP] > 0.5) {
      const sw = sin((t + L.r * 97) * 2.3);
      bone(mC, mRoot, sw * 0.26, 0, 0.62, 0.3, sw * 0.5, sw * 0.14);
      put(MOPS, mC, 0, 0, 0, 1, 1, 1, WHITE);
    }

    // Plate-space contact shadow. Shrinks as the feet leave the floor, and vanishes in bed.
    const disc = (1 - flat) * (0.5 + 0.5 * c[GROUND]) * s * (1.02 - 0.05 * abs(sin(P.phase)) * P.amp);
    if (disc > 0.02) put(DISC, F, P.x, P.y + 0.016, P.z, disc, 1, disc * 0.94, null);
    P.wx = mHead[12]; P.wy = mHead[13]; P.wz = mHead[14];
  }

  return {
    update(dt, t, twin) {
      frame++; stamp++;
      vehicles.update(dt, t, twin);
      const actors = twin.actors;
      if (actors) for (let i = 0; i < actors.length; i++) {
        const a = actors[i], P = byId.get(a.id) ?? spawn(a);
        if (P) { P.actor = a; P.stamp = stamp; }
      }
      for (let i = 0; i < PARTS.length; i++) PARTS[i].n = 0;
      for (let i = 0; i < floors.length; i++) floors[i].updateWorldMatrix(true, false);

      const h = engine.renderer.domElement.clientHeight || innerHeight, ppm = h / ((camera.top - camera.bottom) / camera.zoom);
      const lod = ppm > LOD_PPM ? 1 : 0;
      if (lod !== hiLod) { hiLod = lod; for (const p of PARTS) p.mesh.geometry = p.geos[lod]; }
      const bubble = clamp(34 / ppm, 0.62, 1.5);
      bubbles.begin(camera);
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const v = vp.elements, mx = 3 * hypot(v[0], v[4], v[8]), my = 3 * hypot(v[1], v[5], v[9]);

      for (let i = list.length - 1; i >= 0; i--) {
        const P = list[i], here = P.stamp === stamp, a = P.actor;
        if (!here && P.pop <= 0.02) { despawn(i); continue; }
        if (!engine.floorVisible(P.floor)) {
          // A hidden plate costs nothing: just keep the books straight so the person is in place on return.
          P.x = a.x; P.z = a.z; P.vx = P.vz = P.spd = 0; P.floor = a.floor; P.warp = false; P.key = -1; P.bS = P.bV = 0; P.bIcon = -1; P.pop = a.hidden ? 0 : 1;
          if (!engine.floorVisible(P.floor)) { P.shown = false; if (P.proxy.layers.mask) P.proxy.layers.mask = 0; continue; }
        }
        const anim = motion(P, dt, here, twin);
        const F = floors[P.floor]?.matrixWorld.elements;
        if (!F) continue;
        if (P.pop <= 0.004 && (a.hidden || !here)) { P.shown = false; if (P.proxy.layers.mask) P.proxy.layers.mask = 0; continue; }
        const wx = F[0] * P.x + F[8] * P.z + F[12], wy = F[1] * P.x + F[9] * P.z + F[13] + 0.9, wz = F[2] * P.x + F[10] * P.z + F[14];
        const nx = v[0] * wx + v[4] * wy + v[8] * wz + v[12], ny = v[1] * wx + v[5] * wy + v[9] * wz + v[13];
        P.shown = frame < 3 || (abs(nx) < 1 + mx && abs(ny) < 1 + my);
        if (P.shown) {
          pose(P, anim, dt, t);
          skin(P, F, t);
          bubbles.add(P, a.bubble, P.wx, P.wy + RIG.headR * P.s + P.cur[FLAT] * 0.12, P.wz, dt, t, bubble);
        }
        // Proxies only need to keep up with a click, so each one updates about five times a second.
        if ((frame + P.slot) % 12 === 0) {
          const q = P.proxy;
          q.layers.mask = 1;
          q.matrix.makeTranslation(wx, wy - 0.9, wz);
          q.matrixWorld.copy(q.matrix);
        }
      }
      for (let i = 0; i < PARTS.length; i++) flush(PARTS[i]);
      if (TORSO.n) flushAttr(trimAttr, TORSO.n);
      bubbles.end();
      flow.update(dt, t, twin, list);

      const P = selected != null ? byId.get(selected) : null, sel = P && P.shown;
      ringA += ((sel ? 1 : 0) - ringA) * (1 - exp(-dt * 12));
      ring.visible = ringA > 0.01;
      if (ring.visible) {
        ringMat.uniforms.uT.value = t; ringMat.uniforms.uA.value = ringA;
        if (sel) {
          const F = floors[P.floor].matrixWorld.elements, lying = P.cur[FLAT] > 0.5, y = lying ? P.seat + 0.14 : P.y + 0.03;
          ring.position.set(F[0] * P.x + F[8] * P.z + F[12], F[5] * y + F[13], F[2] * P.x + F[10] * P.z + F[14]);
          ring.scale.setScalar((0.86 + 0.14 * ringA) * (lying ? 1.25 : P.s));
        }
      }
    },
    setLayer(name, on) { if (name === 'flow') flow.set(!!on); },
    highlight(id) { selected = id ?? null; },
    /** World position of a person's head, for anchoring HTML labels. Null when not on screen. */
    locate(id) { const P = byId.get(id); return P?.shown ? { x: P.wx, y: P.wy, z: P.wz, floor: P.floor } : null; },
  };
}
