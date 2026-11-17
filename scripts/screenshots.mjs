// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Genera gli screenshot in docs/screenshots/ servendo dist/rrstudio-tools/browser in locale.
// Uso: npm run build && npm run screenshots   (serve Chromium di Playwright già installato)
// Con --check (npm run e2e) esegue tutte le interazioni ma non scrive nulla; exit 1 se una pagina
// dà errori in console, fa richieste esterne o un'interazione fallisce.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = 4377;
const base = `http://${HOST}:${PORT}`;
const out = 'docs/screenshots';
const CHECK = process.argv.includes('--check') || process.env.CHECK === '1';
if (!CHECK) mkdirSync(out, { recursive: true });

// Server statico temporaneo, fermato per PID al termine
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', HOST], {
  cwd: 'dist/rrstudio-tools/browser',
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1000));
// il server va fermato anche se qualcosa fallisce più avanti
process.on('exit', () => server.kill());

// rete di sicurezza: se qualcosa si blocca lo script finisce comunque e ferma il server
const watchdog = setTimeout(() => {
  console.error('Timeout: screenshot interrotti dopo 5 minuti');
  server.kill();
  process.exit(1);
}, 5 * 60 * 1000);
watchdog.unref();

let browser;
try {
  // http su un IP non è un contesto sicuro: senza questo flag crypto.subtle (hash) non esisterebbe
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: [`--unsafely-treat-insecure-origin-as-secure=${base}`],
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const errors = [];
try {
  // ONLY=home-light.png,base64.png limita gli screenshot a quelli elencati
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  async function shot(name, { width, dark, path = '/', setup }) {
    if (only && !only.includes(name)) return;
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: dark ? 'dark' : 'light',
      locale: 'it-IT',
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    const prefix = `[${name}] `;
    page.on('request', (r) => !/^(blob:|data:)/.test(r.url()) && !r.url().startsWith(base) && errors.push(prefix + 'richiesta esterna: ' + r.url()));
    page.on('console', (m) => m.type() === 'error' && errors.push(prefix + m.text()));
    page.on('pageerror', (e) => errors.push(prefix + e.message));
    try {
      await page.goto(base + path);
      await page.waitForTimeout(900); // animazione d'ingresso delle sezioni
      if (setup) await setup(page);
      if (!CHECK) await page.screenshot({ path: join(out, name), fullPage: true });
    } catch (e) {
      // un'interazione fallita non ferma gli altri: viene riportata alla fine con exit 1
      errors.push(prefix + 'interazione fallita: ' + e.message.split('\n')[0]);
    }
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
  await shot('home-mobile.png', { width: 390, dark: false });
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
  // PDF di esempio creati al volo con pdf-lib (nessun file scaricato): pagine di testo e colori diversi
  const makePdf = async (title, label, palette, pages) => {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const body = await doc.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= pages; n++) {
      const page = doc.addPage(n % 3 === 0 ? [842, 595] : [595, 842]);
      const { width, height } = page.getSize();
      const [r, g, b] = palette[(n - 1) % palette.length];
      page.drawRectangle({ x: 0, y: height - 140, width, height: 140, color: rgb(r, g, b) });
      page.drawText(label, { x: 40, y: height - 85, size: 36, font, color: rgb(1, 1, 1) });
      page.drawText(`Pagina ${n}`, { x: 40, y: height - 200, size: 28, font, color: rgb(0.1, 0.1, 0.12) });
      for (let k = 0; k < 14; k++) {
        page.drawText('Testo di esempio per la miniatura: righe di prova del documento.', {
          x: 40,
          y: height - 250 - k * 22,
          size: 12,
          font: body,
          color: rgb(0.35, 0.35, 0.38),
        });
      }
      page.drawRectangle({ x: 40, y: 60, width: width - 80, height: 70, color: rgb(r, g, b), opacity: 0.25 });
    }
    return Buffer.from(await doc.save());
  };
  const samplePdfs = async (page) => {
    const a = await makePdf('Contratto di esempio', 'Contratto', [[0.7, 0.33, 0.16], [0.75, 0.5, 0.1], [0.55, 0.3, 0.2]], 4);
    const b = await makePdf('Allegati di esempio', 'Allegati', [[0.18, 0.43, 0.62], [0.2, 0.5, 0.45]], 3);
    await page.setInputFiles('input[type=file]', [
      { name: 'contratto.pdf', mimeType: 'application/pdf', buffer: a },
      { name: 'allegati.pdf', mimeType: 'application/pdf', buffer: b },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.card .thumb img').length === 7, null, { timeout: 30000 });
    await page.getByRole('button', { name: 'Ruota la pagina 2 a destra' }).click();
    await page.getByRole('checkbox', { name: /Seleziona la pagina 5/ }).check();
    await page.getByRole('checkbox', { name: /Seleziona la pagina 6/ }).check();
    await page.waitForTimeout(500);
  };
  await shot('pdf-tools.png', { width: 1280, dark: false, path: '/pdf-tools/', setup: samplePdfs });
  await shot('json-formatter.png', {
    width: 1280,
    dark: false,
    path: '/json-formatter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Prova con un esempio' }).click();
    },
  });
  // JSON Viewer: esempio caricato (albero aperto al livello 3) e un nodo selezionato, con percorso nel pannello
  await shot('json-viewer.png', {
    width: 1280,
    dark: false,
    path: '/json-viewer/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Prova con un esempio' }).click();
      await page.waitForSelector('.tree .row');
      await page.locator('.tree .row', { hasText: 'Mario Rossi' }).first().click();
      await page.waitForTimeout(300);
    },
  });
  await shot('password-generator.png', {
    width: 1280,
    dark: false,
    path: '/password-generator/',
    setup: async (page) => {
      await page.waitForFunction(() => document.querySelector('#pw-out')?.textContent.trim().length > 0);
      await page.getByRole('button', { name: 'Genera 10' }).click();
      await page.waitForSelector('[data-testid=pw-list] code');
    },
  });
  await shot('hash-generator.png', {
    width: 1280,
    dark: false,
    path: '/hash-generator/',
    setup: async (page) => {
      await page.fill('#hash-in', 'abc');
      await page.fill('#hash-cmp', 'BA7816BF 8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
      await page.waitForSelector('article.match');
    },
  });
  // Dati inventati: Mario Rossi, nato a Roma il 01/01/1980
  await shot('codice-fiscale.png', {
    width: 1280,
    dark: false,
    path: '/codice-fiscale/',
    setup: async (page) => {
      await page.fill('#cf-surname', 'Rossi');
      await page.fill('#cf-name', 'Mario');
      await page.getByLabel('Maschio').check();
      await page.fill('#cf-date', '1980-01-01');
      await page.getByRole('combobox').focus();
      await page.keyboard.type('Roma', { delay: 80 });
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid=cf-code]');
    },
  });
  await shot('iban-partita-iva.png', {
    width: 1280,
    dark: false,
    path: '/iban-partita-iva/',
    setup: async (page) => {
      await page.fill('#ibv-input', 'IT60 X054 2811 1010 0000 0123 456');
      await page.waitForSelector('[data-testid=ibv-it]');
    },
  });
  // ---- Fattura elettronica: fattura inventata (nessun dato reale) ----
  const sampleInvoice = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
