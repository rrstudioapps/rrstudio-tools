// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Oscuramento vero di parti di un PDF: le pagine con aree da oscurare vengono ridisegnate come immagini con i rettangoli
 * neri «bruciati» dentro, quindi il testo sotto non esiste più nel file. Le pagine senza aree restano com'erano (testo compreso).
 * Qui la parte pura: aree normalizzate e ricerca del testo; il disegno è in `pdf-redact-browser.ts`.
 */

/** Rettangolo in coordinate normalizzate (0–1) della pagina come si vede, origine in alto a sinistra. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Aree per pagina (indice da 0). */
export type Areas = Record<number, Rect[]>;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Rettangolo dal trascinamento tra due punti (in qualunque verso), nei limiti della pagina; null se troppo piccolo. */
export function rectFromDrag(x0: number, y0: number, x1: number, y1: number, minSize = 0.004): Rect | null {
  const x = clamp01(Math.min(x0, x1));
  const y = clamp01(Math.min(y0, y1));
  const w = clamp01(Math.max(x0, x1)) - x;
  const h = clamp01(Math.max(y0, y1)) - y;
  return w < minSize || h < minSize ? null : { x, y, w, h };
}

/** Elemento di testo come lo dà pdf.js (getTextContent). */
export interface TextItem {
  str: string;
  /** [a, b, c, d, e, f]: e, f = origine (sulla linea di base) in punti, y verso l'alto. */
  transform: number[];
  width: number;
  height: number;
}

/**
 * Aree che coprono le occorrenze di `query` (senza distinguere maiuscole) negli elementi di testo di una pagina non ruotata.
 * Dentro un elemento la posizione è stimata in proporzione ai caratteri: va bene per i caratteri a larghezza simile,
 * e per questo si aggiunge un po' di margine.
 */
export function textHits(items: readonly TextItem[], query: string, pageW: number, pageH: number, pad = 1.5): Rect[] {
  const q = query.trim().toLowerCase();
  if (q === '' || pageW <= 0 || pageH <= 0) return [];
  const out: Rect[] = [];
  for (const it of items) {
    const s = it.str.toLowerCase();
    if (s === '' || it.width <= 0) continue;
    const per = it.width / s.length;
    const size = Math.abs(it.height) > 0 ? Math.abs(it.height) : Math.abs(it.transform[3]) || 10;
    for (let i = s.indexOf(q); i !== -1; i = s.indexOf(q, i + q.length)) {
      const left = it.transform[4] + i * per - pad;
      const width = q.length * per + 2 * pad;
      const bottom = it.transform[5] - 0.25 * size - pad;
      const height = 1.1 * size + 2 * pad;
      const r = rectFromDrag(left / pageW, 1 - (bottom + height) / pageH, (left + width) / pageW, 1 - bottom / pageH, 0);
      if (r) out.push(r);
    }
  }
  return out;
}

export function countAreas(a: Areas): { areas: number; pages: number } {
  let areas = 0;
  let pages = 0;
  for (const list of Object.values(a)) {
    if (list.length) pages++;
    areas += list.length;
  }
  return { areas, pages };
}
