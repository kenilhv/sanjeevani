// The live twin: the same API as createTwin (docs/CONTRACT.md §7), driven by the Sanjeevani backend.
// The simulation keeps running underneath for ambient life only (people walking, vehicles, routines),
// with its clinical events switched off. Clock, alerts, agent messages, the Pod A/B patients, their
// vitals and the nurse on shift all come from the event stream (contracts.md §4).
import { createTwin } from '../sim/index.js';
import { setLife, release, releaseAll, removeActor, showBubble, detach, stopLeg } from '../sim/core.js';
import { settleInBed } from '../sim/flows.js';
import { go, leg, standOf, staffLife, bedSpot, faceBed, inpatientLife, inBed } from '../sim/life.js';
import { makeStaff } from '../sim/boot.js';
import { connect, postJSON } from './connection.js';
import { API, PODS, NURSES, PATIENTS, agentLabel, roomLabel, podOfRoom } from './config.js';
import { createSpeaker } from './voice.js';

const DAYPARTS = [[5, 'Night'], [12, 'Morning'], [17, 'Afternoon'], [21, 'Evening'], [24, 'Night']];
const pad = (n) => String(n).padStart(2, '0');
const toMinutes = (hhmm) => { const t = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/); return t ? Number(t[1]) * 60 + Number(t[2]) : null; };
const KIND = {
  alert: 'alert', 'patient.request': 'alert', 'readback.missing': 'alert', 'floor.notice': 'alert',
  'note.new': 'request', question: 'request', readback: 'request', 'help.request': 'request',
  'handoff.section': 'handoff', 'note.ack': 'ack', answer: 'ack', 'readback.ok': 'ack', 'help.response': 'ack',
};
const SEVERITY = { urgent: 'critical', soon: 'watch', fyi: 'info' };
const BED_ALARM = { urgent: 'critical', warning: 'watch' };
const PATIENT_STATUS = { urgent: 'critical', warning: 'watch' };
const ROOM_RE = /\broom[\s-]*(\d+)\b/i;

