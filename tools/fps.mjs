#!/usr/bin/env node
// Measures real frame rate on the machine's actual GPU, which tools/shot.mjs (software GL) cannot do.
//   node tools/fps.mjs "/?skipIntro=1&warm=30" [settleMs] [out.png]
import puppeteer from 'puppeteer-core';

const path = process.argv[2] || '/?skipIntro=1&warm=30';
const settle = Number(process.argv[3] ?? 9000);
const out = process.argv[4];
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1600, height: 1000 },
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-sandbox', '--mute-audio'],
  protocolTimeout: 120000,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 400)); });
await page.goto('http://localhost:5199' + path, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, settle));
const res = await page.evaluate(() => new Promise((resolve) => {
  const dts = []; let last = performance.now(); const start = last;
  const step = (now) => {
    dts.push(now - last); last = now;
    if (now - start < 5000) return requestAnimationFrame(step);
    dts.sort((a, b) => a - b);
    const t = window.__twin, gl = t.engine.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    resolve({
      gpu: dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL), frames: dts.length, fps: +(dts.length / 5).toFixed(1),
      p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), worst: +dts[dts.length - 1].toFixed(1),
      stats: t.engine.stats, actors: t.twin.actors.length,
    });
  };
  requestAnimationFrame(step);
}));
console.log(JSON.stringify(res));
if (out) await page.screenshot({ path: out });
await browser.close();
