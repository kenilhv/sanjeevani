#!/usr/bin/env node
// Lists what the scene spends draw calls on, grouped by prop, on a fully booted app.
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1600, height: 1000 }, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-sandbox'], protocolTimeout: 120000 });
const page = await browser.newPage();
await page.goto('http://localhost:5199/?skipIntro=1&quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const res = await page.evaluate(() => {
  const { engine } = window.__twin, groups = {}, mats = {};
  let meshes = 0, casters = 0, transparent = 0;
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const label = (o) => { for (let p = o; p; p = p.parent) if (p.userData?.prop) return p.userData.prop; for (let p = o; p; p = p.parent) if (p === engine.floors[0]) return 'floor0(other)'; else if (p === engine.floors[1]) return 'floor1(other)'; else if (p === engine.ground) return 'ground(other)'; return 'scene(other)'; };
  engine.scene.traverse((o) => {
    if (!o.isMesh && !o.isSprite && !o.isLine) return;
    if (!vis(o)) return;
    if (o.material?.visible === false) return;
    meshes++;
    if (o.castShadow) casters++;
    if (o.material?.transparent) transparent++;
    const k = label(o);
    groups[k] = (groups[k] ?? 0) + 1;
    const m = o.material?.type ?? '?';
    mats[m] = (mats[m] ?? 0) + 1;
  });
  return { meshes, casters, transparent, mats, top: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30) };
});
console.log(JSON.stringify(res, null, 0));
await browser.close();
