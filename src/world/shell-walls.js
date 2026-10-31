// Walls are derived from the room rectangles and door gaps, never drawn by hand. Each line of wall becomes a "run"
// whose two faces are painted separately, so a wall shows the theme of whichever room you stand in.
import * as THREE from 'three';
import { C, THEMES } from '../style/palette.js';
import { WALL, BUILDING, DOORS, roomAt, roomsOnFloor } from './plan.js';
import { Sheet, rgb, tint, blend, seeded } from './shell-geo.js';
import { canvasTex } from '../style/kit.js';

const T = WALL.thick, HT = T / 2;
export const CAP = 0.075;
const LIP = 0.028;
const SILL = 1.24, HEAD = 2.66;
const EPS = 1e-6;
const num = (a, b) => a - b;

export const P = (run, u, y, v) => (run.axis === 'x' ? [u, y, run.c + v] : [run.c + v, y, u]);
const N = (run, nu, ny, nv) => (run.axis === 'x' ? [nu, ny, nv] : [nv, ny, nu]);
/** Box in run coordinates: u along the wall, v across it. */
export function lbox(s, run, u0, u1, y0, y1, v0, v1, color, o) {
  if (run.axis === 'x') s.box(u0, y0, run.c + v0, u1, y1, run.c + v1, color, o);
  else s.box(run.c + v0, y0, u0, run.c + v1, y1, u1, color, o);
}

export function deriveRuns(floor) {
  const rooms = roomsOnFloor(floor), lines = new Map();
  const add = (axis, c, a, b) => { const k = `${axis}|${c}`; if (!lines.has(k)) lines.set(k, []); lines.get(k).push([a, b]); };
  for (const { rect: r } of rooms) {
    add('x', r.z, r.x, r.x + r.w); add('x', r.z + r.d, r.x, r.x + r.w);
    add('z', r.x, r.z, r.z + r.d); add('z', r.x + r.w, r.z, r.z + r.d);
  }
  const merged = new Map();
  for (const [k, ivs] of lines) {
    ivs.sort((p, q) => p[0] - q[0]);
    const out = [];
    for (const iv of ivs) { const l = out[out.length - 1]; if (l && iv[0] <= l[1] + EPS) l[1] = Math.max(l[1], iv[1]); else out.push([...iv]); }
    merged.set(k, out);
  }
  const touch = (axis, c, at) => {
    for (const [a, b] of merged.get(`${axis === 'x' ? 'z' : 'x'}|${at}`) ?? []) {
      if (c > a + EPS && c < b - EPS) return 'through';
      if (Math.abs(c - a) < EPS || Math.abs(c - b) < EPS) return 'end';
    }
    return null;
  };
  // One wall owns each junction: the through wall at a T, the X-running wall at a corner. That leaves no overlapping faces to z-fight.
  const end = (axis, c, at, dir) => {
    const t = touch(axis, c, at);
    if (t === 'through' || (t === 'end' && axis === 'z')) return { at: at - dir * HT, cap: at - dir * (HT + LIP), t: t === 'through' ? 'stem' : 'short' };
    if (t === 'end') return { at: at + dir * HT, cap: at + dir * (HT + LIP), t: 'long' };
    return { at, cap: at, t: null };
  };
  const isOuter = (axis, c) => (axis === 'x' ? c === 0 || c === BUILDING.d : c === 0 || c === BUILDING.w);
  const runs = [];
  for (const [k, ivs] of merged) {
    const [axis, cs] = k.split('|'), c = Number(cs);
    for (const [a, b] of ivs) {
      const A = end(axis, c, a, -1), B = end(axis, c, b, 1);
      const side = isOuter(axis, c) ? (axis === 'x' ? (c === 0 ? 'N' : 'S') : c === 0 ? 'W' : 'E') : null;
      const run = { axis, c, a: A.at, b: B.at, capA: A.cap, capB: B.cap, side, raw: [a, b], perpOuterA: isOuter(axis === 'x' ? 'z' : 'x', a), perpOuterB: isOuter(axis === 'x' ? 'z' : 'x', b) };
      run.pos = spans(rooms, floor, run, 1);
      run.neg = spans(rooms, floor, run, -1);
      run.doors = DOORS.filter((d) => d.floor === floor && d.axis === axis && (axis === 'x' ? d.z : d.x) === c)
        .map((d) => { const u = axis === 'x' ? d.x : d.z; return { door: d, g0: u - d.w / 2, g1: u + d.w / 2 }; })
        .sort((p, q) => p.g0 - q.g0);
      run.solids = [];
      let from = run.a;
      for (const g of run.doors) { if (g.g0 > from + EPS) run.solids.push({ a: from, b: g.g0 }); from = g.g1; }
      if (run.b > from + EPS) run.solids.push({ a: from, b: run.b });
      runs.push(run);
    }
  }
  return runs;
}

