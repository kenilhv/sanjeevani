// "Ask the hospital": a calm command box. Answers type themselves out, then the camera goes there.
import { el, esc } from './util.js';
import { icons as I } from './icons.js';

const SUGGESTIONS = ['How many beds are free?', 'Who needs attention?', 'How long is the emergency wait?', 'Is the MRI okay?', 'Which ward is busiest?'];
const CPS = 52;

export function createAsk(ui) {
  const { twin, root, shell } = ui;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  // Live mode asks the pod's Nurse Agent, which asks the right Patient Twin when it needs details.
  const blurb = twin.live ? 'The Nurse Agent answers, asking a patient’s Twin when it needs to. Hold the mic to ask out loud.' : 'Anything you would normally phone around for.';
  const pill = el(`<button type="button" class="hv-ask hv-glass hv-enter hv-press" aria-label="Ask the hospital">${I.spark}<span>Ask the hospital</span><kbd class="hv-kbd">${mac ? '⌘K' : 'Ctrl K'}</kbd></button>`);
  const box = el(`<div class="hv-askbox hv-glass" role="dialog" aria-label="Ask the hospital">
    <h3>Ask the hospital</h3>
    <p>${esc(blurb)}</p>
    <div class="hv-ask-log hv-scroll"></div>
    <div class="hv-sugg">${(twin.suggestions ?? SUGGESTIONS).map((s) => `<button type="button" class="hv-press">${esc(s)}</button>`).join('')}</div>
    <form class="hv-field">${I.spark}<input type="text" placeholder="Ask in your own words" aria-label="Your question" autocomplete="off" spellcheck="false" />
      <button type="submit" class="hv-send hv-press" aria-label="Ask">${I.send}</button></form>
  </div>`);
  root.append(box);
  const log = box.querySelector('.hv-ask-log'), input = box.querySelector('input'), form = box.querySelector('form');
  let open = false, typing = null, glow = [], glowTimer;

  const setOpen = (v) => {
    open = v;
    box.classList.toggle('open', v);
    if (v) { ui.onLayerOpen?.('ask'); setTimeout(() => input.focus({ preventScroll: true }), 60); } else input.blur();
    return true;
  };
  pill.addEventListener('click', () => setOpen(!open));
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.value = ''; ask(q); } });
  box.querySelector('.hv-sugg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });

  function reveal(node, text, done) {
    clearInterval(typing);
    if (ui.calm()) { node.textContent = text; done(); return; }
    const t0 = performance.now();
    node.classList.add('typing');
    typing = setInterval(() => {
      const n = Math.min(text.length, Math.floor(((performance.now() - t0) / 1000) * CPS));
      node.textContent = text.slice(0, n);
      log.scrollTop = log.scrollHeight;
      if (n >= text.length) { clearInterval(typing); node.classList.remove('typing'); done(); }
    }, 24);
  }
  function highlight(ids) {
    clearTimeout(glowTimer);
    ui.clearAskTint(glow);
    glow = ids.filter(Boolean);
    ui.askTint(glow);
    glowTimer = setTimeout(() => { ui.clearAskTint(glow); glow = []; }, 7000);
  }
  function go(r) {
    const f = r?.focus;
    if (r?.highlights?.length) highlight(r.highlights);
    if (!f) return;
    if (f.bedId) ui.select({ type: 'bed', id: f.bedId });
    else if (f.actorId) ui.select({ type: 'person', id: f.actorId });
    else if (f.roomId) { ui.select({ type: 'room', id: f.roomId }); shell.highlightRoom?.(f.roomId); }
  }
  async function ask(q) {
    const qa = el(`<div class="hv-qa"><div class="hv-qa-q">${esc(q)}</div><div class="hv-qa-a typing"></div></div>`);
    while (log.children.length >= 2) log.firstElementChild.remove();
    log.append(qa);
    log.scrollTop = log.scrollHeight;
    let r;
    try { r = await twin.ask?.(q); } catch { r = null; }
    const a = qa.querySelector('.hv-qa-a');
    const fallback = twin.live ? 'The Nurse Agent isn’t reachable right now. Check that the voice service is running.' : "I'm not sure about that one yet. Try asking about beds, waits, staff or equipment.";
    reveal(a, r?.answer || fallback, () => go(r));
  }
  return {
    pill, ask,
    toggle: () => setOpen(!open),
    open: () => setOpen(true),
    close: () => (open ? setOpen(false) : false),
    get isOpen() { return open; },
  };
}
