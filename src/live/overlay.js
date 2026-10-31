// What the agents are thinking, made visible. When a nurse or a patient says something:
//   1. a caption shows the words as they are heard, then "the Twin is thinking";
//   2. an overlay covers the floor for 10 seconds: what was said, what the agent picked up from it, what it is
//      doing, its decision, and the Nurse Agent and the Twin talking it through;
// and at shift handover, the report the Nurse Agent gives the incoming nurse. Hover to hold, click to close.
import { el, esc } from '../ui/util.js';
import { icons as I } from '../ui/icons.js';
import { C } from '../style/palette.js';
import { NURSES, PATIENTS, agentLabel, podOfRoom, roomLabel } from './config.js';

const SHOW_MS = 10000;
const CSS = `
.hv-cap { position: absolute; left: 50%; bottom: calc(var(--m) + var(--bottom-h) + 16px); transform: translate(-50%, 12px); max-width: min(720px, 80vw);
  display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-radius: 18px; opacity: 0; pointer-events: none; transition: opacity .3s ease, transform .4s var(--pop); z-index: 40; }
.hv-cap.on { opacity: 1; transform: translate(-50%, 0); }
.hv-cap b { font-size: 12px; color: var(--ink3); font-weight: 620; white-space: nowrap; }
.hv-cap q { font-size: 17px; line-height: 1.35; color: var(--ink); quotes: '\\201C' '\\201D'; }
.hv-cap small { display: block; font-size: 12px; color: var(--accent); margin-top: 2px; }
.hv-cap small::after { content: '…'; animation: hv-cap-dots 1.2s steps(4) infinite; display: inline-block; width: 1.2em; overflow: hidden; vertical-align: bottom; }
@keyframes hv-cap-dots { from { width: 0; } to { width: 1.2em; } }
.hv-ovl { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(14, 20, 32, .44); backdrop-filter: blur(3px); opacity: 0; pointer-events: none;
  transition: opacity .35s ease; z-index: 60; padding: 24px; }
.hv-ovl.on { opacity: 1; pointer-events: auto; }
.hv-ovl-card { width: min(880px, 94vw); max-height: 88vh; overflow: auto; border-radius: 26px; padding: 22px 26px 18px; transform: translateY(14px) scale(.98);
  transition: transform .5s var(--pop); position: relative; }
.hv-ovl.on .hv-ovl-card { transform: none; }
.hv-ovl-h { display: flex; gap: 14px; align-items: flex-start; }
.hv-ovl-h .hv-ag { width: 44px; height: 44px; }
.hv-ovl-h > div { flex: 1; min-width: 0; }
.hv-ovl-who { font-size: 12.5px; font-weight: 620; color: var(--ink3); letter-spacing: .02em; }
.hv-ovl-q { font-family: var(--serif); font-style: italic; font-size: 28px; line-height: 1.18; margin-top: 3px; color: var(--ink); }
.hv-ovl-grid { display: grid; grid-template-columns: 1fr 1.25fr; gap: 18px; margin-top: 18px; }
.hv-ovl h4 { margin: 0 0 8px; font-size: 11px; font-weight: 660; letter-spacing: .07em; text-transform: uppercase; color: var(--ink3); }
.hv-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hv-chips span { display: inline-flex; gap: 6px; padding: 5px 10px; border-radius: 10px; background: var(--fill); border: 1px solid var(--hair); font-size: 12.5px; color: var(--ink); }
.hv-chips span i { font-style: normal; color: var(--ink3); }
.hv-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.hv-steps li { display: flex; gap: 8px; font-size: 13.5px; line-height: 1.38; color: var(--ink); opacity: 0; transform: translateX(-6px); animation: hv-step-in .4s ease forwards; }
.hv-steps li::before { content: '✓'; color: var(--ok); font-weight: 700; flex: none; }
@keyframes hv-step-in { to { opacity: 1; transform: none; } }
.hv-dec { margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 12px; font-weight: 620; font-size: 14px; background: var(--fill); color: var(--ink); }
.hv-dec[data-l=urgent] { background: var(--danger); color: var(--on-ink); }
.hv-dec[data-l=soon] { background: #f2a93b; color: #1d1405; }
.hv-dec[data-l=resolved] { background: var(--ok); color: var(--on-ink); }
.hv-chat { margin-top: 16px; display: grid; gap: 8px; }
.hv-bub { max-width: 82%; padding: 9px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.4; opacity: 0; transform: translateY(6px); animation: hv-step-in .45s ease forwards; }
.hv-bub small { display: block; font-size: 10.5px; font-weight: 640; letter-spacing: .03em; color: var(--ink3); margin-bottom: 2px; }
.hv-bub.q { justify-self: start; background: color-mix(in srgb, ${C.info} 22%, var(--fill)); border-bottom-left-radius: 5px; }
.hv-bub.a { justify-self: end; background: color-mix(in srgb, ${C.teal} 22%, var(--fill)); border-bottom-right-radius: 5px; }
.hv-ovl-foot { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 11.5px; color: var(--ink3); }
.hv-ovl-foot .bar { flex: 1; height: 3px; border-radius: 3px; background: var(--hair); overflow: hidden; }
.hv-ovl-foot .bar i { display: block; height: 100%; width: 100%; background: var(--accent); transform-origin: left; }
.hv-ovl .hv-x { position: absolute; top: 14px; right: 14px; }
.hv-ovl-card.rep { width: min(1060px, 95vw); padding: 24px 28px 18px; }
.hv-rep-top { display: flex; align-items: center; gap: 14px; }
.hv-rep-hand { display: flex; align-items: center; gap: 8px; }
.hv-rep-hand .hv-ag { width: 40px; height: 40px; }
.hv-rep-hand em { font-style: normal; color: var(--ink3); font-size: 20px; }
.hv-rep-title small { display: block; font-size: 11.5px; font-weight: 660; letter-spacing: .07em; text-transform: uppercase; color: var(--ink3); }
.hv-rep-title h2 { margin: 2px 0 0; font-family: var(--serif); font-style: italic; font-size: 30px; line-height: 1.1; }
.hv-rep-counts { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.hv-rep-counts span { font-size: 12px; font-weight: 640; padding: 4px 10px; border-radius: 999px; background: var(--fill); color: var(--ink2); }
.hv-rep-counts span.u { background: var(--danger-soft); color: var(--danger); }
.hv-rep-counts span.w { background: #f2a93b2e; color: #b8740f; }
.hv-rep-counts span.s { background: var(--ok-soft); color: var(--ok); }
.hv-rep-spoken { margin-top: 14px; padding: 12px 16px; border-radius: 14px; border-left: 4px solid var(--accent); background: var(--fill);
  font-size: 15px; line-height: 1.5; color: var(--ink); }
.hv-rep-spoken::before { content: 'Nurse Agent, spoken'; display: block; font-size: 10.5px; font-weight: 680; letter-spacing: .07em; text-transform: uppercase; color: var(--accent); margin-bottom: 3px; }
.hv-rep-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 14px; }
.hv-rep-room { --c: var(--ok); padding: 14px 16px; border-radius: 18px; background: var(--fill); border: 1px solid var(--hair); border-top: 4px solid var(--c); }
.hv-rep-room[data-s=watcher] { --c: #e59a2a; }
.hv-rep-room[data-s=unstable] { --c: var(--danger); }
.hv-rep-room header { display: flex; align-items: center; gap: 8px; }
.hv-rep-room header b { font-size: 15px; }
.hv-rep-room header i { font-style: normal; color: var(--ink3); font-size: 13px; }
.hv-rep-room header span { margin-left: auto; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px;
  color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
.hv-rep-sum { margin: 5px 0 0; font-size: 12.5px; color: var(--ink2); line-height: 1.4; }
.hv-rep-said { margin-top: 10px; padding: 8px 11px; border-radius: 12px; background: color-mix(in srgb, ${C.coral} 16%, transparent); font-size: 12.5px; line-height: 1.4; }
.hv-rep-said b { display: flex; align-items: center; gap: 5px; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: ${C.coralDeep ?? C.coral}; margin-bottom: 3px; }
.hv-rep-said b svg { width: 13px; height: 13px; }
.hv-rep-said p { margin: 2px 0 0; }
.hv-rep-h { margin: 11px 0 5px; font-size: 10.5px; font-weight: 680; letter-spacing: .07em; text-transform: uppercase; color: var(--ink3); }
.hv-rep-tl { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.hv-rep-tl li { display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 12.5px; line-height: 1.38; }
.hv-rep-tl time { font: 600 11.5px var(--mono, ui-monospace, monospace); color: var(--ink3); padding-top: 1px; }
.hv-rep-todo { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.hv-rep-todo li { display: flex; gap: 7px; font-size: 12.5px; line-height: 1.38; }
.hv-rep-todo li::before { content: ''; flex: none; width: 12px; height: 12px; margin-top: 2px; border-radius: 4px; border: 1.5px solid var(--ink3); }
.hv-rep-watch { margin-top: 10px; display: flex; gap: 7px; padding: 7px 10px; border-radius: 10px; background: #f2a93b22; font-size: 12.5px; line-height: 1.38; color: var(--ink); }
.hv-rep-watch::before { content: '▲'; color: #e59a2a; font-size: 10px; margin-top: 2px; }
@media (max-width: 760px) { .hv-ovl-grid { grid-template-columns: 1fr; } }
.hv-ovl:not(.on), .hv-cap:not(.on) { visibility: hidden; }
.hv-ovl:not(.on) *, .hv-cap, .hv-cap * { pointer-events: none !important; }
`;

