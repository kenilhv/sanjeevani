// Left rail of four friendly cards and the list each one opens.
import { el, esc, setText, plural, sparkPaths, Eased, publicRooms, roomName, ROLE, avatar, clockAt, reasonOf } from './util.js';
import { icons as I } from './icons.js';
import { C } from '../style/palette.js';

const BED_ROOMS = ['ward_a', 'ward_b', 'ward_c', 'icu', 'er'];
const SHEET = {
  beds: { title: 'Free beds', tint: C.teal },
  er: { title: 'Emergency right now', tint: C.watch },
  staff: { title: 'Who is on duty', tint: C.info },
  attn: { title: 'Needs attention', tint: C.coral },
};
const openAlerts = (twin) => (twin.alerts ?? []).filter((a) => !a.resolved);

const CARDS = [
  { k: 'beds', label: 'Beds free', icon: 'bed',
    value: (m) => m.bedsFree ?? 0, unit: (m) => `of ${m.bedsTotal ?? 0}`,
    state: (m) => (m.bedsTotal && m.bedsFree / m.bedsTotal < 0.1 ? 'watch' : 'ok'),
    line: (m) => {
      const r = m.bedsTotal ? m.bedsFree / m.bedsTotal : 1;
      if (!m.bedsTotal) return 'Counting the beds.';
      if (!m.bedsFree) return 'Every bed is taken. Going-home plans are moving.';
      return r < 0.1 ? 'Getting tight. Only a few left.' : r < 0.3 ? 'Steady, with room for new arrivals.' : 'Plenty of room right now.';
    },
    series: (t) => { const s = t.history?.occupancy ?? []; return s.map((v) => 100 - v); },
    rooms: () => BED_ROOMS },
  { k: 'er', label: 'Emergency wait', icon: 'wait',
    value: (m) => Math.round(m.erWaitMin ?? 0), unit: () => 'min',
    state: (m) => ((m.erWaitMin ?? 0) >= 40 ? 'danger' : (m.erWaitMin ?? 0) >= 25 ? 'watch' : 'ok'),
    line: (m) => {
      const w = m.erWaitMin ?? 0;
      return w < 10 ? 'Seen almost straight away.' : w < 25 ? 'Moving along nicely.' : w < 40 ? 'A little slower than usual.' : 'Longer than we would like.';
    },
    series: (t) => t.history?.erWait, rooms: () => ['er', 'lobby'] },
  { k: 'staff', label: 'Staff on duty', icon: 'people',
    value: (m) => m.staffOnDuty ?? 0, unit: () => 'people',
    state: (m) => ((m.staffBusyPct ?? 0) >= 92 ? 'watch' : 'ok'),
    line: (m) => {
      const b = Math.round(m.staffBusyPct ?? 0);
      return b >= 92 ? 'Stretched. Almost everyone is with a patient.' : b >= 60 ? `${b}% are with patients.` : 'Everyone has room to breathe.';
    },
    series: (t) => t.history?.staffBusy,
    rooms: (t) => publicRooms().filter((r) => (t.rooms?.get?.(r.id)?.staffIds?.length ?? 0) > 0).map((r) => r.id) },
  { k: 'attn', label: 'Needs attention', icon: 'bell',
    value: (m, t) => openAlerts(t).length, unit: (m, t) => { const n = openAlerts(t).length; return n === 1 ? 'thing' : n ? 'things' : ''; },
    state: (m, t) => { const o = openAlerts(t); return o.some((a) => a.severity === 'critical') ? 'danger' : o.length ? 'watch' : 'ok'; },
    line: (m, t) => { const o = openAlerts(t); return o.length ? o[o.length - 1].title : 'Nothing needs you right now.'; },
    series: null,
    rooms: (t) => [...new Set(openAlerts(t).map((a) => a.roomId ?? t.beds?.get?.(a.bedId)?.roomId).filter(Boolean))] },
];