function spans(rooms, floor, run, sign) {
  const breaks = new Set([run.a, run.b]);
  for (const { rect: r } of rooms) for (const p of run.axis === 'x' ? [r.x, r.x + r.w] : [r.z, r.z + r.d]) if (p > run.a && p < run.b) breaks.add(p);
  const pts = [...breaks].sort(num), out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const m = (pts[i] + pts[i + 1]) / 2, off = run.c + sign * 0.15;
    const room = (run.axis === 'x' ? roomAt(floor, m, off) : roomAt(floor, off, m)) ?? null;
    const last = out[out.length - 1];
    if (last && last.room === room) last.b = pts[i + 1]; else out.push({ a: pts[i], b: pts[i + 1], room });
  }
  return out;
}

export function interiorBands(theme, top) {
  const w = rgb(theme.wainscot), s = rgb(theme.stripe), u = rgb(theme.upper), white = rgb(C.trimWarm);
  return [
    { y0: 0, y1: 0.11, lo: tint(white, 0.93), hi: white },
    { y0: 0.11, y1: 0.935, lo: tint(w, 0.9), hi: w },
    { y0: 0.935, y1: 0.95, lo: tint(w, 0.84), hi: tint(w, 0.84) },
    { y0: 0.95, y1: 1.07, lo: s, hi: s },
    { y0: 1.07, y1: Math.max(top, 1.08), lo: tint(u, 0.95), hi: tint(u, 1.03) },
  ];
}
export function facadeBands(top, accent = '#8fd8d4') {
  const body = rgb(C.trimWarm), plinth = rgb('#d9d2cb'), a = rgb(accent);
  return [
    { y0: 0, y1: 0.4, lo: tint(plinth, 0.9), hi: plinth },
    { y0: 0.4, y1: 0.98, lo: tint(body, 0.96), hi: body },
    { y0: 0.98, y1: 1.14, lo: a, hi: a },
    { y0: 1.14, y1: Math.max(top, 1.15), lo: tint(body, 0.97), hi: body },
  ];
}

/** Paint one face of a run as a grid of quads: colour bands in y, optional window holes, corners darkened as fake AO. */
export function paint(s, run, sign, u0, u1, y0, y1, bands, { holes = [], ao, g = 0, v = HT } = {}) {
  if (u1 - u0 < 1e-4 || y1 - y0 < 1e-4) return;
  const A = 0.5, us = new Set([u0, u1]), ys = new Set([y0, y1]);
  if (ao) for (const p of [ao.a + A, ao.b - A]) if (p > u0 && p < u1) us.add(p);
  for (const h of holes) if (h.u1 > u0 && h.u0 < u1) { us.add(Math.max(h.u0, u0)); us.add(Math.min(h.u1, u1)); ys.add(h.y0); ys.add(h.y1); }
  for (const b of bands) { if (b.y0 > y0 && b.y0 < y1) ys.add(b.y0); if (b.y1 > y0 && b.y1 < y1) ys.add(b.y1); }
  const U = [...us].sort(num), Y = [...ys].filter((y) => y >= y0 && y <= y1).sort(num);
  const n = N(run, 0, 0, sign), dark = (u) => (ao ? 1 - ao.k * Math.max(0, 1 - Math.min(u - ao.a, ao.b - u) / A) : 1);
  for (let j = 0; j < Y.length - 1; j++) {
    const ya = Y[j], yb = Y[j + 1], ym = (ya + yb) / 2;
    const band = bands.find((b) => ym >= b.y0 && ym < b.y1) ?? bands[bands.length - 1];
    const at = (y) => blend(band.lo, band.hi, (y - band.y0) / (band.y1 - band.y0));
    const lo = at(ya), hi = at(yb);
    for (let i = 0; i < U.length - 1; i++) {
      const ua = U[i], ub = U[i + 1], um = (ua + ub) / 2;
      if (holes.some((h) => um > h.u0 && um < h.u1 && ym > h.y0 && ym < h.y1)) continue;
      const k0 = dark(ua), k1 = dark(ub);
      s.quad(P(run, ua, ya, sign * v), P(run, ub, ya, sign * v), P(run, ub, yb, sign * v), P(run, ua, yb, sign * v), n, [tint(lo, k0), tint(lo, k1), tint(hi, k1), tint(hi, k0)], g);
    }
  }
}

