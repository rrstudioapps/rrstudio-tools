// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Calcoli percentuali. Funzioni pure: restituiscono un numero oppure un codice d'errore. */

export type PctError = 'divZero' | 'rate100';
export type PctResult = { ok: true; value: number } | { ok: false; error: PctError };

const ok = (value: number): PctResult => ({ ok: true, value });

/** X% di Y. */
export function percentOf(pct: number, base: number): PctResult {
  return ok((pct * base) / 100);
}

/** X è che percentuale di Y (Y diverso da zero). */
export function whatPercent(part: number, whole: number): PctResult {
  return whole === 0 ? { ok: false, error: 'divZero' } : ok((part / whole) * 100);
}

/**
 * Variazione percentuale da A a B: (B − A) / |A| × 100. Positiva = aumento, negativa = calo.
 * Il valore assoluto al denominatore tiene il segno giusto anche partendo da un numero negativo.
 */
export function percentChange(from: number, to: number): PctResult {
  return from === 0 ? { ok: false, error: 'divZero' } : ok(((to - from) / Math.abs(from)) * 100);
}

/** Aggiunge (+1) o toglie (−1) una percentuale a un valore: sconto, ricarico, IVA. */
export function applyPercent(value: number, pct: number, direction: 1 | -1): PctResult {
  return ok(value * (1 + (direction * pct) / 100));
}

/**
 * Percentuale inversa: il valore di partenza, sapendo il valore finale dopo uno sconto (−1) o un aumento (+1).
 * Esempio: 80 dopo uno sconto del 20% → 100. Con uno sconto del 100% il valore di partenza non è ricavabile.
 */
export function reversePercent(final: number, pct: number, direction: 1 | -1): PctResult {
  const factor = 1 + (direction * pct) / 100;
  return factor === 0 ? { ok: false, error: 'rate100' } : ok(final / factor);
}
