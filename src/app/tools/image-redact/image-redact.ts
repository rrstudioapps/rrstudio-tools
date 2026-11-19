// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Logica pura dello strumento «Oscura parti di un'immagine»: rettangoli, coordinate ed effetti sui pixel. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Effect = 'fill' | 'pixelate' | 'blur';
export const EFFECTS: readonly Effect[] = ['fill', 'pixelate', 'blur'];
export type OutFormat = 'png' | 'jpeg';
export const OUT_FORMATS: readonly OutFormat[] = ['png', 'jpeg'];
export const MIME: Record<OutFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' };

/** Un rettangolo da oscurare con il suo effetto (dimensioni in pixel dell'immagine originale). */
export interface Region {
  id: number;
  rect: Rect;
  effect: Effect;
  /** Colore del riquadro pieno, `#rrggbb`. */
  color: string;
  /** Lato dei blocchi della pixelatura. */
  block: number;
  /** Raggio della sfocatura. */
  blur: number;
}

/** Oltre questi megapixel l'immagine viene rifiutata (memoria del browser). */
export const MAX_MEGAPIXELS = 40;
export const MAX_PIXELS = MAX_MEGAPIXELS * 1_000_000;
/** Blocco minimo a risoluzione originale: sotto questa soglia la pixelatura potrebbe essere reversibile. */
export const MIN_BLOCK = 8;
export const MAX_BLOCK = 400;
export const MIN_BLUR = 4;
export const MAX_BLUR = 200;
export const MAX_REGIONS = 100;

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Handle = (typeof HANDLES)[number];

export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = isHexColor(hex) ? hex : '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function clampNumber(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** true se l'immagine ha troppi pixel per essere elaborata. */
export function tooLarge(width: number, height: number): boolean {
  return width * height > MAX_PIXELS;
}

/** Rettangolo dai due angoli, in qualunque ordine (trascinamento verso l'alto o a sinistra incluso). */
export function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** Intero, dentro l'immagine, almeno 1×1 (larghezza o altezza 0 diventano 1, negative si ribaltano). */
export function clampRect(r: Rect, width: number, height: number): Rect {
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  const fix = (n: number): number => (Number.isFinite(n) ? n : 0);
  let { x, y, w, h } = { x: fix(r.x), y: fix(r.y), w: fix(r.w), h: fix(r.h) };
  if (w < 0) (x += w), (w = -w);
  if (h < 0) (y += h), (h = -h);
  x = Math.round(clampNumber(x, 0, W - 1));
  y = Math.round(clampNumber(y, 0, H - 1));
  w = Math.round(clampNumber(w, 1, W - x));
  h = Math.round(clampNumber(h, 1, H - y));
  return { x, y, w, h };
}

/** Parte del rettangolo che sta davvero dentro l'immagine (può essere vuota: w o h = 0). */
export function visiblePart(r: Rect, width: number, height: number): Rect {
  const x0 = Math.max(0, Math.round(r.x));
  const y0 = Math.max(0, Math.round(r.y));
  const x1 = Math.min(width, Math.round(r.x + r.w));
  const y1 = Math.min(height, Math.round(r.y + r.h));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function moveRect(r: Rect, dx: number, dy: number, width: number, height: number): Rect {
  return { ...r, x: clampNumber(r.x + dx, 0, Math.max(0, width - r.w)), y: clampNumber(r.y + dy, 0, Math.max(0, height - r.h)) };
}

/** Sposta i lati toccati dalla maniglia; se i lati si incrociano il rettangolo si ribalta. */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, width: number, height: number): Rect {
  let l = r.x;
  let t = r.y;
  let rt = r.x + r.w;
  let b = r.y + r.h;
  if (handle.includes('w')) l += dx;
  if (handle.includes('e')) rt += dx;
  if (handle.includes('n')) t += dy;
  if (handle.includes('s')) b += dy;
  l = clampNumber(l, 0, width);
  rt = clampNumber(rt, 0, width);
  t = clampNumber(t, 0, height);
  b = clampNumber(b, 0, height);
  return rectFromPoints(l, t, rt, b);
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Da coordinate della pagina a coordinate dell'immagine originale, limitate ai bordi. */
export function screenToImage(clientX: number, clientY: number, box: Box, width: number, height: number): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  return {
    x: clampNumber(((clientX - box.left) / box.width) * width, 0, width),
    y: clampNumber(((clientY - box.top) / box.height) * height, 0, height),
  };
}

