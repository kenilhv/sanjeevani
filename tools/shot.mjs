#!/usr/bin/env node
// Headless screenshot + console check, using the system Chrome.
//   node tools/shot.mjs --url "/?skipIntro=1" --out shots/main.png
// Options:
//   --url    path on the dev server (http://localhost:5199) or a full URL
//   --out    PNG path (default shots/shot.png)
//   --size   WxH (default 1600x1000)
//   --wait   ms to wait after window.__ready (default 2500)
//   --eval   JS run in the page after the wait; result is printed
//   --after  ms to wait after --eval before the screenshot (default 800)
//   --mobile emulate a phone viewport (390x844, touch)
// Prints page errors and console errors, then a one-line JSON summary. Exit code 1 if the page threw.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (process.argv.includes('--mobile')) args.mobile = true;

const BASE = 'http://localhost:5199';
const url = !args.url ? BASE + '/' : /^(https?|file):/.test(args.url) ? args.url : BASE + args.url;
const out = resolve(args.out || 'shots/shot.png');
const [W, H] = (args.size || (args.mobile ? '390x844' : '1600x1000')).split('x').map(Number);
const wait = Number(args.wait ?? 2500);
const after = Number(args.after ?? 800);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: !!args.mobile, hasTouch: !!args.mobile },
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars', '--mute-audio'],
  protocolTimeout: 180000,
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push('PAGEERROR ' + (e.stack || e.message)); console.log('PAGEERROR', e.stack || e.message); });
page.on('console', (m) => {
  if (m.type() === 'error') { errors.push('console.error ' + m.text()); console.log('console.error', m.text()); }
  else if (m.type() === 'warn' && !/GPU stall|GL Driver Message/.test(m.text())) console.log('console.warn', m.text().slice(0, 300));
  else if (m.type() === 'log' && args.logs) console.log('log', m.text().slice(0, 300));
});

let ready = false;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForFunction('window.__ready === true', { timeout: 45000, polling: 200 }); ready = true; }
  catch { console.log('note: window.__ready never became true (ok for playgrounds that do not set it)'); }
  await new Promise((r) => setTimeout(r, wait));
  if (args.eval) {
    const res = await page.evaluate(args.eval);
    console.log('eval ->', JSON.stringify(res)?.slice(0, 2000));
    await new Promise((r) => setTimeout(r, after));
  }
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
} catch (e) {
  errors.push('SHOT ' + e.message);
  console.log('SHOT FAILED', e.message);
}
await browser.close();
console.log(JSON.stringify({ ok: errors.length === 0, ready, out, errors: errors.length }));
process.exit(errors.some((e) => e.startsWith('PAGEERROR') || e.startsWith('SHOT')) ? 1 : 0);
