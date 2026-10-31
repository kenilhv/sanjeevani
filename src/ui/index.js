// The interface over the 3D scene. mountUI wires one shared `ui` context through every panel,
// then runs a light frame loop: labels each frame, everything that reads the twin about 3 Hz.
import { injectStyles } from './styles.js';
import { calm, clamp } from './util.js';
import { createBrand, createFloors, createClock } from './chrome.js';
import { createRail } from './rail.js';
import { createInspector } from './inspector.js';
import { createDock } from './dock.js';
import { createAsk } from './ask.js';
import { createAgents } from './agents.js';
import { createToasts } from './toasts.js';
import { createLabels } from './labels.js';
import { createWelcome } from './welcome.js';
import { createTour } from './tour.js';
import { el } from './util.js';
import { C } from '../style/palette.js';
import { FLOOR_HEIGHT } from '../world/plan.js';

export function mountUI({ engine, twin, shell, people, root, params }) {
  injectStyles();
  root.classList.add('hv');
  root.dataset.theme = 'day';
  root.dataset.inspect = '0';
  const q = params ?? new URLSearchParams(location.search);

  const ui = { engine, twin, shell, people, root, params: q, calm };

  // The engine reports zoom relative to the home view, so 1 is the whole hospital.
  let zoomNow = 1;
  ui.zoomValue = () => engine.zoom ?? zoomNow;
  ui.zoomRatio = ui.zoomValue;
  ui.zoomFor = (kind) => ({ room: 2.4, bed: 4.2, person: 3.6, site: 1.9 }[kind] ?? 2.4);
  engine.on?.('view', (v) => { if (Number.isFinite(v?.zoom)) zoomNow = v.zoom; });

  // Lookups
  const actorIndex = new Map();
  ui.actor = (id) => {
    if (id == null) return null;
    let a = actorIndex.get(id);
    // People go home, so a cached actor is only good while the sim still has them.
    if (!a || a.alive === false) { a = (twin.actors ?? []).find((x) => x.id === id); a ? actorIndex.set(id, a) : actorIndex.delete(id); }
    return a ?? null;
  };
  ui.locate = (type, id) => {
    // Aim at where a plate will come to rest, not where it happens to be mid-flight.
    const fy = (f) => (!f ? 0 : engine.floorMode === 'stack' ? engine.floorY?.(1) ?? FLOOR_HEIGHT : FLOOR_HEIGHT);
    if (type === 'room') {
      const r = shell.rooms?.get?.(id), t = twin.rooms?.get?.(id);
      const c = r?.centre;
      const floor = r?.floor ?? t?.floor ?? 0;
      return c ? { x: c.x, y: fy(floor), z: c.z, floor } : { floor };
    }
    if (type === 'bed') { const b = twin.beds?.get?.(id); return b && { x: b.x, y: fy(b.floor), z: b.z, floor: b.floor, roomId: b.roomId }; }
    if (type === 'person') { const a = ui.actor(id); return a && { x: a.x, y: fy(a.floor), z: a.z, floor: a.floor, roomId: a.roomId }; }
    if (type === 'equipment') {
      const e = shell.entities?.get?.(id), q2 = twin.equipment?.get?.(id);
      return e ? { ...e.world, floor: e.floor, roomId: e.roomId ?? q2?.roomId } : q2 && { roomId: q2.roomId, floor: twin.rooms?.get?.(q2.roomId)?.floor ?? 0 };
    }
    if (type === 'vehicle') { const v = (twin.vehicles ?? []).find((x) => x.id === id); return v && { x: v.x, y: v.y ?? 0, z: v.z, floor: 0 }; }
    return null;
  };
  const revealFloor = (floor) => {
    if (floor === undefined) return;
    const want = floor === 1 ? 'level1' : 'ground';
    if (engine.floorMode !== 'stack' && engine.floorMode !== want) ui.floors?.set(want);
  };

  // Hover tints win over the busy map, then hand the room back to it.
  const tinted = new Set();
  ui.isTinted = (id) => tinted.has(id);
  ui.hoverTint = (ids, color) => { ui.clearHoverTint(); for (const id of ids) { tinted.add(id); shell.setRoomTint?.(id, color, 0.46); } };
  ui.clearHoverTint = () => { for (const id of tinted) shell.setRoomTint?.(id, null, 0); tinted.clear(); ui.dock?.paint(); };
  ui.askTint = (ids) => { for (const id of ids) { tinted.add(id); shell.setRoomTint?.(id, C.teal, 0.42); } };
  ui.clearAskTint = (ids) => { for (const id of ids) { tinted.delete(id); shell.setRoomTint?.(id, null, 0); } ui.dock?.paint(); };

  // Selection is one flow no matter where it starts: the 3D scene, a list, a toast or an answer.
  ui.select = (hit, { fly = true } = {}) => {
    const h = hit?.info ?? hit;
    if (!h?.type) return ui.clearSelection();
    let { type, id } = h;
    // A patient lying in bed is a click on that bed: the bed panel is the one with the heart trace and vitals.
    const person = type === 'person' ? ui.actor(id) : null;
    if (person?.anim === 'lie' && twin.beds?.get?.(person.bedId)?.patientId === id) { type = 'bed'; id = person.bedId; }
    const at = ui.locate(type, id);
    ui.inspector.open(type, id);
    people.highlight?.(type === 'person' ? id : null);
    ui.labels.setRoute(type === 'person' ? id : null);
    const roomId = type === 'room' ? id : at?.roomId;
    shell.highlightRoom?.(roomId ?? null);
    if (!fly || !at) return;
    revealFloor(at.floor);
    if (type === 'room') engine.focusRoom?.(id, {});
    else if (at.x !== undefined) engine.flyTo?.({ x: at.x, y: at.y ?? 0, z: at.z, zoom: ui.zoomFor(type === 'bed' ? 'bed' : type === 'person' ? 'person' : 'room'), duration: 1.1 });
  };
  ui.clearSelection = () => {
    const had = ui.inspector?.close();
    people.highlight?.(null);
    ui.labels?.setRoute(null);
    shell.highlightRoom?.(null);
    return had;
  };
  // Only one floating layer at a time on small screens; side by side on large ones.
  ui.onLayerOpen = (who) => {
    if (who !== 'ask') ui.ask?.close();
    if (who !== 'fly') ui.rail?.close();
    if (who !== 'agents' && innerWidth < 900) ui.agents?.close();
  };
  ui.closeLayers = () => { ui.ask?.close(); ui.agents?.close(); ui.rail?.close(); };

  // Panels. Toasts need the clock's host node; the order here is also the entrance order.
  const brand = createBrand(ui);
  ui.floors = createFloors(ui);
  ui.clock = createClock(ui);
  ui.rail = createRail(ui);
  const bottom = el(`<div class="hv-bottom"></div>`);
  root.append(bottom);
  ui.ask = createAsk(ui);
  ui.dock = createDock(ui);
  ui.agents = createAgents(ui);
  bottom.append(ui.ask.pill, ui.dock.node, ui.agents.chip);
  ui.labels = createLabels(ui);
  ui.inspector = createInspector(ui);
  ui.toasts = createToasts(ui, ui.clock.toasts);
  ui.tour = createTour(ui);
  // Labels sit under every panel, so move them to the front of the stacking order.
  root.prepend(root.querySelector('.hv-tip'));
  root.prepend(root.querySelector('.hv-labels'));

  engine.on?.('select', (hit) => { if (!ui.tour.active) ui.select(hit); });

  // Phones stack panels above and below the scene instead of beside it, so frame the hospital between them.
  const fitCamera = () => engine.setInsets?.(innerWidth < 900 ? { left: 0, right: 0, top: 124, bottom: 152 } : null);
  addEventListener('resize', fitCamera);
  fitCamera();

  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    const panels = [...root.querySelectorAll('.hv-enter')];
    panels.forEach((n, i) => {
      n.style.setProperty('--d', `${(calm() ? 0 : i * 60)}ms`);
      requestAnimationFrame(() => n.classList.add('in'));
      // Hand the transform back to the press and hover styles once the entrance is over.
      setTimeout(() => n.classList.add('done'), 1300 + i * 60);
    });
    ui.clock.remeasure();
    // Say the one thing a first-time viewer needs, once, and get out of the way.
    const hint = el(`<div class="hv-nudge hv-glass" role="note">${matchMedia('(hover: none)').matches ? 'Tap' : 'Click'} any room, bed or person to look closer</div>`);
    ui.dock.node.append(hint);
    const away = () => { hint.classList.remove('on'); setTimeout(() => hint.remove(), 500); removeEventListener('pointerdown', away, true); };
    setTimeout(() => { if (!ui.tour.active) hint.classList.add('on'); }, 1900);
    setTimeout(away, 11000);
    addEventListener('pointerdown', away, true);
  }
  if (q.has('skipIntro')) enter();
  else {
    const showWelcome = () => createWelcome(ui, {
      onLook: enter,
      onTour: () => { enter(); ui.tour.start(); },
    });
    // The veil and the words arrive with the intro's first frames rather than ahead of them.
    ui.welcome = showWelcome();
  }

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.ask.toggle(); return; }
    if (e.key === 'Escape') {
      if (ui.tour.active) ui.tour.stop();
      else ui.ask.close() || ui.rail.close() || ui.clearSelection() || ui.agents.close();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) return;
    if (ui.tour.active || ui.welcome?.active) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      if (document.activeElement?.matches?.('button:focus-visible')) return;
      e.preventDefault();
      ui.clock.togglePause();
    } else if (k === 'q') engine.rotate?.(-1);
    else if (k === 'e') engine.rotate?.(1);
    else if (k === 'h') ui.dock.toggleBusy();
    else if (k === 'k' || k === '/') { e.preventDefault(); ui.ask.open(); }
  });

  // Night glass eases in with the sky. A little hysteresis so dusk never flickers the theme.
  let night = false;
  const syncTheme = () => {
    const n = engine.ctx?.night ?? 0;
    const next = night ? n > 0.48 : n > 0.55;
    if (next !== night) { night = next; root.dataset.theme = night ? 'night' : 'day'; }
  };

  // If backdrop blur is what is costing frames on this machine, give the frames back.
  let slow = 0, lite = false;
  const watchFrames = (dt) => {
    if (lite || navigator.webdriver) return;
    const fps = engine.stats?.fps ?? 60;
    slow = fps < 34 ? slow + dt : Math.max(0, slow - dt);
    if (slow > 6) { lite = true; root.dataset.glass = 'lite'; }
  };

  let acc = 1, failed = false;
  const tick = () => {
    syncTheme();
    brand.tick();
    ui.rail.tick();
    ui.labels.tick();
    ui.inspector.tick();
    ui.agents.tick();
    ui.toasts.tick();
    ui.dock.tick();
  };
  return {
    ...ui,
    update(dt, t) {
      try {
        const d = clamp(dt, 0, 0.1);
        acc += d;
        if (acc >= 0.33) { acc = 0; tick(); }
        ui.clock.update();
        ui.rail.update(d);
        ui.labels.update(d, t);
        ui.inspector.update(d);
        watchFrames(d);
      } catch (e) {
        // One bad label must never stop the frame loop that drives the whole hospital.
        if (!failed) { failed = true; console.error('ui.update', e); }
      }
    },
  };
}
