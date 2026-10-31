#!/usr/bin/env node
// Builds one self-contained dist/haven-general.html: all JS, three.js and fonts inlined, so it opens by double-click and works offline.
// Uses esbuild's WebAssembly build because this machine's Application Control blocks native binaries.
import * as esbuild from 'esbuild-wasm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = (await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: 'es2022', write: false, legalComments: 'none',
})).outputFiles[0].text;
await esbuild.stop();

const fonts = readFileSync('src/style/fonts.css', 'utf8').replace(/url\(\/(node_modules[^)]+)\)/g, (_, p) =>
  `url(data:font/woff2;base64,${readFileSync(p).toString('base64')})`);

const html = readFileSync('index.html', 'utf8')
  .replace(/\s*<script type="importmap">.*?<\/script>/s, '')
  .replace(/<link rel="stylesheet" href="\/src\/style\/fonts\.css" \/>/, () => `<style>${fonts}</style>`)
  .replace(/<script type="module" src="\/src\/main\.js"><\/script>/, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/haven-general.html', html);
console.log(`dist/haven-general.html  ${(html.length / 1048576).toFixed(2)} MB`);