<FatturaElettronicaHeader>
<DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdTrasmittente><ProgressivoInvio>00042</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>ABC1234</CodiceDestinatario></DatiTrasmissione>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Alfa Servizi di Prova S.r.l.</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>Via dei Campioni</Indirizzo><NumeroCivico>10</NumeroCivico><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>08888888888</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Beta Costruzioni di Esempio S.p.A.</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>Via Fittizia</Indirizzo><NumeroCivico>5</NumeroCivico><CAP>20100</CAP><Comune>Milano</Comune><Provincia>MI</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente>
</FatturaElettronicaHeader>
<FatturaElettronicaBody>
<DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-03-15</Data><Numero>2026/0042</Numero><ImportoTotaleDocumento>470.90</ImportoTotaleDocumento><Causale>Servizi di consulenza di esempio, marzo 2026.</Causale></DatiGeneraliDocumento><DatiOrdineAcquisto><IdDocumento>ORD-7788</IdDocumento><Data>2026-02-20</Data></DatiOrdineAcquisto></DatiGenerali>
<DatiBeniServizi>
<DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Consulenza oraria</Descrizione><Quantita>10.00</Quantita><UnitaMisura>ore</UnitaMisura><PrezzoUnitario>30.00</PrezzoUnitario><PrezzoTotale>300.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>2</NumeroLinea><Descrizione>Materiale di consumo</Descrizione><Quantita>4.00</Quantita><PrezzoUnitario>12.50</PrezzoUnitario><ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>10.00</Percentuale></ScontoMaggiorazione><PrezzoTotale>45.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>3</NumeroLinea><Descrizione>Formazione esente</Descrizione><PrezzoUnitario>50.00</PrezzoUnitario><PrezzoTotale>50.00</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura></DettaglioLinee>
<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>345.00</ImponibileImporto><Imposta>75.90</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo>
<DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura><ImponibileImporto>50.00</ImponibileImporto><Imposta>0.00</Imposta><RiferimentoNormativo>Art. 10 DPR 633/72</RiferimentoNormativo></DatiRiepilogo>
</DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-04-14</DataScadenzaPagamento><ImportoPagamento>470.90</ImportoPagamento><IBAN>IT00A0000000000000000000000</IBAN></DettaglioPagamento></DatiPagamento>
<Allegati><NomeAttachment>condizioni.txt</NomeAttachment><FormatoAttachment>TXT</FormatoAttachment><Attachment>${Buffer.from('Allegato di esempio').toString('base64')}</Attachment></Allegati>
</FatturaElettronicaBody>
</p:FatturaElettronica>`;
  await shot('fattura-elettronica.png', {
    width: 1280,
    dark: false,
    path: '/fattura-elettronica/',
    setup: async (page) => {
      await page.setInputFiles('input[type=file]', [{ name: 'fattura-esempio.xml', mimeType: 'text/xml', buffer: Buffer.from(sampleInvoice) }]);
      await page.waitForSelector('[data-testid=fe-invoice]');
    },
  });

  // ---- Immagini <-> PDF: immagini disegnate al volo ----
  const drawImages = async (page) => {
    const files = await page.evaluate(async () => {
      const mk = async (w, h, c1, c2, type) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.arc(w * 0.7, h * 0.3, Math.min(w, h) * 0.14, 0, 7);
        g.fill();
        const b = await new Promise((r) => c.toBlob(r, type, 0.9));
        const bytes = new Uint8Array(await b.arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      };
      return [
        { name: 'montagna.jpg', mimeType: 'image/jpeg', b64: await mk(1600, 1067, '#2b5a8a', '#e8b27a', 'image/jpeg') },
        { name: 'ritratto.png', mimeType: 'image/png', b64: await mk(900, 1200, '#5a7d2a', '#1c2b1f', 'image/png') },
        { name: 'bosco.webp', mimeType: 'image/webp', b64: await mk(1200, 1200, '#8a4f9e', '#2f6f9f', 'image/webp') },
        { name: 'mare.jpg', mimeType: 'image/jpeg', b64: await mk(1500, 1000, '#2a7f7a', '#f1f3f5', 'image/jpeg') },
      ];
    });
    return files.map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.b64, 'base64') }));
  };
  await shot('images-to-pdf.png', {
    width: 1280,
    dark: false,
    path: '/images-to-pdf/',
    setup: async (page) => {
      await page.setInputFiles('input[type=file]', await drawImages(page));
      await page.waitForFunction(() => document.querySelectorAll('.card .thumb img').length === 4);
      await page.locator('[data-uid="1"] [data-act="after"]').click();
      await page.waitForTimeout(300);
    },
  });
  await shot('pdf-to-images.png', {
    width: 1280,
    dark: false,
    path: '/pdf-to-images/',
    setup: async (page) => {
      const pdf = await makePdf('Relazione di esempio', 'Relazione', [[0.18, 0.43, 0.62], [0.7, 0.33, 0.16], [0.35, 0.5, 0.16]], 4);
      await page.setInputFiles('input[type=file]', [{ name: 'relazione.pdf', mimeType: 'application/pdf', buffer: pdf }]);
      await page.waitForSelector('#ip-dpi');
      await page.selectOption('#ip-dpi', '72');
      await page.getByRole('button', { name: 'Converti' }).click();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid=ip-results] li').length === 4, null, { timeout: 60000 });
      await page.waitForTimeout(400);
    },
  });

  // ---- Metadati foto: JPEG inventato con EXIF (telefono fittizio, GPS) costruito a mano ----
  const exifJpeg = (jpeg) => {
    const ascii = (s) => [...Buffer.from(s + '\0')];
    const u16 = (n) => [n & 255, n >> 8];
    const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    const rat = (list) => list.flatMap(([n, d]) => [...u32(n), ...u32(d)]);
    // IFD0 (5 voci), Exif (3 voci), GPS (4 voci): i valori lunghi vanno in coda
    const data = [];
    const ifd0N = 5, exN = 3, gpsN = 4;
    const size = (n) => 2 + n * 12 + 4;
    const offIfd0 = 8, offEx = offIfd0 + size(ifd0N), offGps = offEx + size(exN), dataStart = offGps + size(gpsN);
    const val = (bytes) => {
      if (bytes.length <= 4) return [...bytes, ...Array(4 - bytes.length).fill(0)];
      const o = dataStart + data.length;
      data.push(...bytes);
      return u32(o);
    };
    const entry = (tag, type, count, bytes) => [...u16(tag), ...u16(type), ...u32(count), ...val(bytes)];
    const str = (tag, s) => entry(tag, 2, s.length + 1, ascii(s));
    const ifd0 = [...u16(ifd0N), ...str(0x010f, 'Marca Fittizia'), ...str(0x0110, 'Prova Phone 1'), ...entry(0x0112, 3, 1, u16(1)), ...entry(0x8769, 4, 1, u32(offEx)), ...entry(0x8825, 4, 1, u32(offGps)), ...u32(0)];
    const ex = [...u16(exN), ...entry(0x829a, 5, 1, rat([[1, 250]])), ...str(0x9003, '2026:03:15 10:22:01'), ...str(0xa431, 'SN-000123'), ...u32(0)];
    const gps = [...u16(gpsN), ...entry(0x0001, 2, 2, ascii('N')), ...entry(0x0002, 5, 3, rat([[41, 1], [53, 1], [2160, 100]])), ...entry(0x0003, 2, 2, ascii('E')), ...entry(0x0004, 5, 3, rat([[12, 1], [29, 1], [3240, 100]])), ...u32(0)];
    const tiff = [0x49, 0x49, 42, 0, ...u32(offIfd0), ...ifd0, ...ex, ...gps, ...data];
    const len = tiff.length + 8;
    return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]), jpeg.subarray(2)]);
  };
  await shot('exif-viewer.png', {
    width: 1280,
    dark: false,
    path: '/exif-viewer/',
    setup: async (page) => {
      const [photo] = await drawImages(page);
      await page.setInputFiles('input[type=file]', [{ name: 'gita-in-montagna.jpg', mimeType: 'image/jpeg', buffer: exifJpeg(photo.buffer) }]);
      await page.waitForSelector('[data-testid=exif-warn]');
      await page.getByRole('button', { name: 'Rimuovi i metadati' }).first().click();
      await page.waitForSelector('[data-testid=exif-result]');
    },
  });
  // ---- Generatore di QR code, calcolo IVA, confronto testi, convertitore CSV/JSON/Excel (dati inventati) ----
  await shot('qr-code-generator.png', {
    width: 1280,
    dark: false,
    path: '/qr-code-generator/',
    setup: async (page) => {
      await page.fill('#qr-url', 'https://example.com/ciao');
      await page.waitForSelector('[data-testid=qr-preview]');
      await page.waitForTimeout(300);
    },
  });
  await shot('calcolo-iva.png', {
    width: 1280,
    dark: false,
    path: '/calcolo-iva/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Notula / fattura', exact: true }).click();
      await page.fill('#iva-amount', '1.000,00');
      await page.getByLabel('Rivalsa INPS 4%').check();
      await page.selectOption('#iva-cassa', '400');
      await page.waitForSelector('[data-testid=iva-table]');
    },
  });
  await shot('calcolo-ritenuta-acconto.png', {
    width: 1280,
    dark: false,
    path: '/calcolo-ritenuta-acconto/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Professionista', exact: true }).click();
      await page.fill('#rit-amount', '1.000,00');
      await page.fill('#rit-cassa', '4');
      await page.waitForSelector('[data-testid=rit-table]');
    },
  });
  await shot('calcolo-rata-mutuo.png', {
    width: 1280,
    dark: false,
    path: '/calcolo-rata-mutuo/',
    setup: async (page) => {
      await page.fill('#mutuo-capital', '150.000');
      await page.fill('#mutuo-tan', '3,25');
      await page.fill('#mutuo-years', '25');
      await page.waitForSelector('[data-testid=mutuo-table]');
    },
  });
  await shot('numeri-in-lettere.png', {
    width: 1280,
    dark: false,
    path: '/numeri-in-lettere/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Assegno / importo', exact: true }).click();
      await page.fill('#nl-input', '1.234,56');
      await page.getByLabel('Aggiungi «euro» davanti').check();
      await page.waitForSelector('[data-testid=nl-result]');
    },
  });
  await shot('percentage-calculator.png', {
    width: 1280,
    dark: false,
    path: '/percentage-calculator/',
    setup: async (page) => {
      const fill = async (id, a, b) => {
        await page.fill(`#pct-${id}-a`, a);
        await page.fill(`#pct-${id}-b`, b);
      };
      await fill('of', '22', '1250');
      await fill('is', '45', '180');
      await fill('change', '80', '100');
      await fill('apply', '250', '15');
      await fill('reverse', '85', '15');
      await page.waitForSelector('[data-testid=pct-out-reverse] .answer');
    },
  });
  await shot('unit-converter.png', {
    width: 1280,
    dark: false,
    path: '/unit-converter/',
    setup: async (page) => {
      await page.fill('#uc-value', '42,195');
      await page.waitForSelector('[data-testid=uc-table]');
    },
  });
  await shot('date-calculator.png', {
    width: 1280,
    dark: false,
    path: '/date-calculator/',
    setup: async (page) => {
      await page.fill('#dc-from', '2020-02-29');
      await page.fill('#dc-to', '2026-11-16');
      await page.waitForSelector('[data-testid=dc-table]');
    },
  });
  await shot('timezone-converter.png', {
    width: 1280,
    dark: false,
    path: '/timezone-converter/',
    setup: async (page) => {
      // data e ora si impostano dopo l'idratazione: si aspettano le schede e poi si scrive
      await page.waitForSelector('[data-testid=tz-cards]');
      await page.fill('#tz-date', '2026-11-16');
      await page.fill('#tz-time', '09:30');
      await page.fill('#tz-search', 'Sydney');
      await page.getByRole('button', { name: /Aggiungi Sydney/ }).click();
      await page.waitForTimeout(300);
    },
  });
  await shot('number-base-converter.png', {
    width: 1280,
    dark: false,
    path: '/number-base-converter/',
    setup: async (page) => {
      await page.fill('#nb-input', '-42');
      await page.fill('#nb-float', '0,1');
      await page.waitForSelector('[data-testid=nb-float]');
      await page.waitForSelector('[data-testid=nb-bits]');
    },
  });
  await shot('text-diff.png', {
    width: 1280,
    dark: false,
    path: '/text-diff/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('table.diff');
    },
  });
  // ---- Markdown, contatore, regex, giorni lavorativi (dati inventati) ----
  await shot('markdown-editor.png', {
    width: 1280,
    dark: false,
    path: '/markdown-editor/',
    setup: async (page) => {
      await page.waitForSelector('[data-testid=md-preview] h1');
    },
  });
  await shot('word-counter.png', {
    width: 1280,
    dark: false,
    path: '/word-counter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('[data-testid=wc-freq]');
    },
  });
  await shot('regex-tester.png', {
    width: 1280,
    dark: false,
    path: '/regex-tester/',
    setup: async (page) => {
      await page.selectOption('#rx-examples', 'date');
      await page.waitForSelector('[data-testid=rx-matches]');
    },
  });
  await shot('calcolo-giorni-lavorativi.png', {
    width: 1280,
    dark: false,
    path: '/calcolo-giorni-lavorativi/',
    setup: async (page) => {
      await page.fill('#wd-start', '2026-04-01');
      await page.fill('#wd-end', '2026-04-30');
      await page.waitForSelector('[data-testid=wd-result]');
    },
  });
  await shot('csv-json-converter.png', {
    width: 1280,
    dark: false,
    path: '/csv-json-converter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('[data-testid=cj-preview]');
    },
  });
  // ---- Strumenti per sviluppatori: JWT, UUID, timestamp, contrasto (dati inventati) ----
  await shot('jwt-decoder.png', {
    width: 1280,
    dark: false,
    path: '/jwt-decoder/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('[data-testid=jwt-dates]');
    },
  });
  await shot('uuid-generator.png', {
    width: 1280,
    dark: false,
    path: '/uuid-generator/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'UUID v7' }).click();
      await page.fill('#uuid-count', '8');
      await page.locator('#uuid-count').dispatchEvent('change');
      await page.fill('#uuid-check', '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b');
      await page.waitForSelector('[data-testid=uuid-date]');
    },
  });
  await shot('timestamp-converter.png', {
    width: 1280,
    dark: false,
    path: '/timestamp-converter/',
    setup: async (page) => {
      await page.selectOption('#ts-tz', 'Europe/Rome');
      await page.fill('#ts-in', '1700000000');
      await page.fill('#ts-date', '2026-03-29 02:30:00');
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('[data-testid=ts-batch-table]');
    },
  });
  await shot('color-contrast-checker.png', {
    width: 1280,
    dark: false,
    path: '/color-contrast-checker/',
    setup: async (page) => {
      await page.waitForSelector('[data-testid=cc-ratio]');
    },
  });
  await shot('yaml-json-converter.png', {
    width: 1280,
    dark: false,
    path: '/yaml-json-converter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForSelector('[data-testid=yj-out]');
    },
  });
  await shot('xml-formatter.png', {
    width: 1280,
    dark: false,
    path: '/xml-formatter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=xml-out]')?.value.includes('\n'));
    },
  });
  await shot('sql-formatter.png', {
    width: 1280,
    dark: false,
    path: '/sql-formatter/',
    setup: async (page) => {
      await page.selectOption('#sql-dialect', 'postgresql');
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=sql-out]')?.value.includes('SELECT'));
    },
  });
  await shot('html-entities.png', {
    width: 1280,
    dark: false,
    path: '/html-entities/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=ent-out]')?.value.includes('&'));
    },
  });
  await shot('case-converter.png', {
    width: 1280,
    dark: false,
    path: '/case-converter/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForSelector('[data-testid=case-snake]');
    },
  });
  await shot('slug-generator.png', {
    width: 1280,
    dark: false,
    path: '/slug-generator/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Esempio' }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=slug-out]')?.value.length > 0);
    },
  });
  await shot('lorem-ipsum-generator.png', {
    width: 1280,
    dark: false,
    path: '/lorem-ipsum-generator/',
    setup: async (page) => {
      await page.fill('#lorem-seed', 'rrstudio');
      await page.waitForFunction(() => document.querySelector('[data-testid=lorem-out]')?.value.startsWith('Lorem ipsum'));
    },
  });
  await shot('cron-expression.png', {
    width: 1280,
    dark: false,
    path: '/cron-expression/',
    setup: async (page) => {
      await page.fill('#cron-expr', '*/15 9-17 * * 1-5');
      await page.waitForSelector('[data-testid=cron-runs]');
    },
  });
  await shot('chmod-calculator.png', {
    width: 1280,
    dark: false,
    path: '/chmod-calculator/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Usa 755' }).click();
      await page.fill('#chmod-expr', 'g+w,o-x');
      await page.waitForSelector('[data-testid=chmod-expr-result]');
    },
  });
  await shot('css-unit-converter.png', {
    width: 1280,
    dark: false,
    path: '/css-unit-converter/',
    setup: async (page) => {
      await page.fill('#cssu-value', '24');
      await page.fill('#cssu-in', '.card {\n  padding: 24px 16px;\n  margin: 0 auto 8px;\n  font-size: 14px;\n  border: 1px solid #ccc;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n}\n@media (min-width: 768px) {\n  .card { padding: 32px; }\n}\n');
      await page.waitForFunction(() => document.querySelector('[data-testid=cssu-out]')?.value.includes('rem'));
    },
  });
  await shot('css-generator.png', {
    width: 1280,
    dark: false,
    path: '/css-generator/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Tramonto' }).click();
      await page.getByRole('button', { name: 'Aggiungi stop' }).click();
      await page.waitForSelector('[data-testid=cssg-code]');
    },
  });
  await shot('svg-optimizer.png', {
    width: 1280,
    dark: false,
    path: '/svg-optimizer/',
    setup: async (page) => {
      await page.fill('#svgo-paste', "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- Generator: Illustrator 27.0 -->\n<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\">\n  <metadata>editor data that nobody needs</metadata>\n  <title>Logo</title>\n  <g id=\"Livello_1\">\n    <circle cx=\"32.000000\" cy=\"32.000000\" r=\"28.500000\" fill=\"#6366F1\" stroke=\"#000000\" stroke-width=\"1.000000\"/>\n    <path d=\"M 20.123456 34.654321 L 28.987654 43.111111 L 45.555555 22.222222\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"5.000000\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  </g>\n</svg>\n");
      await page.getByRole('button', { name: 'Ottimizza il codice incollato' }).click();
      await page.waitForSelector('[data-testid=svgo-after]');
      await page.waitForTimeout(300);
    },
  });
  await shot('favicon-generator.png', {
    width: 1280,
    dark: false,
    path: '/favicon-generator/',
    setup: async (page) => {
      await page.fill('#fav-name', 'Il mio sito');
      await page.fill('#fav-short', 'Sito');
      await page.waitForSelector('[data-testid=fav-previews]');
      await page.waitForTimeout(300);
    },
  });
  await shot('htpasswd-generator.png', {
    width: 1280,
    dark: false,
    path: '/htpasswd-generator/',
    setup: async (page) => {
      await page.fill('#ht-cost', '6');
      await page.locator('#ht-cost').dispatchEvent('change');
      await page.fill('#ht-user-1', 'mario');
      await page.fill('#ht-pw-1', 'una-password-lunga-e-casuale');
      await page.getByRole('button', { name: 'Aggiungi utente' }).click();
      await page.fill('#ht-user-2', 'giulia');
      await page.fill('#ht-pw-2', 'un-altra-password');
      await page.getByRole('button', { name: 'Genera', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=ht-out]')?.value.split('\n').length === 2);
    },
  });
  await shot('certificate-decoder.png', {
    width: 1280,
    dark: false,
    path: '/certificate-decoder/',
    setup: async (page) => {
      await page.fill('#cert-in', "-----BEGIN CERTIFICATE-----\nMIIEDTCCAvWgAwIBAgIUfyC3V5lv3ljF/1wkogHIaIherScwDQYJKoZIhvcNAQEL\nBQAwQTELMAkGA1UEBhMCSVQxGDAWBgNVBAoMD0VzZW1waW8gVGVzdCBDQTEYMBYG\nA1UEAwwPRXNlbXBpbyBSb290IENBMCAXDTI2MTExNzA1NTI0MloYDzIxMjYxMDI0\nMDU1MjQyWjBjMQswCQYDVQQGEwJJVDESMBAGA1UECAwJTG9tYmFyZGlhMQ8wDQYD\nVQQHDAZNaWxhbm8xFDASBgNVBAoMC0VzZW1waW8gU3JsMRkwFwYDVQQDDBB3d3cu\nZXNlbXBpby50ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAufaV\nR5ZLiBU8DqVZhWafAs5B+1OmtioWLGFKs+JqXA6PtZrkq9OU6LVrBCSFqG9azSBZ\n6BIMhddJkGUiND5n8m+goEzEM0zNIWwICkLAfG2cWAM40X28Z0jTnT50M0AgVQP9\n+hrnm4jl2zErJ08chIAId2gLgbgkRyZx/UF9VrMsIw1FmKLo3rBfkHKf+JAP+61x\nzd366smlN8vpynhIgTqbsW77hSFSKzmj5Ifr0FT1Wg7FcGYuyq5mf429pC5G5F62\nTv1KrwnBD6hh67lxppu4gVDiT3fqFXcEyosh5FbJLSC01M8BdsD4tGt41+tixtQ+\nNbhjup7SH3jGrG/pNQIDAQABo4HYMIHVMFkGA1UdEQRSMFCCEHd3dy5lc2VtcGlv\nLnRlc3SCDGVzZW1waW8udGVzdIcEwAACCoERaW5mb0Blc2VtcGlvLnRlc3SGFWh0\ndHBzOi8vZXNlbXBpby50ZXN0LzAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMAkGA1UdEwQCMAAwHQYDVR0OBBYEFBSff/tLoe9D\n0vhQ39aiT4ijIb7IMB8GA1UdIwQYMBaAFGNBlJcieMCAKIqEyhsxaYbtq0aHMA0G\nCSqGSIb3DQEBCwUAA4IBAQBLch6w7zRfNFDedmmD/SunpASomCpcqEAmYwRon1go\nX9dN7DtPOXukikJMy33wHgW1XMrHq+bc6Q1NvOLCJezVAQdZHvHFuZJchikivNci\nvM/a6JEUlLyqjT4/XZAzDJoZuGyLF8XBgvSx1IrMtB+FR/wJpxK2n35Zc6dYvaN0\nU4oW9KBhzGWhKQhVjAa0E9p3I6OB/WxQMsod+b09QUWnfXyUoIbFw9I+MCQpejOx\nO3nl5O6A6zZVRZhmBuuFMAgVLOUP+FH0+1YDvjb6U24f8sTF0GWm9fAzsdTgqV8z\nCGyDq5gCwtOeWlFmG0GOykQyveW4ItdfJQQ3cO7IKz7I\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDeDCCAmCgAwIBAgIUZYp5F1F1ianL1tW3CrVSsWeTBgQwDQYJKoZIhvcNAQEL\nBQAwQTELMAkGA1UEBhMCSVQxGDAWBgNVBAoMD0VzZW1waW8gVGVzdCBDQTEYMBYG\nA1UEAwwPRXNlbXBpbyBSb290IENBMCAXDTI2MTExNzA1NTI0MVoYDzIxMjYxMDI0\nMDU1MjQxWjBBMQswCQYDVQQGEwJJVDEYMBYGA1UECgwPRXNlbXBpbyBUZXN0IENB\nMRgwFgYDVQQDDA9Fc2VtcGlvIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQC1N3cjhtmhLRO3JOmo9Wn/HaQwxuh3ywAbZybVFiD7Re9dZ/D6\n4cRNYb3H21RfxgT6ErL+T7weJ3YLCWha4QfeU6J56rtthEky4mjizlm120Yssl7o\nNoSzHga7iPwSKfQAgkLqgTMf2ib8F4miVyRgkkiLGAO2Nzl4Gbpe2Gyo1IsldIEm\nQMJzvBsgxBrB3lSKf1q999SkiiPUdp7nCXBTUqg0p1t+WAqipOI0aFx5BBUWY1Hj\nHImnSxqcyGsjl7+zQj+8uj7OGX0Ao2T5PovGJ4Bu2B09XTD9I7XfEcegqFp7oS/0\n3HvqZjVZROdd8cjyImFuDrxVXBeDUCMhDS8NAgMBAAGjZjBkMB0GA1UdDgQWBBRj\nQZSXInjAgCiKhMobMWmG7atGhzAfBgNVHSMEGDAWgBRjQZSXInjAgCiKhMobMWmG\n7atGhzASBgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG\n9w0BAQsFAAOCAQEAb8lZATQCAnBIDa2TjpbchD8meg+GdYHa2uka+D8bE+4iHN3v\nZ5L4x711bkr0EvPrJkIw1DuqeG0R6AWgTx/9Stsg6LzxznEh2GHcVu72ZC64HqdI\nYu8OSCc/a1fhoFnD6mfAFZwpwEW7Y/2TYL4AYXDRv/QKRVHEsRmnAMf36vrnnn67\nhlj7RlVQqXW1Elm22uDUYHsRo/ljggM7e2UcHrDhb5EBbIiWieOzwAvlHFHezJkb\n4k1kCWBxvzsyOaIw+LJvxnoAfb3Ay5qnM2DQ0BTWp/nZBIi0Ni1JYo/3oRJ+VWdj\nlABdaTi/QnoLNGh+JLuSZi4yNxgTEQHuOK4TEA==\n-----END CERTIFICATE-----\n");
      await page.waitForSelector('[data-testid=cert-status]');
    },
  });
  await shot('password-strength-checker.png', {
    width: 1280,
    dark: false,
    path: '/password-strength-checker/',
    setup: async (page) => {
      await page.fill('#pws-input', 'Roma1990!');
      await page.getByRole('button', { name: 'Mostra la password' }).click();
      await page.waitForSelector('[data-testid=pws-crack]');
      await page.waitForTimeout(300);
    },
  });
  await shot('totp-generator.png', {
    width: 1280,
    dark: false,
    path: '/totp-generator/',
    setup: async (page) => {
      await page.fill('#totp-secret', 'JBSWY3DPEHPK3PXP');
      await page.fill('#totp-label', 'mario@example.com');
      await page.fill('#totp-issuer', 'Esempio');
      await page.waitForFunction(() => /\d/.test(document.querySelector('[data-testid=totp-code]')?.textContent ?? ''));
      const code = ((await page.textContent('[data-testid=totp-code]')) ?? '').replace(/\s/g, '');
      await page.fill('#totp-verify-code', code);
      await page.waitForSelector('[data-testid=totp-verify-result]');
      await page.waitForSelector('[data-testid=totp-qr]');
      await page.waitForTimeout(300);
    },
  });
  await shot('file-encrypt.png', {
    width: 1280,
    dark: false,
    path: '/file-encrypt/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Testo', exact: true }).click();
      await page.fill('#fe-pass', 'una passphrase lunga e difficile');
      await page.fill('#fe-pass2', 'una passphrase lunga e difficile');
      await page.fill('#fe-text', 'Messaggio riservato: ci vediamo domani alle 18:30.');
      await page.locator('[data-testid=fe-run]').click();
      await page.waitForFunction(() => (document.querySelector('[data-testid=fe-out]')?.value ?? '').length > 20);
    },
  });
  await shot('barcode-generator.png', {
    width: 1280,
    dark: false,
    path: '/barcode-generator/',
    setup: async (page) => {
      await page.fill('[data-testid=bc-text]', '400638133393');
      await page.waitForSelector('[data-testid=bc-preview]');
      await page.waitForSelector('[data-testid=bc-check]');
      await page.waitForTimeout(300);
    },
  });
  await shot('qr-code-reader.png', {
    width: 1280,
    dark: false,
    path: '/qr-code-reader/',
    setup: async (page) => {
      // il QR da leggere viene creato con il generatore QR dello stesso sito e scaricato come PNG
      const gen = await page.context().newPage();
      await gen.goto(base + '/qr-code-generator/');
      await gen.fill('#qr-url', 'https://example.com/ciao?da=qr');
      await gen.waitForSelector('[data-testid=qr-preview]');
      const [download] = await Promise.all([gen.waitForEvent('download'), gen.getByRole('button', { name: /PNG/ }).first().click()]);
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      await gen.close();
      await page.setInputFiles('input[type=file]', [{ name: 'qr.png', mimeType: 'image/png', buffer: Buffer.concat(chunks) }]);
      await page.waitForSelector('[data-testid=qrr-result]');
    },
  });
  await shot('sort-lines.png', {
    width: 1280,
    dark: false,
    path: '/sort-lines/',
    setup: async (page) => {
      await page.fill('#sl-in', 'mela\nPera\nbanana\nmela\n\nalbicocca\nbanana\nmela\nciliegia\nPera');
      await page.selectOption('#sl-mode', 'frequency');
      await page.selectOption('#sl-dedupe', 'ignoreCase');
      await page.locator('[data-testid=sl-count]').check();
      await page.waitForFunction(() => (document.querySelector('[data-testid=sl-out]')?.value ?? '').includes('3×'));
    },
  });
  await shot('find-replace.png', {
    width: 1280,
    dark: false,
    path: '/find-replace/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Carica un esempio' }).click();
      await page.waitForSelector('[data-testid=fr-preview] mark');
      await page.waitForTimeout(300);
    },
  });
  await shot('text-to-speech.png', {
    width: 1280,
    dark: false,
    path: '/text-to-speech/',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Testo di esempio' }).click();
      await page.waitForTimeout(1800); // il browser carica le voci locali (se ce ne sono)
    },
  });

  // Preferiti e menu personalizzati: due stelle dalla home, un menu, esportazione, cancellazione e reimport da link.
  // Lo screenshot finale è quello della pagina di gestione con dati d'esempio.
  const must = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  await shot('favorites.png', {
    width: 1280,
    dark: false,
    path: '/',
    setup: async (page) => {
      const readKey = () => page.evaluate(() => localStorage.getItem('rrtools.favorites'));
      // 1. due preferiti dalle card della home
      const star = (title) => page.getByRole('button', { name: 'Aggiungi ai preferiti: ' + title, exact: true });
      await page.waitForFunction(() => !document.querySelector('app-favorite-button button:disabled'));
      await star('Base64 Encode/Decode').click();
      await star('Hash e checksum').click();
      await page.waitForSelector('#fav-h');
      must((await page.locator('#fav-h').textContent()).includes('2'), 'la sezione preferiti non mostra 2 strumenti');
      // il pulsante sta fuori dal link: nessun elemento interattivo annidato nelle card
      must((await page.locator('a button, a app-favorite-button').count()) === 0, 'pulsante dentro un link');
      // persistenza: dopo il ricaricamento restano premuti
      await page.reload();
      await page.waitForSelector('#fav-h');
      must((await page.locator('#fav-h').textContent()).includes('2'), 'i preferiti non sono sopravvissuti al ricaricamento');
      must(JSON.parse(await readKey()).favorites.length === 2, 'chiave rrtools.favorites mancante');
      // la stella nella pagina di uno strumento
      await page.goto(base + '/url-encode/');
      const toolStar = page.getByRole('button', { name: 'Aggiungi ai preferiti', exact: true });
      await toolStar.waitFor();
      must((await toolStar.getAttribute('aria-pressed')) === 'false', 'stella dello strumento già premuta');
      await toolStar.click();
      await page.waitForSelector('app-tool-frame button[aria-pressed=true]'); // stella premuta (con attesa dell'aggiornamento)
      await toolStar.click(); // la toglie di nuovo
      await page.waitForSelector('app-tool-frame button[aria-pressed=false]');
      // 2. menu a tendina dell'intestazione: Esc chiude e riporta il focus sul pulsante
      const menuBtn = page.locator('app-favorites-menu button.trigger');
      await menuBtn.click();
      await page.waitForSelector('button.trigger[aria-expanded=true]');
      await page.getByRole('link', { name: 'Hash e checksum', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForSelector('button.trigger[aria-expanded=false]');
      must(await menuBtn.evaluate((el) => el === document.activeElement), 'il focus non torna sul pulsante');
      await menuBtn.click();
      await page.getByRole('link', { name: 'Gestisci preferiti e menu' }).click();
      await page.waitForURL('**/preferiti');
      await page.waitForSelector('#new-group');
      must((await page.locator('meta[name=robots]').getAttribute('content')).includes('noindex'), 'noindex mancante');
      // 3. un menu personalizzato con uno strumento aggiunto dalla ricerca
      await page.fill('#new-group', 'Lavoro');
      await page.getByRole('button', { name: 'Crea menu' }).click();
      await page.getByRole('button', { name: 'Aggiungi strumenti' }).nth(1).click();
      await page.getByRole('searchbox', { name: 'Cerca uno strumento da aggiungere' }).fill('uuid');
      await page.getByRole('button', { name: /^Aggiungi «Generatore UUID»/ }).click();
      await page.getByRole('button', { name: /^Aggiungi «Generatore UUID»/ }).waitFor({ state: 'detached' });
      // riordino da tastiera: "Hash" sotto "Base64" e di nuovo su
      const down = page.getByRole('button', { name: 'Sposta «Base64 Encode/Decode» in basso' });
      await down.click();
      await page.waitForFunction(() => {
        const t = [...document.querySelectorAll('ol[aria-label="Preferiti"] .row-title')].map((e) => e.textContent);
        return t[0] === 'Hash e checksum' && t[1] === 'Base64 Encode/Decode';
      });
      // 4. esportazione
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Esporta JSON' }).click()]);
      const exported = readFileSync(await dl.path(), 'utf8');
      const data = JSON.parse(exported);
      must(data.v === 1 && data.favorites.length === 2 && data.groups.length === 1 && data.groups[0].tools.length === 1, 'esportazione inattesa');
      // 5. link di condivisione
      await page.getByRole('button', { name: 'Crea link di condivisione' }).click();
      const url = await page.inputValue('#share-url');
      must(url.includes('/preferiti#d='), 'link di condivisione inatteso: ' + url);
      // 6. cancella tutto (con conferma)
      await page.getByRole('button', { name: 'Cancella preferiti e menu' }).click();
      await page.getByRole('button', { name: 'Sì, cancella tutto' }).click();
      await page.waitForFunction(() => localStorage.getItem('rrtools.favorites') === null);
      // 7. reimport dal link: anteprima e conferma, mai import automatico
      await page.goto(url);
      await page.getByRole('heading', { name: 'Importare questi dati?' }).waitFor();
      must((await readKey()) === null, 'import automatico dal link');
      await page.waitForFunction(() => !location.hash, null, { timeout: 5000 }).catch(() => {
        throw new Error('dati lasciati nell\'indirizzo');
      });
      await page.getByRole('button', { name: 'Importa', exact: true }).click();
      must(JSON.parse(await readKey()).groups.length === 1, 'import dal link non riuscito');
      // 8. file non valido: messaggio chiaro, nessuna modifica
      await page.setInputFiles('input[type=file]', { name: 'rotto.json', mimeType: 'application/json', buffer: Buffer.from('{non json') });
      await page.getByRole('alert').filter({ hasText: 'JSON' }).waitFor();
      // 9. la home mostra preferiti e menu
      await page.goto(base + '/');
      await page.waitForSelector('#fav-h');
      must((await page.locator('#fav-h').textContent()).includes('2'), 'home senza i preferiti reimportati');
      must((await page.locator('h2.cat-title', { hasText: 'Lavoro' }).count()) === 1, 'home senza il menu personalizzato');
      // schermata finale: la pagina di gestione con i dati d'esempio
      await page.goto(base + '/preferiti/');
      await page.waitForSelector('.group');
      await page.waitForTimeout(300);
    },
  });
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.error('Errori:', errors);
  process.exitCode = 1;
} else if (CHECK) {
  console.log('e2e: tutte le interazioni riuscite, nessun errore in console');
}