function endFace(s, run, u, dir, y0, y1, color, g = 0) {
  s.quad(P(run, u, y0, -HT), P(run, u, y0, HT), P(run, u, y1, HT), P(run, u, y1, -HT), N(run, dir, 0, 0), color, g);
}

/** White cap with chamfered top edges, so it catches a thin line of light along the wall. */
function capRun(s, run, u0, u1, y) {
  const w = HT + LIP, c = 0.016, h = CAP, y1 = y + h, wh = rgb(C.white), side = tint(wh, 0.96), k = Math.SQRT1_2;
  for (const sg of [1, -1]) {
    s.quad(P(run, u0, y, sg * w), P(run, u1, y, sg * w), P(run, u1, y1 - c, sg * w), P(run, u0, y1 - c, sg * w), N(run, 0, 0, sg), side);
    s.quad(P(run, u0, y1 - c, sg * w), P(run, u1, y1 - c, sg * w), P(run, u1, y1, sg * (w - c)), P(run, u0, y1, sg * (w - c)), N(run, 0, k, sg * k), wh);
    const u = sg > 0 ? u1 : u0;
    s.quad(P(run, u, y, -w), P(run, u, y, w), P(run, u, y1, w), P(run, u, y1, -w), N(run, sg, 0, 0), side);
  }
  s.quad(P(run, u0, y1, -(w - c)), P(run, u1, y1, -(w - c)), P(run, u1, y1, w - c), P(run, u0, y1, w - c), [0, 1, 0], wh);
  s.quad(P(run, u0, y, -w), P(run, u1, y, -w), P(run, u1, y, w), P(run, u0, y, w), [0, -1, 0], side);
}

/** Pleated curtain drawn back to one side of a window, gathered at a tie-back. Pleats are smooth-shaded so they read as cloth. */
function curtain(s, run, uFix, uFree, yTop, yBot, v, sign) {
  const folds = 7, deep = rgb(C.curtainDeep), lit = rgb(C.curtain), tie = yBot + (yTop - yBot) * 0.36;
  const rows = [[yTop, 1], [tie, 0.62], [yBot, 0.86]];
  const pt = (row, k) => {
    const [y, w] = rows[row], t = k / folds, u = uFix + (uFree - uFix) * w * t;
    return P(run, u, y, sign * (v + (k % 2 ? 0.05 : 0) * (row === 1 ? 0.5 : 1)));
  };
  const nor = (k) => { const a = k % 2 ? 0 : (k % 4 === 0 ? 0.75 : -0.75); const n = N(run, a, 0, sign); const l = Math.hypot(...n); return n.map((c) => c / l); };
  for (let r = 0; r < 2; r++) for (let k = 0; k < folds; k++) {
    const ca = k % 2 ? lit : deep, cb = k % 2 ? deep : lit;
    s.quad(pt(r + 1, k), pt(r + 1, k + 1), pt(r, k + 1), pt(r, k), [nor(k), nor(k + 1), nor(k + 1), nor(k)], [ca, cb, cb, ca], 0.3);
  }
  const u0 = Math.min(uFix, uFix + (uFree - uFix) * 0.62), u1 = Math.max(uFix, uFix + (uFree - uFix) * 0.62);
  lbox(s, run, u0, u1, tie - 0.035, tie + 0.035, sign > 0 ? v - 0.02 : -v - 0.09, sign > 0 ? v + 0.09 : -v + 0.02, rgb(C.woodLight), { g: 0.3 });
}

