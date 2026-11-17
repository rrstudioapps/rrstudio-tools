// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Controllo E2E della PWA servendo dist/rrstudio-tools/browser (dopo `npm run build`):
//  1. il manifest è collegato e valido; la home registra il service worker;
//  2. dopo "Scarica tutto" una pagina mai visitata si apre offline, senza errori in console e con
//     idratazione corretta (la pagina è interattiva); pdf.js e i dizionari sono in cache;
//  3. un indirizzo non in cache mostra la pagina offline tradotta (IT e EN);
//  4. aggiornamento: una nuova versione resta in attesa, compare l'avviso e "Aggiorna" la attiva;
//     chi aveva scaricato tutto ritrova la cache completa;
//  5. "Svuota la cache offline" cancella le cache.
// Uso: npm run build && npm run pwa-check   (CHROMIUM_PATH se Chromium non si trova)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PWA_PORT ?? 4379);
const base = `http://${HOST}:${PORT}`;

// Server statico minimale in questo stesso processo (come nginx: /x/ -> /x/index.html). Serve anche per
// simulare una nuova versione: con `swVersion` impostato, /sw.js esce con un'altra VERSION.
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
  '.csv': 'text/csv; charset=utf-8',
};
let swVersion = null;
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, base).pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  let body = readFileSync(file);
  if (path === '/sw.js' && swVersion) body = Buffer.from(body.toString().replace(/"VERSION":"[^"]+"/, `"VERSION":"${swVersion}"`));
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
});
await new Promise((r) => server.listen(PORT, HOST, r));
const watchdog = setTimeout(() => {
  console.error('Timeout: pwa-check interrotto dopo 10 minuti');
  server.close();
  process.exit(1);
}, 10 * 60 * 1000);
watchdog.unref();

const problems = [];
const fail = (msg) => {
  problems.push(msg);
  console.error('  KO ' + msg);
};
const ok = (cond, msg) => (cond ? console.log('  ok ' + msg) : fail(msg));
/** true se l'elemento diventa visibile entro 5 s. */
const shown = (locator) => locator.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);

