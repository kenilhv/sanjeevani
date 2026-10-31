// Bottom centre dock: "What if…" scenarios, view toggles, camera controls, plus the busy map itself.
import { el, Eased, heat, publicRooms } from './util.js';
import { icons as I } from './icons.js';

const SCENARIOS = [
  ['normal', 'Normal day', 'leaf'], ['flu', 'Flu surge', 'thermo'], ['codeblue', 'Code blue', 'pulse'],
  ['mci', 'Mass casualty', 'siren'], ['mrifault', 'MRI breaks down', 'scan'],
];
const tool = (a, icon, label, hint, key = '', text = false) => `<button type="button" class="hv-tool hv-press" data-a="${a}" ${text ? 'data-text aria-pressed="false"' : ''} aria-label="${label}">
  ${I[icon]}${text ? `<span>${label}</span>` : ''}<div class="hv-hint">${label}${key ? `<kbd>${key}</kbd>` : ''}${hint ? `<small>${hint}</small>` : ''}</div></button>`;

export function createDock(ui) {
  const { engine, twin, shell, people } = ui;
  const node = el(`<div class="hv-dockwrap">
    <div class="hv-legend hv-glass">Quiet<i></i>Full</div>
    <div class="hv-dock hv-glass hv-enter" role="toolbar" aria-label="Controls">
      <span class="hv-dock-t">What if…</span>
      ${SCENARIOS.map(([id, label, icon]) => `<button type="button" class="hv-chip hv-press" data-s="${id}" aria-pressed="false">${I[icon]}${label}</button>`).join('')}
      <i class="hv-sep"></i>
      ${tool('busy', 'heat', 'Busy map', 'Colours each room by how full it is', 'H', true)}
      ${tool('flow', 'flow', 'Movement', 'Shows where people are walking', '', true)}
      ${tool('labels', 'tag', 'Labels', 'Always show room names', '', true)}
      <i class="hv-sep"></i>
      ${tool('left', 'left', 'Turn left', '', 'Q')}
      ${tool('right', 'right', 'Turn right', '', 'E')}
      ${tool('out', 'minus', 'Zoom out', '')}
      ${tool('in', 'plus', 'Zoom in', '')}
      ${tool('home', 'target', 'Back to the whole hospital', '')}
    </div>
  </div>`);
  const legend = node.querySelector('.hv-legend');
  const chips = [...node.querySelectorAll('.hv-chip')];
  const btn = (a) => node.querySelector(`[data-a=${a}]`);
  const state = { busy: false, flow: false, labels: false };
  const heatRooms = new Map(publicRooms().map((r) => [r.id, new Eased(0, 1.6)]));

  function setToggle(k, on) {
    state[k] = on;
    btn(k).setAttribute('aria-pressed', on);
    if (k === 'flow') people.setLayer?.('flow', on);
    if (k === 'labels') ui.labels?.setAlways(on);
    if (k === 'busy') {
      legend.classList.toggle('on', on);
      if (on) paint();
      else for (const id of heatRooms.keys()) if (!ui.isTinted(id)) shell.setRoomTint?.(id, null, 0);
    }
  }
  function paint() {
    if (!state.busy) return;
    for (const [id, e] of heatRooms) {
      if (ui.isTinted(id)) continue;
      const r = twin.rooms?.get?.(id);
      e.set(r?.occupancy ?? (r?.capacity ? (r.occupied ?? 0) / r.capacity : 0));
      e.step(0.33);
      shell.setRoomTint?.(id, heat(Math.min(1, e.v)), 0.48);
    }
  }
  function syncScenario() {
    const s = twin.scenario ?? 'normal';
    for (const c of chips) c.setAttribute('aria-pressed', c.dataset.s === s);
  }
  function zoom(f) {
    if (engine.zoomBy) return engine.zoomBy(f);
    return engine.flyTo?.({ zoom: ui.zoomValue() * f, duration: 0.45 });
  }
  node.addEventListener('click', (e) => {
    const chip = e.target.closest('.hv-chip');
    if (chip) { twin.runScenario?.(chip.dataset.s); syncScenario(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a in state) setToggle(a, !state[a]);
    else if (a === 'left') engine.rotate?.(-1);
    else if (a === 'right') engine.rotate?.(1);
    else if (a === 'in') zoom(1.35);
    else if (a === 'out') zoom(1 / 1.35);
    else if (a === 'home') engine.resetView?.();
  });
  twin.on?.('scenario', syncScenario);
  syncScenario();

  return {
    node, state, setToggle, paint, syncScenario,
    toggleBusy: () => setToggle('busy', !state.busy),
    tick() { syncScenario(); paint(); },
  };
}
