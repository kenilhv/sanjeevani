// Right-hand inspector. One panel, five bodies: room, bed, person, equipment, vehicle.
import { el, esc, setText, plural, clamp, roomName, floorName, ROLE, avatar, heat, Eased, reasonOf } from './util.js';
import { icons as I } from './icons.js';
import { createECG } from './ecg.js';
import { C } from '../style/palette.js';
import { roomAt, roomById } from '../world/plan.js';

const RING = 2 * Math.PI * 31;
const ROOM_WORD = { calm: ['Calm', 'ok'], busy: ['Busy', 'info'], full: ['Full', 'watch'], alert: ['Needs attention', 'danger'] };
const BED_WORD = {
  free: ['Ready for a patient', 'Clean, made up and ready for the next person.'],
  cleaning: ['Being cleaned', 'A cleaner is on it. This bed will be ready soon.'],
  reserved: ['Held for someone', 'Kept aside for a patient who is on their way.'],
};
const EQ_WORD = { idle: ['Ready to use', 'ok'], 'in-use': ['In use', 'info'], maintenance: ['Being serviced', 'watch'], fault: ['Needs repair', 'danger'] };

// Plain-language reading of a vital sign, in the same words a nurse would use to a relative.
const vital = {
  spo2: (v) => (v >= 94 ? ['ok', 'Normal'] : v >= 90 ? ['watch', 'A little low'] : ['danger', 'Too low']),
  bp: (s) => (s < 85 ? ['danger', 'Too low'] : s < 95 ? ['watch', 'A little low'] : s > 175 ? ['danger', 'Too high'] : s > 150 ? ['watch', 'A little high'] : ['ok', 'Normal']),
  temp: (t) => (t >= 39 ? ['danger', 'High fever'] : t >= 37.8 ? ['watch', 'A slight fever'] : t < 35.5 ? ['watch', 'A little cold'] : ['ok', 'Normal']),
  hr: (h) => (h < 40 || h > 135 ? 'danger' : h < 50 || h > 110 ? 'watch' : 'ok'),
};
const ECG_TINT = { ok: C.screenGlow, watch: '#ffd27a', danger: '#ff9a93' };

