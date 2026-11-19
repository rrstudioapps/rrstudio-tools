// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
// Lighthouse (mobile e desktop) su un campione di pagine servendo dist/rrstudio-tools/browser.
// Soglie: accessibilità = 100, SEO = 100 (salvo pagine noindex), best practices >= 95,
// performance >= soglia per pagina/preset (vedi PERF più sotto).
// Uso: npm run build && npm run lighthouse   (CHROMIUM_PATH se Chromium non si trova)
// Variabili: LH_RUNS=3 (mediana di più misure), LH_ONLY=csv-dashboard,privacy (filtra per indirizzo),
//            LH_PRESET=mobile (solo un preset), LH_ONLY=/ (solo la home it),
//            LH_REPORT=1 (stampa solo i numeri senza fallire: serve a misurare, non a fare da gate).
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch } from 'chrome-launcher';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.LH_PORT ?? 4380);
const base = `http://${HOST}:${PORT}`;
const RUNS = Number(process.env.LH_RUNS ?? 1);
const REPORT_ONLY = process.env.LH_REPORT === '1';

// Campione: home IT/EN, privacy e 8 strumenti, pesanti (pdf.js, grafici, zxcvbn, ottimizzatore SVG) e leggeri.
const PAGES = [
  '/',
  '/en/',
  '/privacy/',
  '/csv-dashboard/',
  '/pdf-tools/',
  '/qr-code-generator/',
  '/json-formatter/',
  '/password-strength-checker/',
  '/svg-optimizer/',
  '/calcolo-iva/',
  '/cron-expression/',
];
const only = process.env.LH_ONLY?.split(',').filter(Boolean);
// LH_ONLY='/' = solo la home italiana (corrispondenza esatta); gli altri valori filtrano per sottostringa
const pages = PAGES.filter((p) => !only || only.some((o) => p === o || (o !== '/' && p.includes(o))));
const presets = process.env.LH_PRESET ? [process.env.LH_PRESET] : ['mobile', 'desktop']; // LH_PRESET=mobile misura solo il mobile

// Soglie di performance (0-100), misurate il 17/11/2026 su questa VPS ARM sotto carico (mediana di 3 run):
//  mobile  : da 78 (cron-expression, csv-dashboard) a 96 (calcolo-iva); home EN fino a 67 nei run più disturbati
//  desktop : da 95 a 100
// Le soglie stanno ben SOTTO i valori misurati perché Lighthouse con throttling simulato oscilla di molti punti
// quando la macchina è occupata (le home variano da 67 a 85 tra un run e l'altro); la CI (ubuntu-24.04 x86) è più
// veloce della VPS, quindi un limite tarato qui non dà falsi allarmi. Servono a cogliere regressioni vere
// (una libreria pesante caricata all'avvio, un'animazione che ritarda l'LCP), non a inseguire il singolo punto.
// Il TBT mobile (CPU 4x più lenta) è la voce più debole delle pagine strumento: ogni eccezione per pagina
// va dichiarata qui sotto con il motivo.
const PERF = {
  mobile: { default: 60 },
  desktop: { default: 85 },
};
const perfMin = (preset, page) => PERF[preset][page] ?? PERF[preset].default;
const A11Y_MIN = 100;
const SEO_MIN = 100;
const BP_MIN = 95;

// Server statico minimale in questo processo (come nginx: /x/ -> /x/index.html)
const root = resolve('dist/rrstudio-tools/browser');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, base).pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, HOST, r));

let chrome;
const stop = async () => {
  server.close();
  try {
    await chrome?.kill();
  } catch {
    /* già chiuso */
  }
};
// rete di sicurezza: se qualcosa si blocca si chiude comunque, senza lasciare Chrome acceso
const watchdog = setTimeout(async () => {
  console.error('Timeout: lighthouse interrotto dopo 40 minuti');
  await stop();
  process.exit(1);
}, 40 * 60 * 1000);
watchdog.unref();

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const fmt = (n) => String(Math.round(n)).padStart(3);
const rows = [];
const problems = [];

try {
  chrome = await launch({
    // CHROMIUM_PATH, altrimenti il Chromium di Playwright (installato anche in CI)
    chromePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  for (const preset of presets) {
    for (const page of pages) {
      const url = base + page;
      const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(readFileSync(join(root, page, 'index.html'), 'utf8'));
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await lighthouse(
          url,
          { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] },
          preset === 'desktop' ? desktopConfig : undefined,
        );
        const lhr = r.lhr;
        runs.push({
          perf: lhr.categories.performance.score * 100,
          a11y: lhr.categories.accessibility.score * 100,
          bp: lhr.categories['best-practices'].score * 100,
          seo: lhr.categories.seo.score * 100,
          tbt: lhr.audits['total-blocking-time'].numericValue,
          // dettaglio dell'esecuzione (solo con LH_REPORT=1): script che occupano più tempo di CPU
          boot: REPORT_ONLY ? (lhr.audits['bootup-time'].details?.items ?? []).slice(0, 6).map((i) => `${String(i.url).split('/').pop()?.slice(0, 40)} ${Math.round(i.scripting)}ms script / ${Math.round(i.total)}ms`) : [],
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          failed: Object.values(lhr.audits)
            .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
            .map((a) => a.id),
        });
      }
      const m = (k) => median(runs.map((x) => x[k]));
      const row = { preset, page, perf: m('perf'), a11y: m('a11y'), bp: m('bp'), seo: m('seo'), tbt: m('tbt'), lcp: m('lcp'), failed: runs[0].failed };
      rows.push(row);
      const bad = [];
      if (row.a11y < A11Y_MIN) bad.push(`accessibilità ${row.a11y} < ${A11Y_MIN}`);
      if (!noindex && row.seo < SEO_MIN) bad.push(`SEO ${row.seo} < ${SEO_MIN}`);
      if (row.bp < BP_MIN) bad.push(`best practices ${row.bp} < ${BP_MIN}`);
      if (row.perf < perfMin(preset, page)) bad.push(`performance ${row.perf} < ${perfMin(preset, page)}`);
      for (const b of bad) problems.push(`${preset} ${page}: ${b}`);
      console.log(
        `${preset.padEnd(7)} ${page.padEnd(30)} perf ${fmt(row.perf)} (min ${perfMin(preset, page)})  a11y ${fmt(row.a11y)}  bp ${fmt(row.bp)}  seo ${fmt(row.seo)}` +
          `  TBT ${fmt(row.tbt)} ms  LCP ${fmt(row.lcp)} ms${bad.length ? '  <-- KO' : ''}`,
      );
      if (REPORT_ONLY) for (const b of runs[0].boot) console.log('    ' + b);
    }
  }
} finally {
  await stop();
}

console.log(`\n${rows.length} misure (${RUNS} run ciascuna, mediana).`);
if (problems.length && !REPORT_ONLY) {
  console.error('\nSoglie non rispettate:');
  for (const p of problems) console.error('  KO ' + p);
  process.exit(1);
}
console.log(problems.length ? 'Modalità LH_REPORT: nessun errore forzato.' : 'Tutte le soglie rispettate.');
process.exit(0);
