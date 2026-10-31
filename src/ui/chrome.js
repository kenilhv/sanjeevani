// The always-on chrome: brand and status line, floor switch, clock capsule.
import { el, clamp, setText } from './util.js';
import { icons as I } from './icons.js';
import { HOSPITAL_NAME } from '../world/plan.js';

function statusLine(twin) {
  const m = twin.metrics ?? {};
  const open = (twin.alerts ?? []).filter((a) => !a.resolved);
  const crit = open.find((a) => a.severity === 'critical');
  if (crit) return [crit.title || 'A team is responding right now', 'danger'];
  if (twin.scenario === 'mci') return ['Emergency is taking in a big arrival', 'danger'];
  if ((m.erWaitMin ?? 0) >= 40) return ['Emergency is busier than usual', 'watch'];
  if (m.bedsTotal && !m.bedsFree) return ['Beds are running short', 'watch'];
  if (twin.scenario === 'flu') return ['Busy with flu, but keeping up', 'watch'];
  const watch = open.find((a) => a.severity === 'watch');
  if (watch) return ['One thing to keep an eye on', 'watch'];
  const h = twin.clock?.hours ?? 12;
  if (h >= 22 || h < 5.5) return ['A quiet night so far', 'ok'];
  if ((m.erWaitMin ?? 0) >= 25) return ['Emergency is a little busy', 'ok'];
  return ['All calm right now', 'ok'];
}

export function createBrand(ui) {
  const node = el(`<div class="hv-tl"><div class="hv-brand hv-glass hv-enter">
    <span class="hv-mark">${I.mark}</span>
    <div><div class="hv-name">${HOSPITAL_NAME}</div>
    <div class="hv-status" role="status"><i class="hv-live"></i><span class="hv-status-t">All calm right now</span></div></div>
  </div></div>`);
  const dot = node.querySelector('.hv-live'), text = node.querySelector('.hv-status-t');
  let shown = text.textContent, timer;
  ui.root.append(node);
  return {
    tick() {
      const [line, state] = statusLine(ui.twin);
      if (dot.dataset.s !== state) dot.dataset.s = state;
      if (line === shown) return;
      shown = line;
      clearTimeout(timer);
      text.classList.add('out');
      timer = setTimeout(() => { text.textContent = line; text.classList.remove('out'); }, 260);
    },
  };
}

// Single floor: Level 1 (wards, ICU, nurse station). The floor switch is gone; set() stays so callers that
// reveal a floor before focusing something keep working, and it always lands on Level 1.
export function createFloors(ui) {
  const set = () => { if (ui.engine.floorMode !== 'level1') ui.engine.setFloorMode?.('level1'); };
  return { set, sync() {} };
}

const toFrac = (h) => ((h - 5 + 24) % 24) / 24;
const toHours = (f) => (5 + f * 24) % 24;

