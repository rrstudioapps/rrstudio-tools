// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { PDFFont, PDFPage } from 'pdf-lib';
import { openForEdit } from '../pdf-common/pdf-file';
import { parseRanges, rangePages, RangeError } from '../pdf-tools/page-ranges';

/**
 * Scrive su ogni pagina di un PDF una riga in alto (intestazione) e una in basso (piè di pagina), divise in tre posti:
 * sinistra, centro, destra. Nei testi: {n} numero della pagina, {total} pagine totali, {date} data di oggi, {name} nome del file.
 * Si tiene conto della rotazione della pagina (il testo resta dritto a schermo).
 */

export interface Slots {
  left: string;
  center: string;
  right: string;
}

export type FontName = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface PageTextOptions {
  header: Slots;
  footer: Slots;
  font: FontName;
  size: number;
  /** Colore #rrggbb. */
  color: string;
  /** Distanza dal bordo, in punti (1 pt = 1/72 di pollice). */
  margin: number;
  /** Numero da dare alla prima pagina scelta ({n} parte da qui). */
  startAt: number;
  /** Pagine da numerare ("" = tutte), per esempio "2-" non è ammesso: si scrive "2-10". */
  pages: string;
  /** Salta la prima pagina (copertina) senza cambiare la numerazione delle altre. */
  skipFirst: boolean;
}

export const EMPTY_SLOTS: Slots = { left: '', center: '', right: '' };
export const DEFAULT_OPTIONS: PageTextOptions = {
  header: EMPTY_SLOTS,
  footer: { left: '', center: '{n} / {total}', right: '' },
  font: 'Helvetica',
  size: 10,
  color: '#444444',
  margin: 28,
  startAt: 1,
  pages: '',
  skipFirst: false,
};

export interface TokenContext {
  n: number;
  total: number;
  date: string;
  name: string;
}

export function expandTokens(template: string, c: TokenContext): string {
  return template.replace(/\{(n|total|date|name)\}/g, (_, k: keyof TokenContext) => String(c[k]));
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0x444444;
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** Toglie i caratteri che il carattere standard non sa scrivere (restano «?»). */
export function encodable(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

/** Punto (x, y) nello spazio della pagina «vera» per il punto (vx, vy) dello spazio a schermo, con la rotazione `r`. */
export function toRaw(r: number, w: number, h: number, vx: number, vy: number): { x: number; y: number } {
  switch (((r % 360) + 360) % 360) {
    case 90: return { x: w - vy, y: vx };
    case 180: return { x: w - vx, y: h - vy };
    case 270: return { x: vy, y: h - vx };
    default: return { x: vx, y: vy };
  }
}

export type Plan = { ok: true; indices: number[] } | { ok: false; error: RangeError };

/** Indici (da 0) delle pagine da scrivere. */
export function planPages(total: number, o: Pick<PageTextOptions, 'pages' | 'skipFirst'>): Plan {
  let indices: number[];
  if (o.pages.trim() === '') indices = Array.from({ length: total }, (_, i) => i);
  else {
    const r = parseRanges(o.pages, total);
    if (!r.ok) return { ok: false, error: r.error };
    indices = [...new Set(r.ranges.flatMap(rangePages).map((p) => p - 1))].sort((a, b) => a - b);
  }
  if (o.skipFirst) indices = indices.filter((i) => i !== 0);
  return { ok: true, indices };
}

function drawRow(page: PDFPage, font: PDFFont, slots: Slots, ctx: TokenContext, o: PageTextOptions, top: boolean, rgb: (r: number, g: number, b: number) => unknown, degrees: (n: number) => unknown): void {
  const rot = page.getRotation().angle;
  const box = page.getMediaBox();
  const swap = rot === 90 || rot === 270;
  const vw = swap ? box.height : box.width;
  const vh = swap ? box.width : box.height;
  const vy = top ? vh - o.margin - o.size * 0.8 : o.margin;
  const [r, g, b] = hexToRgb(o.color);
  for (const [pos, raw] of [['left', slots.left], ['center', slots.center], ['right', slots.right]] as const) {
    if (raw === '') continue;
    const text = encodable(font, expandTokens(raw, ctx));
    const width = font.widthOfTextAtSize(text, o.size);
    const vx = pos === 'left' ? o.margin : pos === 'center' ? (vw - width) / 2 : vw - o.margin - width;
    const p = toRaw(rot, box.width, box.height, vx, vy);
    page.drawText(text, { x: box.x + p.x, y: box.y + p.y, size: o.size, font, color: rgb(r, g, b) as never, rotate: degrees(rot) as never });
  }
}

export type PageTextResult = { ok: true; bytes: Uint8Array; written: number } | { ok: false; error: RangeError };

export async function addPageText(bytes: Uint8Array, name: string, o: PageTextOptions, today = new Date()): Promise<PageTextResult> {
  const { StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await openForEdit(bytes);
  const total = doc.getPageCount();
  const plan = planPages(total, o);
  if (!plan.ok) return plan;
  const font = await doc.embedFont(StandardFonts[o.font]);
  const date = today.toLocaleDateString('it-IT');
  const all = planPages(total, { pages: o.pages, skipFirst: false });
  const first = all.ok && all.indices.length ? all.indices[0] : 0;
  for (const i of plan.indices) {
    // la numerazione parte dalla prima pagina scelta (anche se la copertina è saltata: conta comunque)
    const ctx: TokenContext = { n: o.startAt + (i - first), total, date, name };
    const page = doc.getPage(i);
    drawRow(page, font, o.header, ctx, o, true, rgb, degrees);
    drawRow(page, font, o.footer, ctx, o, false, rgb, degrees);
  }
  return { ok: true, bytes: await doc.save({ useObjectStreams: true }), written: plan.indices.length };
}
