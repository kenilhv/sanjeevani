// "Play the story": the night told end to end on the live system, about two minutes, with a narration card that
// says what is happening and why it matters. Every step drives the real backend (Director, voice endpoints), so the
// agents, alerts, beams and chat are the same ones a nurse would see. Stop at any time; Skip moves to the next beat.
import { el } from '../ui/util.js';
import { postJSON } from './connection.js';

// Each agent overlay stays up 10 seconds; give the audience time to read it before the next beat.
const READ = 10500;

const CSS = `
.hv-story { position: absolute; left: 50%; top: calc(var(--m) + 58px); transform: translate(-50%, -8px); width: min(640px, calc(100vw - 2 * var(--m) - 560px));
  min-width: 340px; padding: 16px 20px 14px; border-radius: 22px; opacity: 0; pointer-events: none; transition: opacity .4s ease, transform .5s var(--pop); z-index: 4; }
.hv-story.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.hv-story:not(.on) { visibility: hidden; }
.hv-story:not(.on) * { pointer-events: none !important; }
.hv-story-top { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 640; letter-spacing: .07em; text-transform: uppercase; color: var(--ink3); }
.hv-story-top b { color: var(--accent); }
.hv-story-top span { flex: 1; }
.hv-story-top button { font: inherit; letter-spacing: 0; text-transform: none; font-size: 12px; font-weight: 560; color: var(--ink2); background: var(--fill);
  border: 1px solid var(--hair); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
.hv-story h3 { font-family: var(--serif); font-style: italic; font-size: 25px; line-height: 1.12; margin: 6px 0 4px; letter-spacing: -.01em; }
.hv-story p { font-size: 14px; line-height: 1.45; color: var(--ink2); margin: 0; }
.hv-story .why { margin-top: 9px; padding: 8px 11px; border-radius: 12px; font-size: 12.5px; line-height: 1.4; color: var(--ink); background: var(--fill); border-left: 3px solid var(--accent); }
.hv-story .why:empty { display: none; }
.hv-story-bar { height: 3px; border-radius: 3px; background: var(--hair); margin-top: 12px; overflow: hidden; }
.hv-story-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .6s ease; }
`;

