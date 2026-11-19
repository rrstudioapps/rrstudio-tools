// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Logica pura del ritaglio: proporzioni, rettangolo di ritaglio, rotazione e ridimensionamento. Niente DOM. */

export type AspectId = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | '4:5' | 'id';

/** Proporzioni fisse (larghezza / altezza); `null` = libero. La foto tessera italiana è 35×45 mm. */
export const ASPECTS: Record<AspectId, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  id: 35 / 45,
};
export const ASPECT_IDS = Object.keys(ASPECTS) as AspectId[];

/** Rettangolo in pixel dell'immagine trasformata (origine in alto a sinistra). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  width: number;
  height: number;
}

/** Lato minimo di un ritaglio (px). */
export const MIN_CROP = 8;
/** Lato massimo dell'immagine di lavoro e dell'esportazione (px). */
export const MAX_SIDE = 8192;

/** Maniglie di ridimensionamento: lati e angoli. */
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const EPS = 1e-6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Normalizza un angolo in gradi nell'intervallo [0, 360). */
export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Dimensioni del riquadro che contiene l'immagine ruotata di `deg` gradi (multipli di 90 esatti, senza errori di virgola). */
export function rotatedSize(width: number, height: number, deg: number): Size {
  const a = (normalizeAngle(deg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const snap = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : Math.ceil(v));
  return { width: Math.max(1, snap(width * c + height * s)), height: Math.max(1, snap(width * s + height * c)) };
}

/** Riduce le dimensioni se un lato supera `max`, mantenendo le proporzioni. */
export function limitSize(size: Size, max = MAX_SIDE): Size {
  const k = Math.min(1, max / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
}

/** Rettangolo iniziale: il più grande possibile con le proporzioni date (o tutta l'immagine se libero), centrato, al 90%. */
export function defaultCrop(bounds: Size, ratio: number | null): Rect {
  if (ratio === null) return { x: 0, y: 0, w: bounds.width, h: bounds.height };
  let w = bounds.width;
  let h = w / ratio;
  if (h > bounds.height) {
    h = bounds.height;
    w = h * ratio;
  }
  w *= 0.9;
  h *= 0.9;
  return { x: (bounds.width - w) / 2, y: (bounds.height - h) / 2, w, h };
}

/** Porta il rettangolo dentro i limiti (stessa dimensione se possibile, altrimenti ridotto). */
export function clampRect(r: Rect, bounds: Size): Rect {
  const w = clamp(r.w, Math.min(MIN_CROP, bounds.width), bounds.width);
  const h = clamp(r.h, Math.min(MIN_CROP, bounds.height), bounds.height);
  return { x: clamp(r.x, 0, bounds.width - w), y: clamp(r.y, 0, bounds.height - h), w, h };
}

/** Adatta un rettangolo alle proporzioni date mantenendo il centro e restando nei limiti. */
export function fitRatio(r: Rect, bounds: Size, ratio: number | null): Rect {
  if (ratio === null) return clampRect(r, bounds);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let w = r.w;
  let h = w / ratio;
  if (h > r.h + EPS) {
    h = r.h;
    w = h * ratio;
  }
  // non deve uscire dai limiti, neppure tenendo il centro
  const maxW = Math.min(bounds.width, bounds.height * ratio);
  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h }, bounds);
}

/** Sposta il rettangolo di (dx, dy) senza uscire dai limiti. */
export function moveRect(r: Rect, dx: number, dy: number, bounds: Size): Rect {
  return { ...r, x: clamp(r.x + dx, 0, bounds.width - r.w), y: clamp(r.y + dy, 0, bounds.height - r.h) };
}

/**
 * Trascina una maniglia di (dx, dy). Con `ratio` le proporzioni restano fisse: l'angolo opposto (o il centro
 * del lato opposto) è il punto fermo. Il risultato sta sempre nei limiti e non scende sotto MIN_CROP.
 */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, bounds: Size, ratio: number | null): Rect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (handle.includes('w')) left += dx;
  if (handle.includes('e')) right += dx;
  if (handle.includes('n')) top += dy;
  if (handle.includes('s')) bottom += dy;
  const hasW = handle.includes('w') || handle.includes('e');
  const hasH = handle.includes('n') || handle.includes('s');
  const minW = ratio === null ? MIN_CROP : Math.max(MIN_CROP, MIN_CROP * ratio);
  const minH = ratio === null ? MIN_CROP : Math.max(MIN_CROP, MIN_CROP / ratio);
  // limiti dal bordo opposto
  const anchorL = handle.includes('w') ? r.x + r.w : r.x;
  const anchorT = handle.includes('n') ? r.y + r.h : r.y;
  if (!ratio) {
    if (hasW) {
      if (handle.includes('w')) left = clamp(left, 0, right - minW);
      else right = clamp(right, left + minW, bounds.width);
    }
    if (hasH) {
      if (handle.includes('n')) top = clamp(top, 0, bottom - minH);
      else bottom = clamp(bottom, top + minH, bounds.height);
    }
    return { x: left, y: top, w: right - left, h: bottom - top };
  }
  // proporzioni fisse: si ricava la dimensione dominante e poi l'altra
  let w = right - left;
  let h = bottom - top;
  if (hasW && hasH) {
    // l'angolo segue il movimento che allarga di più
    if (w / ratio > h) h = w / ratio;
    else w = h * ratio;
  } else if (hasW) {
    h = w / ratio;
  } else {
    w = h * ratio;
  }
  // spazio disponibile dal punto fermo
  const availW = handle.includes('w') ? anchorL : handle.includes('e') ? bounds.width - anchorL : 2 * Math.min(r.x + r.w / 2, bounds.width - (r.x + r.w / 2));
  const availH = handle.includes('n') ? anchorT : handle.includes('s') ? bounds.height - anchorT : 2 * Math.min(r.y + r.h / 2, bounds.height - (r.y + r.h / 2));
  const maxW = Math.min(availW, availH * ratio);
  w = clamp(w, minW, Math.max(minW, maxW));
  h = w / ratio;
  const x = handle.includes('w') ? anchorL - w : handle.includes('e') ? anchorL : r.x + r.w / 2 - w / 2;
  const y = handle.includes('n') ? anchorT - h : handle.includes('s') ? anchorT : r.y + r.h / 2 - h / 2;
  return clampRect({ x, y, w, h }, bounds);
}

