// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Massimo comun divisore (interi non negativi). */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export interface Preset {
  id: string;
  /** Etichetta breve (non tradotta: sono rapporti noti). */
  label: string;
  w: number;
  h: number;
}

export const PRESETS: readonly Preset[] = [
  { id: '16-9', label: '16:9', w: 16, h: 9 },
  { id: '4-3', label: '4:3', w: 4, h: 3 },
  { id: '21-9', label: '21:9', w: 21, h: 9 },
  { id: '1-1', label: '1:1', w: 1, h: 1 },
  { id: '9-16', label: '9:16', w: 9, h: 16 },
  { id: '3-2', label: '3:2', w: 3, h: 2 },
  { id: 'a4', label: 'A4 (√2:1)', w: Math.SQRT2, h: 1 },
];

export interface RatioResult {
  /** Rapporto ridotto (interi) se larghezza e altezza sono intere, altrimenti null. */
  w: number | null;
  h: number | null;
  decimal: number;
}

/** Rapporto ridotto con il MCD (solo per dimensioni intere positive) e valore decimale larghezza/altezza. null se non valide. */
export function reduceRatio(width: number, height: number): RatioResult | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const decimal = width / height;
  if (Number.isInteger(width) && Number.isInteger(height)) {
    const g = gcd(width, height);
    return { w: width / g, h: height / g, decimal };
  }
  return { w: null, h: null, decimal };
}

/** Il preset più vicino al rapporto dato (distanza relativa ≤ `tol`), anche capovolto. null se nessuno. */
export function nearestPreset(decimal: number, tol = 0.01): { preset: Preset; flipped: boolean; error: number } | null {
  let best: { preset: Preset; flipped: boolean; error: number } | null = null;
  // prima i preset nel verso diretto: a parità di scarto vince il diretto (9:16 e non 16:9 capovolto)
  for (const flipped of [false, true]) {
    for (const p of PRESETS) {
      const r = flipped ? p.h / p.w : p.w / p.h;
      const err = Math.abs(decimal - r) / r;
      if (err <= tol && (!best || err < best.error)) best = { preset: p, flipped, error: err };
    }
  }
  return best;
}

export type Rounding = 'none' | 'integer' | 'even' | 'multiple8';

/** Arrotonda una dimensione in pixel: nessuno (due decimali), intero, pari, multiplo di 8. Mai sotto il minimo (1 o 8). */
export function roundDimension(v: number, mode: Rounding): number {
  switch (mode) {
    case 'none':
      return Math.round(v * 100) / 100;
    case 'integer':
      return Math.max(1, Math.round(v));
    case 'even':
      return Math.max(2, Math.round(v / 2) * 2);
    case 'multiple8':
      return Math.max(8, Math.round(v / 8) * 8);
  }
}

export interface Solved {
  width: number;
  height: number;
  /** Scarto relativo (%) tra il rapporto ottenuto con l'arrotondamento e quello richiesto. */
  errorPercent: number;
}

/** Dato il rapporto `rw:rh` e un lato, calcola l'altro (arrotondato). null se i dati non sono validi. */
export function solveSide(rw: number, rh: number, side: 'width' | 'height', value: number, mode: Rounding): Solved | null {
  if (!(rw > 0) || !(rh > 0) || !(value > 0) || ![rw, rh, value].every(Number.isFinite)) return null;
  const known = roundDimension(value, mode === 'none' ? 'none' : 'integer');
  const other = roundDimension(side === 'width' ? (value * rh) / rw : (value * rw) / rh, mode);
  // con un arrotondamento a pari o multipli di 8 si arrotonda anche il lato noto, se richiesto
  const k = mode === 'even' || mode === 'multiple8' ? roundDimension(value, mode) : known;
  const width = side === 'width' ? k : other;
  const height = side === 'width' ? other : k;
  const target = rw / rh;
  return { width, height, errorPercent: ((width / height - target) / target) * 100 };
}

/** Valore CSS: `aspect-ratio: 16 / 9;` con interi se possibile, altrimenti decimale a 4 cifre. */
export function cssAspectRatio(rw: number, rh: number): string {
  if (Number.isInteger(rw) && Number.isInteger(rh)) {
    const g = gcd(rw, rh);
    return `aspect-ratio: ${rw / g} / ${rh / g};`;
  }
  return `aspect-ratio: ${Number((rw / rh).toFixed(4))};`;
}

/** Ripiego "padding-top" in percentuale (altezza/larghezza), per i browser senza aspect-ratio. */
export function cssPaddingTop(rw: number, rh: number): string {
  return `padding-top: ${Number(((rh / rw) * 100).toFixed(4))}%;`;
}
