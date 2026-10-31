// The camera. Everything it does is a critically damped spring, or an eased flight that hands its
// velocity back to those springs when interrupted, so no input can ever cause a visible snap.
import * as THREE from 'three';
import { BUILDING, FLOOR_HEIGHT, SITE, WALL } from '../world/plan.js';
import { STACK_LIFT } from './plates.js';
import { clamp, coastOut, glide, lerp, smooth, snap, spring, step } from './motion.js';

const RAD = Math.PI / 180;
export const ELEVATION = 32 * RAD;
const V = 30, DIST = 420;                       // frustum half-height at camera.zoom 1, and stand-off
const Z_MIN = Math.log(0.62), Z_MAX = Math.log(9);
const W = { pan: 30, zoom: 10, turn: 5.6, tilt: 3.4, mode: 3.8 };
const CX = (SITE.x0 + SITE.x1) / 2, CZ = (SITE.z0 + SITE.z1) / 2;
const SITE_W = SITE.x1 - SITE.x0, SITE_D = SITE.z1 - SITE.z0;
const BOX_Y = [-2.8, 7.2];                      // island skirt to treetops
const SHIFT = ['x', 'y', 'z', 'lz', 'th', 'el'];
const bearing = (i) => (135 - 90 * i) * RAD;    // compass bearing of the camera: 0 SE, 1 NE, 2 NW, 3 SW, the order the shell cuts walls in
const mod4 = (i) => ((i % 4) + 4) % 4;

// Matches the UI's fixed panels. The right column is only full while the inspector is open, so the home view may use
// that space, and only flights to a selection keep clear of it (focusRight). Phones pass their own through setInsets.
const defaultInsets = (w, h) => (w < 900
  ? { left: 0, right: 0, top: 124, bottom: Math.min(152, h * 0.24) }
  : { left: 274, right: 64, top: 96, bottom: 84, focusRight: 358 });