/**
 * Tastiera: frecce = sposta di `step` px; con `resize` le frecce ingrandiscono/riducono (destra/giù ingrandisce,
 * sinistra/su riduce) dal centro; `+`/`-` ingrandiscono o riducono del 5%.
 */
export function nudgeRect(
  r: Rect,
  key: string,
  step: number,
  resize: boolean,
  bounds: Size,
  ratio: number | null,
): Rect | null {
  const arrows: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (key in arrows) {
    const [ax, ay] = arrows[key];
    if (!resize) return moveRect(r, ax * step, ay * step, bounds);
    // destra/giù ingrandisce, sinistra/su riduce, restando centrato; libero: orizzontali sulla larghezza, verticali sull'altezza
    const d = step * 2;
    if (ratio) return scaleRectCentered(r, r.w + (ax + ay) * d, bounds, ratio, r.h);
    return scaleRectCentered(r, r.w + ax * d, bounds, null, r.h + ay * d);
  }
  if (key === '+' || key === '=') return scaleRectCentered(r, r.w * 1.05, bounds, ratio, r.h * 1.05);
  if (key === '-' || key === '_') return scaleRectCentered(r, r.w / 1.05, bounds, ratio, r.h / 1.05);
  return null;
}

/** Nuova larghezza (e altezza: da `h` se libero, dalle proporzioni altrimenti) attorno allo stesso centro. */
function scaleRectCentered(r: Rect, w: number, bounds: Size, ratio: number | null, h: number): Rect {
  const nh = ratio ? w / ratio : h;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return fitRatio(clampRect({ x: cx - w / 2, y: cy - nh / 2, w, h: nh }, bounds), bounds, ratio);
}

/** Arrotonda il rettangolo a pixel interi dentro i limiti (per l'esportazione). */
export function roundRect(r: Rect, bounds: Size): Rect {
  const x = clamp(Math.round(r.x), 0, bounds.width - 1);
  const y = clamp(Math.round(r.y), 0, bounds.height - 1);
  const w = clamp(Math.round(r.w), 1, bounds.width - x);
  const h = clamp(Math.round(r.h), 1, bounds.height - y);
  return { x, y, w, h };
}

/**
 * Dimensione finale: se `width`/`height` mancano si tiene quella del ritaglio. Con `lock` l'altro lato segue le
 * proporzioni del ritaglio, partendo dal lato indicato in `driver` (di default la larghezza, se valida).
 */
export function outputSize(
  crop: Size,
  req: { width: number | null; height: number | null; lock: boolean; driver?: 'width' | 'height' },
): Size {
  const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n >= 1;
  const w = valid(req.width) ? Math.round(req.width) : null;
  const h = valid(req.height) ? Math.round(req.height) : null;
  let out: Size;
  if (req.lock) {
    const byHeight = req.driver === 'height' ? h !== null : w === null && h !== null;
    if (byHeight && h !== null) out = { width: Math.round((h * crop.width) / crop.height), height: h };
    else if (w !== null) out = { width: w, height: Math.round((w * crop.height) / crop.width) };
    else out = { width: Math.round(crop.width), height: Math.round(crop.height) };
  } else {
    out = { width: w ?? Math.round(crop.width), height: h ?? Math.round(crop.height) };
  }
  return { width: Math.max(1, out.width), height: Math.max(1, out.height) };
}

export type OutFormat = 'png' | 'jpeg' | 'webp';
export const MIME: Record<OutFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const EXT: Record<OutFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

/** Nome del file ritagliato: `foto.jpg` → `foto-ritaglio.png`. */
export function cropFileName(original: string, format: OutFormat, suffix = 'ritaglio'): string {
  const base = original.replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'immagine';
  return `${base}-${suffix}.${EXT[format]}`;
}

/** Legge larghezza e altezza di un PNG dall'intestazione (per verificare l'esito nei test). */
export function pngSize(bytes: Uint8Array): Size | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** Parsing di un numero da un campo di testo; null se vuoto o non valido. */
export function parseDimension(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}
