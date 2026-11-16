// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Genera gli screenshot in docs/screenshots/ servendo dist/rrstudio-tools/browser in locale.
// Uso: npm run build && npm run screenshots   (serve Chromium di Playwright già installato)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.error('Errori in console:', errors);
  process.exitCode = 1;
}
