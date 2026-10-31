// Procedural poses. Each writes a target pose into a flat channel array; the crossfade lives in index.js.
// Angles are radians. Arms and hips: + swings forward. Elbows and knees: + flexes. Everything varies with the person.
import { RIG } from './rig.js';

const { sin, cos, abs, max, min, floor, sign, PI } = Math;
const TAU = PI * 2;

export const PX = 0, PY = 1, PZ = 2, FLAT = 3, ROLL = 4, TWIST = 5, LEAN = 6, NOD = 7, TURN = 8, TILT = 9,
  ARM_L = 10, OUT_L = 11, ELB_L = 12, IN_L = 13, ARM_R = 14, OUT_R = 15, ELB_R = 16, IN_R = 17,
  HIP_L = 18, KNEE_L = 19, FOOT_L = 20, HIP_R = 21, KNEE_R = 22, FOOT_R = 23,
  GROUND = 24, COAT = 25, EYES = 26, MOUTH = 27, HOLD = 28, SPLAY = 29, MOP = 30, BREATH = 31;
export const CHANNELS = 32;

const smooth = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TABLE = new Float32Array(512);
for (let i = 0; i < 512; i++) { const x = Math.sin(i * 12.9898) * 43758.5453; TABLE[i] = (x - floor(x)) * 2 - 1; }
const noise = (x) => { const i = floor(x), f = x - i, u = f * f * (3 - 2 * f), a = TABLE[i & 511]; return a + (TABLE[(i + 1) & 511] - a) * u; };
// Hold still, then look somewhere, then come back: far more human than a constant drift.
const glance = (x, k) => { const n = noise(x); return sign(n) * smooth(0.14, 0.52, abs(n)) * k; };
// Softened triangle wave. The hip sweeps at a steady rate through stance, so a planted foot keeps pace with the floor.
const tri = (p) => 0.9 * (sin(p) - sin(3 * p) / 9);

function base(o) {
  o.fill(0);
  o[GROUND] = o[COAT] = o[EYES] = 1;
  o[OUT_L] = o[OUT_R] = 0.16; o[ELB_L] = o[ELB_R] = 0.2;
}

function strideLegs(o, P, lift) {
  const p = P.phase, s = tri(p), c = cos(p), A = P.amp, sl = max(0, c), sr = max(0, -c);
  o[HIP_L] = A * s; o[HIP_R] = -A * s;
  o[KNEE_L] = 0.06 + lift * sl * sl; o[KNEE_R] = 0.06 + lift * sr * sr;
  o[FOOT_L] = -0.85 * A * s; o[FOOT_R] = 0.85 * A * s;
}

function carryTablet(o, s) {
  o[ARM_L] = 0.3 + s * 0.02; o[OUT_L] = 0.12; o[ELB_L] = 1.55; o[IN_L] = 0.62; o[HOLD] = 1;
}

function idle(o, P, t) {
  base(o);
  const L = P.look, T = t + L.r * 97, sway = noise(T * 0.27), breath = sin(T * 1.6);
  o[PX] = sway * 0.032; o[ROLL] = -sway * 0.03; o[LEAN] = L.stoop + breath * 0.007; o[PY] = breath * 0.003; o[BREATH] = breath;
  o[KNEE_L] = 0.05 + max(0, sway) * 0.24; o[HIP_L] = max(0, sway) * 0.11;
  o[KNEE_R] = 0.05 + max(0, -sway) * 0.24; o[HIP_R] = max(0, -sway) * 0.11;
  o[SPLAY] = 0.05; o[NOD] = -0.05 + noise(T * 0.19) * 0.1 + L.stoop; o[TURN] = glance(T * 0.21, 0.72); o[TILT] = noise(T * 0.16) * 0.1;
  o[ARM_L] = breath * 0.012; o[ARM_R] = -breath * 0.012;
  switch (P.sub) {
    case 1: // hands clasped in front
      o[ARM_L] = o[ARM_R] = 0.42; o[ELB_L] = o[ELB_R] = 0.95; o[OUT_L] = o[OUT_R] = 0.05; o[IN_L] = o[IN_R] = 0.5; break;
    case 2: // hands behind the back
      o[ARM_L] = o[ARM_R] = -0.42; o[ELB_L] = o[ELB_R] = 0.42; o[OUT_L] = o[OUT_R] = 0.1; o[IN_L] = o[IN_R] = -0.7; break;
    case 3: // arms folded
      o[ARM_L] = 0.5; o[ARM_R] = 0.62; o[ELB_L] = o[ELB_R] = 1.72; o[OUT_L] = o[OUT_R] = 0.26; o[IN_L] = 0.72; o[IN_R] = 0.8; break;
    case 4: // one hand on the hip
      o[ARM_R] = -0.2; o[OUT_R] = 0.62; o[ELB_R] = 1.5; o[IN_R] = 0.9; o[TILT] += 0.06; break;
    default:
  }
}