function emitWindow(s, run, w, inSign, seed) {
  const { u0, u1, y0, y1 } = w, white = rgb(C.white), warm = rgb(C.trimWarm), g = 0.3;
  const skyTop = rgb('#b4dcf2'), skyLow = rgb('#e4f4fa');
  // Reveals: the wall reads as thick because the eye sees into the opening.
  const reveal = tint(warm, 0.97);
  s.quad(P(run, u0, y1, -HT), P(run, u1, y1, -HT), P(run, u1, y1, HT), P(run, u0, y1, HT), [0, -1, 0], tint(warm, 0.84));
  s.quad(P(run, u0, y0, -HT), P(run, u1, y0, -HT), P(run, u1, y0, HT), P(run, u0, y0, HT), [0, 1, 0], white);
  s.quad(P(run, u0, y0, -HT), P(run, u0, y0, HT), P(run, u0, y1, HT), P(run, u0, y1, -HT), N(run, 1, 0, 0), reveal);
  s.quad(P(run, u1, y0, -HT), P(run, u1, y0, HT), P(run, u1, y1, HT), P(run, u1, y1, -HT), N(run, -1, 0, 0), reveal);
  // Both panes are opaque on purpose: real glass would show the trees and lawn through a wall that is meant to feel like a room.
  const pane = (v, n, c, gl) => s.quad(P(run, u0, y0, v), P(run, u1, y0, v), P(run, u1, y1, v), P(run, u0, y1, v), N(run, 0, 0, n), c, gl);
  pane(inSign * 0.012, inSign, [skyLow, skyLow, skyTop, skyTop], 2);
  pane(-inSign * 0.012, -inSign, [skyLow, skyLow, skyTop, skyTop], 1 + seed() * 0.44);
  const sw = (u1 - u0) * 0.22, sheen = rgb('#f6fcfe');
  s.quad(P(run, u0 + sw, y0 + 0.02, inSign * 0.017), P(run, u0 + sw * 1.8, y0 + 0.02, inSign * 0.017), P(run, u0 + sw * 2.8, y1 - 0.02, inSign * 0.017), P(run, u0 + sw * 2, y1 - 0.02, inSign * 0.017), N(run, 0, 0, inSign), sheen, 2);
  const f = 0.052, d = 0.035;
  lbox(s, run, u0, u1, y1 - f, y1, -d, d, white, { g });
  lbox(s, run, u0, u1, y0, y0 + f, -d, d, white, { g });
  lbox(s, run, u0, u0 + f, y0, y1, -d, d, white, { g });
  lbox(s, run, u1 - f, u1, y0, y1, -d, d, white, { g });
  const m = (u0 + u1) / 2;
  lbox(s, run, m - 0.022, m + 0.022, y0, y1, -d, d, white, { g });
  lbox(s, run, u0, u1, y0 + (y1 - y0) * 0.68 - 0.018, y0 + (y1 - y0) * 0.68 + 0.018, -d, d, white, { g });
  // Sills, then the curtain set on the room side only.
  const near = inSign > 0 ? [HT - 0.01, HT + 0.075] : [-HT - 0.075, -HT + 0.01];
  const far = inSign > 0 ? [-HT - 0.07, -HT + 0.01] : [HT - 0.01, HT + 0.07];
  lbox(s, run, u0 - 0.07, u1 + 0.07, y0 - 0.045, y0, near[0], near[1], white, { g });
  lbox(s, run, u0 - 0.06, u1 + 0.06, y0 - 0.045, y0 - 0.002, far[0], far[1], white);
  const hang = HEAD + 0.15, drop = SILL - 0.3, v = HT + 0.05, cw = (u1 - u0) * 0.32;
  curtain(s, run, u0 - 0.2, u0 + cw, hang - 0.01, drop, v, inSign);
  curtain(s, run, u1 + 0.2, u1 - cw, hang - 0.01, drop, v, inSign);
  const rail = rgb(C.curtainDeep), vr = inSign * (HT + 0.08);
  s.tube(P(run, u0 - 0.3, hang + 0.01, vr), P(run, u1 + 0.3, hang + 0.01, vr), 0.016, rail, { g });
  for (const uu of [u0 - 0.24, m, u1 + 0.24]) lbox(s, run, uu - 0.012, uu + 0.012, hang - 0.01, hang + 0.04, inSign > 0 ? HT : vr, inSign > 0 ? vr : -HT, rail, { g });
}

