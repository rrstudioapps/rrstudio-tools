// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { extensionForMime, uniqueNames } from '../image-compressor/image-compressor';

// Logica pura della filigrana: impostazioni, posizionamento (9 punti o mosaico), dimensioni e nomi dei file.
// Ogni misura è relativa al lato corto dell'immagine o della pagina, così l'anteprima ridotta e l'esportazione
// a piena risoluzione (o la pagina PDF in punti) danno lo stesso risultato.

export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type Placement = Anchor | 'tile';
export const ANCHORS: readonly Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
export const PLACEMENTS: readonly Placement[] = [...ANCHORS, 'tile'];

export type WatermarkKind = 'text' | 'image';
export type FontId = 'sans' | 'serif' | 'mono';
export const FONT_IDS: readonly FontId[] = ['sans', 'serif', 'mono'];
/** Famiglie per il canvas (il PDF usa i font standard Helvetica, Times e Courier). */
export const FONT_CSS: Record<FontId, string> = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

export interface WatermarkSettings {
  kind: WatermarkKind;
  text: string;
  font: FontId;
  bold: boolean;
  /** Altezza del testo in % del lato corto. */
  sizePct: number;
  color: string;
  /** 1-100. */
  opacity: number;
  /** Gradi, positivi in senso orario (come si vede a schermo). */
  rotation: number;
  position: Placement;
  /** Distanza dal bordo in % del lato corto. */
  margin: number;
  /** Spazio fra le ripetizioni del mosaico, in % del lato corto. */
  gap: number;
  /** Larghezza del logo in % del lato corto. */
  logoScale: number;
}

export const DEFAULT_SETTINGS: WatermarkSettings = {
  kind: 'text',
  text: '© rrstudio',
  font: 'sans',
  bold: true,
  sizePct: 6,
  color: '#ffffff',
  opacity: 60,
  rotation: 0,
  position: 'br',
  margin: 3,
  gap: 12,
  logoScale: 25,
};

export const LIMITS = {
  sizePct: { min: 1, max: 50 },
  opacity: { min: 1, max: 100 },
  rotation: { min: -180, max: 180 },
  margin: { min: 0, max: 30 },
  gap: { min: 0, max: 100 },
  logoScale: { min: 2, max: 100 },
} as const;

export const MAX_TEXT = 120;
export const MAX_PIXELS = 100_000_000;

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
export const isHexColor = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);
export const isPlacement = (v: unknown): v is Placement => typeof v === 'string' && (PLACEMENTS as readonly string[]).includes(v);
export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && (FONT_IDS as readonly string[]).includes(v);

/** Numero entro i limiti del campo (NaN o testo non numerico: valore di riserva). */
export function clampField(key: keyof typeof LIMITS, v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, LIMITS[key].min, LIMITS[key].max);
}

/** Misura di riferimento: il lato corto. */
export const reference = (width: number, height: number): number => Math.max(1, Math.min(width, height));

/** Altezza del testo in pixel (o punti) per una superficie `width`×`height`. */
export function fontSize(sizePct: number, width: number, height: number): number {
  return Math.max(4, (reference(width, height) * sizePct) / 100);
}

/** Dimensioni del logo (larghezza data dalla scala, proporzioni mantenute). */
export function logoSize(logoW: number, logoH: number, scalePct: number, width: number, height: number): { w: number; h: number } {
  const w = Math.max(1, (reference(width, height) * scalePct) / 100);
  return { w, h: Math.max(1, (w * logoH) / Math.max(1, logoW)) };
}

/** Riquadro che contiene un rettangolo `w`×`h` ruotato di `deg` gradi. */
export function rotatedBox(w: number, h: number, deg: number): { w: number; h: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + h * s, h: w * s + h * c };
}

export interface Point {
  cx: number;
  cy: number;
}

/**
 * Centro della filigrana per una posizione a 9 punti: il riquadro ruotato (`bw`×`bh`) sta dentro i margini;
 * se è più grande dello spazio disponibile resta centrato su quell'asse.
 */
export function anchorCenter(pos: Anchor, bw: number, bh: number, width: number, height: number, margin: number): Point {
  const axis = (which: 'l' | 'm' | 'r', box: number, size: number): number => {
    if (which === 'm' || box + 2 * margin > size) return size / 2;
    return which === 'l' ? margin + box / 2 : size - margin - box / 2;
  };
  const row = pos[0] === 't' ? 'l' : pos[0] === 'm' ? 'm' : 'r';
  const col = pos[1] === 'l' ? 'l' : pos[1] === 'c' || pos[1] === 'm' ? 'm' : 'r';
  return { cx: axis(col, bw, width), cy: axis(row, bh, height) };
}

