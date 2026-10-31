// The few pieces live mode adds to the interface, built from the same glass and type as the rest:
// a status pill where the floor switch used to be, push-to-talk for voice notes, a mic in the Ask box,
// and a veil while the backend reconnects (the restart moment).
import * as THREE from 'three';
import { el } from '../ui/util.js';
import { FLOOR_HEIGHT, roomById } from '../world/plan.js';
import { CLOSED_ROOMS, NURSES, PODS, podOfRoom, roomLabel } from './config.js';
import { postJSON } from './connection.js';
import { pushToTalk, setServerVoice } from './voice.js';
import { mountOrbs } from './orbs.js';
import { mountStory } from './story.js';
import { mountOverlay } from './overlay.js';

const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';

const CSS = `
.hv-live-pill { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 9px 16px; font-size: 13.5px; font-weight: 540; color: var(--ink); }
.hv-live-pill small { color: var(--ink3); font-weight: 480; }
.hv-live-tech { display: flex; gap: 6px; margin-left: 4px; padding-left: 10px; border-left: 1px solid var(--hair); }
.hv-live-tech span { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--ink3); padding: 2px 8px; border-radius: 999px; background: var(--fill); }
.hv-live-tech span::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ink4, #9aa3b2); }
.hv-live-tech span.on { color: var(--ink); }
.hv-live-tech span.on::before { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-soft); }
.hv-chip[data-live=shift] { background: var(--accent); color: var(--on-ink); border-color: transparent; }
.hv-live-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 4px var(--ok-soft); }
.hv-live-pill[data-s=reconnecting] i, .hv-live-pill[data-s=connecting] i { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); animation: hv-live-blink 1s ease-in-out infinite; }
.hv-live-pill[data-s=offline] i { background: var(--danger); box-shadow: 0 0 0 4px var(--danger-soft); }
@keyframes hv-live-blink { 50% { opacity: .35; } }
.hv-live-left { justify-self: start; display: flex; align-items: end; gap: 10px; pointer-events: none; }
.hv-live-left > * { pointer-events: auto; }
.hv-talk svg { width: 18px; height: 18px; }
.hv-talk { user-select: none; -webkit-user-select: none; touch-action: none; }
.hv-talk[data-state=recording] { background: var(--danger); color: var(--on-ink); box-shadow: 0 0 0 6px var(--danger-soft); }
.hv-talk[data-state=sending] { opacity: .75; }
.hv-mic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; color: var(--ink2); flex: none; touch-action: none; }
.hv-mic svg { width: 17px; height: 17px; }
.hv-mic[data-state=recording] { background: var(--danger); color: var(--on-ink); }
.hv-live-veil { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(12, 18, 28, .38); backdrop-filter: grayscale(.6) blur(2px);
  opacity: 0; pointer-events: none; transition: opacity .5s ease; z-index: 5; }
.hv-live-veil.on { opacity: 1; }
.hv-live-veil:not(.on) { visibility: hidden; }
.hv-live-veil * { pointer-events: none !important; }
.hv-live-veil div { padding: 14px 22px; border-radius: 18px; font-weight: 560; font-size: 15px; }
.hv-bs { display: none; gap: 8px; padding: 12px 16px 16px; border-top: 1px solid var(--hair); }
.hv-bs.on { display: grid; }
.hv-bs h4 { margin: 0 0 2px; font-size: 11px; font-weight: 620; letter-spacing: .06em; text-transform: uppercase; color: var(--ink3); }
.hv-bs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hv-bs-btn { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 0 10px; border-radius: 12px; font: inherit;
  font-size: 13px; font-weight: 560; color: var(--ink); background: var(--fill); border: 1px solid var(--hair); cursor: pointer; user-select: none; touch-action: none; }
.hv-bs-btn svg { width: 16px; height: 16px; flex: none; }
.hv-bs-btn[data-state=recording] { background: var(--danger); border-color: var(--danger); color: var(--on-ink); box-shadow: 0 0 0 5px var(--danger-soft); }
.hv-bs-btn[data-state=sending] { opacity: .7; }
.hv-bs-btn.go { background: var(--accent); border-color: var(--accent); color: var(--on-ink); }
.hv-bs-btn:disabled { opacity: .55; cursor: default; }
.hv-bs-note { font-size: 12px; color: var(--ink3); }
.hv-bs-type { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; }
.hv-bs-type input { min-width: 0; height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--hair); background: var(--fill); color: var(--ink); font: inherit; font-size: 12.5px; }
.hv-bs-type button { height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--hair); background: var(--fill); color: var(--ink2); font: inherit; font-size: 12px; cursor: pointer; }
.hv-agentbox.hv-chat { height: auto; max-height: min(560px, calc(100vh - 190px)); }
.hv-agentbox.hv-chat .hv-feed-pad { flex: 0 0 4px; }
.hv-agentbox.hv-chat .hv-crew .hv-ag { cursor: pointer; }
.hv-agentbox.hv-chat .hv-crew .hv-ag:hover { transform: translateY(-2px) scale(1.07); }
`;
const WALK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6 2.5 2.5V21M8 12l3-4.5 4 1.5 2 3.5M11 7.5L9.5 13"/></svg>';
const BED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/></svg>';

