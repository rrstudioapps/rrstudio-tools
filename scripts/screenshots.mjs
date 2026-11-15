// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Genera gli screenshot in docs/screenshots/ servendo dist/rrstudio-tools/browser in locale.
// Uso: npm run build && npm run screenshots   (serve Chromium di Playwright già installato)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = 4377;
const base = `http://${HOST}:${PORT}`;
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });

// Server statico temporaneo, fermato per PID al termine
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', HOST], {
  cwd: 'dist/rrstudio-tools/browser',
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1000));
// il server va fermato anche se qualcosa fallisce più avanti
process.on('exit', () => server.kill());

let browser;
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const errors = [];
try {
  async function shot(name, { width, dark, tool }) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: dark ? 'dark' : 'light',
      locale: 'it-IT',
    });
    const page = await ctx.newPage();
    page.on('request', (r) => !r.url().startsWith(base) && errors.push('richiesta esterna: ' + r.url()));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + (tool ? '/csv-dashboard/' : '/'));
    await page.waitForTimeout(900); // animazione d'ingresso delle sezioni
    if (tool) {
      await page.getByRole('button', { name: /dati di esempio/i }).click();
      await page.waitForSelector('app-kpi-cards .kpi');
      await page.waitForTimeout(1200); // animazioni dei grafici
    }
    await page.screenshot({ path: join(out, name), fullPage: true });
    await ctx.close();
  }
  await shot('home-light.png', { width: 1280, dark: false, tool: false });
  await shot('home-dark.png', { width: 1280, dark: true, tool: false });
  await shot('dashboard-light.png', { width: 1280, dark: false, tool: true });
  await shot('dashboard-dark.png', { width: 1280, dark: true, tool: true });
  await shot('dashboard-mobile.png', { width: 390, dark: false, tool: true });
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.error('Errori in console:', errors);
  process.exitCode = 1;
}