/** Rettangolo in percentuale della scena (per posizionare i riquadri sopra l'anteprima). */
export function rectToPercent(r: Rect, width: number, height: number): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(r.x / width) * 100}%`,
    top: `${(r.y / height) * 100}%`,
    width: `${(r.w / width) * 100}%`,
    height: `${(r.h / height) * 100}%`,
  };
}

/** Porta una regione a valori sicuri: rettangolo nell'immagine, blocchi e sfocatura sopra le soglie minime. */
export function sanitizeRegion(r: Region, width: number, height: number): Region {
  return {
    ...r,
    rect: clampRect(r.rect, width, height),
    color: isHexColor(r.color) ? r.color : '#000000',
    block: Math.round(clampNumber(r.block, MIN_BLOCK, MAX_BLOCK)),
    blur: Math.round(clampNumber(r.blur, MIN_BLUR, MAX_BLUR)),
  };
}

/** Riquadro pieno e opaco (alpha 255): copre al 100% anche i pixel trasparenti. */
export function fillRegion(data: Uint8ClampedArray, width: number, height: number, rect: Rect, rgb: readonly [number, number, number]): void {
  const v = visiblePart(rect, width, height);
  for (let y = v.y; y < v.y + v.h; y++) {
    for (let x = v.x; x < v.x + v.w; x++) {
      const i = (y * width + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
}

/** Pixelatura: ogni blocco (a partire dall'angolo del rettangolo) diventa la media dei suoi pixel. */
export function pixelateRegion(data: Uint8ClampedArray, width: number, height: number, rect: Rect, block: number): void {
  const v = visiblePart(rect, width, height);
  const size = Math.max(1, Math.round(block));
  for (let by = v.y; by < v.y + v.h; by += size) {
    const bh = Math.min(size, v.y + v.h - by);
    for (let bx = v.x; bx < v.x + v.w; bx += size) {
      const bw = Math.min(size, v.x + v.w - bx);
      const sum = [0, 0, 0, 0];
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * width + x) * 4;
          sum[0] += data[i];
          sum[1] += data[i + 1];
          sum[2] += data[i + 2];
          sum[3] += data[i + 3];
        }
      }
      const n = bw * bh;
      const avg = sum.map((s) => Math.round(s / n));
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = (y * width + x) * 4;
          data[i] = avg[0];
          data[i + 1] = avg[1];
          data[i + 2] = avg[2];
          data[i + 3] = avg[3];
        }
      }
    }
  }
}

/** Media mobile su una riga di `n` valori con finestra [i-r, i+r] ritagliata ai bordi (somme prefisso). */
function smoothLine(src: Float64Array, dst: Float64Array, n: number, radius: number): void {
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + src[i];
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    dst[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
}

/** Sfocatura a scatola in due passate (orizzontale poi verticale) che usa solo i pixel del rettangolo. */
export function blurRegion(data: Uint8ClampedArray, width: number, height: number, rect: Rect, radius: number): void {
  const v = visiblePart(rect, width, height);
  if (v.w === 0 || v.h === 0) return;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float64Array(v.w * v.h * 4);
  const lineIn = new Float64Array(Math.max(v.w, v.h));
  const lineOut = new Float64Array(Math.max(v.w, v.h));
  for (let c = 0; c < 4; c++) {
    // passata orizzontale: data -> tmp
    for (let y = 0; y < v.h; y++) {
      for (let x = 0; x < v.w; x++) lineIn[x] = data[((v.y + y) * width + v.x + x) * 4 + c];
      smoothLine(lineIn, lineOut, v.w, r);
      for (let x = 0; x < v.w; x++) tmp[(y * v.w + x) * 4 + c] = lineOut[x];
    }
    // passata verticale: tmp -> data
    for (let x = 0; x < v.w; x++) {
      for (let y = 0; y < v.h; y++) lineIn[y] = tmp[(y * v.w + x) * 4 + c];
      smoothLine(lineIn, lineOut, v.h, r);
      for (let y = 0; y < v.h; y++) data[((v.y + y) * width + v.x + x) * 4 + c] = Math.round(lineOut[y]);
    }
  }
}

/** Applica le regioni nell'ordine dell'elenco (le ultime stanno sopra) direttamente sul buffer RGBA. */
export function applyRegions(data: Uint8ClampedArray, width: number, height: number, regions: readonly Region[]): void {
  for (const reg of regions) {
    if (reg.effect === 'fill') fillRegion(data, width, height, reg.rect, hexToRgb(reg.color));
    else if (reg.effect === 'pixelate') pixelateRegion(data, width, height, reg.rect, reg.block);
    else blurRegion(data, width, height, reg.rect, reg.blur);
  }
}

/** Come applyRegions ma con le soglie di sicurezza (è la via dell'esportazione). */
export function applySafely(data: Uint8ClampedArray, width: number, height: number, regions: readonly Region[]): void {
  applyRegions(data, width, height, regions.map((r) => sanitizeRegion(r, width, height)));
}

/** Regioni ridotte alla scala dell'anteprima (stesso aspetto, meno pixel). */
export function scaleRegions(regions: readonly Region[], scale: number): Region[] {
  return regions.map((r) => ({
    ...r,
    rect: {
      x: Math.round(r.rect.x * scale),
      y: Math.round(r.rect.y * scale),
      w: Math.max(1, Math.round(r.rect.w * scale)),
      h: Math.max(1, Math.round(r.rect.h * scale)),
    },
    block: Math.max(1, Math.round(r.block * scale)),
    blur: Math.max(1, Math.round(r.blur * scale)),
  }));
}

/** Nome del file di uscita: `foto.jpg` -> `foto-oscurata.png`. */
export function outputName(original: string, suffix: string, format: OutFormat): string {
  const base = original.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').trim() || 'immagine';
  return `${base}-${suffix}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

/** Cronologia annulla/ripristina su istantanee immutabili dell'elenco di regioni. */
export interface History<T> {
  past: readonly T[];
  future: readonly T[];
}
export const HISTORY_LIMIT = 100;

export function pushHistory<T>(h: History<T>, previous: T): History<T> {
  return { past: [...h.past, previous].slice(-HISTORY_LIMIT), future: [] };
}
export function undoHistory<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (h.past.length === 0) return null;
  const value = h.past[h.past.length - 1];
  return { value, history: { past: h.past.slice(0, -1), future: [...h.future, current] } };
}
export function redoHistory<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (h.future.length === 0) return null;
  const value = h.future[h.future.length - 1];
  return { value, history: { past: [...h.past, current], future: h.future.slice(0, -1) } };
}