export function mountLive(ui) {
  const { twin, root } = ui;
  const { live } = twin;
  root.append(el(`<style>${CSS}</style>`));

  // Top centre: connection + who is on shift.
  const tc = el(`<div class="hv-tc"><div class="hv-live-pill hv-glass hv-enter" role="status" data-s="connecting"><i></i><span></span><small></small>
    <div class="hv-live-tech"><span data-t="actors" title="Every patient, ward and floor is an actor with its own memory and alarms">Actors</span></div></div></div>`);
  root.append(tc);
  const pill = tc.firstElementChild, line = pill.querySelector('span'), sub = pill.querySelector('small');

  const veil = el(`<div class="hv-live-veil" aria-hidden="true"><div class="hv-glass">Reconnecting to the actors…</div></div>`);
  root.append(veil);

  const nurseOn = (pod) => NURSES[live.nurse[pod]];
  function render() {
    const s = live.status;
    pill.dataset.s = s;
    line.textContent = s === 'live' ? 'Live' : s === 'reconnecting' ? 'Reconnecting…' : s === 'offline' ? 'Backend offline' : 'Connecting…';
    const n = nurseOn('pod-a');
    sub.textContent = s === 'offline' ? `start the voice service at ${live.api}` : n ? `${n.shift} shift · ${n.short} on ${PODS['pod-a'].name}` : `${PODS['pod-a'].name} · no nurse signed in`;
    veil.classList.toggle('on', s === 'reconnecting');
  }
  live.onChange = render;
  const tech = (h) => {
    const on = { actors: !!h?.ok };
    for (const n of tc.querySelectorAll('[data-t]')) { n.classList.toggle('on', !!on[n.dataset.t]); n.title = n.title.replace(/ \((live|not connected)\)$/, '') + (on[n.dataset.t] ? ' (live)' : ' (not connected)'); }
  };
  const pollHealth = () => fetch(`${live.api}/health`).then((r) => r.json()).then(tech).catch(() => tech(null));
  pollHealth();
  setInterval(pollHealth, 10000);
  render();

  // Bottom left: hold to talk (voice note to the Nurse Agent), beside Ask.
  const bottom = root.querySelector('.hv-bottom');
  const left = el(`<div class="hv-live-left"></div>`);
  bottom.replaceChild(left, ui.ask.pill);
  const talk = el(`<button type="button" class="hv-ask hv-talk hv-glass hv-enter hv-press" data-state="idle" aria-label="Hold to talk to the Nurse Agent">${MIC}<span>Hold to talk</span></button>`);
  left.append(talk, ui.ask.pill);
  const label = talk.querySelector('span');
  const nurseId = (pod = 'pod-a') => live.nurse[pod] ?? (pod === 'pod-b' ? 'sam' : 'maya');
  const orbs = mountOrbs(ui);
  const overlay = mountOverlay(ui);
  const speakerName = (id) => (id?.startsWith('bedside-') ? `${twin.profile(id.slice(8))?.name ?? 'Patient'}` : NURSES[id]?.short ?? 'Nurse');
  twin.on('heard', (e) => overlay.caption.thinking(speakerName(e.who), e.text, live.label(e.agent)));
  // A Twin that decides the nurse must come sends her: she walks to the bed while the overlay explains why.
  twin.on('insight', (e) => {
    if (e.role === 'patient' && (e.level === 'urgent' || e.level === 'soon') && e.room && !twin.bedside(e.room)) twin.sendNurse(e.room);
  });

  // The clock capsule moves the backend's night only during a real gesture on it: a held pointer on the
  // capsule, a key pressed on the slider, or Space (pause). Anything else that calls the setters is ignored.
  const capsule = root.querySelector('.hv-clock');
  let pressing = false, keyUntil = 0;
  capsule?.addEventListener('pointerdown', () => { pressing = true; }, true);
  addEventListener('pointerup', () => { pressing = false; }, true);
  addEventListener('pointercancel', () => { pressing = false; }, true);
  addEventListener('blur', () => { pressing = false; });
  capsule?.addEventListener('click', () => { keyUntil = performance.now() + 50; }, true);
  capsule?.addEventListener('keydown', () => { keyUntil = performance.now() + 50; }, true);
  addEventListener('keydown', (e) => {
    if (e.key === ' ' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) keyUntil = performance.now() + 50;
  }, true);
  live.clockGesture = () => pressing || performance.now() < keyUntil;
  const toast = (title, detail) => ui.toasts.show({ id: `lv-${Date.now()}`, severity: 'watch', title, detail });
  // Server speech-to-text when the voice service has it (OpenAI key); otherwise Chrome's own recogniser.
  fetch(`${live.api}/health`).then((r) => r.json()).then(setServerVoice).catch(() => {});
  const heard = (s) => (s.length > 34 ? `…${s.slice(-33)}` : s);
  pushToTalk(talk, {
    path: () => `/voice/nurse?podId=pod-a&nurseId=${encodeURIComponent(nurseId())}`,
    onState: (s) => {
      talk.dataset.state = s;
      label.textContent = s === 'recording' ? 'Listening…' : s === 'sending' ? 'Sending…' : 'Hold to talk';
      orbs.listen('nurse-pod-a', s === 'recording');
    },
    onInterim: (t) => { if (t) { label.textContent = `“${heard(t)}”`; overlay.caption.hearing(speakerName(nurseId()), t); } },
    onError: (err) => toast('Voice note not sent', err.message),
  });

  // ── Camera that keeps a walking person in frame ─────────────────────────────
  let followTimer = null;
  function follow(id, { ms = 8000, until } = {}) {
    clearInterval(followTimer);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const a = ui.actor(id), at = a && ui.locate('person', id);
        if (!a || a.hidden || a.floor !== 1 || !at || performance.now() - t0 > ms || until?.()) {
          clearInterval(followTimer); followTimer = null; resolve(); return;
        }
        ui.engine.flyTo?.({ x: at.x, y: at.y ?? 0, z: at.z, zoom: ui.zoomFor('person'), duration: 0.85 });
      };
      step();
      followTimer = setInterval(step, 800);
    });
  }

  // ── Shift change: zoom in on the night nurse leaving, the day nurse arriving, then the briefing ──
  const arrived = new Set();
  twin.on('arrived', ({ actorId }) => arrived.add(actorId));
  twin.on('handover', async ({ outId, inId }) => {
    ui.select({ type: 'person', id: outId });
    await follow(outId, { ms: 7000 });
    ui.select({ type: 'person', id: inId }, { fly: false });
    await follow(inId, { ms: 25000, until: () => arrived.has(inId) });
    ui.select({ type: 'person', id: inId });
  });
  // ── Only the rooms the story uses stay open: the rest become closed, roofed blocks ──
  const plate = ui.engine.floors?.[1];
  if (plate) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9d2ca, roughness: 0.95 });
    for (const id of CLOSED_ROOMS) {
      const r = roomById(id)?.rect;
      if (!r) continue;
      const h = 2.7, inset = 0.14;
      const block = new THREE.Mesh(new THREE.BoxGeometry(r.w - inset * 2, h, r.d - inset * 2), mat);
      block.position.set(r.x + r.w / 2, h / 2, r.z + r.d / 2);
      block.castShadow = block.receiveShadow = true;
      block.userData.dynamic = true;
      plate.add(block);
      // Catch clicks so they don't fall through to the closed room's beds; 'closed' opens nothing.
      ui.engine.addPickable?.(block, { type: 'closed', id, floor: 1 });
    }
  }
  // Open on the pods, not the whole hospital: Pod A and Pod B with the corridor between them.
  // The dock's home button comes back here too.
  const wardView = (duration = 1.4) => ui.engine.flyTo?.({ x: 11, y: ui.engine.floorY?.(1) ?? FLOOR_HEIGHT, z: 7.5, zoom: 2.05, duration });
  ui.engine.resetView = () => wardView();
  live.wardView = wardView;
  const settle = setInterval(() => {
    if (!window.__ready || ui.engine.introActive || ui.welcome?.active) return;
    clearInterval(settle);
    wardView(1.6);
    // The first frames can still re-home the camera; look again once things settle.
    setTimeout(() => { if ((ui.engine.zoom ?? 1) < 1.4 && !ui.inspector.isOpen) wardView(1.2); }, 2200);
  }, 250);

  // Clicking an agent's avatar (in the scene or the Agent network) opens what that agent looks after.
  live.focusAgent = (k) => {
    if (k.startsWith('twin-')) { const id = twin.bedOf(k.slice(5)); if (id) ui.select({ type: 'bed', id }); }
    else if (k.startsWith('nurse-')) { const ward = PODS[k.slice(6)]?.ward; if (ward) ui.select({ type: 'room', id: ward }); }
  };

  // When the agents start talking, the conversation shows itself.
  twin.on('relay', () => { if (!ui.agents.isOpen) ui.agents.open?.(); });

  const story = mountStory(ui, { follow });

  let shifting = false;
  live.actions = {
    story(btn) { if (story.playing) story.stop(); else story.play(btn); },
    async shift(btn) {
      if (shifting) return;
      shifting = true;
      btn.disabled = true;
      const out = twin.nurseOf('pod-a');
      if (out) ui.select({ type: 'person', id: out.id });
      try {
        await postJSON('/director/handoff');
      } catch (err) {
        toast('Shift change failed', err.message);
      } finally {
        setTimeout(() => { shifting = false; btn.disabled = false; }, 4000);
      }
    },
  };

  // ── Bedside: under a live patient's bed panel, the patient and the nurse can both talk ──
  const panel = root.querySelector('.hv-insp-in');
  const bs = el(`<div class="hv-bs" aria-label="Bedside">
    <h4>Bedside</h4>
    <button type="button" class="hv-bs-btn" data-who="patient" data-state="idle">${BED}<span></span></button>
    <div class="hv-bs-row">
      <button type="button" class="hv-bs-btn go" data-act="send">${WALK}<span></span></button>
      <button type="button" class="hv-bs-btn" data-who="nurse" data-state="idle">${MIC}<span></span></button>
    </div>
    <div class="hv-bs-note"></div>
    <div class="hv-bs-type"><input type="text" placeholder="Or type what they say" aria-label="Type instead of talking" />
      <button type="button" data-send="patient"></button><button type="button" data-send="nurse"></button></div>
  </div>`);
  panel.append(bs);
  const [patientBtn, sendBtn, nurseBtn] = [bs.querySelector('[data-who=patient]'), bs.querySelector('[data-act=send]'), bs.querySelector('[data-who=nurse]')];
  const note = bs.querySelector('.hv-bs-note'), typed = bs.querySelector('input');
  let room = null;

  const first = (name) => String(name ?? '').split(' ')[0];
  const nurseName = () => NURSES[nurseId(podOfRoom(room))]?.short ?? 'the nurse';
  function currentRoom() {
    const cur = ui.inspector.current;
    if (!cur) return null;
    if (cur.type === 'bed') return twin.roomOfBed(cur.id);
    if (cur.type === 'person') { const a = ui.actor(cur.id); return a?._live ?? null; }
    return null;
  }
  function renderBedside() {
    room = currentRoom();
    bs.classList.toggle('on', !!room);
    if (!room) return;
    const who = first(twin.profile(room)?.name), nurse = nurseName(), visit = twin.bedside(room);
    if (patientBtn.dataset.state === 'idle') patientBtn.querySelector('span').textContent = `Hold to talk as ${who}`;
    if (nurseBtn.dataset.state === 'idle') nurseBtn.querySelector('span').textContent = `Hold to talk as ${nurse}`;
    sendBtn.querySelector('span').textContent = visit ? (visit.arrived ? `${nurse} is here` : `${nurse} is on the way…`) : `Send ${nurse} over`;
    sendBtn.disabled = !!visit;
    note.textContent = visit?.arrived
      ? `${nurse} is at the bedside. Everything said goes to ${roomLabel(room)}'s Twin and the Nurse Agent.`
      : `${roomLabel(room)}'s Twin listens to ${who} and escalates to the Nurse Agent when it matters.`;
    bs.querySelector('[data-send=patient]').textContent = `as ${who}`;
    bs.querySelector('[data-send=nurse]').textContent = `as ${nurse}`;
  }
  setInterval(renderBedside, 300);

  sendBtn.addEventListener('click', () => {
    if (!room) return;
    const nurse = twin.sendNurse(room);
    if (!nurse) return toast('Can’t reach the bedside', 'No nurse is on shift for this pod.');
    const target = room;
    renderBedside();
    follow(nurse.id, { ms: 30000, until: () => twin.bedside(target)?.arrived }).then(() => {
      const bedId = twin.bedOf(target);
      if (bedId) ui.select({ type: 'bed', id: bedId });
    });
  });

  const voicePath = (who) => (who === 'patient'
    ? `/voice/bedside?room=${room}`
    : `/voice/nurse?podId=${podOfRoom(room)}&nurseId=${encodeURIComponent(nurseId(podOfRoom(room)))}&room=${room}`);
  for (const btn of [patientBtn, nurseBtn]) {
    const who = btn.dataset.who;
    pushToTalk(btn, {
      path: () => voicePath(who),
      onState: (s) => {
        btn.dataset.state = s;
        if (s !== 'idle') btn.querySelector('span').textContent = s === 'recording' ? `${roomLabel(room)} ${who === 'patient' ? 'Twin' : 'Nurse Agent'} is listening…` : 'Sending…';
        // The agent that hears this voice glows while it listens.
        orbs.listen(who === 'patient' ? `twin-${room}` : `nurse-${podOfRoom(room)}`, s === 'recording');
        if (s === 'idle') renderBedside();
      },
      onInterim: (t) => { if (t) { btn.querySelector('span').textContent = `“${heard(t)}”`; overlay.caption.hearing(who === 'patient' ? speakerName(`bedside-${room}`) : speakerName(nurseId(podOfRoom(room))), t); } },
      // The Twin answers the patient out loud, so the bedside feels heard.
      onResult: (r) => { if (who === 'patient' && r.reply) live.speaker.speak(r.reply, r.audioUrl, 'twin'); },
      onError: (err) => toast('Not sent', err.message),
    });
  }
  for (const b of bs.querySelectorAll('[data-send]')) {
    b.addEventListener('click', async () => {
      const text = typed.value.trim();
      if (!text || !room) return;
      typed.value = '';
      try {
        const r = await postJSON(voicePath(b.dataset.send), { text });
        if (b.dataset.send === 'patient' && r.reply) live.speaker.speak(r.reply, r.audioUrl, 'twin');
      } catch (err) { toast('Not sent', err.message); }
    });
  }
  typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') bs.querySelector('[data-send=patient]').click(); });

  // Ask box: hold the mic to ask out loud. The Nurse Agent answers in text and speech.
  const form = root.querySelector('.hv-askbox form');
  const mic = el(`<button type="button" class="hv-mic hv-press" data-state="idle" aria-label="Hold to ask out loud">${MIC}</button>`);
  form.insertBefore(mic, form.querySelector('.hv-send'));
  pushToTalk(mic, {
    path: () => `/voice/ask?podId=pod-a&nurseId=${encodeURIComponent(nurseId())}`,
    onState: (s) => { mic.dataset.state = s; },
    onResult: (r) => { twin.rememberVoiceAnswer(r); ui.ask.ask(r.question); },
    onError: (err) => ui.toasts.show({ id: `ask${Date.now()}`, severity: 'watch', title: 'Question not sent', detail: err.message }),
  });

  // The entrance animation reveals .hv-enter panels once, possibly before these existed. Join it, or catch up.
  const join = setInterval(() => {
    if (!root.querySelector('.hv-enter.in')) return;
    clearInterval(join);
    for (const n of [pill, talk]) { n.classList.add('in'); setTimeout(() => n.classList.add('done'), 1300); }
  }, 150);
}