function walk(o, P) {
  base(o);
  const L = P.look, A = P.amp, p = P.phase, s = tri(p), c = cos(p), go = min(1, A / 0.26), sw = (0.34 + A * 1.15) * L.swing;
  strideLegs(o, P, 1.05);
  o[ARM_L] = 0.05 - sw * s; o[ARM_R] = 0.05 + sw * s;
  o[ELB_L] = 0.22 + 0.42 * max(0, -s) * go; o[ELB_R] = 0.22 + 0.42 * max(0, s) * go;
  o[LEAN] = 0.03 * go + L.stoop; o[TWIST] = 0.17 * s * go; o[ROLL] = L.waddle * c * go * 1.4; o[PX] = -0.016 * c * go;
  o[PY] = 0.017 * L.bounce * abs(sin(p)) * go;
  o[TURN] = -0.13 * s * go; o[TILT] = -L.waddle * c * go * 0.8; o[NOD] = -0.02 + 0.03 * sin(p * 2) * go + L.stoop;
  if (L.carry) carryTablet(o, s);
}

function run(o, P) {
  base(o);
  const A = P.amp, p = P.phase, s = tri(p), c = cos(p), sw = 0.6 + A * 0.65;
  strideLegs(o, P, 1.95);
  o[ELB_L] = o[ELB_R] = 1.55; o[OUT_L] = o[OUT_R] = 0.24; o[IN_L] = o[IN_R] = 0.32;
  o[ARM_L] = 0.12 - sw * s; o[ARM_R] = 0.12 + sw * s;
  o[LEAN] = 0.21; o[TWIST] = 0.26 * s; o[ROLL] = 0.035 * c; o[NOD] = -0.12; o[TURN] = -0.2 * s;
  o[PY] = 0.05 * abs(sin(p));
}

function push(o, P) {
  base(o);
  const A = P.amp, s = tri(P.phase), c = cos(P.phase), go = min(1, A / 0.26);
  strideLegs(o, P, 0.95);
  o[ARM_L] = o[ARM_R] = 1.22 + 0.03 * s; o[ELB_L] = o[ELB_R] = 0.42; o[OUT_L] = o[OUT_R] = 0.05; o[IN_L] = o[IN_R] = 0.1;
  o[LEAN] = 0.15; o[NOD] = -0.12; o[TWIST] = 0.05 * s * go; o[ROLL] = 0.02 * c * go;
  o[PY] = 0.012 * abs(sin(P.phase)) * go;
}