export function mountStory(ui, { follow }) {
  const { twin, root } = ui;
  root.append(el(`<style>${CSS}</style>`));
  const card = el(`<div class="hv-story hv-glass" role="status" aria-live="polite">
    <div class="hv-story-top"><b></b><span></span><button type="button" data-a="skip">Skip ▸</button><button type="button" data-a="stop">Stop</button></div>
    <h3></h3><p></p><div class="why"></div><div class="hv-story-bar"><i></i></div></div>`);
  root.append(card);
  const [step, clock, title, body, why, bar] = ['b', 'span', 'h3', 'p', '.why', '.hv-story-bar i'].map((s) => card.querySelector(s));

  let run = 0, skip = null, skipped = false;
  const alive = (id) => id === run && !skipped;
  // A wait that Skip and Stop can cut short.
  const wait = (ms, id) => new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); skip = null; resolve(); }
    skip = done;
    if (!alive(id)) done();
  });
  const until = async (test, ms, id) => { const t0 = performance.now(); while (alive(id) && !test() && performance.now() - t0 < ms) await wait(250, id); };
  card.querySelector('[data-a=skip]').addEventListener('click', () => { skipped = true; skip?.(); });
  card.querySelector('[data-a=stop]').addEventListener('click', () => stop());

  const nurse = () => twin.live.nurse['pod-a'] ?? 'maya';
  const call = (path, data) => postJSON(path, data).catch((e) => console.warn('[story]', path, e.message));
  const note = (text) => call('/voice/nurse', { podId: 'pod-a', nurseId: nurse(), text });
  const bed = (room) => { const id = twin.bedOf(room); if (id) ui.select({ type: 'bed', id }); };
  const overview = () => { ui.clearSelection?.(); twin.live.wardView ? twin.live.wardView() : ui.engine.focusRoom?.('ward_a', {}); };

  // Each beat: what the audience sees, then why it matters.
  const BEATS = [
    {
      t: '7:00 pm', h: 'A night shift begins', p: 'Maya takes Ward A. Every patient has an AI Patient Twin that knows them deeply; the ward has a Nurse Agent that never clocks out.',
      why: 'Hospitals run 24 hours on 12-hour shifts. Twice a day, every patient’s whole story has to move from one head to another.',
      async run(id) { await call('/director/reset'); await call('/director/start-night'); overview(); await wait(7000, id); },
    },
    {
      t: '11:30 pm', h: 'The nurse just talks', p: '“Room 6, gave zolpidem 5 milligrams for sleep.” The Nurse Agent routes it to Room 6’s Twin, which checks it against everything it knows about Walter.',
      why: 'Walter is 81 with a Morse fall score of 65. Falls are the most common sentinel event: 42% of the 1,441 reviewed in 2022.',
      async run(id) {
        await call('/director/set-clock', { simTime: '23:30', speed: 1 }); bed('room-6'); await wait(1800, id);
        await note('Room 6, gave zolpidem 5 milligrams for sleep.'); await wait(READ, id);
        await note('Room 6, bed alarm is on.'); await wait(READ, id);
      },
    },
    {
      t: '2:00 am', h: 'The patient speaks, the Twin listens', p: 'Grace tells her bedside she feels shaky. Her Twin adds what only it knows: she’s diabetic and had insulin at 9 pm. The Nurse Agent moves Room 8 to the top of Maya’s list.',
      why: 'The bedside talks to the patient’s own Twin, so it can never leak another patient’s information.',
      async run(id) {
        await call('/director/set-clock', { simTime: '02:00', speed: 1 }); bed('room-8'); await wait(1500, id);
        await call('/voice/bedside', { room: 'room-8', text: 'I feel shaky and sweaty.' }); await wait(READ, id);
        // Her Twin already decided to call Maya and sent her; follow that walk (or send her if it didn't).
        const visit = twin.bedside('room-8');
        const n = visit ? ui.actor(visit.actorId) : twin.sendNurse('room-8');
        if (n) { await follow(n.id, { ms: 18000, until: () => twin.bedside('room-8')?.arrived || !alive(id) }); bed('room-8'); }
        await call('/voice/nurse', { podId: 'pod-a', nurseId: nurse(), room: 'room-8', text: 'Glucose is 62, giving her juice now.' });
        await wait(READ, id);
      },
    },
    {
      t: '3:30 am', h: 'An alarm catches the miss', p: 'Nobody charted Linda’s 3 am potassium. Her Twin’s alarm runs on the actor’s own clock, so it fires by itself, 30 minutes overdue, and asks.',
      why: 'Every patient is an actor with its own memory and alarms, so their story survives shift changes, restarts and crashes.',
      async run(id) {
        await call('/director/set-clock', { simTime: '03:10', speed: 600 }); bed('room-4');
        await until(() => twin.roomStatus('room-4') === 'urgent', 8000, id); await wait(4000, id);
        await note('Room 4, given at 3, forgot to chart.'); await wait(READ, id);
      },
    },
    {
      t: '4:00 am', h: 'Wards help each other', p: 'Daniel’s blood pressure falls on three checks. Maya is busy with Room 8, so Ward A’s Nurse Agent asks Ward B’s for help, and Sam goes.',
      why: 'The agents message each other directly: nothing gets lost when someone is busy, and every message is kept as a record.',
      async run(id) { await call('/director/jump-0400'); bed('room-2'); await wait(8000, id); },
    },
    {
      t: '7:00 am', h: 'The nurse changes. The agent doesn’t.', p: 'Maya hands over and heads home. Jordan arrives, and the Nurse Agent briefs him with the whole night, sickest patient first.',
      why: 'Communication failures play a part in up to 80% of the most serious hospital harms, and the handoff is where they happen.',
      async run(id) {
        overview(); await wait(1200, id);
        const arrived = new Promise((r) => { const off = twin.on('arrived', () => { off(); r(); }); });
        call('/director/handoff');
        await Promise.race([arrived, wait(30000, id)]); await wait(READ + 2000, id);
      },
    },
    {
      t: '7:05 am', h: 'Ask, and the right Twin answers', p: 'Jordan asks whether Room 4’s pain improved. The Nurse Agent asks Linda’s Twin, which answers from the night’s notes. Maya is never called at home.',
      why: 'Humans decide. Agents remind, warn, draft and answer.',
      async run(id) { ui.ask?.open?.(); await ui.ask?.ask?.('Did Room 4’s pain improve?'); await wait(READ, id); ui.ask?.close?.(); },
    },
    {
      t: '7:10 am', h: 'Read-back before ownership moves', p: 'Jordan reads Room 4 back. The Twin confirms it, and the floor’s checklist marks the handoff accepted.',
      why: 'Structured handoffs cut adverse events by up to 47%. Sanjeevani does one for every patient, every shift, without asking a tired nurse to.',
      async run(id) {
        bed('room-4');
        await call('/voice/readback', { podId: 'pod-a', nurseId: nurse(), room: 'room-4', text: 'Room 4: 3am potassium given late, confirmed. Pain down to 3.' });
        await wait(7000, id);
      },
    },
    {
      t: 'Sanjeevani', h: 'Nothing gets lost at 7am.', p: 'Every patient’s story carried through the night: a Patient Twin for every patient and a Nurse Agent for every ward, each an actor with its own memory and alarms, talking to each other, with every voice note and message kept on record.',
      why: '', async run(id) { overview(); await wait(12000, id); },
    },
  ];

  function show(i) {
    const b = BEATS[i];
    step.textContent = `${i + 1} / ${BEATS.length}`;
    clock.textContent = b.t;
    title.textContent = b.h;
    body.textContent = b.p;
    why.textContent = b.why;
    bar.style.width = `${((i + 1) / BEATS.length) * 100}%`;
  }
  async function play(btn) {
    const id = ++run;
    btn?.setAttribute('aria-pressed', 'true');
    card.classList.add('on');
    ui.closeLayers?.();
    for (let i = 0; i < BEATS.length && id === run; i++) {
      skipped = false;
      show(i);
      try { await BEATS[i].run(id); } catch (e) { console.warn('[story]', e); }
    }
    if (id === run) stop();
  }
  function stop() {
    run++;
    skip?.();
    card.classList.remove('on');
  }
  return { play, stop, get playing() { return card.classList.contains('on'); } };
}
