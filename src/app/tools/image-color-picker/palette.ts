// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { cssVarName, toHexOpaque, toHslString, toOklchString, toRgbString, type Rgba } from '../color-converter/color-convert';

// Logica pura del contagocce: lettura di un pixel, spostamento del mirino con la tastiera e palette dominante
// (median cut più qualche passo di k-means, deterministici: stesso input, stessa palette).

export type Rgb = [number, number, number];

export const MIN_COLORS = 5;
export const MAX_COLORS = 12;
export const DEFAULT_COLORS = 8;
/** Numero massimo di pixel considerati per la palette. */
export const SAMPLE_PIXELS = 40_000;
/** Sotto questa opacità (0-255) un pixel non conta per la palette. */
export const MIN_ALPHA = 128;
export const HISTORY_MAX = 30;

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
export const clampCount = (n: number): number => clamp(Math.round(Number.isFinite(n) ? n : DEFAULT_COLORS), MIN_COLORS, MAX_COLORS);

export interface Pixel {
  r: number;
  g: number;
  b: number;
  /** 0-255. */
  a: number;
}

/** Pixel `(x, y)` di un'immagine RGBA; coordinate fuori dall'immagine vengono riportate sul bordo. */
export function pixelAt(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): Pixel {
  const px = clamp(Math.floor(x), 0, width - 1);
  const py = clamp(Math.floor(y), 0, height - 1);
  const i = (py * width + px) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

export const pixelToRgba = (p: Pixel): Rgba => ({ r: p.r, g: p.g, b: p.b, a: p.a / 255 });

/** Colore in #rrggbb. */
export const hexOf = (c: Pick<Rgba, 'r' | 'g' | 'b'>): string => toHexOpaque(c);

/** Valori di un colore nei quattro formati mostrati dallo strumento. */
export function colorValues(p: Pixel): { hex: string; rgb: string; hsl: string; oklch: string } {
  const c = pixelToRgba(p);
  const opaque = { ...c, a: 1 };
  return { hex: hexOf(c), rgb: toRgbString(opaque), hsl: toHslString(opaque), oklch: toOklchString(opaque) };
}

/**
 * Sposta il mirino con le frecce (Maiusc: passo x10; Home/End: bordo sinistro/destro della riga corrente).
 * Rende la nuova posizione intera, oppure null se il tasto non serve.
 */
export function moveCrosshair(x: number, y: number, key: string, step: number, shift: boolean, width: number, height: number): { x: number; y: number } | null {
  const d = Math.max(1, Math.round(step)) * (shift ? 10 : 1);
  let nx = x;
  let ny = y;
  switch (key) {
    case 'ArrowLeft':
      nx -= d;
      break;
    case 'ArrowRight':
      nx += d;
      break;
    case 'ArrowUp':
      ny -= d;
      break;
    case 'ArrowDown':
      ny += d;
      break;
    case 'Home':
      nx = 0;
      break;
    case 'End':
      nx = width - 1;
      break;
    default:
      return null;
  }
  return { x: clamp(Math.round(nx), 0, width - 1), y: clamp(Math.round(ny), 0, height - 1) };
}

/** Coordinate nell'immagine di un punto dello schermo, dato il riquadro su cui è mostrata. */
export function toImageCoords(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }, width: number, height: number): { x: number; y: number } {
  const fx = box.width > 0 ? (clientX - box.left) / box.width : 0;
  const fy = box.height > 0 ? (clientY - box.top) / box.height : 0;
  return { x: clamp(Math.floor(fx * width), 0, width - 1), y: clamp(Math.floor(fy * height), 0, height - 1) };
}

/** Angolo in alto a sinistra della zona `size`×`size` pixel centrata in (x, y), per la lente. */
export function lensOrigin(x: number, y: number, size: number): { sx: number; sy: number } {
  const half = Math.floor(size / 2);
  return { sx: x - half, sy: y - half };
}

/** Aggiunge un colore in testa allo storico (senza doppioni, al massimo HISTORY_MAX voci). */
export function pushHistory(history: readonly string[], hex: string): string[] {
  const h = hex.toLowerCase();
  return [h, ...history.filter((c) => c !== h)].slice(0, HISTORY_MAX);
}

// ---------------- palette ----------------

/** Pixel da usare per la palette: campionamento regolare (deterministico), senza pixel trasparenti. */
export function samplePixels(data: Uint8ClampedArray, maxPixels = SAMPLE_PIXELS): Rgb[] {
  const total = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(total / maxPixels));
  const out: Rgb[] = [];
  for (let p = 0; p < total; p += step) {
    const i = p * 4;
    if (data[i + 3] >= MIN_ALPHA) out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}

export interface PaletteColor {
  rgb: Rgb;
  hex: string;
  /** Quota dei pixel campionati, 0-100 con un decimale; la somma è 100. */
  percent: number;
  /** Numero di pixel campionati. */
  count: number;
}

const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
export const rgbHex = (c: Rgb): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

