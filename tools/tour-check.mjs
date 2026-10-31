#!/usr/bin/env node
// Plays the guided tour in real time on the real GPU, logging each caption and taking a screenshot per beat.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1600, height: 1000 },
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-sandbox', '--mute-audio'], protocolTimeout: 180000,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 400)); });
await page.goto('http://localhost:5199/?skipIntro=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => { window.__twin.ui.tour.start(); });

const t0 = Date.now();
let lastText = '', beat = 0, gone = 0;
while (Date.now() - t0 < 110000) {
  await new Promise((r) => setTimeout(r, 700));
  const s = await page.evaluate(() => {
    const el = document.querySelector('.hv-tour:not([hidden]) .hv-tour-c h2');
    const t = window.__twin, tour = t.ui.tour;
    return { text: el?.textContent.trim().slice(0, 140) ?? '', opacity: el ? getComputedStyle(el).opacity : null, active: tour.active, fl: t.engine.floorMode, zoom: +t.engine.zoom.toFixed(2), scenario: t.twin.scenario, fps: t.engine.stats.fps, level: t.engine.stats.level, dpr: t.engine.stats.dpr };
  });
  if (s.text !== lastText) {
    lastText = s.text; beat++;
    console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s beat ${beat}`, JSON.stringify(s));
    if (s.text) { await new Promise((r) => setTimeout(r, 2200)); await page.screenshot({ path: `shots/tour-${beat}.png` }); }
  }
  if (!s.text) { if (++gone > 6 && beat > 2) break; } else gone = 0;
}
console.log('end', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.screenshot({ path: 'shots/tour-end.png' });
await browser.close();