export function createInspector(ui) {
  const { twin, root, engine } = ui;
  const node = el(`<aside class="hv-insp" aria-label="Details"><div class="hv-insp-in hv-glass" tabindex="-1">
    <div class="hv-grab" aria-hidden="true"></div>
    <div class="hv-insp-h"><div><div class="hv-eyebrow"></div><h2></h2></div><button type="button" class="hv-x hv-press" aria-label="Close">${I.x}</button></div>
    <div class="hv-insp-b hv-scroll"></div>
  </div></aside>`);
  root.append(node);
  const panel = node.firstElementChild, brow = node.querySelector('.hv-eyebrow'), title = node.querySelector('h2'), body = node.querySelector('.hv-insp-b');
  let cur = null, view = null;

  node.querySelector('.hv-x').addEventListener('click', () => ui.clearSelection());
  body.addEventListener('click', (e) => {
    const r = e.target.closest('[data-hit]');
    if (!r) return;
    const [type, id] = r.dataset.hit.split(':');
    ui.select({ type, id });
  });

  // Bottom sheet drag on phones.
  const grab = node.querySelector('.hv-grab');
  let dragY = null, dy = 0;
  grab.addEventListener('pointerdown', (e) => { dragY = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); node.classList.add('dragging'); });
  grab.addEventListener('pointermove', (e) => { if (dragY === null) return; dy = Math.max(0, e.clientY - dragY); panel.style.setProperty('--drag', `${dy}px`); });
  const drop = () => {
    if (dragY === null) return;
    dragY = null; node.classList.remove('dragging'); panel.style.removeProperty('--drag');
    if (dy > 90) ui.clearSelection();
  };
  grab.addEventListener('pointerup', drop);
  grab.addEventListener('pointercancel', drop);

  const person = (id) => ui.actor(id);
  const staffRows = (ids, limit = 8) => (ids ?? []).map(person).filter(Boolean).slice(0, limit).map((a) =>
    `<button type="button" class="hv-row" data-hit="person:${a.id}">${avatar(a, 's')}<span><b>${esc(a.name)}</b><small>${esc(ROLE[a.role] ?? a.role)}${a.task ? ` · ${esc(a.task)}` : ''}</small></span></button>`).join('');
  const sec = (label, html, side = '') => (html ? `<section class="hv-sec"><h3>${esc(label)}<span>${esc(side)}</span></h3>${html}</section>` : '');

  // Compare the finished markup so a changed task updates the row without disturbing the rest.
  function list(n, html) { if (n && n._html !== html) { n._html = html; n.innerHTML = html; } }

  const views = {
    room(id) {
      const r = twin.rooms?.get?.(id);
      const name = roomName(twin, id), dept = r?.dept ?? roomById(id)?.dept;
      setText(brow, `${dept && dept !== name ? `${dept} · ` : ''}${floorName(r?.floor ?? ui.locate('room', id)?.floor)}`);
      setText(title, name);
      body.innerHTML = `
        <div class="hv-occ"><div class="hv-ringwrap"><svg class="hv-ring" viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="31"/><circle class="fg" cx="37" cy="37" r="31" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg><div class="hv-ring-v" data-v="ratio"></div></div>
        <div><b data-v="word"></b><span class="t" data-v="line"></span></div></div>
        <div data-l="pts"></div><div data-l="staff"></div><div data-l="eq"></div>`;
      const fg = body.querySelector('.fg'), ratio = body.querySelector('[data-v=ratio]'), word = body.querySelector('[data-v=word]'), line = body.querySelector('[data-v=line]');
      const lp = body.querySelector('[data-l=pts]'), ls = body.querySelector('[data-l=staff]'), le = body.querySelector('[data-l=eq]');
      return () => {
        const r = twin.rooms?.get?.(id);
        if (!r) return;
        const occ = clamp(r.occupancy ?? (r.capacity ? r.occupied / r.capacity : 0));
        fg.style.strokeDashoffset = RING * (1 - occ);
        fg.style.stroke = heat(occ);
        setText(ratio, `${Math.round(occ * 100)}%`);
        setText(word, (ROOM_WORD[r.status] ?? ROOM_WORD.calm)[0]);
        setText(line, r.capacity ? `${r.occupied ?? 0} of ${plural(r.capacity, 'place')} taken${r.waiting ? `, ${r.waiting} waiting` : ''}` : `${plural(r.occupied ?? 0, 'person', 'people')} here`);
        const pts = r.patientIds ?? [];
        list(lp, sec('Who is here', pts.map(person).filter(Boolean).slice(0, 8).map((a) => {
          const hit = a.bedId ? `bed:${a.bedId}` : `person:${a.id}`;
          return `<button type="button" class="hv-row" data-hit="${hit}">${avatar(a, 's')}<span><b>${esc(a.name)}</b><small>${esc(reasonOf(a) || 'Resting')}</small></span><i class="hv-dot" data-s="${a.status === 'critical' ? 'critical' : a.status === 'watch' ? 'watch' : 'ok'}"></i></button>`;
        }).join(''), pts.length > 8 ? `${pts.length} in all` : ''));
        list(ls, sec('Staff', staffRows(r.staffIds, 6), (r.staffIds?.length ?? 0) > 6 ? `${r.staffIds.length} in all` : ''));
        const eqs = [...(twin.equipment?.values?.() ?? [])].filter((q) => q.roomId === id);
        list(le, sec('Equipment', eqs.slice(0, 6).map((q) => {
          const w = EQ_WORD[q.status] ?? EQ_WORD.idle;
          return `<button type="button" class="hv-row" data-hit="equipment:${q.id}"><i class="hv-dot" data-s="${w[1] === 'danger' ? 'critical' : w[1]}"></i><span><b>${esc(q.name ?? q.type)}</b><small>${esc(w[0])}</small></span></button>`;
        }).join('')));
      };
    },

    bed(id) {
      const b = twin.beds?.get?.(id);
      const a = person(b?.patientId);
      setText(brow, `Bed ${id} · ${roomName(twin, b?.roomId)}`);
      if (!a) {
        const w = BED_WORD[b?.status] ?? BED_WORD.free;
        setText(title, w[0]);
        body.innerHTML = `<p class="hv-lede" data-v="line"></p>`;
        const line = body.querySelector('[data-v=line]');
        return () => setText(line, (BED_WORD[twin.beds?.get?.(id)?.status] ?? w)[1]);
      }
      setText(title, a.name);
      body.innerHTML = `
        <p class="hv-lede" data-v="why"></p>
        <div class="hv-ecg" style="margin-top:12px"><canvas></canvas><div class="hv-ecg-hr"><b data-v="hr">0</b><span>${I.heart}beats a minute</span></div></div>
        <div class="hv-tiles">
          <div class="hv-tile" data-t="spo2"><span>Oxygen</span><b data-v="spo2"></b><small>%</small><em></em></div>
          <div class="hv-tile" data-t="bp"><span>Blood pressure</span><b data-v="bp"></b><em></em></div>
          <div class="hv-tile" data-t="temp"><span>Temperature</span><b data-v="temp"></b><small>°C</small><em></em></div>
          <div class="hv-tile" data-t="rr"><span>Breathing</span><b data-v="rr"></b><small>a min</small><em></em></div>
        </div>
        <div data-l="team"></div>`;
      const ecg = createECG(body.querySelector('canvas'));
      const box = body.querySelector('.hv-ecg'), why = body.querySelector('[data-v=why]'), hrEl = body.querySelector('[data-v=hr]');
      const tiles = Object.fromEntries(['spo2', 'bp', 'temp', 'rr'].map((k) => [k, body.querySelector(`[data-t=${k}]`)]));
      const put = (k, value, [s, word]) => {
        const t = tiles[k];
        setText(t.querySelector('b'), value);
        setText(t.querySelector('em'), word);
        if (t.dataset.s !== s) t.dataset.s = s;
      };
      const hr = new Eased(0, 3), team = body.querySelector('[data-l=team]');
      const fn = () => {
        const bd = twin.beds?.get?.(id);
        const v = bd?.vitals, pt = person(bd?.patientId);
        if (!v) return;
        setText(why, reasonOf(pt) || 'Resting comfortably');
        hr.set(v.hr ?? 0);
        const s = vital.hr(v.hr ?? 70);
        box.style.setProperty('--c', ECG_TINT[s]);
        box.style.setProperty('--beat', `${(60 / clamp(v.hr || 60, 30, 200)).toFixed(2)}s`);
        ecg.setColor(ECG_TINT[s]);
        put('spo2', Math.round(v.spo2 ?? 0), vital.spo2(v.spo2 ?? 98));
        put('bp', `${Math.round(v.sys ?? 0)}/${Math.round(v.dia ?? 0)}`, vital.bp(v.sys ?? 120));
        put('temp', (v.temp ?? 36.8).toFixed(1), vital.temp(v.temp ?? 36.8));
        const rr = Math.round(v.rr ?? 16);
        put('rr', rr, rr < 10 || rr > 24 ? ['watch', rr < 10 ? 'A little slow' : 'A little fast'] : ['ok', 'Normal']);
        const crew = (twin.actors ?? []).filter((x) => x.kind === 'staff' && (x.bedId === id || (twin.rooms?.get?.(bd.roomId)?.staffIds ?? []).includes(x.id))).sort((p, q) => (q.bedId === id) - (p.bedId === id)).slice(0, 3);
        list(team, sec('Care team', staffRows(crew.map((c) => c.id))));
      };
      fn.frame = (dt) => { setText(hrEl, Math.round(hr.step(dt))); ecg.tick(dt, twin.beds?.get?.(id)?.vitals?.hr ?? 0); };
      return fn;
    },

    person(id) {
      const a = person(id);
      setText(brow, `${ROLE[a?.role] ?? 'Person'}${a?.roomId ? ` · ${roomName(twin, a.roomId)}` : ''}`);
      setText(title, a?.name ?? 'Someone');
      body.innerHTML = `
        <div class="hv-person">${avatar(a, 'l')}<div><span class="hv-pill" data-v="state"></span></div></div>
        <div class="hv-sec">
          <div class="hv-step">${I.user}<div><b>Right now</b><p data-v="task"></p></div></div>
          <div class="hv-step" data-v="next">${I.route}<div><b>Heading to</b><p data-v="dest"></p></div></div>
        </div><div data-l="bed"></div>`;
      const st = body.querySelector('[data-v=state]'), task = body.querySelector('[data-v=task]'), dest = body.querySelector('[data-v=dest]'), next = body.querySelector('[data-v=next]'), lb = body.querySelector('[data-l=bed]');
      return () => {
        const p = person(id);
        if (!p) { ui.clearSelection(); return; } // discharged while we were looking
        setText(task, p.task || (p.anim === 'walk' ? 'Walking' : 'Taking a moment'));
        const route = twin.routeOf?.(id) ?? [];
        const last = route[route.length - 1];
        const to = last ? roomAt(p.floor, last.x, last.z) : null;
        next.hidden = !last;
        const near = route.length < 6 || to?.id === p.roomId;
        setText(dest, to ? `${to.name}${near ? ', almost there' : ', a short walk away'}` : 'Just along here');
        const word = p.kind === 'patient' ? (p.status === 'critical' ? ['Needs close care', 'danger'] : p.status === 'watch' ? ['Being watched closely', 'watch'] : ['Doing well', 'ok'])
          : p.status === 'critical' ? ['On an emergency', 'danger'] : p.anim === 'walk' || p.anim === 'run' ? ['On the move', 'info'] : ['On duty', 'ok'];
        setText(st, word[0]); st.dataset.s = word[1];
        list(lb, p.bedId ? sec('Bed', `<button type="button" class="hv-row" data-hit="bed:${p.bedId}"><i class="hv-dot" data-s="ok"></i><span><b>Bed ${esc(p.bedId)}</b><small>${esc(roomName(twin, twin.beds?.get?.(p.bedId)?.roomId))}</small></span></button>`) : '');
      };
    },

    equipment(id) {
      const q = twin.equipment?.get?.(id);
      setText(brow, `Equipment · ${roomName(twin, q?.roomId)}`);
      setText(title, q?.name ?? q?.type ?? id);
      body.innerHTML = `
        <div><span class="hv-pill" data-v="state"></span></div>
        <div class="hv-sec"><h3>Health<span data-v="pct"></span></h3><div class="hv-bar"><i data-v="bar" style="transform:scaleX(0)"></i></div></div>
        <p class="hv-lede" data-v="note" style="margin-top:14px"></p>`;
      const st = body.querySelector('[data-v=state]'), pct = body.querySelector('[data-v=pct]'), bar = body.querySelector('[data-v=bar]'), note = body.querySelector('[data-v=note]');
      return () => {
        const e = twin.equipment?.get?.(id);
        if (!e) return;
        const w = EQ_WORD[e.status] ?? EQ_WORD.idle;
        setText(st, w[0]); st.dataset.s = w[1];
        const h = clamp(e.health ?? 1);
        setText(pct, `${Math.round(h * 100)}%`);
        bar.style.transform = `scaleX(${h})`;
        bar.style.setProperty('--c', h < 0.3 ? 'var(--danger)' : h < 0.6 ? 'var(--watch)' : 'var(--ok)');
        setText(note, e.note || (h > 0.8 ? 'Running well. Nothing to do here.' : 'Worth a look at the next service.'));
      };
    },

    vehicle(id) {
      const v = (twin.vehicles ?? []).find((x) => x.id === id);
      const air = v?.type === 'helicopter';
      setText(brow, air ? 'Air ambulance' : v?.type === 'ambulance' ? 'Ambulance' : 'On the road');
      setText(title, v?.label ?? (air ? 'Air ambulance' : v?.type === 'car' ? 'Car' : 'Ambulance'));
      body.innerHTML = `
        <div class="hv-step">${air ? I.heli : I.van}<div><b data-v="k">Arriving</b><p data-v="eta"></p></div></div>
        <p class="hv-lede" data-v="line" style="margin-top:8px"></p>`;
      const eta = body.querySelector('[data-v=eta]'), line = body.querySelector('[data-v=line]');
      return () => {
        const x = (twin.vehicles ?? []).find((y) => y.id === id);
        if (!x) { setText(eta, 'Has left the site'); setText(line, ''); return; }
        const e = x.eta;
        setText(eta, Number.isFinite(e) && e > 0.5 ? `About ${plural(Math.round(e), 'minute')} away` : 'Here now');
        setText(line, x.type === 'car' ? 'Dropping someone off at the main doors.' : 'A bay and a team are ready for this arrival.');
      };
    },
  };

  let refresh = null;
  function open(type, id) {
    const mk = views[type];
    if (!mk) return;
    cur = { type, id };
    view = `${type}:${id}`;
    body.classList.remove('fade'); void body.offsetWidth; body.classList.add('fade');
    refresh = mk(id);
    body.scrollTop = 0;
    refresh?.();
    node.classList.add('open');
    root.dataset.inspect = '1';
  }
  function close() {
    if (!cur) return false;
    cur = null; view = null; refresh = null;
    node.classList.remove('open');
    root.dataset.inspect = '0';
    return true;
  }
  return {
    open, close,
    get current() { return cur; },
    get isOpen() { return !!cur; },
    // A patient can arrive in or leave a bed while it is open, which changes the body entirely.
    tick() {
      if (cur?.type === 'bed') {
        const b = twin.beds?.get?.(cur.id);
        const has = !!(b?.patientId);
        if (has !== !!body.querySelector('canvas')) refresh = views.bed(cur.id);
      }
      refresh?.();
    },
    update(dt) { refresh?.frame?.(dt); },
  };
}
