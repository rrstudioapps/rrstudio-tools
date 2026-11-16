// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Cronologia annulla/ripeti con limite: tiene gli stati (immutabili, condividono i sotto-alberi). */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Nuovo stato: azzera il "ripeti" e scarta i più vecchi oltre il limite. Stesso valore = nessun cambio. */
export function pushState<T>(h: History<T>, next: T, limit = HISTORY_LIMIT): History<T> {
  if (Object.is(h.present, next)) return h;
  const past = [...h.past, h.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
