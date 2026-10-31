// The guided tour. About a minute, written for the person who signs the cheque:
// every beat is an outcome (time, safety, money), and the hospital itself is the proof.
import { el, sleep } from './util.js';
import { icons as I } from './icons.js';

export function createTour(ui) {
  const { engine, twin, shell, root } = ui;
  const node = el(`<div class="hv-tour" aria-live="polite" hidden>
    <div class="hv-tour-c"><h2></h2><p></p>
      <div class="hv-tour-end"><button type="button" class="hv-btn pri hv-press" data-a="done">Look around myself ${I.go}</button><button type="button" class="hv-btn sec hv-press" data-a="again">Watch again</button></div>
    </div>
    <div class="hv-tour-f"><div class="hv-dots"></div><button type="button" class="hv-skip hv-press">Skip tour</button></div>
  </div>`);
  root.append(node);
  const cap = node.querySelector('.hv-tour-c'), h2 = cap.querySelector('h2'), p = cap.querySelector('p'), dots = node.querySelector('.hv-dots');
  let run = 0, active = false, saved = null;

  const firstActor = (test) => (twin.actors ?? []).find(test);
  const newest = (test) => [...(twin.alerts ?? [])].reverse().find((a) => !a.resolved && test(a));
  const floorOf = (a) => (a.bedId ? twin.beds?.get?.(a.bedId)?.floor : a.roomId ? twin.rooms?.get?.(a.roomId)?.floor : undefined);
  // A scenario raises its alert on a later sim step, so give it a moment before looking for it.
  async function alertFor(test, live, tries = 16) {
    for (let i = 0; i < tries && live(); i++) {
      const a = newest(test);
      if (a) return a;
      await sleep(120);
    }
    return newest(test);
  }
  const showFloor = (m) => { if (engine.floorMode !== m) ui.floors.set(m); };
  const room = (id, zoom) => engine.focusRoom?.(id, zoom ? { zoom, duration: 2.2 } : { duration: 2.2 });
  const glide = (o) => engine.flyTo?.({ duration: 2.4, ...o });

  const beats = [
    { t: 7.5, title: 'This is your whole hospital, live.',
      sub: 'Every bed, every patient, every team, in one calm picture that updates by itself.',
      run: () => { showFloor('ground'); return engine.resetView?.(); } },

    { t: 9, title: 'An ambulance is on its way. A bay is already waiting.',
      sub: 'The emergency team has the handover before the doors open. Nobody picks up a phone.',
      run: async () => {
        showFloor('ground');
        const v = (twin.vehicles ?? []).find((x) => x.type === 'ambulance');
        if (v) glide({ x: Math.min(v.x, 44), y: 0, z: Math.max(v.z, 20), zoom: ui.zoomFor('site') });
        else glide({ x: 41, y: 0, z: 20, zoom: ui.zoomFor('site') });
        shell.highlightRoom?.('er');
      } },

    { t: 9, title: 'A nurse is on her way before anyone calls.',
      sub: 'One patient’s oxygen is slowly slipping. The system spots it early and sends the nearest nurse.',
      run: async () => {
        shell.highlightRoom?.(null);
        showFloor('level1');
        const bed = [...(twin.beds?.values?.() ?? [])].sort((a, b) => (b.alarm ? 1 : 0) - (a.alarm ? 1 : 0)).find((b) => b.patientId && b.kind === 'ward')
          ?? [...(twin.beds?.values?.() ?? [])].find((b) => b.patientId);
        if (bed) ui.select({ type: 'bed', id: bed.id });
        else room('ward_b');
      } },

    { t: 9, title: 'Code blue. The whole team, called at once.',
      sub: 'Everyone needed is alerted together, and the nearest people run with the crash cart.',
      run: async (live) => {
        ui.clearSelection();
        twin.runScenario?.('codeblue');
        const a = await alertFor((x) => x.severity === 'critical', live);
        if (!live()) return;
        const f = a ? floorOf(a) : undefined;
        if (f !== undefined) showFloor(f === 1 ? 'level1' : 'ground');
        const id = a?.roomId ?? twin.beds?.get?.(a?.bedId)?.roomId;
        if (id) { room(id); shell.highlightRoom?.(id); }
        else room('icu');
      } },

    { t: 9.5, title: 'A flu surge, absorbed.',
      sub: 'Beds are freed early and staff move before the queue forms, so overtime stays down and nobody waits in a corridor.',
      run: async () => {
        shell.highlightRoom?.(null);
        twin.runScenario?.('flu');
        showFloor('stack');
        engine.resetView?.();
        ui.dock.setToggle('busy', true);
      } },

    { t: 9, title: 'The MRI went down. The day didn’t.',
      sub: 'Scans move to the CT straight away and an engineer is booked, so nobody spends the morning phoning round.',
      run: async () => {
        ui.dock.setToggle('busy', false);
        twin.runScenario?.('mrifault');
        showFloor('ground');
        room('radiology');
        shell.highlightRoom?.('radiology');
        const mri = twin.equipment?.get?.('MRI1') ?? [...(twin.equipment?.values?.() ?? [])].find((q) => /mri/i.test(`${q.type} ${q.name}`));
        if (mri) setTimeout(() => { if (active) ui.select({ type: 'equipment', id: mri.id }, { fly: false }); }, 1300);
      } },

    { t: 8, end: true, title: 'One live picture of everything.',
      sub: 'No more phone calls to find a bed.',
      run: async () => {
        ui.clearSelection();
        shell.highlightRoom?.(null);
        twin.runScenario?.('normal');
        showFloor('ground');
        return engine.resetView?.();
      } },
  ];

  dots.innerHTML = beats.map(() => '<i></i>').join('');
  const dotEls = [...dots.children];

  function caption(b, i) {
    h2.textContent = b.title;
    p.textContent = b.sub;
    cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
    node.classList.toggle('end', !!b.end);
    dotEls.forEach((d, n) => { d.className = n < i ? 'past' : n === i ? 'now' : ''; });
    dots.style.setProperty('--dur', `${b.t}s`);
  }
  const hold = (s, live) => new Promise((res) => {
    const t0 = performance.now();
    const check = () => (!live() || performance.now() - t0 >= s * 1000 ? res() : setTimeout(check, 90));
    check();
  });

  async function start() {
    if (active) stop();
    const me = ++run;
    const live = () => me === run;
    active = true;
    saved = { speed: twin.speed, paused: twin.paused, floor: engine.floorMode, labels: ui.dock.state.labels, busy: ui.dock.state.busy };
    twin.setPaused?.(false);
    twin.setSpeed?.(1);
    ui.clock.syncSpeed?.();
    ui.closeLayers();
    ui.clearSelection();
    root.dataset.tour = '1';
    node.hidden = false;
    requestAnimationFrame(() => node.classList.add('on'));
    for (let i = 0; i < beats.length && live(); i++) {
      const b = beats[i];
      caption(b, i);
      try { b.run(live); } catch (e) { console.warn('tour beat', i, e); }
      await hold(b.t, live);
    }
    // The final beat holds on its two buttons until the viewer picks one, or for a few more seconds.
    if (live()) await hold(6, live);
    if (live()) stop();
  }

  function stop() {
    if (!active) return false;
    run++;
    active = false;
    root.dataset.tour = '0';
    node.classList.remove('on', 'end');
    setTimeout(() => { if (!active) node.hidden = true; }, 700);
    ui.clearSelection();
    shell.highlightRoom?.(null);
    ui.dock.setToggle('busy', saved?.busy ?? false);
    if ((twin.scenario ?? 'normal') !== 'normal') twin.runScenario?.('normal');
    twin.setPaused?.(!!saved?.paused);
    if (saved?.speed) twin.setSpeed?.(saved.speed);
    ui.clock.syncSpeed?.();
    ui.dock.syncScenario();
    ui.floors.set(saved?.floor ?? 'ground');
    engine.resetView?.();
    return true;
  }

  node.querySelector('.hv-skip').addEventListener('click', () => stop());
  node.querySelector('[data-a=done]').addEventListener('click', () => stop());
  node.querySelector('[data-a=again]').addEventListener('click', () => start());

  return { start, stop, get active() { return active; } };
}