/**
 * Centri del mosaico: righe alternate sfalsate di mezzo passo, centrate sulla superficie,
 * solo i riquadri che toccano la superficie. Il passo è il riquadro ruotato più lo spazio `gap`.
 */
export function tileCenters(bw: number, bh: number, width: number, height: number, gap: number): Point[] {
  const stepX = Math.max(1, bw + gap);
  const stepY = Math.max(1, bh + gap);
  const rows = Math.ceil(height / stepY) + 2;
  const out: Point[] = [];
  const mid = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    const cy = height / 2 + (r - Math.floor(mid)) * stepY;
    if (cy + bh / 2 < 0 || cy - bh / 2 > height) continue;
    const shift = Math.abs(r - Math.floor(mid)) % 2 === 1 ? stepX / 2 : 0;
    const cols = Math.ceil(width / stepX) + 2;
    for (let c = -cols; c <= cols; c++) {
      const cx = width / 2 + c * stepX + shift;
      if (cx + bw / 2 < 0 || cx - bw / 2 > width) continue;
      out.push({ cx, cy });
    }
  }
  return out;
}

/** Tetto al numero di ripetizioni del mosaico (testi minuscoli su immagini enormi). */
export const MAX_TILES = 2000;

/**
 * Posizioni (centri) in cui disegnare una filigrana di dimensioni `wmW`×`wmH` (non ruotata) su `width`×`height`.
 * `margin` e `gap` sono in percentuale del lato corto, come nelle impostazioni.
 */
export function layout(
  s: Pick<WatermarkSettings, 'position' | 'rotation' | 'margin' | 'gap'>,
  wmW: number,
  wmH: number,
  width: number,
  height: number,
): Point[] {
  const box = rotatedBox(wmW, wmH, s.rotation);
  const ref = reference(width, height);
  if (s.position === 'tile') {
    const gap = (ref * s.gap) / 100;
    const stepX = Math.max(1, box.w + gap);
    const stepY = Math.max(1, box.h + gap);
    // se i passi darebbero troppe ripetizioni, si allarga lo spazio
    const est = Math.ceil(width / stepX + 2) * Math.ceil(height / stepY + 2);
    const grow = est > MAX_TILES ? Math.sqrt(est / MAX_TILES) : 1;
    return tileCenters(box.w, box.h, width, height, gap + (grow - 1) * Math.max(stepX, stepY));
  }
  return [anchorCenter(s.position, box.w, box.h, width, height, (ref * s.margin) / 100)];
}

/** Pagine (da 0) su cui applicare la filigrana: tutte se il testo è vuoto, altrimenti l'intervallo scritto. */
export function pagesFromRanges(ranges: readonly { from: number; to: number }[] | null, total: number): number[] {
  if (!ranges) return Array.from({ length: total }, (_, i) => i);
  const set = new Set<number>();
  for (const r of ranges) for (let p = r.from; p <= r.to; p++) if (p >= 1 && p <= total) set.add(p - 1);
  return [...set].sort((a, b) => a - b);
}

/** Nome del file di uscita: originale senza estensione, suffisso e estensione del formato. */
export function outputName(original: string, mime: string, suffix: string): string {
  const dot = original.lastIndexOf('.');
  const base = (dot > 0 ? original.slice(0, dot) : original).trim() || 'immagine';
  return `${base}-${suffix}.${mime === 'application/pdf' ? 'pdf' : extensionForMime(mime)}`;
}

/** Nomi di uscita senza duplicati. */
export function outputNames(items: readonly { name: string; mime: string }[], suffix: string): string[] {
  return uniqueNames(items.map((i) => outputName(i.name, i.mime, suffix)));
}

/** Testo ripulito: una riga, spazi ridotti, lunghezza limitata. */
export function cleanText(t: string): string {
  return t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

/** Vero se la filigrana ha qualcosa da disegnare. */
export function hasContent(s: Pick<WatermarkSettings, 'kind' | 'text'>, hasLogo: boolean): boolean {
  return s.kind === 'image' ? hasLogo : cleanText(s.text) !== '';
}