export function createClock(ui) {
  const { twin, root } = ui;
  const SPEEDS = [1, 4, 16];
  const node = el(`<div class="hv-tr">
    <div class="hv-clock hv-glass hv-enter">
      <div class="hv-clock-top">
        <div class="hv-time" aria-label="Time in the hospital"><span class="h"></span><i>:</i><span class="m"></span></div>
        <span class="hv-part"></span>
        <div class="hv-speed" role="group" aria-label="How fast time passes">
          <button type="button" data-a="pause" aria-label="Pause" aria-pressed="false">${I.pause}</button>
          ${SPEEDS.map((s) => `<button type="button" data-s="${s}" aria-pressed="false">${s}×</button>`).join('')}
        </div>
      </div>
      <div class="hv-scrub" role="slider" tabindex="0" aria-label="Time of day" aria-valuemin="0" aria-valuemax="24">
        ${I.sun}<div class="hv-scrub-track"><div class="hv-scrub-knob"></div></div>${I.moon}
      </div>
    </div>
    <div class="hv-toasts" aria-live="polite"></div>
  </div>`);
  const capsule = node.querySelector('.hv-clock');
  const h = node.querySelector('.h'), m = node.querySelector('.m'), part = node.querySelector('.hv-part');
  const scrub = node.querySelector('.hv-scrub'), track = node.querySelector('.hv-scrub-track'), knob = node.querySelector('.hv-scrub-knob');
  const pauseBtn = node.querySelector('[data-a=pause]');
  const speedBtns = [...node.querySelectorAll('[data-s]')];
  let dragging = false, lastFrac = -1, lastLabel = '', trackW = 0;

  const measure = () => { trackW = track.clientWidth; lastFrac = -1; };
  const place = (f) => {
    if (Math.abs(f - lastFrac) < 0.0006) return;
    lastFrac = f;
    knob.style.transform = `translateX(${(f * trackW).toFixed(1)}px)`;
  };
  const setFromX = (x) => {
    const r = track.getBoundingClientRect();
    const f = clamp((x - r.left) / r.width, 0, 0.9999);
    place(f);
    twin.setHours?.(toHours(f));
  };
  scrub.addEventListener('pointerdown', (e) => { dragging = true; scrub.classList.add('drag'); scrub.setPointerCapture(e.pointerId); setFromX(e.clientX); });
  scrub.addEventListener('pointermove', (e) => { if (dragging) setFromX(e.clientX); });
  const end = () => { dragging = false; scrub.classList.remove('drag'); };
  scrub.addEventListener('pointerup', end);
  scrub.addEventListener('pointercancel', end);
  // A drag can also end by losing capture (window blur, devtools); without this it keeps following the mouse.
  scrub.addEventListener('lostpointercapture', end);
  scrub.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 0.25 : e.key === 'ArrowLeft' ? -0.25 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    twin.setHours?.((((twin.clock?.hours ?? 12) + d) % 24 + 24) % 24);
  });

  const setPaused = (b) => { twin.setPaused?.(b); if (twin.paused !== b) twin.paused = b; syncSpeed(); };
  const setSpeed = (s) => { if (twin.paused) twin.setPaused?.(false); twin.setSpeed?.(s); syncSpeed(); };
  function syncSpeed() {
    const paused = !!twin.paused;
    root.dataset.paused = paused ? '1' : '0';
    pauseBtn.setAttribute('aria-pressed', paused);
    pauseBtn.innerHTML = paused ? I.play : I.pause;
    pauseBtn.setAttribute('aria-label', paused ? 'Carry on' : 'Pause');
    for (const b of speedBtns) b.setAttribute('aria-pressed', !paused && Number(b.dataset.s) === twin.speed);
  }
  pauseBtn.addEventListener('click', () => setPaused(!twin.paused));
  for (const b of speedBtns) b.addEventListener('click', () => setSpeed(Number(b.dataset.s)));

  // On phones the capsule is just the time until you tap it.
  capsule.addEventListener('click', (e) => {
    if (innerWidth >= 900 || e.target.closest('button, .hv-scrub')) return;
    capsule.classList.toggle('wide');
    requestAnimationFrame(() => setTimeout(measure, 420));
  });

  root.append(node);
  addEventListener('resize', measure);
  measure();
  syncSpeed();

  return {
    capsule,
    toasts: node.querySelector('.hv-toasts'),
    setPaused, setSpeed,
    togglePause: () => setPaused(!twin.paused),
    remeasure: measure,
    update() {
      const c = twin.clock;
      if (!c) return;
      if (c.label !== lastLabel) {
        lastLabel = c.label;
        const [hh, mm] = String(c.label ?? '').split(':');
        setText(h, hh ?? ''); setText(m, mm ?? '');
        setText(part, c.dayPart ?? '');
        scrub.setAttribute('aria-valuenow', (c.hours ?? 0).toFixed(1));
        scrub.setAttribute('aria-valuetext', `${c.label} ${c.dayPart ?? ''}`);
      }
      if (!dragging && Number.isFinite(c.hours)) place(toFrac(c.hours));
    },
    syncSpeed,
  };
}
