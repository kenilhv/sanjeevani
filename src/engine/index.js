// Haven General's stage: renderer, camera, floors, light, picking. See docs/CONTRACT.md §6.
import * as THREE from 'three';
import './shadow-filter.js';
import { roomById } from '../world/plan.js';
import { createRig } from './rig.js';
import { createPlates } from './plates.js';
import { createSky } from './sky.js';
import { createPipeline } from './pipeline.js';
import { createPicker } from './picking.js';
import { createPulses } from './pulse.js';
import { attachInput } from './input.js';
import { createIntro } from './intro.js';

const MODES = ['ground', 'level1', 'stack'];
const SIDES = [['S', 'E'], ['N', 'E'], ['N', 'W'], ['S', 'W']];
const HOVER_MS = 50, REHOVER_MS = 220, VIEW_MS = 100;
// A stall should pause a transition, not teleport it. Headless GL renders about a frame a second, though, and screenshots
// taken after a mode change still have to show it finished.
const MAX_STEP = navigator.webdriver ? 3 : 0.25;
const v = new THREE.Vector3();

export function createEngine(container, { quality = 'auto' } = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral, not ACES or AgX: on the pink tile #f5cbc1 a swatch test gave ACES #e5d7d2 and AgX #d9cbc7, both grey. Neutral gave #eec3b9.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // PCFSoft ignores shadow.radius, and softness is keyframed through the day
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', touchAction: 'none', outline: 'none' });
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  const root = new THREE.Group(), ground = new THREE.Group(), floors = [new THREE.Group(), new THREE.Group()];
  root.add(ground, ...floors);
  scene.add(root);

  const size = { W: 1, H: 1 };
  const ctx = { night: 0 };
  const stats = { fps: 60, calls: 0, tris: 0, dpr: 1, level: 0, quality };
  const listeners = {}, frameCbs = [];
  const emit = (name, data) => { const list = listeners[name]; if (list) for (const f of list) f(data); };

  const rig = createRig(camera, { reduced });
  const plates = createPlates(floors, {
    farY: () => Math.min(170, Math.max(rig.clearance() + 28, 74 * sky.tanEl)),
    offFrame: (y) => y > rig.clearance(),
  });
  const sky = createSky({ scene, renderer, rig, ctx });
  const pipeline = createPipeline({ renderer, scene, camera, sky, stats });
  const floorVisible = (i) => plates.visible(i);
  const floorY = (i) => floors[i].position.y;
  const picker = createPicker({ camera, floors, floorVisible, size });
  const pulses = createPulses(floors, { floorVisible, floorY });

  let started = false, last = 0, lastZoom = 1, lastAz = 0, lastView = 0, hoverAt = 0, hoverKey = null, dragging = false, cursor = '';

  function sendView() {
    lastZoom = rig.zoom; lastAz = rig.azimuthIndex;
    emit('view', { azimuthIndex: rig.azimuthIndex, floorMode: plates.mode, zoom: rig.zoom, near: SIDES[rig.azimuthIndex] });
  }
  function setCursor(next) { if (next !== cursor) { cursor = next; canvas.style.cursor = next; } }

  function setFloorMode(mode, instant) {
    if (!MODES.includes(mode)) return;
    const snapNow = instant || !started;
    if (mode === plates.mode && !snapNow) return;
    plates.set(mode, snapNow);
    rig.setModeView(mode, snapNow);
    sendView();
  }

  const intro = createIntro({ rig, sky, plates, setFloorMode, reduced });
  // The UI binds Q and E too. One key press must stay one quarter turn, and holding a key must not spin the building.
  let turnEvent = null;
  function turn(dir) {
    const ev = window.event;
    if (ev?.type === 'keydown' && (ev.repeat || ev === turnEvent)) return;
    turnEvent = ev;
    rig.rotate(dir);
  }
  const input = attachInput({
    el: canvas, rig, size,
    onAny: () => rig.poke(),
    locked: () => intro.locked,
    onTurn: turn,
    onDragChange(on) { dragging = on; setCursor(on ? 'grabbing' : ''); if (on) clearHover(); },
    onTap(x, y) { emit('select', picker.pick(x, y)); },
  });

  // Window capture, because the welcome card sits over the canvas during the opening and takes its pointer events.
  const skipIntro = (e) => { if (e.key !== 'Tab') intro.skip(); };
  for (const type of ['pointerdown', 'wheel', 'keydown']) window.addEventListener(type, skipIntro, { capture: true, passive: true });

  function clearHover() {
    if (hoverKey !== null) { hoverKey = null; emit('hover', null); }
  }
  function updateHover(now) {
    const h = input.hover;
    if (dragging || intro.active) return;
    if (!h.inside) { if (h.dirty) { h.dirty = false; clearHover(); if (cursor === 'pointer') setCursor(''); } return; }
    if (now - hoverAt < (h.dirty ? HOVER_MS : REHOVER_MS)) return;
    hoverAt = now; h.dirty = false;
    const hit = picker.pick(h.x, h.y), key = hit ? hit.type + ':' + hit.id : null;
    if (key === hoverKey) return;
    hoverKey = key;
    setCursor(hit ? 'pointer' : '');
    emit('hover', hit);
  }

  function frame(now) {
    requestAnimationFrame(frame);       // first, so a throwing subscriber costs a frame rather than the whole loop
    const raw = Math.max(0, (now - last) / 1000);
    last = now;
    const rdt = Math.min(raw, MAX_STEP), dt = Math.min(raw, 0.05), t = now / 1000;
    pipeline.sample(raw);
    input.update(rdt);
    intro.update(Math.min(raw, 0.1));
    plates.update(rdt);
    rig.update(rdt, t);
    sky.update(rdt, t, plates.top());
    pulses.update(rdt);
    if (rig.azimuthIndex !== lastAz || (now - lastView > VIEW_MS && Math.abs(rig.zoom / lastZoom - 1) > 0.004)) { lastView = now; sendView(); }
    updateHover(now);
    for (const cb of frameCbs) cb(dt, t);
    renderer.info.reset();
    pipeline.render(dt);
    stats.calls = renderer.info.render.calls;
    stats.tris = renderer.info.render.triangles;
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    if (w === size.W && h === size.H) return;
    size.W = w; size.H = h;
    pipeline.resize(w, h);
    rig.resize(w, h);
    sky.resize(w, h);
    input.measure();
    sendView();
  }

  const engine = {
    scene, camera, renderer, root, ground, floors, ctx, stats,
    get floorMode() { return plates.mode; },
    get azimuthIndex() { return rig.azimuthIndex; },
    get zoom() { return rig.zoom; },
    get introActive() { return intro.active; },
    onFrame(cb) { frameCbs.push(cb); return () => frameCbs.splice(frameCbs.indexOf(cb), 1); },
    on(name, cb) { (listeners[name] ??= []).push(cb); return () => listeners[name].splice(listeners[name].indexOf(cb), 1); },
    start() {
      if (started) return;
      started = true;
      rig.goLive();
      last = performance.now();
      requestAnimationFrame(frame);
    },
    setFloorMode: (mode) => setFloorMode(mode),
    floorVisible,
    floorY,
    rotate(dir) { rig.poke(); intro.skip(); turn(Math.sign(dir) || 1); },
    flyTo: (o) => { rig.poke(); return rig.flyTo(o); },
    focusRoom(id, { zoom, duration } = {}) {
      const room = roomById(id);
      if (!room) return Promise.resolve();
      if (room.floor === 1 && plates.mode === 'ground') setFloorMode('level1');
      if (room.floor === 0 && plates.mode === 'level1') setFloorMode('ground');
      const r = room.rect;
      rig.poke();
      return rig.flyTo({ x: r.x + r.w / 2, y: plates.goalY(room.floor) + 0.5, z: r.z + r.d / 2, zoom: zoom ?? rig.fitRect(r), duration });
    },
    resetView() { rig.poke(); return rig.flyTo(rig.home(), { framed: false }).then(sendView); },
    setHours: (h) => sky.setHours(h),
    project(x, y, z, floor) {
      v.set(x, y, z).project(camera);
      const visible = Math.abs(v.x) <= 1.02 && Math.abs(v.y) <= 1.02 && v.z >= -1 && v.z <= 1 && (floor === undefined || floorVisible(floor));
      return { x: ((v.x + 1) / 2) * size.W, y: ((1 - v.y) / 2) * size.H, visible };
    },
    addPickable: (object, info) => picker.add(object, info),
    removePickable: (object) => picker.remove(object),
    pulse: (x, y, z, color) => pulses.fire(x, y, z, color),
    intro: () => intro.play(),
    setQuality: (q) => pipeline.setQuality(q),
    setInsets: (insets) => rig.setInsets(insets),
    zoomBy: (f) => { rig.poke(); rig.zoomBy(f); },
  };

  resize();
  pipeline.setQuality(quality);
  new ResizeObserver(resize).observe(container);
  return engine;
}
