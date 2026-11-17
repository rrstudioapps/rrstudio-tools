// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { safeColor } from '../qr-code/qr-render';
import type { BarcodeFormat } from './barcode';

/** Disegno dei codici a barre con jsbarcode (caricata con import dinamico, solo nella pagina). */

export interface BarcodeStyle {
  /** Larghezza di una barra stretta, in pixel (1-6). */
  barWidth: number;
  /** Altezza delle barre, in pixel (20-400). */
  height: number;
  showText: boolean;
  fontSize: number;
  /** Margine attorno al codice, in pixel (0-60). */
  margin: number;
  fg: string;
  bg: string;
  /** Solo Code 39: aggiunge la cifra di controllo modulo 43. */
  mod43?: boolean;
}

export const DEFAULT_STYLE: BarcodeStyle = {
  barWidth: 2,
  height: 100,
  showText: true,
  fontSize: 18,
  margin: 10,
  fg: '#000000',
  bg: '#ffffff',
  mod43: false,
};

const clamp = (n: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

export function clampStyle(s: BarcodeStyle): BarcodeStyle {
  return {
    barWidth: clamp(s.barWidth, 1, 6, 2),
    height: clamp(s.height, 20, 400, 100),
    showText: !!s.showText,
    fontSize: clamp(s.fontSize, 8, 48, 18),
    margin: clamp(s.margin, 0, 60, 10),
    fg: safeColor(s.fg, '#000000'),
    bg: safeColor(s.bg, '#ffffff'),
    mod43: !!s.mod43,
  };
}

type JsBarcodeFn = (target: unknown, text: string, options: Record<string, unknown>) => unknown;

let lib: Promise<JsBarcodeFn> | null = null;
export function loadJsBarcode(): Promise<JsBarcodeFn> {
  lib ??= import('jsbarcode').then((m) => ((m as { default?: JsBarcodeFn }).default ?? (m as unknown as JsBarcodeFn)));
  return lib;
}

function options(format: BarcodeFormat, s: BarcodeStyle, scale: number): Record<string, unknown> {
  const c = clampStyle(s);
  const o: Record<string, unknown> = {
    format,
    width: c.barWidth * scale,
    height: c.height * scale,
    displayValue: c.showText,
    fontSize: c.fontSize * scale,
    margin: c.margin * scale,
    textMargin: 2 * scale,
    lineColor: c.fg,
    background: c.bg,
    font: 'monospace',
    // niente eccezioni nel renderer: l'errore arriva al chiamante
    valid: () => undefined,
  };
  if (format === 'CODE39' && c.mod43) o['mod43'] = true;
  return o;
}

/** Il testo non è codificabile nel formato scelto. */
export class BarcodeRenderError extends Error {}

/** Restituisce l'SVG del codice (stringa completa, con dichiarazione dello spazio dei nomi). */
export async function renderSvg(format: BarcodeFormat, value: string, style: BarcodeStyle): Promise<string> {
  const JsBarcode = await loadJsBarcode();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let valid = true;
  const opts = options(format, style, 1);
  opts['valid'] = (ok: boolean) => {
    valid = ok;
  };
  try {
    JsBarcode(svg, value, { ...opts, xmlDocument: document });
  } catch {
    throw new BarcodeRenderError(value);
  }
  if (!valid) throw new BarcodeRenderError(value);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(svg);
}

/** PNG del codice, ingrandito di `scale` volte (1-4). */
export async function renderPng(format: BarcodeFormat, value: string, style: BarcodeStyle, scale = 1): Promise<Blob> {
  const JsBarcode = await loadJsBarcode();
  const canvas = document.createElement('canvas');
  let valid = true;
  const opts = options(format, style, clamp(scale, 1, 4, 1));
  opts['valid'] = (ok: boolean) => {
    valid = ok;
  };
  try {
    JsBarcode(canvas, value, opts);
  } catch {
    throw new BarcodeRenderError(value);
  }
  if (!valid) throw new BarcodeRenderError(value);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new BarcodeRenderError(value);
  return blob;
}