/** Confronto totale e stabile fra colori (per ordinare senza dipendere dall'algoritmo di sort). */
const cmp = (a: Rgb, b: Rgb): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function channelRanges(px: readonly Rgb[]): { channel: 0 | 1 | 2; range: number } {
  let best: 0 | 1 | 2 = 0;
  let bestRange = -1;
  for (const ch of [0, 1, 2] as const) {
    let lo = 255;
    let hi = 0;
    for (const p of px) {
      if (p[ch] < lo) lo = p[ch];
      if (p[ch] > hi) hi = p[ch];
    }
    if (hi - lo > bestRange) {
      bestRange = hi - lo;
      best = ch;
    }
  }
  return { channel: best, range: bestRange };
}

function mean(px: readonly Rgb[]): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of px) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  const n = Math.max(1, px.length);
  return [r / n, g / n, b / n];
}

/** Median cut: divide in due, sul canale più esteso, la scatola con più pixel finché ce ne sono `k` (o non si può più dividere). */
export function medianCut(pixels: readonly Rgb[], k: number): Rgb[][] {
  if (pixels.length === 0) return [];
  const boxes: Rgb[][] = [[...pixels]];
  while (boxes.length < k) {
    // la scatola da dividere: la più numerosa fra quelle con almeno due colori diversi (a parità, la prima)
    let target = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2 || channelRanges(boxes[i]).range === 0) continue;
      if (target < 0 || boxes[i].length > boxes[target].length) target = i;
    }
    if (target < 0) break;
    const box = boxes[target];
    const { channel } = channelRanges(box);
    box.sort((a, b) => a[channel] - b[channel] || cmp(a, b));
    // taglio sulla mediana, spostato sul confine più vicino così pixel con lo stesso valore restano insieme
    const half = Math.floor(box.length / 2);
    const v = box[half][channel];
    let lo = half;
    while (lo > 0 && box[lo - 1][channel] === v) lo--;
    let hi = half;
    while (hi < box.length && box[hi][channel] === v) hi++;
    const useLo = lo > 0 && (hi >= box.length || half - lo <= hi - half);
    const mid = useLo ? lo : hi;
    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes;
}

const dist2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Palette dominante di `k` colori (5-12): median cut per partire, poi `iterations` passi di k-means
 * sul campione. Colori ordinati per quota decrescente (a parità, per valore). Deterministica.
 * Con meno colori distinti di `k` rende solo quelli che ci sono.
 */
export function dominantPalette(pixels: readonly Rgb[], k: number, iterations = 4): PaletteColor[] {
  const want = clampCount(k);
  if (pixels.length === 0) return [];
  let centers = medianCut(pixels, want).map(mean);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pixels) {
      const j = nearest(p, centers);
      sums[j][0] += p[0];
      sums[j][1] += p[1];
      sums[j][2] += p[2];
      sums[j][3]++;
    }
    centers = centers.map((c, j) => (sums[j][3] > 0 ? [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]] : c));
  }
  const counts = centers.map(() => 0);
  for (const p of pixels) counts[nearest(p, centers)]++;
  const out = centers
    .map((c, j) => ({ rgb: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as Rgb, count: counts[j] }))
    .filter((c) => c.count > 0);
  // colori che dopo l'arrotondamento coincidono: si fondono
  const merged = new Map<string, { rgb: Rgb; count: number }>();
  for (const c of out) {
    const key = rgbHex(c.rgb);
    const prev = merged.get(key);
    if (prev) prev.count += c.count;
    else merged.set(key, { ...c });
  }
  const list = [...merged.values()].sort((a, b) => b.count - a.count || cmp(a.rgb, b.rgb));
  const percents = roundPercents(list.map((c) => c.count), pixels.length);
  return list.map((c, i) => ({ rgb: c.rgb, hex: rgbHex(c.rgb), percent: percents[i], count: c.count }));
}

function nearest(p: Rgb, centers: readonly Rgb[]): number {
  let best = 0;
  let bd = Infinity;
  for (let j = 0; j < centers.length; j++) {
    const d = dist2(p, centers[j]);
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  return best;
}

/** Percentuali con un decimale la cui somma è esattamente 100 (il resto va alla voce con più resto, poi alla più grande). */
export function roundPercents(counts: readonly number[], total: number): number[] {
  if (total <= 0 || counts.length === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 1000);
  const floors = raw.map(Math.floor);
  let left = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, rem: v - floors[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    floors[o.i]++;
    left--;
  }
  return floors.map((f) => f / 10);
}

// ---------------- esportazione ----------------

export type ExportFormat = 'css' | 'json';

export function paletteToCss(palette: readonly PaletteColor[], name: string): string {
  const prefix = cssVarName(name);
  return `:root {\n${palette.map((c, i) => `  --${prefix}-${i + 1}: ${c.hex};`).join('\n')}\n}`;
}

export function paletteToJson(palette: readonly PaletteColor[], name: string): string {
  return JSON.stringify({ [cssVarName(name)]: palette.map((c) => ({ hex: c.hex, percent: c.percent })) }, null, 2);
}

export const paletteExport = (palette: readonly PaletteColor[], name: string, format: ExportFormat): string =>
  format === 'css' ? paletteToCss(palette, name) : paletteToJson(palette, name);

/** Il colore come testo per il campo del convertitore colori (HEX con # davanti). */
export const converterText = (hex: string): string => hex.toLowerCase();
