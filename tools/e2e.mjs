#!/usr/bin/env node
// Drives the real app through its interface on the real GPU and reports what actually happened.
// Screenshots land in shots/e2e-*.png. Exit code 1 if any check failed or the page threw.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1600, height: 1000 },
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-sandbox', '--mute-audio'], protocolTimeout: 180000,
});
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => { problems.push('PAGEERROR ' + (e.stack || e.message).slice(0, 400)); console.log('PAGEERROR', (e.stack || e.message).slice(0, 400)); });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /\[sim\]|tour beat|shadow-filter/.test(t)) { problems.push(t.slice(0, 400)); console.log('CONSOLE', m.type(), t.slice(0, 400)); }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (fn, ...a) => page.evaluate(fn, ...a);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); };
const shot = (name) => page.screenshot({ path: `shots/e2e-${name}.png` });
const clickText = (t) => js((t) => { const b = [...document.querySelectorAll('#ui button')].find((x) => x.textContent.trim().startsWith(t)); if (!b) return false; b.click(); return true; }, t);
const clickSel = (s) => js((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, s);
const view = () => js(() => { const e = window.__twin.engine; return { az: e.azimuthIndex, zoom: +e.zoom.toFixed(2), floor: e.floorMode, fps: e.stats.fps, level: e.stats.level }; });

await page.goto('http://localhost:5199/?skipIntro=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await wait(3000);
console.log('## boot', await view());

console.log('## camera');
for (let i = 1; i <= 4; i++) {
  await clickSel('[data-a=right]');
  await wait(1500);
  const v = await view();
  check(`rotate right ${i}`, v.az === i % 4, v);
  if (i < 4) await shot(`rotate-${i}`);
}
await page.keyboard.press('q'); await wait(1300);
check('Q turns left', (await view()).az === 3);
await page.keyboard.press('e'); await wait(1300);
check('E turns right', (await view()).az === 0);
const z0 = (await view()).zoom;
await clickSel('[data-a=in]'); await wait(800);
const z1 = (await view()).zoom;
check('zoom in button', z1 > z0 * 1.1, { z0, z1 });
await clickSel('[data-a=out]'); await wait(800);
await page.mouse.move(800, 500);
await page.mouse.wheel({ deltaY: -400 }); await wait(800);
const z2 = (await view()).zoom;
check('wheel zoom', z2 > 1.05, { z2 });
await page.mouse.move(800, 500); await page.mouse.down(); await page.mouse.move(700, 450, { steps: 6 }); await page.mouse.up(); await wait(500);
await clickSel('[data-a=home]'); await wait(1500);
check('re-centre', Math.abs((await view()).zoom - 1) < 0.05, await view());

console.log('## floors');
await clickText('Level 1'); await wait(3200);
check('floor switch to Level 1', (await view()).floor === 'level1', await view());
await shot('level1');
await clickText('Both'); await wait(3200);
check('floor switch to Both', (await view()).floor === 'stack');
await shot('stack');
await clickText('Ground'); await wait(3200);
check('floor switch to Ground', (await view()).floor === 'ground');
await page.keyboard.press('2'); await wait(1000);
check('key 2 selects Level 1', (await view()).floor === 'level1');
await page.keyboard.press('1'); await wait(3000);

console.log('## selection with the real mouse');
const spot = (fn, ...a) => js(fn, ...a);
const roomP = await spot(() => { const t = window.__twin, c = t.shell.rooms.get('lobby').centre; return t.engine.project(c.x, 0, c.z); });
await page.mouse.move(roomP.x, roomP.y); await wait(500);
const tip = await js(() => { const n = document.querySelector('.hv-tip'); return n ? { text: n.textContent.trim().slice(0, 60), opacity: getComputedStyle(n).opacity } : null; });
check('hover tooltip on a room', !!tip?.text && +tip.opacity > 0.3, tip);
await page.mouse.click(roomP.x, roomP.y); await wait(1800);
check('click opens room panel', (await js(() => document.getElementById('ui').dataset.inspect)) === '1', await js(() => document.querySelector('[class*=hv-insp]')?.textContent.trim().slice(0, 90)));
await shot('room');
await page.keyboard.press('Escape'); await wait(600);
check('Esc closes panel', (await js(() => document.getElementById('ui').dataset.inspect)) === '0');
await clickSel('[data-a=home]'); await wait(1400);

const bedId = await js(() => { const t = window.__twin; return [...t.twin.beds.values()].find((b) => b.floor === 0 && b.patientId)?.id; });
const bedP = await spot((id) => { const t = window.__twin, b = t.twin.beds.get(id); return t.engine.project(b.x, 0.8, b.z); }, bedId);
await page.mouse.click(bedP.x, bedP.y); await wait(2000);
const panel = await js(() => document.querySelector('[class*=hv-insp]')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
check(`click bed ${bedId} shows vitals`, /Heart|Oxygen/i.test(panel), panel.slice(0, 170));
await shot('bed');
await js(() => { const t = window.__twin; const a = t.twin.actors.find((x) => x.kind === 'staff' && x.anim === 'walk' && t.twin.routeOf(x.id).length > 2) ?? t.twin.actors.find((x) => x.kind === 'staff'); t.ui.select({ type: 'person', id: a.id }); window.__pid = a.id; });
await wait(1800);
check('person panel', /task|doing|heading|Nurse|Dr|Porter/i.test(await js(() => document.querySelector('[class*=hv-insp]')?.textContent ?? '')), await js(() => document.querySelector('[class*=hv-insp]')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 140)));
check('person route line drawn', await js(() => { const n = document.querySelector('.hv-labels svg path, .hv-route path, [class*=route] path'); return !!n && (n.getAttribute('d') ?? '').length > 10; }));
await shot('person');
await js(() => window.__twin.ui.select({ type: 'equipment', id: 'MRI1' })); await wait(1800);
check('equipment panel', /Health/i.test(await js(() => document.querySelector('[class*=hv-insp]')?.textContent ?? '')));
await page.keyboard.press('Escape'); await wait(400);
await clickSel('[data-a=home]'); await wait(1400);

console.log('## view toggles');
await clickSel('[data-a=busy]'); await wait(1500);
await shot('busy');
check('busy map legend shows', await js(() => document.querySelector('.hv-legend')?.classList.contains('on')));
await clickSel('[data-a=busy]'); await wait(600);
await clickSel('[data-a=flow]'); await wait(1800);
await shot('flow');
check('movement layer has geometry', await js(() => { let n = 0; window.__twin.engine.scene.traverse((o) => { if (o.name === 'flow' && o.visible) n += o.geometry.drawRange.count; }); return n > 0; }));
await clickSel('[data-a=flow]'); await wait(300);
await clickSel('[data-a=labels]'); await wait(1000);
await shot('labels');
check('labels toggle shows room names', await js(() => [...document.querySelectorAll('.hv-labels *')].filter((n) => /Radiology|Lobby|Emergency|Laboratory|Pharmacy/.test(n.textContent) && n.getBoundingClientRect().width > 20 && n.getBoundingClientRect().width < 260).length >= 3));
await clickSel('[data-a=labels]'); await wait(300);

console.log('## clock');
await clickText('4×'); await wait(1500);
check('speed 4x', (await js(() => window.__twin.twin.speed)) === 4);
await clickText('1×'); await wait(300);
await page.keyboard.press('Space'); await wait(400);
check('Space pauses', await js(() => window.__twin.twin.paused));
const c0 = await js(() => window.__twin.twin.clock.label); await wait(2000);
check('clock stops while paused', c0 === (await js(() => window.__twin.twin.clock.label)), c0);
await page.keyboard.press('Space'); await wait(300);
const nb = await js(() => { const n = [...document.querySelectorAll('#ui [class*=scrub], #ui input[type=range], #ui [role=slider]')].find((x) => x.getBoundingClientRect().width > 60); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
if (nb) {
  await page.mouse.move(nb.x + nb.w * 0.3, nb.y); await page.mouse.down(); await page.mouse.move(nb.x + nb.w * 0.82, nb.y, { steps: 8 }); await page.mouse.up();
  await wait(3500);
  const th = await js(() => ({ theme: document.getElementById('ui').dataset.theme, night: +window.__twin.engine.ctx.night.toFixed(2), clock: window.__twin.twin.clock.label }));
  check('scrubber drag reaches night', th.theme === 'night', th);
  await shot('night');
  await page.mouse.move(nb.x + nb.w * 0.82, nb.y); await page.mouse.down(); await page.mouse.move(nb.x + nb.w * 0.32, nb.y, { steps: 8 }); await page.mouse.up();
  await wait(2500);
} else check('scrubber found', false);

console.log('## ask');
await clickSel('.hv-ask'); await wait(500);
for (const q of ['How many beds are free?', 'Who needs attention?', 'How long is the emergency wait?', 'Is the MRI okay?', 'Which ward is busiest?', 'What if a surge happens?', 'How many staff are on?', 'tell me a joke']) {
  await js(() => { const i = document.querySelector('.hv-askbox input'); i.focus(); });
  await page.keyboard.type(q); await page.keyboard.press('Enter');
  await wait(2600);
  const a = await js(() => [...document.querySelectorAll('.hv-qa-a')].at(-1)?.textContent ?? '');
  check(`ask: ${q}`, a.length > 12, a.slice(0, 150));
}
await shot('ask');
await page.keyboard.press('Escape'); await wait(500);
await page.keyboard.press('Escape'); await wait(500);
await clickSel('[data-a=home]'); await clickText('Ground'); await wait(2500);

console.log('## agent network');
await clickSel('.hv-agents-chip'); await wait(900);
check('agent feed has messages', (await js(() => document.querySelectorAll('.hv-feed .hv-msg').length)) >= 5, await js(() => document.querySelector('.hv-feed .hv-msg:last-child')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 130)));
await shot('agents');
await clickSel('.hv-agentbox .hv-x'); await wait(400);

console.log('## scenarios');
const snap = () => js(() => { const t = window.__twin.twin; return { scenario: t.scenario, wait: t.metrics.erWaitMin, occ: t.metrics.occupancyPct, free: t.metrics.bedsFree, inHouse: t.metrics.patientsInHouse, alerts: t.metrics.activeAlerts, crit: t.alerts.filter((a) => a.severity === 'critical' && !a.resolved).length, cars: t.vehicles.map((v) => v.type[0]).join(''), actors: t.actors.length, feed: t.feed.length, cpr: t.actors.filter((a) => a.anim === 'cpr').length }; });
for (const [label, id] of [['Flu surge', 'flu'], ['Code blue', 'codeblue'], ['Mass casualty', 'mci'], ['MRI breaks down', 'mrifault'], ['Normal day', 'normal']]) {
  await clickText(label); await wait(800);
  const a = await snap();
  await clickText('4×'); await wait(9000);
  const b = await snap();
  await clickText('1×');
  // Code blue is an event that ends by itself, so it is judged on starting, and on the CPR check further down.
  check(`scenario ${id}`, (id === 'codeblue' ? a : b).scenario === id, { start: a, later: b, chip: await js(() => document.querySelector('.hv-chip[aria-pressed=true]')?.textContent.trim()) });
  await shot(`scenario-${id}`);
  const toast = await js(() => { const n = document.querySelector('.hv-toast .go'); if (!n) return null; const t = n.closest('.hv-toast').querySelector('b').textContent; n.click(); return t; });
  if (toast) { await wait(1800); check(`toast Show me (${toast.slice(0, 40)})`, (await js(() => document.getElementById('ui').dataset.inspect)) === '1'); await page.keyboard.press('Escape'); await wait(400); await clickSel('[data-a=home]'); await clickText('Ground'); await wait(1800); }
}

console.log('## code blue at normal speed');
await clickText('Code blue');
let cpr = null;
for (let i = 0; i < 80 && !cpr; i++) {
  await wait(500);
  cpr = await js(() => { const t = window.__twin; const a = t.twin.actors.find((x) => x.anim === 'cpr'); if (!a) return null; t.ui.select({ type: 'room', id: a.roomId }); return { who: a.display, room: a.roomId, floor: a.floor }; });
}
check('team reaches the patient and starts CPR', !!cpr, cpr);
if (cpr) { await wait(2600); await shot('codeblue-cpr'); }
const edge = await js(() => document.querySelector('.hv-edgeglow')?.classList.contains('on'));
check('edge glow on during an emergency', edge === true);
await page.keyboard.press('Escape'); await wait(300);
await clickSel('[data-a=home]'); await clickText('Ground'); await clickText('Normal day'); await wait(2500);

console.log('## long run at 16x');
await clickText('16×'); await wait(20000);
const end = await snap();
await clickText('1×');
const stuck = await js(() => { const t = window.__twin.twin; return t.actors.filter((a) => a.anim === 'walk' && a.speed === 0).length; });
check('16x stays healthy', end.actors > 30, { ...end, stuck, clock: await js(() => window.__twin.twin.clock.label), fps: (await view()).fps });

console.log('## summary');
console.log(JSON.stringify({ fails, problems: problems.length }));
await browser.close();
process.exit(fails || problems.some((p) => p.startsWith('PAGEERROR')) ? 1 : 0);
