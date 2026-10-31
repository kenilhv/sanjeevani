// Pointer, wheel, touch and keyboard. Translates raw events into rig moves; knows nothing about what is on screen.
import { clamp } from './motion.js';

const TAP_PX = 5, TURN_PX = 130, TURN_RAD = 0.5, KEY_PAN = 520;
const isTyping = (t) => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '');
const ARROWS = { arrowleft: [1, 0], arrowright: [-1, 0], arrowup: [0, 1], arrowdown: [0, -1] };

export function attachInput({ el, rig, size, onAny, locked, onTap, onTurn, onDragChange }) {
  const pts = new Map(), held = new Set();
  const hover = { x: 0, y: 0, inside: false, dirty: false };
  const vel = { x: 0, y: 0 };
  let rect = el.getBoundingClientRect(), mode = null, moved = false, start = null, acc = 0, twist = 0, pinch = null, lastMove = 0;

  const pos = (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  const gesture = () => {
    const [a, b] = [...pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), a: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const setDragging = (on) => { onDragChange(on); rig.hold(on); };

  function down(e) {
    onAny();
    if (locked()) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
    pts.set(e.pointerId, pos(e));
    if (pts.size === 1) {
      start = pos(e); moved = false; acc = 0;
      mode = e.button === 2 ? 'turn' : 'pan';
      vel.x = vel.y = 0;
      rig.hold(true);
    } else if (pts.size === 2) {
      mode = 'pinch'; moved = true; twist = 0; pinch = gesture();
      onDragChange(true);
    }
  }

  function move(e) {
    const p = pos(e);
    onAny();
    if (e.pointerType !== 'touch') { hover.x = p.x; hover.y = p.y; hover.inside = true; hover.dirty = true; }
    const prev = pts.get(e.pointerId);
    if (!prev || locked()) return;
    const dx = p.x - prev.x, dy = p.y - prev.y;
    pts.set(e.pointerId, p);
    if (mode === 'pinch' && pts.size >= 2) {
      const g = gesture();
      rig.pan(g.x - pinch.x, g.y - pinch.y);
      rig.zoomAt(Math.log(g.d / pinch.d), g.x, g.y);
      twist += Math.atan2(Math.sin(g.a - pinch.a), Math.cos(g.a - pinch.a));
      if (Math.abs(twist) > TURN_RAD) { rig.rotate(twist > 0 ? 1 : -1); twist = 0; }
      pinch = g;
      return;
    }
    if (!moved) {
      if (Math.hypot(p.x - start.x, p.y - start.y) <= TAP_PX) return;
      moved = true;
      onDragChange(true);
    }
    if (mode === 'pan') {
      const now = performance.now(), ms = Math.max(4, now - lastMove);
      vel.x += (dx / ms * 1000 - vel.x) * 0.4;
      vel.y += (dy / ms * 1000 - vel.y) * 0.4;
      lastMove = now;
      rig.pan(dx, dy);
    } else if (mode === 'turn') {
      acc += dx;
      if (Math.abs(acc) >= TURN_PX) { rig.rotate(acc > 0 ? -1 : 1); acc = 0; }
    }
  }

  function up(e, cancelled) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 1 && mode === 'pinch') { mode = 'pan'; vel.x = vel.y = 0; return; }
    if (pts.size) return;
    setDragging(false);
    if (!cancelled && !moved && mode === 'pan' && e.button === 0) { const p = pos(e); onTap(p.x, p.y); }
    else if (mode === 'pan' && moved && performance.now() - lastMove < 70) rig.release(vel.x, vel.y);
    mode = null;
  }

  function wheel(e) {
    e.preventDefault();
    onAny();
    if (locked()) return;
    const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 120 : 1, p = pos(e);
    // A trackpad pinch arrives as a ctrl+wheel with tiny deltas.
    rig.zoomAt(-clamp(e.deltaY * unit, -240, 240) * (e.ctrlKey ? 0.012 : 0.0017), p.x, p.y);
  }

  function key(e) {
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    onAny();
    if (locked()) return;
    const k = e.key.toLowerCase();
    if (k === 'q') onTurn(-1);
    else if (k === 'e') onTurn(1);
    else if (ARROWS[k]) { held.add(k); e.preventDefault(); }
    else if (k === '+' || k === '=') rig.zoomAt(0.28, size.W / 2, size.H / 2);
    else if (k === '-' || k === '_') rig.zoomAt(-0.28, size.W / 2, size.H / 2);
  }
  const keyUp = (e) => held.delete(e.key.toLowerCase());
  const blur = () => held.clear();
  const leave = () => { hover.inside = false; hover.dirty = true; };
  const noMenu = (e) => e.preventDefault();
  const upBound = (e) => up(e, false), cancelBound = (e) => up(e, true);

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', upBound);
  el.addEventListener('pointercancel', cancelBound);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  return {
    hover,
    get dragging() { return pts.size > 0 && moved; },
    measure() { rect = el.getBoundingClientRect(); },
    update(dt) {
      if (!held.size) return;
      let x = 0, y = 0;
      for (const k of held) { x += ARROWS[k][0]; y += ARROWS[k][1]; }
      onAny();
      rig.pan(x * KEY_PAN * dt, y * KEY_PAN * dt);
    },
  };
}
