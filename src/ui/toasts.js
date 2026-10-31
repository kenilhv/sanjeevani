// Alerts as gentle toasts under the clock. A critical alert also warms the screen edges.
import { el, esc } from './util.js';
import { icons as I } from './icons.js';

const ICON = { info: 'bell', watch: 'bell', critical: 'pulse' };
const LIFE = { info: 7000, watch: 11000, critical: 26000 };
const MAX = 3;

export function createToasts(ui, host) {
  const { twin, root } = ui;
  const edge = el(`<div class="hv-edgeglow" aria-hidden="true"></div>`);
  root.prepend(edge);
  const live = new Map();

  function drop(id) {
    const t = live.get(id);
    if (!t) return;
    live.delete(id);
    clearTimeout(t.timer);
    t.node.classList.add('out');
    setTimeout(() => t.node.remove(), 300);
  }
  function target(a) {
    if (a.bedId) return { type: 'bed', id: a.bedId };
    if (a.actorId) return { type: 'person', id: a.actorId };
    if (a.roomId) return { type: 'room', id: a.roomId };
    return null;
  }
  function show(a) {
    if (!a || live.has(a.id) || a.resolved) return;
    const hit = target(a);
    const s = a.severity ?? 'info';
    const node = el(`<div class="hv-toast hv-glass" data-s="${esc(s)}" role="status">
      <span class="hv-toast-ic">${I[ICON[s] ?? 'bell']}</span>
      <div class="hv-toast-b"><b>${esc(a.title)}</b>${a.detail ? `<p>${esc(a.detail)}</p>` : ''}
        ${hit ? `<div class="hv-toast-a"><button type="button" class="go hv-press">Show me</button></div>` : ''}</div>
      <button type="button" class="hv-x hv-press" aria-label="Dismiss">${I.x}</button>
    </div>`);
    node.querySelector('.go')?.addEventListener('click', () => { ui.select(hit); drop(a.id); });
    node.querySelector('.hv-x').addEventListener('click', () => { twin.ack?.(a.id); drop(a.id); });
    host.append(node);
    live.set(a.id, { node, timer: setTimeout(() => drop(a.id), LIFE[s] ?? LIFE.info), s });
    while (live.size > MAX) {
      const oldest = [...live.entries()].find(([, t]) => t.s !== 'critical') ?? [...live.entries()][0];
      drop(oldest[0]);
    }
  }
  twin.on?.('alert', show);
  twin.on?.('resolve', (a) => drop(a?.id ?? a));

  return {
    show,
    tick() {
      const crit = (twin.alerts ?? []).some((a) => a.severity === 'critical' && !a.resolved);
      edge.classList.toggle('on', crit);
    },
  };
}