export function createLiveTwin({ shell } = {}) {
  const base = createTwin({ shell, clinical: false });
  const listeners = new Map();
  const emit = (ev, payload) => listeners.get(ev)?.forEach((cb) => cb(payload));
  const alerts = [], feed = [], seen = new Set();
  const clock = { minutes: 0, hours: 0, label: '', dayPart: '' };
  const profiles = structuredClone(PATIENTS);
  const rooms = {};                  // room -> { status, owner, label }
  const binding = new Map();         // room -> { bedId, patientId }
  const nurseActor = {};             // pod -> staff actor id
  const transient = new Map();       // patient actor id -> { bubble, until }
  const voiceAnswers = new Map();    // question -> /voice/ask result, so a spoken question isn't asked twice
  const lastAlert = {};              // room -> latest alert text from its Twin
  const heldSpeech = new Map();      // pod -> speech events waiting until the incoming nurse reaches the ward
  let seq = 0, simMinutes = 19 * 60, backendSpeed = 1, lastRunSpeed = 60, localClockUntil = 0;

  const live = {
    api: API,
    label: agentLabel,
    status: 'connecting',
    nurse: { 'pod-a': null, 'pod-b': null },
    accepted: new Set(),
    onChange: null,
    speaker: createSpeaker({ onBlocked: () => info('Turn on the agents’ voices', 'Click anywhere on the page once so the browser lets the Nurse Agent speak.') }),
  };
  const changed = () => live.onChange?.();

  // ── Clock ────────────────────────────────────────────────────────────────
  function syncClock() {
    const m = ((simMinutes % 1440) + 1440) % 1440;
    clock.minutes = simMinutes;
    clock.hours = m / 60;
    clock.label = `${pad(Math.floor(m / 60))}:${pad(Math.floor(m % 60))}`;
    clock.dayPart = DAYPARTS.find(([h]) => clock.hours < h)[1];
  }
  function setClock(simTime, speed) {
    const m = toMinutes(simTime);
    // While the slider is being dragged, the local position wins over echoes of earlier positions.
    if (m !== null && performance.now() > localClockUntil) {
      simMinutes = m;
      // Keep the ambient life on the same hour, so a night clock has a night-time hospital.
      base.setHours(m / 60);
    }
    if (Number.isFinite(speed)) {
      backendSpeed = speed;
      if (speed > 0) lastRunSpeed = speed;
      // The capsule's 1×/4×/16× mean story minutes per real second; the backend counts story seconds.
      twin.speed = speed / 60;
    }
    syncClock();
  }
  // Slider drags fire on every pointer move; send at most one set-clock per 200 ms, always including the last.
  let clockTimer = null, pendingTime = null;
  function sendClock(simTime) {
    pendingTime = simTime;
    if (clockTimer) return;
    const flush = () => {
      if (pendingTime === null) { clockTimer = null; return; }
      const t = pendingTime;
      pendingTime = null;
      postJSON('/director/set-clock', { simTime: t }).catch((e) => console.warn('[live] set clock', e.message));
      clockTimer = setTimeout(flush, 200);
    };
    flush();
  }
  function setSpeedOnBackend(speed) {
    postJSON('/director/set-clock', { speed }).catch((e) => console.warn('[live] set speed', e.message));
  }

  // ── Binding live patients and nurses onto the ward beds ─────────────────
  function patientActor(room) { const b = binding.get(room); return b && base.actors.find((a) => a.id === b.patientId); }
  function bind() {
    for (const [podId, pod] of Object.entries(PODS)) {
      const ward = base.rooms.get(pod.ward);
      if (ward) ward.name = pod.name;
      // Skip patients the simulation has plans for (surgery booked, an order queued), so nobody is wheeled out of a live bed.
      const preop = (b) => { const a = base.actors.find((x) => x.id === b.patientId); return a?._cond?.preop || a?._booked || a?._order || a?._puppet || !inBed(a) ? 1 : 0; };
      const beds = [...base.beds.values()].filter((b) => b.roomId === pod.ward && b.kind === 'ward' && b.patientId)
        .sort((a, b) => preop(a) - preop(b) || a.x - b.x || a.z - b.z);
      pod.rooms.forEach((room, i) => {
        const bed = beds[i];
        if (!bed || binding.has(room)) return;
        binding.set(room, { bedId: bed.id, patientId: bed.patientId });
      });
      const nurse = base.actors.find((a) => a.kind === 'staff' && a.role === 'nurse' && a._zone === pod.ward);
      if (nurse) nurseActor[podId] = nurse.id;
    }
    for (const room of binding.keys()) { applyProfile(room); keepInBed(room); }
  }
  function applyProfile(room) {
    const p = patientActor(room), prof = profiles[room];
    if (!p || !prof) return;
    p.name = p.display = prof.name;
    p.reason = `${roomLabel(room)} · ${prof.diagnosis}`;
    p.task = prof.age ? `${prof.age} years old` : p.task;
    // Live patients belong to the actors: the ambient simulation never discharges, operates on or moves them.
    p._stayUntil = Infinity;
    p._cond = { ...p._cond, preop: null, risk: 0 };
    p._booked = true;
    if (!p._puppet) p._order = null;
    // A plan already under way (a surgery being set up) lives in the patient's process, so restart it as a plain
    // inpatient routine and free anything held for them elsewhere.
    const sim = base._sim;
    if (sim && !p._live && !p._puppet && base.beds.get(p.bedId)?.patientId === p.id) {
      for (const b of base.beds.values()) if (b._for === p.id && b.id !== p.bedId) { b._for = null; b._busy = false; if (b.status === 'reserved') b.status = 'free'; }
      setLife(sim, p, inpatientLife(sim, p));
    }
    p._live = room;
    if (prof.vitals && p._base) Object.assign(p._base, prof.vitals);
  }
  // A live patient stays in their own bed. The ambient simulation may already have plans for the patient it
  // was given (a surgery under way, a porter on the way); cancel them and settle the patient back home.
  function keepInBed(room) {
    const sim = base._sim, home = base.beds.get(binding.get(room)?.bedId), p = patientActor(room);
    if (!sim || !home || !p?.alive) return;
    if (home.patientId === p.id && p.bedId === home.id && !p._away && !p._moving && !p._leader && !p._followers?.length) return;
    live.resettles = (live.resettles ?? 0) + 1;
    for (const f of [...(p._followers ?? [])]) { detach(f); f._locked = false; f._busy = false; setLife(sim, f, staffLife(sim, f)); }
    if (p._leader) detach(p);
    stopLeg(p);
    for (const b of base.beds.values()) {
      if (b === home) continue;
      if (b._for === p.id) { b._for = null; b._busy = false; if (b.status === 'reserved') b.status = 'free'; }
      if (b.patientId === p.id) { b.patientId = null; b._busy = false; b.status = 'free'; }
    }
    p._puppet = false; p._enRoute = false; p._order = null; p.hidden = false;
    settleInBed(sim, p, home);
    setLife(sim, p, inpatientLife(sim, p));
  }
  setInterval(() => { for (const room of binding.keys()) keepInBed(room); }, 1000);

  function applyNurse(podId, nurseId) {
    const a = base.actors.find((x) => x.id === nurseActor[podId]), n = NURSES[nurseId];
    if (!a || !n) return;
    a.name = n.name; a.display = `Nurse ${n.short}`; a.first = n.short;
    a.task = `${n.shift} shift, ${PODS[podId].name}`;
  }

  // ── Shift change: the outgoing nurse leaves, the incoming one arrives, then the agent briefs them ──
  // Driven by nurse.change, so it plays the same from the floor's Shift change button or the Director panel.
  const nurseHere = (podId) => base.actors.find((x) => x.id === nurseActor[podId]);
  function releaseBriefing(podId) {
    const held = heldSpeech.get(podId);
    if (!held) return;
    heldSpeech.delete(podId);
    clearTimeout(held.timer);
    for (const e of held.events) onEvent(e);
  }
  function handover(podId, fromId, toId) {
    const sim = base._sim, out = nurseHere(podId);
    const lift = sim?.world?.portals?.find((p) => p.kind === 'lift');
    if (!sim || !out || !lift || !out._post) { applyNurse(podId, toId); return; }
    const post = out._post;

    // Hold the Nurse Agent's briefing until the new nurse is at the ward (or 25 s, whichever comes first).
    heldSpeech.set(podId, { events: [], timer: setTimeout(() => releaseBriefing(podId), 25000) });

    // Outgoing: a last word at the ward, then down in the lift and home.
    releaseAll(out);
    out._busy = true;
    setLife(sim, out, (function* () {
      out.anim = 'talk'; out.task = 'Handing over to the day shift';
      yield 3;
      out.task = `Heading home after the ${NURSES[fromId]?.shift.toLowerCase() ?? ''} shift`.replace('  ', ' ');
      yield* go(sim, out, sim.world.entry.inside);
      yield* go(sim, out, sim.world.entry.outside);
      yield* go(sim, out, sim.rng.pick(sim.world.plazaEnds));
      removeActor(sim, out);
    })());

    // Incoming: steps out of the lift on Level 1 and walks to the pod's post.
    const cabin = { x: lift.x, z: lift.z + 0.9 }, stand = standOf(lift, 1);
    const inn = makeStaff(sim, { role: 'nurse', zone: out._zone, routine: out._routine }, { floor: 1, x: cabin.x, z: cabin.z });
    inn._post = post;
    inn._busy = true;
    nurseActor[podId] = inn.id;
    applyNurse(podId, toId);
    setLife(sim, inn, (function* () {
      inn.task = 'Arriving for the day shift';
      yield 2;
      yield* leg(sim, inn, { x: stand.x, z: stand.z, noclip: true });
      yield* go(sim, inn, { floor: post.floor, x: post.ax ?? post.x, z: post.az ?? post.z });
      inn.anim = 'idle';
      inn.task = 'Being briefed by the Nurse Agent';
      showBubble(sim, inn, 'chat', 12);
      emit('arrived', { pod: podId, actorId: inn.id });
      releaseBriefing(podId);
      yield 12;
      inn._busy = false;
      yield* staffLife(sim, inn);
    })());
    emit('handover', { pod: podId, outId: out.id, inId: inn.id });
  }

  // ── Send the pod's nurse to a bedside, to talk with the patient ───────────
  const bedsideVisit = new Map();    // room -> { actorId, arrived }
  function sendNurse(room) {
    const sim = base._sim, podId = podOfRoom(room), nurse = nurseHere(podId);
    const bed = base.beds.get(binding.get(room)?.bedId), p = patientActor(room);
    if (!sim || !nurse || !bed || !p) return null;
    const visit = { actorId: nurse.id, arrived: false };
    bedsideVisit.set(room, visit);
    releaseAll(nurse);
    nurse._busy = true;
    setLife(sim, nurse, (function* () {
      const spot = bedSpot(bed, nurse);
      nurse.task = `On the way to ${p.display}`;
      yield* go(sim, nurse, spot);
      faceBed(nurse, bed);
      nurse.anim = 'talk';
      nurse.task = `Talking with ${p.display}`;
      showBubble(sim, nurse, 'chat', 30);
      visit.arrived = true;
      emit('bedside', { room, actorId: nurse.id });
      changed();
      // Stays and listens while the conversation goes on, then back to the usual routine.
      yield 45;
      release(nurse, spot);
      if (bedsideVisit.get(room) === visit) bedsideVisit.delete(room);
      nurse._busy = false;
      changed();
      yield* staffLife(sim, nurse);
    })());
    changed();
    return nurse;
  }

  // ── Alerts and the agent feed ─────────────────────────────────────────────
  const wardOf = (room) => PODS[podOfRoom(room)]?.ward;
  const roomOf = (e) => e.room ?? [e.from, e.to].map((s) => String(s ?? '').match(/room-\d+/)?.[0]).find(Boolean);
  const at = (simTime) => toMinutes(simTime) ?? simMinutes;

  function raise({ severity = 'watch', title, detail = '', room, silent = false }) {
    const b = room && binding.get(room);
    const al = {
      id: `lv${++seq}`, severity, title, detail, roomId: room ? wardOf(room) : undefined, bedId: b?.bedId, actorId: b?.patientId,
      at: simMinutes, resolved: false, acked: false, _room: room,
    };
    alerts.push(al);
    if (alerts.length > 80) { const i = alerts.findIndex((x) => x.resolved); if (i >= 0) alerts.splice(i, 1); }
    if (!silent) emit('alert', al);
    return al;
  }
  // Information toasts: shown once, never counted as "needs attention".
  function info(title, detail, room) { const al = raise({ severity: 'info', title, detail, room }); al.resolved = true; return al; }
  function resolveRoom(room, detail) {
    for (const al of alerts) if (al._room === room && !al.resolved && al.severity !== 'info') {
      al.resolved = true; al.resolvedAt = simMinutes;
      if (detail) al.detail = detail;
      emit('resolve', al);
    }
  }
  function post(from, to, text, kind, room, simTime, key) {
    // Same message from the live stream, the in-memory history and the Supabase audit log carries
    // different ids, so the content is a second key.
    const content = `${from}|${to}|${text}|${simTime ?? ''}`;
    if ((key && seen.has(key)) || seen.has(content)) return;
    if (key) seen.add(key);
    seen.add(content);
    const m = { id: `lm${++seq}`, at: at(simTime), from, to, text, kind, roomId: room ? wardOf(room) : undefined };
    feed.push(m);
    if (feed.length > 200) feed.shift();
    emit('feed', m);
  }
  const nameOf = (room) => profiles[room]?.name ?? roomLabel(room);
  const bubble = (room, kind, ms = 4000) => { const p = patientActor(room); if (p) transient.set(p.id, { bubble: kind, until: performance.now() + ms }); };

  // ── Event stream ──────────────────────────────────────────────────────────
  function onEvent(e, { silent = false, replay = false } = {}) {
    switch (e.kind) {
      case 'clock': setClock(e.simTime, e.speed); break;
      case 'room.status': roomStatus(e, silent); break;
      case 'agent.message': message(e, silent, replay); break;
      case 'transcript': {
        const room = e.who?.startsWith('bedside-') ? e.who.slice(8) : null;
        const pod = room ? podOfRoom(room) : NURSES[e.who]?.pod ?? 'pod-a';
        post(e.who, room ? `twin-${room}` : `nurse-${pod}`, `“${e.text}”`, 'request', room, undefined, e.id);
        // The agent hears it: a voice beam from the speaker to the Twin (patient) or the Nurse Agent (nurse).
        if (!silent) emit('relay', { from: e.who, to: room ? `twin-${room}` : `nurse-${pod}`, type: 'voice', text: e.text });
        // The words go up as a caption while the agent thinks; its reasoning arrives as an overlay.
        if (!silent) emit('heard', { who: e.who, text: e.text, room, agent: room ? `twin-${room}` : `nurse-${pod}` });
        if (room) bubble(room, 'call', 6000);
        break;
      }
      // An agent's reasoning about what someone just said, and the handover report: shown as overlays.
      case 'insight': if (!silent) emit('insight', e); break;
      case 'report':
        if (!silent && heldSpeech.has(e.pod)) { heldSpeech.get(e.pod).events.push(e); break; }
        if (!silent) emit('report', e);
        break;
      case 'speech':
        if (!silent && heldSpeech.has(e.who?.slice(6))) { heldSpeech.get(e.who.slice(6)).events.push(e); break; }
        post(e.who, live.nurse[e.who?.slice(6)] ?? 'nurse', e.text, 'handoff', undefined, undefined, e.id);
        if (!silent) { info(agentLabel(e.who), e.text); live.speaker.speak(e.text, e.audioUrl, e.who?.startsWith('twin-') ? 'twin' : 'agent'); }
        break;
      case 'nurse.change': {
        const pod = e.pod;
        live.nurse[pod] = e.to ?? null;
        const live1 = !silent && e.from && e.to && e.from !== e.to;
        // A real handover is acted out on the floor; a first sign-in or a reload just renames the nurse.
        if (live1) handover(pod, e.from, e.to);
        else if (e.to) applyNurse(pod, e.to);
        if (live1) {
          info(`Shift change · ${PODS[pod]?.name ?? pod}`, `${NURSES[e.from]?.short ?? e.from} hands over to ${NURSES[e.to]?.short ?? e.to}. The Nurse Agent keeps every patient’s story.`);
          post(`nurse-${pod}`, e.to, `Good to have you, ${NURSES[e.to]?.short ?? e.to}. Briefing is ready.`, 'handoff', undefined, undefined, e.id);
        }
        changed();
        break;
      }
      case 'handoff.progress':
        if (e.state === 'accepted') {
          live.accepted.add(e.room);
          bubble(e.room, 'heart', 5000);
          if (!silent) info(`${roomLabel(e.room)} handoff accepted`, `${nameOf(e.room)} is now ${NURSES[live.nurse[podOfRoom(e.room)]]?.short ?? 'the day nurse'}’s. Read-back confirmed by the Twin.`, e.room);
          changed();
        }
        break;
      case 'vitals': {
        const prof = profiles[e.room];
        if (prof && e.vitals) { prof.vitals = { ...prof.vitals, ...e.vitals }; const p = patientActor(e.room); if (p?._base) Object.assign(p._base, e.vitals); }
        break;
      }
      case 'system':
        // The restart drill kills the actors, not the voice service, so the socket stays up; the phase drives the veil.
        if (!replay && e.phase === 'down') { live.status = 'reconnecting'; changed(); break; }
        if (!replay && e.phase === 'up' && live.status === 'reconnecting') { live.status = 'live'; changed(); }
        post('system', 'floor', e.text, 'ack', undefined, undefined, e.id);
        if (!silent) info('Sanjeevani', e.text);
        break;
    }
  }
  function roomStatus(e, silent) {
    const prev = rooms[e.room]?.status;
    rooms[e.room] = { status: e.status, owner: e.owner ?? rooms[e.room]?.owner ?? null, label: e.label ?? null };
    if (e.status === 'resolved' || e.status === 'stable') {
      if (prev === 'warning' || prev === 'urgent') resolveRoom(e.room, `Resolved at ${clock.label}.`);
      if (e.status === 'resolved') {
        bubble(e.room, 'heart', 4000);
        // contracts.md §4: resolved fades back to stable after about 3 seconds.
        setTimeout(() => { if (rooms[e.room]?.status === 'resolved') rooms[e.room].status = 'stable'; }, 3000);
      }
    } else if ((e.status === 'warning' || e.status === 'urgent') && !alerts.some((a) => a._room === e.room && !a.resolved && a.severity !== 'info')) {
      raise({ severity: e.status === 'urgent' ? 'critical' : 'watch', title: `${roomLabel(e.room)} · ${nameOf(e.room)}`, detail: lastAlert[e.room] ?? e.label ?? 'Needs a nurse.', room: e.room, silent });
    }
  }
  function message(e, silent, replay) {
    const room = roomOf(e);
    post(e.from, e.to, e.text, KIND[e.type] ?? 'request', room, e.simTime, e.id);
    if (!silent && !replay) emit('relay', { from: e.from, to: e.to, type: e.type, level: e.level, text: e.text });
    if (!['alert', 'patient.request', 'readback.missing', 'floor.notice'].includes(e.type)) return;
    if (room) lastAlert[room] = e.text;
    if (replay) return;
    const open = room && alerts.find((a) => a._room === room && !a.resolved && a.severity !== 'info');
    const severity = SEVERITY[e.level] ?? (e.type === 'floor.notice' ? 'info' : 'watch');
    // Not urgent (a patient asking for water): shown once, bundled for the next round, never "needs attention".
    if (severity === 'info') { if (!silent) info(room ? `${roomLabel(room)} \u00b7 ${nameOf(room)}` : agentLabel(e.from), e.text, room); return; }
    if (open) {
      // A room keeps one open alert; a newer message escalates or updates it.
      const escalate = severity === 'critical' && open.severity !== 'critical';
      open.detail = e.text;
      if (escalate) open.severity = 'critical';
      if (!silent) emit('alert', open);
      return;
    }
    raise({ severity, title: room ? `${roomLabel(room)} · ${nameOf(room)}` : agentLabel(e.from), detail: e.text, room, silent });
    if (room) bubble(room, e.type === 'patient.request' ? 'call' : 'alert', 8000);
  }
  function snapshot({ state, history, reconnect }) {
    const unit = state?.unit && !state.unit.error ? state.unit : null;
    for (const [room, p] of Object.entries(state?.patients ?? {})) {
      if (!p || p.error || !profiles[room]) continue;
      const prof = profiles[room];
      prof.name = p.name ?? prof.name;
      prof.age = p.age ?? prof.age;
      prof.diagnosis = p.diagnosis ?? p.why ?? prof.diagnosis;
      if (p.vitals && !Array.isArray(p.vitals)) prof.vitals = { ...prof.vitals, ...p.vitals };
      applyProfile(room);
    }
    // History fills the feed first; which alerts are still open comes from the room statuses,
    // since a replayed alert may have been resolved long ago.
    for (const ev of history) onEvent(ev, { silent: true, replay: true });
    if (unit) {
      setClock(unit.simTime, unit.speed);
      for (const [pod, nurse] of Object.entries(unit.assignments ?? {})) { live.nurse[pod] = nurse; if (nurse) applyNurse(pod, nurse); }
      for (const [room, r] of Object.entries(unit.roomStatus ?? {})) roomStatus({ room, ...r }, true);
    }
    if (reconnect) info('Reconnected', 'Live again. Every patient’s story was restored from the actors.');
    changed();
  }

  connect({
    onEvent: (e) => onEvent(e),
    onSnapshot: snapshot,
    onStatus: (s) => { live.status = s; changed(); },
  });

  // ── Per frame: the live state wins over the ambient simulation ───────────
  function overlay() {
    const now = performance.now();
    for (const [room, b] of binding) {
      const bed = base.beds.get(b.bedId), p = patientActor(room);
      if (!bed || !p || bed.patientId !== p.id) continue;
      // The monitor shows the backend's vitals as they arrive (every few seconds), not the simulation's.
      const lv = profiles[room]?.vitals;
      if (lv) {
        if (p._v) Object.assign(p._v, lv);
        bed.vitals.hr = Math.round(lv.hr); bed.vitals.spo2 = Math.round(Math.min(100, lv.spo2)); bed.vitals.rr = Math.round(lv.rr);
        bed.vitals.sys = Math.round(lv.sys); bed.vitals.dia = Math.round(lv.dia); bed.vitals.temp = Math.round(lv.temp * 10) / 10;
      }
      const st = rooms[room]?.status ?? 'stable';
      bed.alarm = BED_ALARM[st] ?? null;
      p.status = PATIENT_STATUS[st] ?? 'ok';
      const t = transient.get(p.id);
      if (t && t.until > now) { p.bubble = t.bubble; p._bubbleUntil = Infinity; }
      else {
        if (t) transient.delete(p.id);
        p.bubble = st === 'urgent' || st === 'warning' ? 'alert' : clock.hours >= 22 || clock.hours < 6 ? 'zzz' : null;
        p._bubbleUntil = Infinity;
      }
    }
  }

  function roomIn(text) { const m = String(text ?? '').match(ROOM_RE); return m ? `room-${m[1]}` : null; }

  const twin = {
    live,
    speed: 1, clock,
    actors: base.actors, vehicles: base.vehicles, beds: base.beds, rooms: base.rooms, equipment: base.equipment,
    alerts, feed, metrics: base.metrics, history: base.history, lifts: base.lifts,
    get scenario() { return 'normal'; },
    suggestions: ['Who needs attention?', 'Did Room 4’s pain improve?', 'Why was Room 6’s sleeping pill started?', 'How is Room 2’s blood pressure?'],
    tick(dt) {
      if (!(dt > 0)) return;
      base.tick(dt);
      simMinutes += (dt * backendSpeed) / 60;
      syncClock();
      overlay();
    },
    // The clock capsule drives the Unit Actor's story clock (contracts.md §6): the slider sets the time,
    // 1×/4×/16× set story minutes per real second, pause stops story time. People keep moving either way.
    get paused() { return backendSpeed === 0; },
    set paused(_) {},
    // Only a person at the clock capsule moves the night: live.clockGesture() is true while they press its
    // slider or buttons (see live/ui.js). Programmatic calls (the guided tour forcing 1×) are ignored.
    setSpeed(n) {
      if (!live.clockGesture?.()) return;
      backendSpeed = n * 60; lastRunSpeed = backendSpeed; twin.speed = n;
      setSpeedOnBackend(backendSpeed);
    },
    setPaused(b) {
      if (!live.clockGesture?.()) return;
      backendSpeed = b ? 0 : lastRunSpeed;
      twin.speed = backendSpeed / 60;
      setSpeedOnBackend(backendSpeed);
    },
    setHours(h) {
      if (!live.clockGesture?.()) return;
      const m = ((Math.round(h * 60) % 1440) + 1440) % 1440;
      simMinutes = m;
      localClockUntil = performance.now() + 700;
      base.setHours(m / 60);
      syncClock();
      sendClock(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    },
    nurseOf: (podId) => nurseHere(podId),
    sendNurse,
    bedside: (room) => bedsideVisit.get(room) ?? null,
    roomOfBed: (bedId) => [...binding].find(([, b]) => b.bedId === bedId)?.[0] ?? null,
    patientOf: (room) => patientActor(room),
    profile: (room) => profiles[room],
    runScenario() {},
    ack(id) {
      const al = alerts.find((a) => a.id === id);
      if (al) al.acked = true;
    },
    async ask(question) {
      const r = voiceAnswers.get(question) ?? await postJSON('/voice/ask', { podId: 'pod-a', nurseId: live.nurse['pod-a'] ?? 'maya', text: question });
      voiceAnswers.delete(question);
      const room = roomIn(question) ?? roomIn(r.answer);
      const b = room && binding.get(room);
      return { answer: r.answer, focus: b ? { bedId: b.bedId } : room ? { roomId: wardOf(room) } : undefined, highlights: room ? [wardOf(room)] : [] };
    },
    rememberVoiceAnswer(result) { if (result?.question) voiceAnswers.set(result.question, result); },
    routeOf: (id) => base.routeOf(id),
    on(event, cb) { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)).add(cb); return () => listeners.get(event)?.delete(cb); },
    bedOf: (room) => binding.get(room)?.bedId,
    roomStatus: (room) => rooms[room]?.status ?? 'stable',
  };

  bind();
  syncClock();
  return twin;
}