function sit(o, P, t) {
  base(o);
  const L = P.look, T = t + L.r * 97, breath = sin(T * 1.5), tap = L.r > 0.55 ? max(0, sin(T * 2.4 + L.r)) * smooth(0, 0.5, noise(T * 0.15)) : 0;
  o[GROUND] = 0; o[COAT] = 0.58; o[PY] = P.seat / P.s + 0.07;
  o[HIP_L] = o[HIP_R] = 0.98; o[KNEE_L] = 0.96; o[KNEE_R] = 0.96 - tap * 0.2; o[FOOT_L] = 0.34; o[FOOT_R] = 0.34 + tap * 0.3; o[SPLAY] = 0.08;
  o[LEAN] = -0.05 + breath * 0.006; o[BREATH] = breath;
  o[ARM_L] = 0.72; o[ARM_R] = 0.78; o[ELB_L] = 0.95; o[ELB_R] = 0.9; o[OUT_L] = o[OUT_R] = 0.14; o[IN_L] = o[IN_R] = 0.34;
  o[TURN] = glance(T * 0.2, 0.62); o[NOD] = -0.03 + noise(T * 0.17) * 0.13; o[TILT] = noise(T * 0.14) * 0.11;
}

function lie(o, P, t) {
  base(o);
  const L = P.look, T = t + L.r * 97, asleep = P.actor.bubble === 'zzz', breath = sin(T * 1.2);
  // P.seat is the pillow top. The head sinks into it a little, and the actor stands at the bed centre, so the pelvis
  // is placed to put the head on the pillow whatever this person's height.
  o[GROUND] = 0; o[FLAT] = 1; o[COAT] = 0.5; o[PY] = (P.seat + 0.13) / P.s; o[PZ] = RIG.headToBedCentre / P.s + RIG.neckY + RIG.headUp;
  o[OUT_L] = o[OUT_R] = 0.12; o[BREATH] = breath; o[EYES] = asleep ? 0 : 1;
  // Chin tucked as if propped on the pillow, so the face is seen from the foot of the bed.
  o[NOD] = 0.58; o[TURN] = asleep ? 0.2 : glance(T * 0.11, 0.5); o[TILT] = asleep ? -0.1 : 0;
}

function work(o, P, t) {
  base(o);
  const L = P.look, T = t + L.r * 97, sway = noise(T * 0.3);
  o[PX] = sway * 0.018; o[SPLAY] = 0.05; o[KNEE_L] = o[KNEE_R] = 0.05;
  switch (L.work) {
    case 'mop': {
      const s = sin(T * 2.3), c = cos(T * 2.3);
      o[MOP] = 1; o[LEAN] = 0.13; o[TWIST] = s * 0.14; o[TURN] = s * 0.14 + 0.05; o[NOD] = 0.26; o[ROLL] = c * 0.02; o[PX] = s * 0.03;
      o[ARM_R] = 0.92 + s * 0.2; o[OUT_R] = 0.06; o[ELB_R] = 0.72; o[IN_R] = 0.42;
      o[ARM_L] = 0.62 - s * 0.2; o[OUT_L] = 0.1; o[ELB_L] = 1.15; o[IN_L] = 0.42;
      break;
    }
    case 'tablet': {
      carryTablet(o, 0); o[ARM_L] = 0.62; o[ELB_L] = 1.25; o[IN_L] = 0.5;
      const tap = noise(T * 4.2); o[ARM_R] = 0.74 + tap * 0.05; o[OUT_R] = 0.06; o[ELB_R] = 1.42 + noise(T * 6.1) * 0.1; o[IN_R] = 0.64;
      o[LEAN] = 0.05; o[NOD] = 0.34 + noise(T * 0.5) * 0.07; o[TURN] = noise(T * 0.4) * 0.14;
      break;
    }
    default: {
      // busy hands over a bench or device, stopping now and then to look at the work
      const pause = smooth(0.25, 0.55, noise(T * 0.33)), rate = (1 - pause) * 0.09;
      o[ARM_L] = 0.86 + noise(T * 2.7) * rate * 1.4; o[ARM_R] = 0.92 + noise(T * 3.3 + 40) * rate * 1.4;
      o[ELB_L] = 1.02 + noise(T * 4.3 + 8) * rate * 2; o[ELB_R] = 0.96 + noise(T * 4.9 + 16) * rate * 2;
      o[OUT_L] = o[OUT_R] = 0.1; o[IN_L] = 0.28 + noise(T * 2.1) * rate * 2; o[IN_R] = 0.28 + noise(T * 2.4 + 9) * rate * 2;
      o[LEAN] = 0.11; o[NOD] = 0.3 + noise(T * 0.5) * 0.08; o[TURN] = noise(T * 0.44) * 0.22; o[TILT] = noise(T * 0.31) * 0.08;
    }
  }
}