export function createRig(camera, { reduced }) {
  const s = {
    x: spring(CX), y: spring(0), z: spring(CZ),
    lz: spring(0), th: spring(bearing(0)), el: spring(ELEVATION),
    mz: spring(0), my: spring(0),                // framing asked for by the floor mode, on top of the user's own
  };
  const view = { W: 1, H: 1, cx: 0, cy: 0, base: 1, insets: null, homeY: 0, freeW: 1, freeH: 1, fullW: 1, focusDx: 0, stackZ: 0, stackY: 0 };
  const m = new THREE.Matrix4(), R = new THREE.Vector3(), U = new THREE.Vector3(), D = new THREE.Vector3();
  const br = { th: 0, lz: 0, u: 0, v: 0, amt: 0 };
  let index = 0, grid = bearing(0), flight = null, anchor = null, held = false, idle = 0, live = false, mode = 'ground';
  const coast = { x: 0, y: 0, on: false };
  let lift = 0;                                  // the opening rises by moving the camera: world-space clip planes must stay true

  const px = (lz = s.lz.x + s.mz.x) => (view.H / (2 * V)) * view.base * Math.exp(lz);

  function refit() {
    const { W: w, H: h } = view, ins = view.insets ?? defaultInsets(w, h), hd = ((SITE_W + SITE_D) / 2) * Math.SQRT1_2;
    const wasHome = Math.abs(s.y.g - view.homeY) < 1e-4;
    const se = Math.sin(ELEVATION), ce = Math.cos(ELEVATION);
    const focusRight = ins.focusRight ?? ins.right;
    view.freeW = w - ins.left - ins.right;
    view.fullW = w - ins.left - focusRight;
    view.focusDx = (ins.right - focusRight) / 2;
    view.freeH = h - ins.top - ins.bottom;
    view.cx = (ins.left - ins.right) / 2;
    view.cy = (ins.top - ins.bottom) / 2;
    // An axis-aligned site seen at 45° frames identically from all four sides.
    const v0 = -hd * se + BOX_Y[0] * ce, v1 = hd * se + BOX_Y[1] * ce;
    const P = Math.min(view.freeW / (2 * hd), view.freeH / (v1 - v0));
    view.base = (P * 2 * V) / h;
    view.homeY = (v0 + v1) / 2 / ce;
    if (wasHome) snap(s.y, view.homeY);
    const stackTop = hd * se * 0.72 + (FLOOR_HEIGHT + STACK_LIFT + WALL.full) * ce;
    view.stackZ = Math.log(Math.min(0.9, view.freeH / (stackTop - v0) / P));
    view.stackY = ((v0 + stackTop) / 2 - (v0 + v1) / 2) / ce;
    setModeView(mode, !live);
  }

  function setModeView(next, instant) {
    mode = next;
    s.mz.g = next === 'stack' ? view.stackZ : 0;
    s.my.g = next === 'stack' ? view.stackY : next === 'level1' ? FLOOR_HEIGHT * 0.3 : 0;
    if (instant) { snap(s.mz); snap(s.my); }
  }

  function limit() {
    const k = Math.max(0, 1 - 1 / Math.exp(s.lz.g + s.mz.g));
    const ax = (SITE_W / 2) * k + 9, az = (SITE_D / 2) * k + 9;
    s.x.g = clamp(s.x.g, CX - ax, CX + ax);
    s.z.g = clamp(s.z.g, CZ - az, CZ + az);
  }

  /** Slide the target by a camera-plane offset in metres, along the ground. */
  function shift(right, up, both) {
    const b = s.th.x, cb = Math.cos(b), sb = Math.sin(b), g = up / Math.sin(s.el.x);
    const dx = -cb * right - sb * g, dz = -sb * right + cb * g;
    s.x.g += dx; s.z.g += dz;
    if (both) { s.x.x += dx; s.z.x += dz; }
  }

  function interrupt() {
    if (!flight) return;
    const f = flight;
    flight = null;
    coastOut(s.x, W.pan); coastOut(s.y, W.pan); coastOut(s.z, W.pan); coastOut(s.lz, W.zoom);
    s.th.g = grid; s.el.g = ELEVATION;
    f.resolve();
  }

  /** Any input: bake the idle drift into the pose, so it stops dead instead of snapping back. */
  function poke() {
    idle = 0;
    if (!br.amt) return;
    s.th.x += br.th;
    s.lz.x += br.lz; s.lz.g += br.lz;
    shift(br.u, br.v, true);
    br.th = br.lz = br.u = br.v = br.amt = 0;
  }

  function stepFlight(dt) {
    const f = flight;
    f.t += dt;
    const u = f.dur > 0 ? clamp(f.t / f.dur) : 1, e = f.ease(u);
    for (const k of SHIFT) {
      const sp = s[k], dip = k === 'lz' ? f.dip * Math.sin(Math.PI * e) ** 2 : 0;
      const nx = lerp(f.from[k], f.to[k], e) - dip;
      if (dt > 0) sp.v = (nx - sp.x) / dt;
      sp.x = sp.g = nx;
    }
    if (u >= 1) {
      flight = null;
      for (const k of SHIFT) s[k].v = 0;
      f.resolve();
    }
  }

  function breathe(dt, t) {
    const moving = flight || held || coast.on || anchor || Math.abs(s.th.x - s.th.g) > 1e-3;
    idle = moving ? 0 : idle + dt;
    if (idle < 8 || reduced.matches) { if (br.amt) poke(); return; }
    br.amt = Math.min(1, br.amt + dt / 7);
    const e = smooth(br.amt);
    br.th = e * 0.0042 * Math.sin(t * 0.23);
    br.lz = e * 0.0038 * Math.sin(t * 0.17 + 1.3);
    br.u = e * 0.07 * Math.sin(t * 0.19 + 2.1);
    br.v = e * 0.05 * Math.sin(t * 0.14 + 0.7);
  }

  function compose() {
    const b = s.th.x + br.th, e = s.el.x, sb = Math.sin(b), cb = Math.cos(b), se = Math.sin(e), ce = Math.cos(e);
    const lz = s.lz.x + s.mz.x + br.lz, zoom = view.base * Math.exp(lz), P = (view.H / (2 * V)) * zoom;
    if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
    D.set(sb * ce, se, -cb * ce);
    R.set(-cb, 0, -sb);
    U.set(-sb * se, ce, cb * se);
    // The look-at point sits at the centre of the free area between the panels, not the middle of the screen.
    const right = br.u - view.cx / P, up = br.v + view.cy / P;
    camera.position.set(s.x.x, s.y.x + s.my.x + lift, s.z.x)
      .addScaledVector(D, DIST).addScaledVector(R, right).addScaledVector(U, up);
    m.makeBasis(R, U, D);
    camera.quaternion.setFromRotationMatrix(m);
    camera.updateMatrixWorld(true);
  }

  const rig = {
    get azimuthIndex() { return index; },
    get zoom() { return Math.exp(s.lz.x + s.mz.x); },
    get flying() { return !!flight; },
    get right() { return R; },
    get up() { return U; },
    get bearing() { return s.th.x; },
    poke,
    goLive() { live = true; },
    setLift(y) { lift = y; },
    resize(w, h) {
      view.W = w; view.H = h;
      const a = w / h;
      Object.assign(camera, { left: -V * a, right: V * a, top: V, bottom: -V, near: 1, far: 1000 });
      camera.updateProjectionMatrix();
      refit();
      compose();
    },
    setInsets(ins) { view.insets = ins; refit(); },
    setModeView,
    hold(on) { held = on; if (on) { interrupt(); coast.on = false; } },
    pan(dx, dy) {
      interrupt();
      const k = 1 / px();
      shift(-dx * k, dy * k);
      limit();
    },
    release(vx, vy) { coast.x = vx; coast.y = vy; coast.on = Math.hypot(vx, vy) > 30; },
    zoomAt(delta, x, y) {
      interrupt();
      s.lz.g = clamp(s.lz.g + delta, Z_MIN - s.mz.g, Z_MAX - s.mz.g);
      anchor = { x: x - (view.W / 2 + view.cx), y: y - (view.H / 2 + view.cy) };
      limit();
    },
    rotate(dir) {
      interrupt();
      index = mod4(index + dir);
      grid -= dir * 90 * RAD;
      s.th.g = grid;
    },
    pose: () => ({ x: s.x.g, y: s.y.g + s.my.g, z: s.z.g, zoom: Math.exp(s.lz.g + s.mz.g), azimuthIndex: index }),
    jump({ dx = 0, dy = 0, lz = 0, th = 0, el }) {
      s.x.g += dx; s.y.g += dy;
      snap(s.x); snap(s.y); snap(s.lz, s.lz.g + lz); snap(s.th, s.th.g + th);
      if (el !== undefined) snap(s.el, el);
      compose();
    },
    home: () => ({ x: CX, y: view.homeY + s.my.g, z: CZ, zoom: Math.exp(s.mz.g), azimuthIndex: 0 }),
    zoomBy(f) { rig.zoomAt(Math.log(f), view.W / 2 + view.cx, view.H / 2 + view.cy); },
    /** Zoom that fits a room in the free area between the panels. */
    fitRect(r) {
      const hd = ((r.w + r.d) / 2) * Math.SQRT1_2, se = Math.sin(ELEVATION), ce = Math.cos(ELEVATION);
      const P = Math.min(view.fullW / (2 * hd + 2.4), view.freeH / (2 * hd * se + (WALL.full + 1.6) * ce));
      return clamp(P / px(0), 1.25, 5.5);
    },
    flyTo({ x, y, z, zoom, azimuthIndex, duration } = {}, { ease = glide, arc = true, framed = true } = {}) {
      interrupt();
      coast.on = false; anchor = null;
      const to = {
        x: x ?? s.x.g, z: z ?? s.z.g,
        y: y !== undefined ? y - s.my.g : s.y.g,
        lz: zoom !== undefined ? clamp(Math.log(zoom), Z_MIN, Z_MAX) - s.mz.g : s.lz.g,
        th: grid, el: ELEVATION,
      };
      if (azimuthIndex !== undefined) {
        let d = mod4(azimuthIndex - index);
        if (d === 3) d = -1;
        grid -= d * 90 * RAD;
        to.th = grid;
        index = mod4(azimuthIndex);
      }
      if (framed && x !== undefined) {
        // Land the subject in the middle of what the open inspector leaves visible.
        const k = view.focusDx / px(to.lz + s.mz.g);
        to.x += Math.cos(to.th) * k; to.z += Math.sin(to.th) * k;
      }
      const from = Object.fromEntries(SHIFT.map((k) => [k, s[k].x]));
      const lift = Math.hypot(to.x - from.x, to.z - from.z) * px(Math.max(from.lz, to.lz) + s.mz.g);
      const span = Math.min(view.W, view.H);
      let dur = duration ?? clamp(1.05 + (lift / span) * 0.35 + Math.abs(to.lz - from.lz) * 0.16 + Math.abs(to.th - from.th) * 0.22, 1.1, 2.4);
      if (reduced.matches) dur *= 0.45;
      if (!live) dur = 0;
      // Long moves between close-ups pull back and come in again, so the journey stays readable.
      const dip = arc ? clamp(Math.log(1 + lift / span) * 0.42, 0, 0.55) : 0;
      return new Promise((resolve) => {
        flight = { from, to, t: 0, dur, ease, dip, resolve };
        if (dur === 0) { stepFlight(0); compose(); }
      });
    },
    /** World height where the plate's nearest corner clears the top of the frame. */
    clearance() {
      const P = px(), top = (view.H / 2 + view.cy) / P;
      let low = Infinity;
      for (const cx of [0, BUILDING.w]) for (const cz of [0, BUILDING.d]) {
        low = Math.min(low, (cx - s.x.x) * U.x + (cz - s.z.x) * U.z - (s.y.x + s.my.x) * U.y);
      }
      return (top - low + 2) / U.y;
    },
    update(dt, t) {
      if (flight) stepFlight(dt);
      else {
        if (coast.on) {
          rig.pan(coast.x * dt, coast.y * dt);
          const k = Math.exp(-dt / 0.3);
          coast.x *= k; coast.y *= k;
          if (Math.hypot(coast.x, coast.y) < 6) coast.on = false;
        }
        const before = s.lz.x;
        step(s.lz, W.zoom, dt);
        if (anchor) {
          // Slide target and goal together, so the point under the cursor stays exactly there.
          const k = 1 / px(before + s.mz.x) - 1 / px();
          shift(anchor.x * k, -anchor.y * k, true);
          if (Math.abs(s.lz.g - s.lz.x) < 5e-4) anchor = null;
        }
        step(s.x, W.pan, dt); step(s.y, W.pan, dt); step(s.z, W.pan, dt);
        step(s.th, W.turn, dt); step(s.el, W.tilt, dt);
      }
      step(s.mz, W.mode, dt); step(s.my, W.mode, dt);
      breathe(dt, t);
      compose();
    },
  };
  return rig;
}
