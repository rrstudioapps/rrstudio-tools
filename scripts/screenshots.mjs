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
  async function shot(name, { width, dark, path = '/', setup }) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: dark ? 'dark' : 'light',
      locale: 'it-IT',
    });
    const page = await ctx.newPage();
    page.on('request', (r) => !/^(blob:|data:)/.test(r.url()) && !r.url().startsWith(base) && errors.push('richiesta esterna: ' + r.url()));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + path);
    await page.waitForTimeout(900); // animazione d'ingresso delle sezioni
    if (setup) await setup(page);
    await page.screenshot({ path: join(out, name), fullPage: true });
    await ctx.close();
  }
  const csvSample = async (page) => {
    await page.getByRole('button', { name: /dati di esempio/i }).click();
    await page.waitForSelector('app-kpi-cards .kpi');
    await page.waitForTimeout(1200); // animazioni dei grafici
  };
  const csv = { path: '/csv-dashboard/', setup: csvSample };
  await shot('home-light.png', { width: 1280, dark: false });
  await shot('home-dark.png', { width: 1280, dark: true });
  await shot('dashboard-light.png', { width: 1280, dark: false, ...csv });
  await shot('dashboard-dark.png', { width: 1280, dark: true, ...csv });
  await shot('dashboard-mobile.png', { width: 390, dark: false, ...csv });
  // Tool di testo: tema chiaro, con un input d'esempio già inserito
  await shot('base64.png', {
    width: 1280,
    dark: false,
    path: '/base64/',
    setup: async (page) => {
      await page.fill('#b64-in', 'Ciao àèì: Base64 senza uscire dal browser.');
    },
  });
  await shot('url-encode.png', {
    width: 1280,
    dark: false,
    path: '/url-encode/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Decodifica', exact: true }).click();
      await page.fill('#url-in', 'https://example.com/cerca/caff%C3%A8?q=pizza+e+caff%C3%A8&lingua=it&tag=a%26b#risultati');
    },
  });
  // Immagini di esempio disegnate al volo con un canvas (nessun file scaricato)
  const sampleImages = async (page) => {
    const files = await page.evaluate(async () => {
      // conversione a ciclo: lo spread su un array di ~1 MB manda in stack overflow
      const toB64 = async (c, type, q) => {
        const blob = await new Promise((res) => c.toBlob(res, type, q));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      };
      const photo = document.createElement('canvas');
      photo.width = 2400;
      photo.height = 1600;
      const g = photo.getContext('2d');
      const sky = g.createLinearGradient(0, 0, 0, 1600);
      sky.addColorStop(0, '#2b5a8a');
      sky.addColorStop(0.6, '#e8b27a');
      sky.addColorStop(1, '#3d5a3a');
      g.fillStyle = sky;
      g.fillRect(0, 0, 2400, 1600);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${(Math.random() * 255) | 0},${(Math.random() * 255) | 0},${(Math.random() * 255) | 0},0.35)`;
        g.fillRect(Math.random() * 2400, Math.random() * 1600, 6 + Math.random() * 30, 6 + Math.random() * 30);
      }
      g.fillStyle = '#1c2b1f';
      g.beginPath();
      g.moveTo(0, 1200);
      for (let x = 0; x <= 2400; x += 120) g.lineTo(x, 1000 + Math.sin(x / 300) * 160);
      g.lineTo(2400, 1600);
      g.lineTo(0, 1600);
      g.fill();
      const logo = document.createElement('canvas');
      logo.width = logo.height = 800;
      const l = logo.getContext('2d');
      l.fillStyle = '#d9480f';
      l.beginPath();
      l.arc(400, 400, 360, 0, 7);
      l.fill();
      l.fillStyle = '#fff';
      l.font = 'bold 300px sans-serif';
      l.textAlign = 'center';
      l.fillText('rr', 400, 480);
      const shot = document.createElement('canvas');
      shot.width = 1600;
      shot.height = 900;
      const s = shot.getContext('2d');
      s.fillStyle = '#f1f3f5';
      s.fillRect(0, 0, 1600, 900);
      for (let i = 0; i < 12; i++) {
        s.fillStyle = i % 2 ? '#4c6ef5' : '#adb5bd';
        s.fillRect(100 + i * 110, 800 - (i * 53) % 500 - 100, 80, (i * 53) % 500 + 100);
      }
      return [
        { name: 'paesaggio.jpg', mimeType: 'image/jpeg', b64: await toB64(photo, 'image/jpeg', 0.95) },
        { name: 'logo.png', mimeType: 'image/png', b64: await toB64(logo, 'image/png') },
        { name: 'grafico.png', mimeType: 'image/png', b64: await toB64(shot, 'image/png') },
      ];
    });
    await page.setInputFiles(
      'input[type=file]',
      files.map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.b64, 'base64') })),
    );
    await page.selectOption('#ic-format', 'webp');
    await page.waitForFunction(() => document.querySelectorAll('.row[data-status="done"]').length === 3, null, { timeout: 30000 });
    await page.waitForTimeout(400);
  };
  await shot('image-compressor.png', { width: 1280, dark: false, path: '/image-compressor/', setup: sampleImages });
  await shot('json-formatter.png', {
    width: 1280,
    dark: false,
    path: '/json-formatter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Prova con un esempio' }).click();
    },
  });
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.error('Errori in console:', errors);
  process.exitCode = 1;
}
