// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Dimensioni incorporate in favicon.ico. */
export const ICO_SIZES = [16, 32, 48] as const;
/** Tutte le dimensioni PNG da disegnare. */
export const ALL_SIZES = [16, 32, 48, 180, 192, 512] as const;

export interface IcoImage {
  size: number;
  /** Byte di un file PNG. */
  png: Uint8Array;
}

/**
 * Scrive un file .ico con immagini PNG incorporate (supportato da tutti i browser attuali e da Windows Vista in poi).
 * Formato: ICONDIR (6 byte) + una ICONDIRENTRY (16 byte) per immagine + i dati PNG.
 */
export function encodeIco(images: readonly IcoImage[]): Uint8Array {
  if (images.length === 0) throw new Error('ico: nessuna immagine');
  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // riservato
  view.setUint16(2, 1, true); // tipo 1 = icona
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach((img, i) => {
    if (img.size < 1 || img.size > 256) throw new Error('ico: dimensione non valida');
    const p = 6 + 16 * i;
    out[p] = img.size === 256 ? 0 : img.size; // larghezza (0 = 256)
    out[p + 1] = img.size === 256 ? 0 : img.size; // altezza
    out[p + 2] = 0; // colori in tavolozza
    out[p + 3] = 0; // riservato
    view.setUint16(p + 4, 1, true); // piani
    view.setUint16(p + 6, 32, true); // bit per pixel
    view.setUint32(p + 8, img.png.length, true);
    view.setUint32(p + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

// ---------- disposizione dell'immagine sul quadrato ----------

export type FitMode = 'cover' | 'contain';

export interface Layout {
  /** Porzione dell'immagine sorgente da usare. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Dove disegnarla sul quadrato di lato `size`. */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Calcola come mettere un'immagine srcW×srcH su un quadrato di lato `size`.
 * `paddingPct` (0-40) è il margine su ogni lato in % del lato. `cover` ritaglia al centro un quadrato,
 * `contain` mostra tutta l'immagine e lascia bordi se non è quadrata. `zoom` (1-4) ingrandisce al centro.
 */
export function layoutImage(srcW: number, srcH: number, size: number, paddingPct: number, mode: FitMode, zoom = 1): Layout {
  const pad = Math.min(40, Math.max(0, Number.isFinite(paddingPct) ? paddingPct : 0));
  const z = Math.min(4, Math.max(1, Number.isFinite(zoom) ? zoom : 1));
  const inner = size * (1 - (2 * pad) / 100);
  const offset = (size - inner) / 2;
  if (!(srcW > 0 && srcH > 0)) return { sx: 0, sy: 0, sw: 1, sh: 1, dx: offset, dy: offset, dw: inner, dh: inner };
  if (mode === 'cover') {
    const side = Math.min(srcW, srcH) / z;
    return { sx: (srcW - side) / 2, sy: (srcH - side) / 2, sw: side, sh: side, dx: offset, dy: offset, dw: inner, dh: inner };
  }
  const scale = Math.min(inner / srcW, inner / srcH) * z;
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh };
}

export type Shape = 'square' | 'rounded' | 'circle';

/** Raggio degli angoli per la forma scelta, su un quadrato di lato `size`. */
export function cornerRadius(shape: Shape, size: number): number {
  if (shape === 'circle') return size / 2;
  if (shape === 'rounded') return size * 0.22;
  return 0;
}

/** Dimensione del carattere perché il testo (1-3 caratteri o un'emoji) stia nel quadrato. */
export function textFontSize(text: string, size: number): number {
  const n = Math.max(1, Array.from(text.trim()).length);
  const factor = n === 1 ? 0.72 : n === 2 ? 0.52 : 0.38;
  return Math.round(size * factor);
}

export const MAX_TEXT_CHARS = 3;

/** Taglia il testo a `MAX_TEXT_CHARS` caratteri veri (le emoji contano come uno). */
export function clipText(text: string): string {
  const seg =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim()), (s) => s.segment)
      : Array.from(text.trim());
  return seg.slice(0, MAX_TEXT_CHARS).join('');
}

// ---------- manifest, snippet, pacchetto ----------

export interface SiteInfo {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
}

export const DEFAULT_SITE: SiteInfo = { name: 'My site', shortName: 'Site', themeColor: '#ffffff', backgroundColor: '#ffffff' };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validHexColor(s: string): boolean {
  return HEX.test(s);
}

/** site.webmanifest con le due icone Android/Chrome. */
export function manifestJson(site: SiteInfo): string {
  const name = site.name.trim() || DEFAULT_SITE.name;
  const manifest = {
    name,
    short_name: site.shortName.trim() || name.slice(0, 12),
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: validHexColor(site.themeColor) ? site.themeColor : DEFAULT_SITE.themeColor,
    background_color: validHexColor(site.backgroundColor) ? site.backgroundColor : DEFAULT_SITE.backgroundColor,
    display: 'standalone',
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

/** Righe da incollare nell'<head>. */
export function htmlSnippet(site: SiteInfo): string {
  const theme = validHexColor(site.themeColor) ? site.themeColor : DEFAULT_SITE.themeColor;
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${theme}">`,
  ].join('\n');
}

export type SizedPngs = Partial<Record<number, Uint8Array>>;

/** Nomi dei file nel pacchetto, per dimensione. */
export const PNG_FILES: Record<number, string> = {
  16: 'favicon-16x16.png',
  32: 'favicon-32x32.png',
  180: 'apple-touch-icon.png',
  192: 'android-chrome-192x192.png',
  512: 'android-chrome-512x512.png',
};

/** Tutti i file del pacchetto (nome → byte). Servono i PNG di tutte le dimensioni di `ALL_SIZES`. */
export function buildPackage(pngs: SizedPngs, site: SiteInfo): Record<string, Uint8Array> {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const size of ALL_SIZES) {
    if (!pngs[size]) throw new Error(`png ${size}: mancante`);
  }
  files['favicon.ico'] = encodeIco(ICO_SIZES.map((size) => ({ size, png: pngs[size] as Uint8Array })));
  for (const [size, name] of Object.entries(PNG_FILES)) files[name] = pngs[Number(size)] as Uint8Array;
  files['site.webmanifest'] = enc.encode(manifestJson(site));
  files['README.txt'] = enc.encode(
    'Copy these files to the root of your site and paste the snippet below into the <head> of your pages.\n\n' + htmlSnippet(site) + '\n',
  );
  return files;
}

/** Colore del testo leggibile (nero o bianco) sullo sfondo dato. */
export function readableOn(bg: string): '#000000' | '#ffffff' {
  if (!validHexColor(bg)) return '#000000';
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  // luminanza percepita
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000000' : '#ffffff';
}