// Seated at a desk: legs from sit, hands typing on the desk in front.
function deskWork(o, P, t) {
  sit(o, P, t);
  const L = P.look, T = t + L.r * 97;
  o[ARM_L] = 0.94 + noise(T * 7.3) * 0.04; o[ARM_R] = 0.94 + noise(T * 8.1 + 7) * 0.04; o[ELB_L] = 0.84 + noise(T * 9.2 + 3) * 0.08; o[ELB_R] = 0.84 + noise(T * 9.7 + 5) * 0.08;
  o[OUT_L] = o[OUT_R] = 0.08; o[IN_L] = o[IN_R] = 0.42; o[LEAN] = 0.05; o[NOD] = 0.12 + noise(T * 0.5) * 0.07; o[TURN] = noise(T * 0.4) * 0.2;
}

function cpr(o, P, t) {
  base(o);
  const L = P.look, beat = max(0, sin(t * TAU * 1.85 + L.r * 9)), push = beat * beat; // 110 compressions a minute
  o[SPLAY] = 0.13; o[KNEE_L] = o[KNEE_R] = 0.16 + push * 0.08; o[HIP_L] = o[HIP_R] = 0.1 + push * 0.04;
  o[LEAN] = 0.48 + push * 0.13; o[ARM_L] = o[ARM_R] = 1.5 - push * 0.09; o[ELB_L] = o[ELB_R] = 0.06; o[OUT_L] = o[OUT_R] = -0.46;
  o[NOD] = 0.28 - push * 0.14; o[PZ] = 0.03 + push * 0.02; o[PY] = -push * 0.015;
}

function talk(o, P, t) {
  base(o);
  const L = P.look, T = t + L.r * 97, speak = smooth(-0.15, 0.2, noise(T * 0.23)), sway = noise(T * 0.27), w = noise(T * 1.6), v = noise(T * 2.3 + 11);
  o[PX] = sway * 0.03; o[ROLL] = -sway * 0.03; o[KNEE_L] = 0.05 + max(0, sway) * 0.2; o[KNEE_R] = 0.05 + max(0, -sway) * 0.2; o[SPLAY] = 0.05;
  o[ARM_R] = 0.2 + speak * (0.62 + w * 0.42); o[ELB_R] = 0.5 + speak * (0.9 + v * 0.45); o[OUT_R] = 0.2 + speak * 0.12 * w; o[IN_R] = 0.3;
  o[ARM_L] = 0.1 + speak * (0.34 - v * 0.3); o[ELB_L] = 0.4 + speak * (0.75 + w * 0.3); o[OUT_L] = 0.18; o[IN_L] = 0.28;
  o[NOD] = -0.06 + (1 - speak) * abs(sin(T * 2.7)) * 0.13 + speak * noise(T * 2.1) * 0.08;
  o[TURN] = noise(T * 0.5) * 0.2; o[TILT] = noise(T * 0.37) * 0.14 * (1.4 - speak);
  o[TWIST] = speak * w * 0.09; o[MOUTH] = speak * (0.35 + 0.65 * abs(sin(T * 8.3)) * smooth(-0.4, 0.2, noise(T * 3.1)));
}

export const POSES = { idle, walk, run, push, sit, lie, work, deskWork, cpr, talk };
export const ANIM_ID = { idle: 1, walk: 2, run: 3, push: 4, sit: 5, lie: 6, work: 7, deskWork: 8, cpr: 9, talk: 10 };