function planWindows(run, inSign, avoid) {
  const out = [], list = inSign > 0 ? run.pos : run.neg;
  for (const sp of list) {
    if (!sp.room) continue;
    if (sp.room.theme === 'core' && run.side === 'N') continue;
    const gaps = run.doors.map((g) => ({ a: g.g0 - (g.door.kind === 'slide' ? 1.5 : 0.6), b: g.g1 + (g.door.kind === 'slide' ? 1.5 : 0.6) }));
    let from = sp.a + 0.55;
    const edges = [...gaps.filter((g) => g.b > sp.a && g.a < sp.b), { a: sp.b - 0.55, b: sp.b }].sort((p, q) => p.a - q.a);
    for (const e of edges) {
      const L = e.a - from;
      if (L >= 1.7) {
        const n = Math.max(1, Math.round(L / 3.5)), w = Math.min(1.8, L - 0.3), pitch = L / n;
        for (let i = 0; i < n; i++) {
          const m = from + pitch * (i + 0.5), u0 = m - w / 2, u1 = m + w / 2;
          if (!avoid.some((q) => q.u1 > u0 - 0.28 && q.u0 < u1 + 0.28)) out.push({ u0, u1, y0: SILL, y1: HEAD });
        }
      }
      from = Math.max(from, e.b);
    }
  }
  return out;
}

function perimeter(run, base, avoid) {
  const inSign = run.side === 'N' || run.side === 'W' ? 1 : -1;
  const upper = new Sheet(), cap = new Sheet(), H = WALL.full, top = H - CAP, cut = WALL.cut, seed = seeded(run.c * 7 + run.side.charCodeAt(0));
  const windows = planWindows(run, inSign, avoid);
  for (const seg of run.solids) {
    for (const sign of [1, -1]) for (const sp of sign > 0 ? run.pos : run.neg) {
      const a = Math.max(sp.a, seg.a), b = Math.min(sp.b, seg.b);
      if (b <= a) continue;
      const room = sp.room, bands = room ? interiorBands(THEMES[room.theme], top) : facadeBands(top);
      const ao = room ? { a: Math.max(sp.a, run.a), b: Math.min(sp.b, run.b), k: 0.13 } : undefined, g = room ? 0.3 : 0;
      paint(base, run, sign, a, b, 0, cut, bands, { ao, g });
      paint(upper, run, sign, a, b, cut, top, bands, { ao, g, holes: windows });
      if (room) {
        const s = rgb(THEMES[room.theme].stripe), v = sign * HT;
        lbox(upper, run, a, b, 0.95, 1.07, sign > 0 ? v - 0.002 : v - 0.011, sign > 0 ? v + 0.011 : v + 0.002, s, { g });
      }
    }
    const facade = tint(rgb(C.trimWarm), 0.98);
    for (const [u, dir] of [[seg.a, -1], [seg.b, 1]]) { endFace(base, run, u, dir, 0, cut, facade); endFace(upper, run, u, dir, cut, top, facade); }
    capRun(cap, run, seg.a === run.a ? run.capA : seg.a, seg.b === run.b ? run.capB : seg.b, 0);
  }
  for (const w of windows) emitWindow(upper, run, w, inSign, seed);
  return { name: run.side, run, upper, cap, windows, inSign };
}

const JAMB = 0.075;
export const glassTop = WALL.glassTop;