export function createRail(ui) {
  const { twin, root } = ui;
  const node = el(`<div class="hv-rail" aria-label="Hospital at a glance"></div>`);
  const attnSeries = [];
  let attnLen = 0;
  const cards = CARDS.map((c) => {
    const n = el(`<button type="button" class="hv-card hv-glass hv-enter hv-press" data-k="${c.k}" aria-expanded="false">
      <span class="hv-card-top">${I[c.icon]}<span>${c.label}</span></span>
      <span class="hv-card-n"><b>0</b><small></small></span>
      <span class="hv-card-s"></span>
      <svg class="hv-spark" viewBox="0 0 86 34" aria-hidden="true"><path class="a"/><path class="l"/><circle r="2.3" cx="-9" cy="-9"/></svg>
    </button>`);
    node.append(n);
    return { ...c, n, num: new Eased(0, 4.2), bEl: n.querySelector('b'), uEl: n.querySelector('small'), sEl: n.querySelector('.hv-card-s'),
      a: n.querySelector('.a'), l: n.querySelector('.l'), dot: n.querySelector('.hv-spark circle'), sparkKey: '' };
  });

  const fly = el(`<div class="hv-fly" hidden></div>`);
  root.append(node, fly);
  let openKey = null, flyBody = null, bodyKey = '';

  for (const c of cards) {
    c.n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') ui.hoverTint(c.rooms(twin), SHEET[c.k].tint); });
    c.n.addEventListener('pointerleave', () => ui.clearHoverTint());
    c.n.addEventListener('click', () => toggle(c.k));
  }

  function toggle(k) { openKey === k ? close() : open(k); }
  function open(k) {
    openKey = k;
    bodyKey = '';
    for (const c of cards) c.n.setAttribute('aria-expanded', c.k === k);
    fly.hidden = false;
    fly.classList.remove('out');
    fly.innerHTML = `<div class="hv-fly-in hv-glass"><div class="hv-fly-h"><div><h3>${SHEET[k].title}</h3><p class="sub"></p></div><button type="button" class="hv-x hv-press" aria-label="Close">${I.x}</button></div><div class="hv-fly-b hv-scroll"></div></div>`;
    fly.querySelector('.hv-x').addEventListener('click', close);
    flyBody = fly.querySelector('.hv-fly-b');
    flyBody.addEventListener('click', onRow);
    fill();
    ui.onLayerOpen?.('fly');
  }
  function close() {
    if (!openKey) return false;
    openKey = null;
    for (const c of cards) c.n.setAttribute('aria-expanded', false);
    fly.classList.add('out');
    setTimeout(() => { if (!openKey) { fly.hidden = true; fly.innerHTML = ''; } }, 260);
    return true;
  }
  function onRow(e) {
    const r = e.target.closest('[data-hit]');
    if (!r) return;
    const [type, id] = r.dataset.hit.split(':');
    ui.select({ type, id });
    if (innerWidth < 900) close();
  }
  const row = (hit, left, title, sub, right = '') => `<button type="button" class="hv-row" data-hit="${hit}">${left}<span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${right ? `<span class="hv-row-r">${esc(right)}</span>` : ''}</button>`;
  const dot = (s) => `<i class="hv-dot" data-s="${s}"></i>`;

  const lists = {
    beds() {
      const m = twin.metrics ?? {};
      const groups = new Map();
      for (const b of twin.beds?.values?.() ?? []) {
        const g = groups.get(b.roomId) ?? { free: 0, total: 0, soon: 0 };
        g.total++; if (b.status === 'free') g.free++; if (b.status === 'cleaning') g.soon++;
        groups.set(b.roomId, g);
      }
      const rows = [...groups.entries()].sort((a, b) => b[1].free - a[1].free).map(([id, g]) =>
        row(`room:${id}`, dot(g.free ? 'ok' : g.soon ? 'watch' : 'critical'), roomName(twin, id), g.soon ? `${plural(g.soon, 'bed')} being cleaned` : `${g.total} beds in all`, `${g.free} free`));
      return { sub: `${plural(m.bedsFree ?? 0, 'bed')} ready for a patient.`, html: rows.join('') || empty('Beds are still being counted.') };
    },
    er() {
      const rm = twin.rooms?.get?.('er');
      const ids = rm?.patientIds ?? [];
      const rows = ids.map((id) => ui.actor(id)).filter(Boolean).sort((a, b) => (a.acuity ?? 9) - (b.acuity ?? 9)).slice(0, 24).map((a) =>
        row(`person:${a.id}`, dot(a.status === 'critical' ? 'critical' : a.status === 'watch' ? 'watch' : 'ok'), a.name, reasonOf(a) || 'Being looked after', a.status === 'critical' ? 'Urgent' : ''));
      const waiting = rm?.waiting ?? 0;
      return { sub: `${plural(ids.length, 'patient')} here, ${waiting} waiting to be seen.`, html: rows.join('') || empty('Nobody is waiting right now.') };
    },
    staff() {
      const byRole = new Map();
      for (const a of twin.actors ?? []) if (a.kind === 'staff') { if (!byRole.has(a.role)) byRole.set(a.role, []); byRole.get(a.role).push(a); }
      let html = '';
      for (const [role, list] of [...byRole.entries()].sort((a, b) => b[1].length - a[1].length)) {
        html += `<div class="hv-group">${esc(ROLE[role] ?? role)}s · ${list.length}</div>`;
        html += list.slice(0, 12).map((a) => row(`person:${a.id}`, avatar(a, 's'), a.name, a.task ?? roomName(twin, a.roomId))).join('');
      }
      return { sub: `${Math.round(twin.metrics?.staffBusyPct ?? 0)}% are busy with patients.`, html: html || empty('The team list is loading.') };
    },
    attn() {
      const o = openAlerts(twin).slice().reverse();
      const rows = o.map((a) => {
        const hit = a.bedId ? `bed:${a.bedId}` : a.actorId ? `person:${a.actorId}` : a.roomId ? `room:${a.roomId}` : '';
        return row(hit, dot(a.severity), a.title, a.detail, clockAt(a.at));
      });
      return { sub: o.length ? 'Tap one to go there.' : '', html: rows.join('') || empty('All clear.', 'Nothing needs you right now.') };
    },
  };
  const empty = (a, b = '') => `<div class="hv-empty"><em>${esc(a)}</em>${esc(b)}</div>`;

  function fill() {
    if (!openKey || !flyBody) return;
    const { sub, html } = lists[openKey]();
    setText(fly.querySelector('.sub'), sub);
    if (html === bodyKey) return;
    bodyKey = html;
    const top = flyBody.scrollTop;
    flyBody.innerHTML = html;
    flyBody.scrollTop = top;
  }

  let sinceFill = 0;
  return {
    close, open,
    get isOpen() { return !!openKey; },
    tick() {
      const m = twin.metrics ?? {};
      const hist = twin.history?.occupancy?.length ?? 0;
      if (hist !== attnLen) { attnLen = hist; attnSeries.push(openAlerts(twin).length); if (attnSeries.length > 48) attnSeries.shift(); }
      for (const c of cards) {
        c.num.set(c.value(m, twin));
        setText(c.uEl, c.unit(m, twin));
        setText(c.sEl, c.line(m, twin));
        const st = c.state(m, twin);
        if (c.n.dataset.state !== st) c.n.dataset.state = st;
        const series = c.series ? c.series(twin) : attnSeries;
        const key = `${series?.length}|${series?.[series.length - 1]}`;
        if (key !== c.sparkKey) {
          c.sparkKey = key;
          const p = sparkPaths(series, 86, 34);
          if (p) { c.a.setAttribute('d', p.area); c.l.setAttribute('d', p.line); c.dot.setAttribute('cx', p.end[0]); c.dot.setAttribute('cy', p.end[1]); }
        }
      }
      if (++sinceFill >= 3) { sinceFill = 0; fill(); }
    },
    update(dt) {
      for (const c of cards) setText(c.bEl, Math.round(c.num.step(dt)));
    },
  };
}
