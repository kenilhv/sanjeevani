// The agent network: software helpers talking to each other in plain words.
import { el, esc, clockAt } from './util.js';
import { icons as I } from './icons.js';
import { C } from '../style/palette.js';

const CREW = [
  { k: 'triage', name: 'Triage', icon: 'pulse', tint: C.coral },
  { k: 'bed', name: 'Beds', icon: 'bed', tint: C.teal },
  { k: 'staff', name: 'Staffing', icon: 'people', tint: C.info },
  { k: 'pharm', name: 'Pharmacy', icon: 'pill', tint: C.leafLight },
  { k: 'imag', name: 'Imaging', icon: 'scan', tint: C.purple },
  { k: 'facil', name: 'Facilities', icon: 'wrench', tint: C.watch },
];
// Live mode: the Sanjeevani agents on Agent Relay. Each Patient Twin speaks for one room; the Nurse Agent runs the pod.
const LIVE_CREW = [
  { k: 'nurse-pod-a', name: 'Ward A Nurse Agent', tile: 'Ward A', icon: 'people', tint: C.info },
  { k: 'twin-room-2', name: 'Room 2 Twin', tile: 'Room 2', icon: 'bed', tint: C.coral },
  { k: 'twin-room-4', name: 'Room 4 Twin', tile: 'Room 4', icon: 'bed', tint: C.teal },
  { k: 'twin-room-6', name: 'Room 6 Twin', tile: 'Room 6', icon: 'bed', tint: C.watch },
  { k: 'twin-room-8', name: 'Room 8 Twin', tile: 'Room 8', icon: 'bed', tint: C.purple },
  { k: 'nurse-pod-b', name: 'Ward B Nurse Agent', tile: 'Ward B', icon: 'people', tint: C.leafLight },
];
const ag = (c) => `<span class="hv-ag" data-a="${c.k}" style="--t:${c.tint}" title="${esc(c.name)}">${I[c.icon]}</span>`;
const MAX_NODES = 40;

