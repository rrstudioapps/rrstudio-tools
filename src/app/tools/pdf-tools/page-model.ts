// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** Numero di colori distinti per i file d'origine (vedi --src-N in styles.scss). */
export const SOURCE_COLORS = 8;

/** Una pagina nella griglia. `rotation` è la rotazione aggiunta dall'utente (multipli di 90). */
export interface PageItem {
  uid: number;
  sourceId: number;
  /** Indice (da 0) nel file d'origine. */
  index: number;
  rotation: number;
  selected: boolean;
}

export function normalizeRotation(deg: number): number {
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
}

/** Sposta l'elemento in `from` in modo che finisca in posizione `to` (dopo la rimozione). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const target = Math.max(0, Math.min(list.length - 1, to));
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(target, 0, item);
  return copy;
}

/**
 * Posizione finale quando si trascina `from` sopra `over`, prima o dopo di essa.
 * Restituisce `from` se non cambia nulla.
 */
export function dropPosition(from: number, over: number, after: boolean): number {
  let to = after ? over + 1 : over;
  if (from < to) to--;
  return to;
}

/** Dati di un file caricato per l'uso in `buildPdf`. */
export interface SourceRef {
  id: number;
  load: () => Promise<Uint8Array>;
}