let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'it-IT', serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

  // --- 1. manifest e registrazione
  console.log('Registrazione');
  await page.goto(base + '/');
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
  ok(manifestHref === 'manifest.webmanifest', 'manifest collegato in index.html');
  const manifest = await (await page.request.get(base + '/manifest.webmanifest')).json();
  ok(manifest.start_url === '/' && manifest.scope === '/' && manifest.display === 'standalone', 'manifest: start_url, scope, display');
  ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'manifest: icone maskable 512');
  for (const i of manifest.icons) {
    const r = await page.request.get(base + i.src);
    ok(r.ok(), `icona ${i.src} raggiungibile`);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.active), 'service worker attivo');

  // --- 2. download completo
  console.log('Download completo');
  const footerBtn = page.getByRole('button', { name: 'Usa offline' });
  await footerBtn.waitFor();
  await footerBtn.click();
  const dlBtn = page.getByRole('button', { name: "Scarica tutto per l'uso offline" });
  await dlBtn.waitFor();
  await dlBtn.click();
  await page.getByText('Pronto offline').waitFor({ timeout: 180000 });
  ok(true, 'download completato: "Pronto offline"');
  await page.keyboard.press('Escape');

  const swText = await (await page.request.get(base + '/sw.js')).text();
  const data = JSON.parse(/const DATA = (\{.*\});/.exec(swText)[1]);
  console.log(`  SHELL ${data.SHELL.length} file, ALL ${data.ALL.length} file, stima ${(data.SIZE / 1048576).toFixed(1)} MB`);
  ok(data.ALL.includes('/pdfjs/pdf.worker.min.mjs'), 'pdf.js worker nell\'elenco completo');
  ok(data.ALL.some((u) => u.startsWith('/pdfjs/standard_fonts/')), 'font standard di pdf.js nell\'elenco completo');
  ok(data.ALL.includes('/wordlists/eff-large.txt') && data.ALL.includes('/data/luoghi.json'), 'liste parole e luoghi nell\'elenco completo');
  ok(!data.ALL.some((u) => u.startsWith('/og/') || u === '/sitemap.xml'), 'og/ e sitemap esclusi');
  ok(data.ALL.includes('/en/privacy/') && data.ALL.includes('/base64/'), 'pagine IT ed EN nell\'elenco completo');
  ok(data.ALL.includes('/preferiti/') && data.ALL.includes('/en/favorites/'), 'pagine dei preferiti (IT ed EN) nell\'elenco completo');

  // --- 3. offline: pagina mai visitata, con tutto idratato
  console.log('Offline');
  await ctx.setOffline(true);
  logs.length = 0;
  for (const url of ['/base64/', '/en/qr-code-generator/', '/pdf-tools/', '/preferiti/', '/en/favorites/']) {
    await page.goto(base + url);
    await page.waitForSelector('h1');
    const title = await page.title();
    ok(title && !/offline/i.test(title), `${url} si apre offline (${title})`);
  }
  // idratazione: la pagina è interattiva (il tema cambia al clic) e la lingua è giusta
  await page.goto(base + '/base64/');
  await page.waitForSelector('textarea');
  const before = await page.getAttribute('html', 'data-theme');
  // il clic prima dell'idratazione non fa nulla: si riprova finché l'app non risponde (massimo ~10 s)
  let toggled = false;
  for (let i = 0; i < 20 && !toggled; i++) {
    await page.locator('app-header button[aria-label*="tema"]').first().click();
    await page.waitForTimeout(500);
    toggled = (await page.getAttribute('html', 'data-theme')) !== before;
  }
  ok(toggled, 'pagina offline interattiva (idratata)');
  ok(await shown(page.getByText('Sei offline').first()), 'indicatore "Sei offline"');
  const inCache = await page.evaluate(async () => ({
    worker: !!(await caches.match('/pdfjs/pdf.worker.min.mjs')),
    words: !!(await caches.match('/wordlists/eff-large.txt')),
  }));
  ok(inCache.worker && inCache.words, 'pdf.js worker e liste parole in cache');
  ok(logs.length === 0, 'nessun errore in console offline' + (logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''));

  // pagina offline tradotta per un indirizzo non in cache
  // (si aspetta che l'elemento compaia: sui runner veloci isVisible() subito dopo goto arriva troppo presto)
  await page.goto(base + '/zz-non-esiste/');
  ok(await shown(page.getByRole('heading', { name: 'Sei offline' })), 'pagina offline in italiano');
  await page.goto(base + '/en/zz-not-cached/');
  ok(await shown(page.getByRole('heading', { name: 'You are offline' })), 'pagina offline in inglese');
  await ctx.setOffline(false);

  // --- 4. aggiornamento: una "nuova versione" (VERSION diversa) resta in attesa finché l'utente non la chiede
  console.log('Aggiornamento');
  logs.length = 0;
  await page.goto(base + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const oldKeys = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('rrtools-v-')));
  swVersion = 'pwa-check-v2';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).update());
  await page.getByText('Nuova versione disponibile').waitFor();
  ok(true, 'avviso "Nuova versione disponibile"');
  const stillOld = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('rrtools-v-')));
  ok(stillOld.includes(oldKeys[0]), 'la versione vecchia resta attiva finché non si preme "Aggiorna"');
  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Aggiorna' }).click()]);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).includes('rrtools-v-pwa-check-v2'));
  const newKeys = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('rrtools-v-')));
  ok(newKeys.length === 1 && newKeys[0] === 'rrtools-v-pwa-check-v2', 'dopo "Aggiorna" resta solo la cache della nuova versione');
  // chi aveva scaricato tutto lo ritrova completo (download automatico in background)
  await page.getByRole('button', { name: 'Usa offline' }).click();
  await page.getByText('Pronto offline').waitFor({ timeout: 180000 });
  ok(true, 'cache completa anche dopo l\'aggiornamento');

  // --- 5. svuota
  console.log('Svuotamento');
  await page.getByRole('button', { name: 'Svuota la cache offline' }).click();
  await page.getByText('Cache offline svuotata.').waitFor();
  ok((await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('rrtools-')).length)) === 0, 'cache svuotata');
  ok(logs.filter((l) => !/sw\.js|ServiceWorker/i.test(l)).length === 0, 'nessun errore in console' + (logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''));
} catch (e) {
  fail('eccezione: ' + (e instanceof Error ? e.message.split('\n')[0] : e));
} finally {
  await browser?.close();
  server.close();
  clearTimeout(watchdog);
}

if (problems.length) {
  console.error(`\npwa-check: ${problems.length} problemi`);
  process.exit(1);
}
console.log('\npwa-check: tutto a posto');
