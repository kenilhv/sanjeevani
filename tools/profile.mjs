#!/usr/bin/env node
// Splits a frame into its parts on the real GPU: per-module JS time, three's render call, and whatever is left (GPU wait).
import puppeteer from 'puppeteer-core';

const path = process.argv[2] || '/?skipIntro=1&warm=30&quality=low';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1600, height: 1000 },
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-sandbox', '--mute-audio'], protocolTimeout: 120000,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack || e.message));
await page.goto('http://localhost:5199' + path, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));
const res = await page.evaluate(() => new Promise((resolve) => {
  const t = window.__twin, ms = {}, wrap = (o, k, label) => { const f = o[k]; ms[label] = 0; o[k] = function (...a) { const s = performance.now(); const r = f.apply(this, a); ms[label] += performance.now() - s; return r; }; };
  wrap(t.twin, 'tick', 'sim'); wrap(t.shell, 'update', 'shell'); wrap(t.people, 'update', 'people'); wrap(t.ui, 'update', 'ui'); wrap(t.engine.renderer, 'render', 'render');
  let n = 0; const start = performance.now();
  const step = () => {
    n++;
    if (performance.now() - start < 4000) return requestAnimationFrame(step);
    const out = { frames: n, frameMs: +(4000 / n).toFixed(1) };
    for (const k in ms) out[k] = +(ms[k] / n).toFixed(2);
    resolve({ ...out, stats: t.engine.stats });
  };
  requestAnimationFrame(step);
}));
console.log(JSON.stringify(res));
await browser.close();