const LEVEL_ICON = { urgent: 'pulse', soon: 'bell', resolved: 'heart', fyi: 'spark', none: 'spark' };

export function mountOverlay(ui) {
  const { root, twin } = ui;
  root.append(el(`<style>${CSS}</style>`));

  // ── Caption: the words as they are heard, then the agent thinking ───────────
  const cap = el(`<div class="hv-cap hv-glass" role="status"><b></b><div><q></q><small></small></div></div>`);
  root.append(cap);
  let capTimer;
  const caption = {
    hearing(who, text) {
      clearTimeout(capTimer);
      cap.querySelector('b').textContent = who;
      cap.querySelector('q').textContent = text || '…';
      cap.querySelector('small').textContent = '';
      cap.classList.add('on');
    },
    thinking(who, text, agent) {
      clearTimeout(capTimer);
      cap.querySelector('b').textContent = who;
      cap.querySelector('q').textContent = text;
      cap.querySelector('small').textContent = `${agent} is thinking`;
      cap.classList.add('on');
      capTimer = setTimeout(() => cap.classList.remove('on'), 25000);
    },
    hide(ms = 0) { clearTimeout(capTimer); capTimer = setTimeout(() => cap.classList.remove('on'), ms); },
  };

  // ── Overlay ────────────────────────────────────────────────────────────────
  const ovl = el(`<div class="hv-ovl" aria-live="polite"><div class="hv-ovl-card hv-glass" role="dialog" aria-modal="false"></div></div>`);
  root.append(ovl);
  const card = ovl.firstElementChild;
  let hideAt = 0, held = false, raf = 0, queue = [];
  const close = () => { ovl.classList.remove('on'); cancelAnimationFrame(raf); setTimeout(next, 450); };
  ovl.addEventListener('click', (e) => { if (e.target === ovl || e.target.closest('.hv-x')) close(); });
  card.addEventListener('pointerenter', () => { held = true; });
  card.addEventListener('pointerleave', () => { held = false; });
  function countdown() {
    const bar = card.querySelector('.bar i');
    let last = performance.now();
    const step = (now) => {
      if (held) hideAt += now - last;
      last = now;
      const left = Math.max(0, hideAt - now);
      if (bar) bar.style.transform = `scaleX(${left / SHOW_MS})`;
      if (left <= 0) return close();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function show(html) {
    card.classList.remove('rep');
    card.innerHTML = html;
    ovl.classList.add('on');
    hideAt = performance.now() + SHOW_MS;
    cancelAnimationFrame(raf);
    countdown();
  }
  function next() {
    if (ovl.classList.contains('on') || !queue.length) return;
    queue.shift()();
  }
  const enqueue = (fn) => { queue.push(fn); if (queue.length > 3) queue.shift(); next(); };

  const whoOf = (id) => {
    const s = String(id ?? '');
    if (s.startsWith('bedside-')) { const r = s.slice(8); return `${PATIENTS[r]?.name ?? 'Patient'} · ${roomLabel(r)} patient`; }
    const n = NURSES[s];
    return n ? `${n.name} · ${n.shift.toLowerCase()} nurse` : agentLabel(s);
  };
  const avatar = (role) => `<span class="hv-ag" style="--t:${role === 'patient' ? C.coral : C.info}">${I[role === 'patient' ? 'user' : 'people']}</span>`;
  const brainNote = (b) => 'Live from the actors';

  function insightHtml(e) {
    const agent = agentLabel(e.agent);
    // In every exchange the pod's Nurse Agent asks and the room's Twin answers from its patient's record.
    const asker = agentLabel(`nurse-${podOfRoom(e.room) ?? 'pod-a'}`), answerer = e.room ? `${roomLabel(e.room)} Twin` : 'Twin';
    const chat = (e.chat ?? []).flatMap((x, i) => [
      `<div class="hv-bub q" style="animation-delay:${0.9 + i * 1.6}s"><small>${esc(asker)} asks</small>${esc(x.question)}</div>`,
      `<div class="hv-bub a" style="animation-delay:${1.7 + i * 1.6}s"><small>${esc(answerer)}</small>${esc(x.answer)}</div>`,
    ]).join('');
    return `<button type="button" class="hv-x hv-press" aria-label="Close">${I.x}</button>
      <div class="hv-ovl-h">${avatar(e.role)}<div><div class="hv-ovl-who">${esc(whoOf(e.who))} said${e.simTime ? ` · ${esc(e.simTime)}` : ''}</div>
        <div class="hv-ovl-q">“${esc(e.transcript)}”</div></div></div>
      <div class="hv-ovl-grid">
        <section><h4>What ${esc(agent)} picked up</h4><div class="hv-chips">${(e.picked ?? []).map((p) => `<span><i>${esc(p.label)}</i>${esc(p.value)}</span>`).join('') || '<span>Nothing specific yet</span>'}</div></section>
        <section><h4>What it’s doing</h4><ol class="hv-steps">${(e.actions ?? []).map((a, i) => `<li style="animation-delay:${0.15 + i * 0.22}s">${esc(a)}</li>`).join('')}</ol></section>
      </div>
      <div class="hv-dec" data-l="${esc(e.level)}">${I[LEVEL_ICON[e.level] ?? 'spark']}${esc(e.decision)}</div>
      ${chat ? `<section class="hv-chat"><h4>${esc(asker)} ⇄ ${esc(answerer)}</h4>${chat}</section>` : ''}
      <div class="hv-ovl-foot"><span>${brainNote(e.brain)}</span><span class="bar"><i></i></span><span>hover to hold</span></div>`;
  }

  // "23:30 Zolpidem 5 mg given" → [time, text]; items without a leading time keep the text whole.
  const split = (line) => { const m = String(line).match(/^\s*(\d{1,2}:\d{2})\s*[-–—:]?\s*(.*)$/); return m ? [m[1], m[2]] : ['', String(line)]; };
  const RANK = { unstable: 0, watcher: 1, stable: 2 };
  function reportHtml(r) {
    const sections = [...(r.sections ?? [])].sort((a, b) => (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3));
    const count = (st) => sections.filter((s) => s.status === st).length;
    const from = NURSES[r.from], to = NURSES[r.to];
    const rooms = sections.map((s) => {
      const said = s.patientSaid?.length
        ? `<div class="hv-rep-said"><b>${I.user}Patient said</b>${s.patientSaid.slice(-3).map((x) => `<p>${esc(x)}</p>`).join('')}</div>` : '';
      const night = (s.overnight ?? []).filter((o) => !/patient said/i.test(o)).slice(-4);
      const tl = night.length ? `<div class="hv-rep-h">Tonight</div><ul class="hv-rep-tl">${night.map((o) => { const [t, x] = split(o); return `<li><time>${esc(t)}</time><span>${esc(x)}</span></li>`; }).join('')}</ul>` : '';
      const todo = s.todo?.length ? `<div class="hv-rep-h">To do</div><ul class="hv-rep-todo">${s.todo.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
      const name = String(s.patient ?? '').split(',')[0];
      return `<article class="hv-rep-room" data-s="${esc(s.status)}">
        <header><b>${esc(roomLabel(s.room))}</b><i>${esc(name)}</i><span>${esc(s.status === 'unstable' ? 'See first' : s.status === 'watcher' ? 'Watch' : 'Stable')}</span></header>
        <p class="hv-rep-sum">${esc(s.summary ?? '')}</p>${said}${tl}${todo}
        ${s.watchFor ? `<div class="hv-rep-watch">${esc(s.watchFor)}</div>` : ''}</article>`;
    }).join('');
    return `<button type="button" class="hv-x hv-press" aria-label="Close">${I.x}</button>
      <div class="hv-rep-top">
        <div class="hv-rep-hand"><span class="hv-ag" style="--t:${C.info}">${I.moon}</span><em>→</em><span class="hv-ag" style="--t:${C.watch}">${I.sun}</span></div>
        <div class="hv-rep-title"><small>Shift handover · ${esc(agentLabel(`nurse-${r.pod}`))}</small><h2>${esc(from?.short ?? 'Night nurse')} to ${esc(to?.short ?? 'day nurse')}</h2></div>
        <div class="hv-rep-counts">${count('unstable') ? `<span class="u">${count('unstable')} see first</span>` : ''}${count('watcher') ? `<span class="w">${count('watcher')} to watch</span>` : ''}${count('stable') ? `<span class="s">${count('stable')} stable</span>` : ''}</div>
      </div>
      <div class="hv-rep-spoken">${esc(r.spoken ?? '')}</div>
      <div class="hv-rep-grid">${rooms}</div>
      <div class="hv-ovl-foot"><span>Built from every note, bedside conversation and flag tonight</span><span class="bar"><i></i></span><span>hover to hold</span></div>`;
  }

  twin.on('insight', (e) => { caption.hide(); enqueue(() => show(insightHtml(e))); });
  twin.on('report', (r) => enqueue(() => { show(reportHtml(r)); card.classList.add('rep'); }));
  return { caption, close };
}