export function createAgents(ui) {
  const { twin, root } = ui;
  const crewList = twin.live ? LIVE_CREW : CREW;
  const label = twin.live?.label ?? ((n) => n ?? 'Team');
  const who = (name) => {
    const s = String(name ?? '').toLowerCase();
    // Live mode: people in the conversation (the nurse on shift, a patient at the bedside) get a person avatar.
    const person = twin.live && (s.startsWith('bedside-') || ['maya', 'jordan', 'sam'].includes(s));
    return crewList.find((c) => s.startsWith(c.k) || s.includes(c.k))
      ?? { k: s, name: label(name), icon: person ? 'user' : 'spark', tint: person ? (s.startsWith('bedside-') ? C.coral : C.leaf ?? C.teal) : C.steel };
  };
  const blurb = twin.live
    ? 'Every patient has a Twin and every ward a Nurse Agent. They talk to each other, and every message is kept on record.'
    : "Six helpers quietly sorting things out, so people don't have to phone around.";
  const chip = el(`<button type="button" class="hv-agents-chip hv-glass hv-enter hv-press" aria-expanded="false" aria-label="Agent network">
    <span class="hv-stack">${crewList.map(ag).join('')}</span>
    <span class="hv-agents-meta">Agent network<small><i class="hv-live"></i>Working together</small></span>
  </button>`);
  const box = el(`<div class="hv-agentbox hv-glass" role="dialog" aria-label="Agent network">
    <header><div><h3>Agent network</h3><p>${esc(blurb)}</p></div><button type="button" class="hv-x hv-press" aria-label="Close">${I.x}</button></header>
    <div class="hv-crew"><svg class="links" aria-hidden="true"></svg>${crewList.map((c) => `<span class="hv-ag" data-a="${c.k}" style="--t:${c.tint}">${I[c.icon]}<span class="hv-crew-n">${c.tile ?? c.name}</span></span>`).join('')}</div>
    <div class="hv-feed hv-scroll"><div class="hv-feed-pad"></div></div>
  </div>`);
  root.append(box);
  const feed = box.querySelector('.hv-feed'), crew = box.querySelector('.hv-crew'), links = box.querySelector('.links');
  let open = false, lastId = null;

  const setOpen = (v) => {
    open = v;
    box.classList.toggle('open', v);
    chip.setAttribute('aria-expanded', v);
    if (v) { ui.onLayerOpen?.('agents'); feed.scrollTop = feed.scrollHeight; }
    return true;
  };
  chip.addEventListener('click', () => setOpen(!open));
  box.querySelector('.hv-x').addEventListener('click', () => setOpen(false));
  if (twin.live) {
    // Live mode: the panel is the conversation. It sizes to what has been said, and the avatars open their agent.
    box.classList.add('hv-chat');
    crew.addEventListener('click', (e) => {
      const k = e.target.closest('.hv-ag')?.dataset.a;
      if (k) twin.live.focusAgent?.(k);
    });
    twin.live.openChat = () => setOpen(true);
  }

  function msgNode(m, fresh) {
    const f = who(m.from), t = who(m.to);
    const n = el(`<div class="hv-msg${fresh ? ' new' : ''}" data-k="${esc(m.kind ?? '')}">${ag(f)}<div style="min-width:0;flex:1">
      <div class="hv-msg-w"><time>${esc(clockAt(m.at))}</time><b>${esc(f.name)}</b> to <b>${esc(t.name)}</b></div><p>${esc(m.text)}</p></div></div>`);
    if (m.roomId) { n.style.cursor = 'pointer'; n.addEventListener('click', () => ui.select({ type: 'room', id: m.roomId })); }
    return n;
  }
  const centre = (k) => {
    const n = crew.querySelector(`.hv-ag[data-a="${k}"]`);
    return n ? [n.offsetLeft + n.offsetWidth / 2, n.offsetTop + n.offsetHeight / 2] : null;
  };
  function pass(fromK, toK) {
    for (const k of [fromK, toK]) for (const n of [...chip.querySelectorAll(`[data-a="${k}"]`), ...crew.querySelectorAll(`[data-a="${k}"]`)]) {
      n.classList.add('talk');
      setTimeout(() => n.classList.remove('talk'), 900);
    }
    if (!open) return;
    const a = centre(fromK), b = centre(toK);
    if (!a || !b || fromK === toK) return;
    const lift = 14 + Math.abs(b[0] - a[0]) * 0.13;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${a[0]} ${a[1] - 16}C${a[0]} ${a[1] - 16 - lift} ${b[0]} ${b[1] - 16 - lift} ${b[0]} ${b[1] - 16}`);
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', 'hv-link');
    p.addEventListener('animationend', () => p.remove());
    links.append(p);
  }

  function pull() {
    const list = twin.feed ?? [];
    if (!list.length) return;
    const newest = list[list.length - 1];
    if (newest.id === lastId) return;
    let start = list.length - 1;
    while (start > 0 && list[start - 1].id !== lastId) start--;
    const first = lastId === null;
    if (first) start = Math.max(0, list.length - 14);
    const stick = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
    for (let i = start; i < list.length; i++) {
      feed.append(msgNode(list[i], !first));
      if (!first) pass(who(list[i].from).k, who(list[i].to).k);
    }
    lastId = newest.id;
    while (feed.children.length > MAX_NODES + 1) feed.children[1].remove();
    // Live mode: when the agents start talking, the conversation shows itself.
    if (twin.live && !first && !open && !ui.tour?.active) setOpen(true);
    if (open && stick) feed.scrollTo({ top: feed.scrollHeight, behavior: ui.calm() ? 'auto' : 'smooth' });
    else if (!open) feed.scrollTop = feed.scrollHeight;
  }

  return {
    chip,
    open: () => setOpen(true),
    close: () => (open ? setOpen(false) : false),
    get isOpen() { return open; },
    tick: pull,
  };
}
