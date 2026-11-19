// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

export type CssUnit = 'px' | 'rem' | 'em' | 'pt' | 'pc' | 'percent' | 'vw' | 'vh' | 'cm' | 'mm' | 'in';

export const UNITS: readonly CssUnit[] = ['px', 'rem', 'em', 'pt', 'pc', 'percent', 'vw', 'vh', 'cm', 'mm', 'in'];

/** Testo CSS di ogni unità. */
export const UNIT_SUFFIX: Record<CssUnit, string> = {
  px: 'px',
  rem: 'rem',
  em: 'em',
  pt: 'pt',
  pc: 'pc',
  percent: '%',
  vw: 'vw',
  vh: 'vh',
  cm: 'cm',
  mm: 'mm',
  in: 'in',
};

export interface CssContext {
  /** Dimensione del carattere dell'elemento radice (di solito 16 px): base del rem. */
  rootPx: number;
  /** Dimensione del carattere dell'elemento genitore: base di em e di % (per font-size). */
  parentPx: number;
  /** Larghezza e altezza della finestra in px (per vw e vh). */
  viewportW: number;
  viewportH: number;
}

export const DEFAULT_CONTEXT: CssContext = { rootPx: 16, parentPx: 16, viewportW: 1280, viewportH: 720 };

/** Un pollice CSS vale 96 px, un punto 1/72 di pollice, un pica 12 punti. */
const PX_PER_IN = 96;

/** Numero di px per una unità (se non dipende dal contesto, altrimenti dal contesto). */
function pxPerUnit(unit: CssUnit, ctx: CssContext): number {
  switch (unit) {
    case 'px':
      return 1;
    case 'rem':
      return ctx.rootPx;
    case 'em':
      return ctx.parentPx;
    case 'pt':
      return PX_PER_IN / 72;
    case 'pc':
      return PX_PER_IN / 6;
    case 'percent':
      return ctx.parentPx / 100;
    case 'vw':
      return ctx.viewportW / 100;
    case 'vh':
      return ctx.viewportH / 100;
    case 'cm':
      return PX_PER_IN / 2.54;
    case 'mm':
      return PX_PER_IN / 25.4;
    case 'in':
      return PX_PER_IN;
  }
}

export function toPx(value: number, unit: CssUnit, ctx: CssContext): number {
  return value * pxPerUnit(unit, ctx);
}

export function fromPx(px: number, unit: CssUnit, ctx: CssContext): number {
  const k = pxPerUnit(unit, ctx);
  return k === 0 ? NaN : px / k;
}

export function convert(value: number, from: CssUnit, to: CssUnit, ctx: CssContext): number {
  if (from === to) return value;
  return fromPx(toPx(value, from, ctx), to, ctx);
}

/** Il contesto è valido se tutte le basi sono numeri finiti positivi. */
export function validContext(ctx: CssContext): boolean {
  return [ctx.rootPx, ctx.parentPx, ctx.viewportW, ctx.viewportH].every((n) => Number.isFinite(n) && n > 0);
}

export function convertAll(value: number, from: CssUnit, ctx: CssContext): Record<CssUnit, number> {
  const px = toPx(value, from, ctx);
  const out = {} as Record<CssUnit, number>;
  for (const u of UNITS) out[u] = u === from ? value : fromPx(px, u, ctx);
  return out;
}

/** Numero per il CSS: al massimo `decimals` decimali, senza zeri inutili, senza notazione esponenziale. */
export function formatCssNumber(n: number, decimals = 4): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e21) return '';
  const factor = 10 ** decimals;
  let r = (Math.sign(n) * Math.round(Math.abs(n) * factor)) / factor;
  if (Object.is(r, -0)) r = 0;
  let s = r.toFixed(decimals);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/** Valore con unità, come si scrive nel CSS (0 senza unità). */
export function formatCssValue(n: number, unit: CssUnit, decimals = 4): string {
  const s = formatCssNumber(n, decimals);
  return s === '0' ? '0' : s + UNIT_SUFFIX[unit];
}

/** Tabella rapida: valori in px e il loro valore in `to`. */
export const QUICK_PX: readonly number[] = [4, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];

export function quickTable(to: 'rem' | 'em', ctx: CssContext, values: readonly number[] = QUICK_PX): { px: number; value: number }[] {
  return values.map((px) => ({ px, value: fromPx(px, to, ctx) }));
}

export type BlockUnit = 'px' | 'rem' | 'em';

export interface BlockOptions {
  from: BlockUnit;
  to: BlockUnit;
  /** Cifre decimali massime (4 di default). */
  decimals?: number;
  /** Lascia invariati i valori da 1 px (bordi sottili). */
  keepHairline?: boolean;
  /** Converte anche i valori dentro @media (di norma lì si preferisce em o px). */
  convertMedia?: boolean;
}

export interface BlockResult {
  css: string;
  /** Quanti valori sono stati convertiti. */
  count: number;
}

// Parti da non toccare: commenti, stringhe, url(...), condizioni di @media.
const PROTECTED = String.raw`\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\([^)]*\)|@media[^{;]*`;

/**
 * Converte in blocco tutti i valori `from` di un testo CSS in `to`, saltando commenti, stringhe, url()
 * e (di default) le condizioni di @media. I numeri negativi e decimali (`-4px`, `.5px`) sono gestiti.
 */
export function convertCssBlock(css: string, ctx: CssContext, opts: BlockOptions): BlockResult {
  const decimals = opts.decimals ?? 4;
  const from = UNIT_SUFFIX[opts.from];
  // Non deve far parte di un identificatore o di un numero più lungo (es. `a-4px`, `1.2.3px`).
  const re = new RegExp(`(${opts.convertMedia ? '(?!)' : PROTECTED})|(?<![\\w.#]|\\w-)(-?)(\\d*\\.?\\d+)${from}(?![\\w%-])`, 'gi');
  let count = 0;
  const out = css.replace(re, (all: string, prot: string | undefined, sign: string, num: string) => {
    if (prot !== undefined) return prot;
    const n = parseFloat(num) * (sign === '-' ? -1 : 1);
    if (opts.keepHairline && opts.from === 'px' && Math.abs(n) === 1) return all;
    const converted = convert(n, opts.from, opts.to, ctx);
    if (!Number.isFinite(converted)) return all;
    count++;
    return formatCssValue(converted, opts.to, decimals);
  });
  return { css: out, count };
}