function partition(run, s, panes) {
  const H = WALL.partition, top = H - CAP, g = 0.3, white = rgb(C.white), gt = glassTop, r = 0.024;
  for (const seg of run.solids) {
    for (const sign of [1, -1]) for (const sp of sign > 0 ? run.pos : run.neg) {
      const a = Math.max(sp.a, seg.a), b = Math.min(sp.b, seg.b);
      if (b <= a || !sp.room) continue;
      const th = THEMES[sp.room.theme];
      paint(s, run, sign, a, b, 0, top, interiorBands(th, top), { ao: { a: Math.max(sp.a, run.a), b: Math.min(sp.b, run.b), k: 0.1 }, g });
      const c = rgb(th.stripe), v = sign * HT;
      lbox(s, run, a, b, 0.95, 1.07, sign > 0 ? v - 0.002 : v - 0.011, sign > 0 ? v + 0.011 : v + 0.002, c, { g });
    }
    const wh = rgb(C.trimWarm);
    endFace(s, run, seg.a, -1, 0, top, wh, g); endFace(s, run, seg.b, 1, 0, top, wh, g);
    const ca = seg.a === run.a ? run.capA : seg.a, cb = seg.b === run.b ? run.capB : seg.b;
    capRun(s, run, ca, cb, top);
    // Stems reach the through wall's glass line; ends against the perimeter stop at its face so nothing pokes over a cut wall.
    const ga = seg.a === run.a && !run.perpOuterA && run.raw ? seg.a - HT + 0.02 : seg.a;
    const gb = seg.b === run.b && !run.perpOuterB && run.raw ? seg.b + HT - 0.02 : seg.b;
    if (gb - ga < 0.12) continue;
    panes.pane(run, ga, gb, H, gt);
    lbox(s, run, ga, gb, gt - 2 * r, gt, -r, r, white, { g });
    lbox(s, run, ga, gb, H, H + 0.03, -r, r, white, { g });
    const n = Math.max(1, Math.round((gb - ga) / 1.7));
    for (let i = 0; i <= n; i++) {
      const u = ga + ((gb - ga) * i) / n;
      lbox(s, run, Math.max(ga, u - r), Math.min(gb, u + r), H, gt - 2 * r, -r, r, white, { g });
    }
  }
}

/** Frosted, slightly denser at the bottom, with the dotted manifestation band real hospital glazing has at eye height. */
export function frostMaterial() {
  const tex = canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(232,244,252,.5)'); g.addColorStop(0.42, 'rgba(232,244,252,.26)'); g.addColorStop(1, 'rgba(232,244,252,.15)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.62)';
    for (let i = 0; i < 26; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc((i + 0.5 + (j % 2) * 0.5) * (w / 26), h * 0.56 + j * 11, 3.2, 0, 7); x.fill(); }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false });
}

/** Flat panes with uv, kept apart from the Sheet because glass needs a map and transparency. */
export class Panes {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  pane(run, u0, u1, y0, y1) {
    const a = P(run, u0, y0, 0), b = P(run, u1, y0, 0), c = P(run, u1, y1, 0), d = P(run, u0, y1, 0);
    const n = run.axis === 'x' ? [0, 0, 1] : [1, 0, 0], v0 = (y0 - WALL.partition) / (glassTop - WALL.partition), v1 = (y1 - WALL.partition) / (glassTop - WALL.partition);
    for (const [p, uu, vv] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]]) { this.pos.push(...p); this.nor.push(...n); this.uv.push(uu / 2.4, vv); }
  }
  rawQuad(a, b, c, d, n, w, y0 = 0, y1 = 1) {
    for (const [p, uu, vv] of [[a, 0, y0], [b, w, y0], [c, w, y1], [a, 0, y0], [c, w, y1], [d, 0, y1]]) { this.pos.push(...p); this.nor.push(...n); this.uv.push(uu / 2.4, vv); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

/** `avoid(side)` returns the stretches of a perimeter wall that must stay blank because something hangs or stands there. */
export function buildWalls(floor, { avoid = () => [] } = {}) {
  const runs = deriveRuns(floor), solid = new Sheet(), panes = new Panes(), sides = {};
  for (const run of runs) {
    if (run.side) sides[run.side] = perimeter(run, solid, avoid(run.side));
    else partition(run, solid, panes);
  }
  return { runs, solid, panes, sides };
}

export { JAMB, HT };
