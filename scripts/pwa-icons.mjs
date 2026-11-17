// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Genera le icone della PWA in public/: icon-512.png e le versioni "maskable" (192 e 512 px) con
// sfondo pieno e logo dentro l'area sicura (cerchio del 40% del lato), partendo da public/favicon.svg.
// Uso: npm run pwa-icons   (serve il Chromium di Playwright già installato; CHROMIUM_PATH se serve)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const font = pathToFileURL(join(root, 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2')).href;
const BG = '#1c1c1e';

/** Pagina HTML con il logo a `size` px; maskable: sfondo pieno e logo ridotto al 72% (cerchio ~37% del lato). */
const page = (size, maskable) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url(${font}) format('woff2')}
html,body{margin:0;background:${maskable ? BG : 'transparent'}}
.w{width:${size}px;height:${size}px;display:grid;place-items:center}
svg{width:${maskable ? Math.round(size * 0.72) : size}px;height:auto;display:block}
</style><div class="w">${svg}</div>`;

const jobs = [
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const tmp = join(tmpdir(), `pwa-icons-${process.pid}.html`);
try {
  for (const j of jobs) {
    const ctx = await browser.newContext({ viewport: { width: j.size, height: j.size }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    writeFileSync(tmp, page(j.size, j.maskable));
    await p.goto(pathToFileURL(tmp).href);
    await p.evaluate(() => document.fonts.ready);
    const buf = await p.screenshot({ omitBackground: !j.maskable, type: 'png' });
    writeFileSync(join(root, 'public', j.file), buf);
    console.log(`public/${j.file} (${buf.length} byte)`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
