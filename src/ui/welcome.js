// The first ten seconds. One line, one sentence, two choices. Anything else simply lets you in.
import { el } from './util.js';
import { icons as I } from './icons.js';

export function createWelcome(ui, { onTour, onLook }) {
  const words = ['Your', 'hospital,', 'alive.'];
  const node = el(`<div class="hv-welcome" role="dialog" aria-label="Welcome to Sanjeevani">
    <div class="hv-welcome-in">
      <h1>${words.map((w, i) => `<span style="--i:${i}">${w}</span>`).join(' ')}</h1>
      <p>Every bed, every patient, every team, in one calm picture.</p>
      <div class="hv-welcome-a">
        <button type="button" class="hv-btn pri hv-press" data-a="tour">Take the 60-second tour ${I.go}</button>
        <button type="button" class="hv-btn sec hv-press" data-a="look">Look around myself</button>
      </div>
    </div>
  </div>`);
  ui.root.append(node);
  let gone = false;

  function bye() {
    if (gone) return;
    gone = true;
    removeEventListener('wheel', any);
    removeEventListener('keydown', onKey, true);
    node.classList.add('bye');
    setTimeout(() => node.remove(), 1100);
  }
  const any = () => { bye(); onLook(); };
  const onKey = (e) => {
    if (e.key === 'Tab') return;
    if (e.key === 'Enter' && document.activeElement?.closest?.('.hv-welcome')) return;
    bye(); onLook();
  };
  node.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) any(); });
  node.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    bye();
    b.dataset.a === 'tour' ? onTour() : onLook();
  });
  addEventListener('wheel', any, { passive: true, once: true });
  addEventListener('keydown', onKey, true);
  return { get active() { return !gone; }, dismiss: bye };
}
