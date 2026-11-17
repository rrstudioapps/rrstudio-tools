// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Lettura del QR da pixel RGBA con jsQR (caricata solo quando serve). */

export interface ScanResult {
  text: string;
  /** Angoli del codice nell'immagine analizzata (coordinate dell'immagine ridotta). */
  corners: { x: number; y: number }[];
}

type JsQR = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }) => {
  data: string;
  location: { topLeftCorner: Pt; topRightCorner: Pt; bottomRightCorner: Pt; bottomLeftCorner: Pt };
} | null;
interface Pt {
  x: number;
  y: number;
}

let lib: Promise<JsQR> | null = null;
export function loadJsQr(): Promise<JsQR> {
  lib ??= import('jsqr').then((m) => ((m as { default?: JsQR }).default ?? (m as unknown as JsQR)));
  return lib;
}

/** Decodifica un'immagine RGBA. `attemptBoth` prova anche i colori invertiti (QR chiaro su sfondo scuro). */
export async function decodePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  inversion: 'dontInvert' | 'attemptBoth' = 'attemptBoth',
): Promise<ScanResult | null> {
  if (width < 21 || height < 21 || data.length < width * height * 4) return null;
  const jsQR = await loadJsQr();
  const r = jsQR(data, width, height, { inversionAttempts: inversion });
  if (!r || r.data === '') return null;
  const l = r.location;
  return { text: r.data, corners: [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner] };
}

/** Dimensioni ridotte in modo che il lato più lungo non superi `max` (mai ingrandisce). */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
