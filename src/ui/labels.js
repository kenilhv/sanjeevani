// 3D-anchored labels: pooled DOM moved with transform only, recomputed every frame.
import { el, esc, setText, roomName, publicRooms, hiddenRooms, plural, ROLE, reasonOf } from './util.js';
import { icons as I } from './icons.js';
import { roomCentre, FLOOR_HEIGHT } from '../world/plan.js';

const ROOM_ZOOM = 1.28, BED_ZOOM = 1.75;
const STATUS = { calm: 'Calm', busy: 'Busy', full: 'Full', alert: 'Needs attention' };
const BED_WORD = { free: 'Free', occupied: 'Occupied', cleaning: 'Being cleaned', reserved: 'Held for someone' };
const EQ_WORD = { idle: 'Ready to use', 'in-use': 'In use', maintenance: 'Being serviced', fault: 'Needs repair' };
const NS = 'http://www.w3.org/2000/svg';

export function createLabels(ui) {
  const { engine, twin, shell, root } = ui;
  const layer = el(`<div class="hv-labels" aria-hidden="true"></div>`);
  const route = document.createElementNS(NS, 'svg');
  route.setAttribute('class', 'hv-route');
  route.innerHTML = '<polyline points=""/><circle r="6" cx="-99" cy="-99"/>';
  const line = route.firstChild, flag = route.lastChild;
  const tip = el(`<div class="hv-tip"><b></b><span></span></div>`);
  layer.append(route);
  root.append(layer, tip);

  let always = false, hoverRoom = null, routeId = null, hover = null;
  let mx = 0, my = 0, tipOn = false, tipAt = 0, tipW = 0, tipH = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const mk = (html, onClick) => {
    const n = el(`<div class="hv-lb">${html}</div>`);
    if (onClick) n.firstElementChild.addEventListener('click', onClick);
    layer.append(n);
    return { n, on: false, lx: -1e6, ly: -1e6 };
  };
  const show = (l, v) => { if (l.on !== v) { l.on = v; l.n.classList.toggle('on', v); } };
  const place = (l, x, y) => {
    const px = Math.round(x * 2) / 2, py = Math.round(y * 2) / 2;
    if (px === l.lx && py === l.ly) return;
    l.lx = px; l.ly = py;
    l.n.style.transform = `translate3d(${px}px,${py}px,0)`;
  };
  const worldY = (floor, h) => (engine.floorY?.(floor) ?? floor * FLOOR_HEIGHT) + h;
  // Follow the chosen mode rather than plate visibility: a plate stays visible until it has fully landed or left.
  const floorOn = (f) => {
    const m = engine.floorMode ?? 'ground';
    return m === 'stack' || (m === 'level1' ? f === 1 : f === 0);
  };

  const rooms = publicRooms().map((r) => {
    const c = shell.rooms?.get?.(r.id)?.centre ?? roomCentre(r);
    const l = mk(`<div class="hv-lroom"><i></i>${esc(r.name)}<small></small></div>`, () => ui.select({ type: 'room', id: r.id }));
    return { ...l, id: r.id, floor: r.floor, x: c.x, z: c.z, pill: l.n.firstElementChild, count: l.n.querySelector('small') };
  });
  let beds = [];
  const shownBeds = () => [...(twin.beds?.values() ?? [])].filter((b) => !hiddenRooms.has(b.roomId));
  const syncBeds = () => {
    if (!twin.beds || beds.length === shownBeds().length) return;
    for (const b of beds) b.n.remove();
    beds = shownBeds().map((b) => {
      const l = mk(`<span class="hv-lbed"></span>`);
      return { ...l, b, dot: l.n.firstElementChild };
    });
  };
  const beacons = Array.from({ length: 8 }, () => {
    const l = mk(`<div class="hv-beacon">${I.heart}</div>`, () => { if (l.bed) ui.select({ type: 'bed', id: l.bed.id }); });
    l.face = l.n.firstElementChild;
    return l;
  });
  const tags = Array.from({ length: 4 }, () => {
    const l = mk(`<div class="hv-ltag"><span class="ic"></span><span class="t"></span><small></small></div>`, () => { if (l.v) ui.select({ type: 'vehicle', id: l.v.id }); });
    l.ic = l.n.querySelector('.ic'); l.t = l.n.querySelector('.t'); l.eta = l.n.querySelector('small');
    return l;
  });

  function describe(hit) {
    const id = hit.id;
    switch (hit.type) {
      case 'room': {
        const r = twin.rooms?.get?.(id);
        const n = r?.capacity ? `${r.occupied ?? 0} of ${r.capacity} taken` : plural(r?.occupied ?? 0, 'person', 'people');
        return [r?.name ?? roomName(twin, id), `${n}${r?.status ? `. ${STATUS[r.status] ?? ''}` : ''}`];
      }
      case 'bed': {
        const b = twin.beds?.get?.(id), a = ui.actor(b?.patientId);
        return a ? [a.name, reasonOf(a) || `Bed ${id}`] : [`Bed ${id}`, BED_WORD[b?.status] ?? 'Free'];
      }
      case 'person': {
        const a = ui.actor(id);
        return a ? [a.name, `${ROLE[a.role] ?? a.role}${a.task ? `, ${a.task.charAt(0).toLowerCase()}${a.task.slice(1)}` : ''}`] : null;
      }
      case 'equipment': {
        const q = twin.equipment?.get?.(id);
        return q ? [q.name ?? q.type, EQ_WORD[q.status] ?? ''] : null;
      }
      case 'vehicle': {
        const v = (twin.vehicles ?? []).find((x) => x.id === id);
        if (!v) return null;
        const name = v.type === 'helicopter' ? 'Air ambulance' : v.type === 'ambulance' ? 'Ambulance' : 'Car';
        return [v.label ?? name, Number.isFinite(v.eta) && v.eta > 0.5 ? `About ${plural(Math.round(v.eta), 'minute')} away` : 'Here now'];
      }
      default: return null;
    }
  }

  engine.on?.('hover', (hit) => {
    const h = hit?.info ?? hit;
    hover = h ?? null;
    hoverRoom = h?.type === 'room' ? h.id : h?.type === 'bed' ? twin.beds?.get?.(h.id)?.roomId ?? null : null;
    const d = h ? describe(h) : null;
    if (d) { setText(tip.firstElementChild, d[0]); setText(tip.lastElementChild, d[1]); tipW = 0; }
    tipAt = d ? performance.now() : 0;
    if (!d) { tipOn = false; tip.classList.remove('on'); }
    document.body.style.cursor = h ? 'pointer' : '';
  });

  let beat = 0;
  return {
    setAlways(v) { always = v; },
    setRoute(id) { routeId = id; if (!id) route.classList.remove('on'); },
    tick() {
      syncBeds();
      for (const r of rooms) {
        const d = twin.rooms?.get?.(r.id);
        if (!d) continue;
        setText(r.count, d.capacity ? `${d.occupied ?? 0}/${d.capacity}` : `${d.occupied ?? 0}`);
        if (r.pill.dataset.s !== d.status) r.pill.dataset.s = d.status ?? 'calm';
      }
      // Alarmed beds claim beacons at 3 Hz; the beacons track them every frame.
      let i = 0;
      for (const b of twin.beds?.values?.() ?? []) {
        if (!b.alarm || i >= beacons.length || hiddenRooms.has(b.roomId)) continue;
        const l = beacons[i++];
        l.bed = b;
        if (l.face.dataset.s !== b.alarm) l.face.dataset.s = b.alarm;
      }
      for (; i < beacons.length; i++) beacons[i].bed = null;
      let j = 0;
      for (const v of twin.vehicles ?? []) {
        if ((v.type !== 'ambulance' && v.type !== 'helicopter') || j >= tags.length) continue;
        const l = tags[j++];
        l.v = v;
        const eta = Number.isFinite(v.eta) && v.eta > 0.5 ? `${Math.round(v.eta)} min` : '';
        setText(l.t, v.type === 'helicopter' ? 'Air ambulance' : 'Ambulance');
        setText(l.eta, eta);
        if (l.kind !== v.type) { l.kind = v.type; l.ic.innerHTML = v.type === 'helicopter' ? I.heli : I.van; }
      }
      for (; j < tags.length; j++) tags[j].v = null;
    },
    update(dt, t) {
      const zr = ui.zoomRatio();
      const sel = ui.inspector?.current;
      const selRoom = sel?.type === 'room' ? sel.id : null;
      const showRooms = always || zr > ROOM_ZOOM;
      for (const r of rooms) {
        const v = floorOn(r.floor) && (showRooms || hoverRoom === r.id || selRoom === r.id);
        if (v || r.on) {
          const p = engine.project(r.x, worldY(r.floor, 1.5), r.z);
          show(r, v && p.visible);
          if (p.visible) place(r, p.x, p.y);
        }
      }
      const showBeds = zr > BED_ZOOM;
      for (const l of beds) {
        const b = l.b;
        const v = showBeds && floorOn(b.floor) && !b.alarm;
        if (v || l.on) {
          const p = engine.project(b.x, worldY(b.floor, 1.25), b.z);
          show(l, v && p.visible);
          if (p.visible) place(l, p.x, p.y);
          if (l.dot.dataset.s !== b.status) l.dot.dataset.s = b.status;
        }
      }
      for (const l of beacons) {
        const b = l.bed;
        if (!b) { show(l, false); continue; }
        const v = floorOn(b.floor);
        const p = engine.project(b.x, worldY(b.floor, 1.75 + Math.sin(t * 2.2) * 0.05), b.z);
        show(l, v && p.visible);
        if (p.visible) place(l, p.x, p.y);
      }
      for (const l of tags) {
        const c = l.v;
        if (!c) { show(l, false); continue; }
        const p = engine.project(c.x, (c.y ?? 0) + (c.type === 'helicopter' ? 4.4 : 3.4), c.z);
        show(l, p.visible);
        if (p.visible) place(l, p.x, p.y);
      }
      if (tipAt && !tipOn && performance.now() - tipAt > 130) { tipOn = true; tip.classList.add('on'); }
      if (tipOn) {
        if (!tipW) { tipW = tip.offsetWidth; tipH = tip.offsetHeight; } // measured once per subject, never per frame
        const x = Math.min(mx + 16, innerWidth - tipW - 10), y = Math.max(8, my - tipH - 12);
        tip.style.transform = `translate3d(${x}px,${y}px,0)`;
      }
      // Route overlay for the selected person, rebuilt ten times a second.
      if (routeId && (beat = (beat + 1) % 6) === 0) {
        const a = ui.actor(routeId);
        const path = a ? twin.routeOf?.(routeId) ?? [] : [];
        if (!a || !path.length || !floorOn(a.floor)) { route.classList.remove('on'); return; }
        const y = worldY(a.floor, 0.1);
        const s = engine.project(a.x, y, a.z);
        let pts = `${s.x.toFixed(1)},${s.y.toFixed(1)}`, e = s;
        for (let i = 0; i < path.length; i += Math.max(1, Math.floor(path.length / 28))) {
          e = engine.project(path[i].x, y, path[i].z);
          pts += ` ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
        }
        const last = path[path.length - 1];
        e = engine.project(last.x, y, last.z);
        pts += ` ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
        line.setAttribute('points', pts);
        flag.setAttribute('cx', e.x); flag.setAttribute('cy', e.y);
        route.classList.add('on');
      }
    },
  };
}
