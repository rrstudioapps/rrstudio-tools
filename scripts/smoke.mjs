// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Smoke test E2E di tutte le pagine (home, privacy, preferiti, strumenti; IT e /en/) servendo dist/rrstudio-tools/browser.
// Per ogni pagina, a 360 e 1280 px: nessun errore in console, nessuno scorrimento orizzontale,
// axe-core senza violazioni critical/serious in tema chiaro e scuro.
// Uso: npm run build && npm run smoke   (serve Chromium di Playwright; CHROMIUM_PATH se non lo trova)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const HOST = '127.0.0.1';
const PORT = Number(process.env.SMOKE_PORT ?? 4378);
const base = `http://${HOST}:${PORT}`;
const WIDTHS = [360, 1280];

// Eccezioni note, esplicite e limitate: regola axe + pagina (senza prefisso /en) + frammento del selettore.
// La regola NON è disattivata altrove. Sono controlli con etichetta visibile diversa dal nome accessibile.
const ALLOW = [
  // Area di drop del CSV Dashboard: la scritta visibile e il nome accessibile differiscono di proposito.
  { rule: 'label-content-name-mismatch', page: '/csv-dashboard/', target: '.drop' },
  // Pulsanti del formato (grassetto, corsivo…) del Markdown editor: icona/simbolo visibile con nome esteso.
  { rule: 'label-content-name-mismatch', page: '/markdown-editor/', target: 'data-fmt' },
];

// Elenco pagine dal registry degli strumenti: ogni voce ha `path` e, se solo italiana, `italyOnly: true`
const registry = readFileSync('src/app/tools/tools.registry.ts', 'utf8');
const body = registry.slice(registry.indexOf('export const TOOLS'));
const tools = [...body.matchAll(/\n {2}\{\n([\s\S]*?)\n {2}\},/g)].map((m) => ({
  path: /\n? {4}path: '([^']+)'/.exec(m[1])?.[1],
  italyOnly: /\n {4}italyOnly: true/.test(m[1]),
}));
if (!tools.length || tools.some((t) => !t.path)) {
  console.error('Impossibile leggere il registry degli strumenti');
  process.exit(1);
}
const pages = ['/', '/privacy/', '/preferiti/'];
const pagesEn = ['/en/', '/en/privacy/', '/en/favorites/'];
for (const t of tools) {
  pages.push(`/${t.path}/`);
  if (!t.italyOnly) pagesEn.push(`/en/${t.path}/`);
}
// SMOKE_ONLY=csv-dashboard,markdown limita le pagine a quelle il cui indirizzo contiene uno dei frammenti;
// con il prefisso = l'indirizzo deve coincidere (SMOKE_ONLY==/,=/en/ solo le due home)
const only = process.env.SMOKE_ONLY?.split(',').filter(Boolean);
const all = [...pages, ...pagesEn].filter((p) => !only || only.some((o) => (o.startsWith('=') ? p === o.slice(1) : p.includes(o))));

const axeSrc = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// Server statico temporaneo, fermato per PID al termine
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', HOST], {
  cwd: 'dist/rrstudio-tools/browser',
  stdio: 'ignore',
});
process.on('exit', () => server.kill());
await new Promise((r) => setTimeout(r, 1000));

// rete di sicurezza: se qualcosa si blocca lo script finisce comunque e ferma il server
const watchdog = setTimeout(() => {
  console.error('Timeout: smoke test interrotto dopo 20 minuti');
  server.kill();
  process.exit(1);
}, 20 * 60 * 1000);
watchdog.unref();

let browser;
try {
  // http su un IP non è un contesto sicuro: senza questo flag crypto.subtle non esisterebbe
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: [`--unsafely-treat-insecure-origin-as-secure=${base}`],
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Esegue axe sulla pagina corrente e restituisce le violazioni critical/serious non in allowlist
async function runAxe(page, p, label) {
  const found = await page.evaluate(async () =>
    (await window.axe.run(document, {
      resultTypes: ['violations'],
      // regola sperimentale, spenta di default in axe: la accendiamo (con allowlist per i casi noti)
      rules: { 'label-content-name-mismatch': { enabled: true } },
    })).violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) })),
  );
  const pageKey = p.replace(/^\/en\//, '/');
  const out = [];
  for (const v of found) {
    const nodes = v.nodes.filter(
      (t) => !ALLOW.some((a) => a.rule === v.id && a.page === pageKey && t.includes(a.target)),
    );
    if (nodes.length) out.push(`axe ${label}: ${v.id} (${nodes.length}) ${nodes[0]}`);
  }
  return out;
}

let problems = 0;
let checks = 0;
try {
  for (const p of all) {
    for (const width of WIDTHS) {
      checks++;
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: p.startsWith('/en/') ? 'en-GB' : 'it-IT' });
      const page = await ctx.newPage();
      page.setDefaultTimeout(20000);
      const issues = [];
      page.on('request', (r) => !/^(blob:|data:)/.test(r.url()) && !r.url().startsWith(base) && issues.push('richiesta esterna: ' + r.url()));
      page.on('console', (m) => m.type() === 'error' && issues.push('console: ' + m.text().slice(0, 200)));
      page.on('pageerror', (e) => issues.push('pageerror: ' + e.message.slice(0, 200)));
      try {
        await page.goto(base + p, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500); // animazione d'ingresso delle sezioni
        // Scorrimento orizzontale: della pagina, o elementi fuori dal viewport non dentro un contenitore con scroll/clip
        const overflow = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const els = [];
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
              let a = el.parentElement;
              let clipped = false;
              while (a) {
                const o = getComputedStyle(a).overflowX;
                if (o === 'auto' || o === 'scroll' || o === 'hidden') {
                  clipped = true;
                  break;
                }
                a = a.parentElement;
              }
              if (!clipped) els.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}#${el.id} r=${Math.round(r.right)}`);
            }
          }
          return { page: document.documentElement.scrollWidth > w, els: els.slice(0, 4) };
        });
        if (overflow.page || overflow.els.length) issues.push(`overflow: ${overflow.page ? 'pagina ' : ''}${overflow.els.join(' | ')}`);
        await page.addScriptTag({ content: axeSrc });
        issues.push(...(await runAxe(page, p, 'chiaro')));
        // tema scuro: attributo sul <html> più preferenza del sistema
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(150);
        issues.push(...(await runAxe(page, p, 'scuro')));
      } catch (e) {
        issues.push('errore: ' + e.message.split('\n')[0]);
      }
      if (issues.length) {
        problems++;
        console.log(`KO  ${p} @${width}`);
        for (const i of [...new Set(issues)]) console.log('      ' + i);
      }
      await ctx.close();
    }
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server.kill();
}
console.log(`\n${all.length} pagine x ${WIDTHS.length} larghezze = ${checks} controlli, ${problems} con problemi`);
process.exitCode = problems ? 1 : 0;
