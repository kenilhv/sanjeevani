#!/usr/bin/env node
// Zero-dependency static dev server on :5199. No bundler: the app is plain ES modules.
// Any served HTML gets the three.js import map injected, so playground pages stay one line simpler.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT || 5199);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json' };
export const IMPORT_MAP = '<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/examples/jsm/":"/node_modules/three/examples/jsm/"}}</script>';

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const s = await stat(p).catch(() => null);
    if (s?.isDirectory()) p = join(p, 'index.html');
    const ext = extname(p).toLowerCase();
    let body = await readFile(p);
    if (ext === '.html') {
      let html = body.toString();
      if (!html.includes('importmap')) html = html.replace(/<head>/i, '<head>' + IMPORT_MAP);
      body = html;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
