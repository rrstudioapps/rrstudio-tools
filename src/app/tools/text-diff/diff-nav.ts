// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Misure (in px) che servono a calcolare dove scorrere il contenitore dei risultati. */
export interface ScrollGeometry {
  /** scrollTop attuale del contenitore */
  scrollTop: number;
  /** distanza del bordo alto del contenitore dal bordo alto del viewport */
  containerTop: number;
  /** distanza del bordo alto della riga dal bordo alto del viewport */
  elTop: number;
  elHeight: number;
  /** altezza visibile del contenitore */
  containerHeight: number;
  /** altezza della barra sticky in cima al contenitore */
  stickyHeight: number;
  /** scrollHeight - clientHeight */
  maxScroll: number;
}

/**
 * scrollTop da dare al contenitore per portare la riga nella parte visibile (sotto la barra sticky),
 * circa a un terzo dall'alto così si vede anche il contesto; sempre dentro [0, maxScroll].
 */
export function targetScrollTop(g: ScrollGeometry): number {
  const visible = Math.max(0, g.containerHeight - g.stickyHeight);
  const margin = Math.max(0, Math.min((visible - g.elHeight) / 3, visible / 3));
  const top = g.scrollTop + (g.elTop - g.containerTop) - g.stickyHeight - margin;
  return Math.min(Math.max(0, Math.round(top)), Math.max(0, g.maxScroll));
}

/** Differenza successiva/precedente (a giro): indice del gruppo, -1 prima di partire. */
export function nextGroup(current: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : total - 1;
  return (current + delta + total) % total;
}

/** Posizione (indice di carattere) dell'inizio della riga `line` (1 = prima) in `text`; oltre la fine → fine del testo. */
export function lineStartOffset(text: string, line: number): number {
  if (line <= 1) return 0;
  const re = /\r\n|\n|\r/g;
  let seen = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    seen++;
    if (seen === line) return m.index + m[0].length;
  }
  return text.length;
}

/** Numero totale di righe di un testo (come le conta l'editor: "a\nb\n" ha 3 righe, la terza vuota). */
export function lineCount(text: string): number {
  return text === '' ? 0 : text.split(/\r\n|\n|\r/).length;
}
