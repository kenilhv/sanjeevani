// The agents, made visible and clickable. A small avatar floats over each live patient's bed (that patient's Twin)
// and over each pod (its Nurse Agent), in the same style as the Agent network panel. Click a Twin to open its
// patient; click a Nurse Agent to open the conversation. Every Agent Relay message travels between them as a thin
// beam of light, and voices travel from the person speaking to the agent listening.
import * as THREE from 'three';
import { FLOOR_HEIGHT, roomById } from '../world/plan.js';
import { icons as I } from '../ui/icons.js';
import { C } from '../style/palette.js';
import { PODS, roomLabel } from './config.js';

const COLORS = {
  alert: 0xff5a5f, 'readback.missing': 0xff5a5f, 'patient.request': 0xffb020, rank: 0xffd166,
  'note.new': 0xf4f7fb, 'note.ack': 0xf4f7fb, question: 0x38d6f0, answer: 0x38d6f0,
  readback: 0x36d399, 'readback.ok': 0x36d399, 'help.request': 0xa78bfa, 'help.response': 0xa78bfa,
  'handoff.section': 0xf3a6ff, voice: 0x6aa8ff,
};
const LEVEL = { urgent: 0xff5a5f, soon: 0xffb020 };
const RING = { urgent: '#ff5a5f', warning: '#ffb020', resolved: '#36d399' };
const TINT = { 'room-2': C.coral, 'room-4': C.teal, 'room-6': C.watch, 'room-8': C.purple, 'room-3': C.steel };
const TRAVEL = 1.1, MAX_FLYING = 3;

const CSS = `
.hv-pin { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; pointer-events: auto; cursor: pointer;
  border: 0; padding: 0; background: none; font: inherit; z-index: 2; }
.hv-pin .hv-ag { width: 30px; height: 30px; transition: transform .35s var(--pop), box-shadow .3s ease; }
.hv-pin.big .hv-ag { width: 38px; height: 38px; }
.hv-pin:hover .hv-ag { transform: scale(1.12); }
.hv-pin small { font-size: 10.5px; font-weight: 620; color: var(--ink); padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.hv-pin.kick .hv-ag { animation: hv-pin-kick .6s var(--pop); }
.hv-pin.listen .hv-ag { animation: hv-pin-listen 0.9s ease-in-out infinite; }
@keyframes hv-pin-kick { 40% { transform: scale(1.35); } }
@keyframes hv-pin-listen { 50% { transform: scale(1.25); box-shadow: 0 0 0 6px color-mix(in srgb, var(--t) 45%, transparent); } }
`;

export function mountOrbs(ui) {
  const { engine, twin, root } = ui;
  root.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const group = new THREE.Group();
  group.name = 'sanjeevni-agents';
  engine.scene.add(group);
  const planeY = () => engine.floorY?.(1) ?? FLOOR_HEIGHT;

  // ── Clickable avatars ──────────────────────────────────────────────────────
  const pins = new Map();   // agent id -> { node, pos() }
  function pin(id, { icon, tint, label, big, pos, onClick }) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `hv-pin${big ? ' big' : ''}`;
    node.setAttribute('aria-label', label);
    node.innerHTML = `<span class="hv-ag" style="--t:${tint}">${I[icon]}</span><small class="hv-glass"></small>`;
    node.querySelector('small').textContent = label;
    node.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    // Under every panel, like the room labels: prepend so later panels paint on top.
    root.prepend(node);
    pins.set(id, { node, pos });
  }
  for (const [podId, pod] of Object.entries(PODS)) {
    for (const room of pod.rooms) {
      const bedId = twin.bedOf?.(room);
      if (!bedId) continue;
      pin(`twin-${room}`, {
        icon: 'bed', tint: TINT[room] ?? C.teal, label: `${roomLabel(room)} Twin`,
        pos: () => { const b = twin.beds.get(bedId); return b && new THREE.Vector3(b.x, planeY() + 2.4, b.z); },
        onClick: () => ui.select({ type: 'bed', id: bedId }),
      });
    }
    const r = roomById(pod.ward)?.rect;
    if (r) pin(`nurse-${podId}`, {
      icon: 'people', tint: podId === 'pod-a' ? C.info : C.leafLight, label: `${pod.name} Nurse Agent`, big: true,
      pos: () => new THREE.Vector3(r.x + r.w / 2, planeY() + 3.1, r.z + r.d / 2),
      onClick: () => twin.live.openChat?.(),
    });
  }

  // People who speak: a nurse id (maya, jordan, sam) or bedside-room-N.
  function personPos(id) {
    const s = String(id ?? '');
    let actor = null;
    if (s.startsWith('bedside-')) actor = twin.patientOf?.(s.slice(8));
    else for (const podId of Object.keys(PODS)) if (twin.live.nurse[podId] === s) actor = twin.nurseOf?.(podId);
    return actor && !actor.hidden && actor.floor === 1 ? new THREE.Vector3(actor.x, planeY() + 1.6, actor.z) : null;
  }
  const posOf = (id) => pins.get(id)?.pos() ?? personPos(id);
  const kick = (id) => { const n = pins.get(id)?.node; if (!n) return; n.classList.remove('kick'); void n.offsetWidth; n.classList.add('kick'); };

  // ── Beams: thin arcs of light between whoever is talking ───────────────────
  const flying = [], waiting = [];
  const headGeo = new THREE.SphereGeometry(0.09, 10, 8);
  function launch(m) {
    const a = posOf(m.from), b = posOf(m.to);
    if (!a || !b) return;
    const color = LEVEL[m.level] ?? COLORS[m.type] ?? 0xf4f7fb;
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.2 + a.distanceTo(b) * 0.16, 0));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    line.renderOrder = head.renderOrder = 11;
    group.add(line, head);
    kick(m.from);
    flying.push({ m, curve, line, head, t: 0, done: false });
  }
  twin.on('relay', (m) => {
    if (!posOf(m.from) || !posOf(m.to)) return;
    if (flying.length >= MAX_FLYING) { waiting.push(m); if (waiting.length > 8) waiting.shift(); return; }
    launch(m);
  });

  function listen(id, on) { pins.get(id)?.node.classList.toggle('listen', on); }

  engine.onFrame((dt) => {
    for (const [id, p] of pins) {
      const at = p.pos();
      const sp = at && engine.project(at.x, at.y, at.z, 1);
      const show = !!sp?.visible;
      p.node.style.display = show ? '' : 'none';
      if (!show) continue;
      p.node.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -50%)`;
      const st = id.startsWith('twin-') ? twin.roomStatus?.(id.slice(5)) : null;
      p.node.firstElementChild.style.setProperty('--ring', RING[st] ?? 'var(--solid)');
    }
    for (const f of flying) {
      f.t += dt / TRAVEL;
      const k = Math.min(1, f.t);
      f.head.position.copy(f.curve.getPoint(k));
      f.line.material.opacity = k < 1 ? 0.6 * Math.min(1, k * 3) : Math.max(0, 0.6 - (f.t - 1) * 1.2);
      if (k >= 1 && !f.done) { f.done = true; f.head.visible = false; kick(f.m.to); }
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (f.t > 1.5) {
        group.remove(f.line, f.head);
        f.line.geometry.dispose(); f.line.material.dispose(); f.head.material.dispose();
        flying.splice(i, 1);
      }
    }
    while (flying.length < MAX_FLYING && waiting.length) launch(waiting.shift());
  });

  return { listen };
}
