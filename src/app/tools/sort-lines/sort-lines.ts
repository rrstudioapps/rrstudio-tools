// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Ordinamento e pulizia di elenchi di righe. Logica pura.
 *
 * Ordine delle operazioni: dividi in righe → rimuovi spazi ai margini → togli le righe vuote → rimuovi i
 * duplicati (tenendo la prima occorrenza, contandole) → ordina → inverti → prefisso con il conteggio →
 * prefisso/suffisso → numerazione.
 */

export type SortMode = 'none' | 'alpha' | 'natural' | 'length' | 'frequency' | 'random';
export type DedupeMode = 'none' | 'exact' | 'ignoreCase';
export type Lang = 'it' | 'en';

export interface SortOptions {
  mode: SortMode;
  reverse: boolean;
  /** Distingue maiuscole e minuscole nell'ordine alfabetico/naturale. */
  caseSensitive: boolean;
  dedupe: DedupeMode;
  /** Nel confronto dei duplicati le sequenze di spazi valgono uno spazio solo. */
  collapseSpaces: boolean;
  trim: boolean;
  removeEmpty: boolean;
  /** Unisce le righe uguali e antepone il numero di occorrenze. */
  countOccurrences: boolean;
  prefix: string;
  suffix: string;
  numbering: boolean;
  numberStart: number;
  /** Testo tra il numero e la riga, es. ". " */
  numberSeparator: string;
  lang: Lang;
}

export const DEFAULT_OPTIONS: SortOptions = {
  mode: 'alpha',
  reverse: false,
  caseSensitive: false,
  dedupe: 'none',
  collapseSpaces: false,
  trim: false,
  removeEmpty: false,
  countOccurrences: false,
  prefix: '',
  suffix: '',
  numbering: false,
  numberStart: 1,
  numberSeparator: '. ',
  lang: 'it',
};

export interface SortResult {
  text: string;
  linesIn: number;
  linesOut: number;
  duplicatesRemoved: number;
  emptyRemoved: number;
}

export type RandomFn = () => number;

/** Numero casuale in [0, 1) dal generatore crittografico del browser. */
export function cryptoRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 0x1_0000_0000;
}

/** Fisher-Yates su una copia. */
export function shuffle<T>(items: readonly T[], rnd: RandomFn = cryptoRandom): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function splitLines(text: string): { lines: string[]; trailingNewline: boolean } {
  if (text === '') return { lines: [], trailingNewline: false };
  const lines = text.split(/\r\n|\r|\n/);
  const trailingNewline = lines.length > 1 && lines[lines.length - 1] === '';
  if (trailingNewline) lines.pop();
  return { lines, trailingNewline };
}

function dedupeKey(line: string, o: SortOptions): string {
  let k = line;
  if (o.collapseSpaces) k = k.replace(/\s+/g, ' ').trim();
  if (o.dedupe === 'ignoreCase') k = k.toLocaleLowerCase(o.lang);
  return k;
}

interface Item {
  text: string;
  count: number;
}

/** Applica ordinamento e pulizia; `rnd` serve solo per l'ordine casuale (iniettabile nei test). */
export function processLines(input: string, options: Partial<SortOptions> = {}, rnd: RandomFn = cryptoRandom): SortResult {
  const o: SortOptions = { ...DEFAULT_OPTIONS, ...options };
  const { lines, trailingNewline } = splitLines(input);
  let work = lines.slice();
  if (o.trim) work = work.map((l) => l.trim());
  let emptyRemoved = 0;
  if (o.removeEmpty) {
    const before = work.length;
    work = work.filter((l) => l.trim() !== '');
    emptyRemoved = before - work.length;
  }

  // gruppi di righe uguali (secondo il confronto scelto) con il loro conteggio
  const groups = new Map<string, Item>();
  const unique: Item[] = [];
  const keyOf = (line: string): string => dedupeKey(line, o.dedupe === 'none' ? { ...o, dedupe: 'exact' } : o);
  for (const line of work) {
    const key = keyOf(line);
    const found = groups.get(key);
    if (found) found.count++;
    else {
      const item: Item = { text: line, count: 1 };
      groups.set(key, item);
      unique.push(item);
    }
  }
  let items: Item[];
  let duplicatesRemoved = 0;
  if (o.dedupe !== 'none' || o.countOccurrences) {
    // il conteggio ha senso solo per righe distinte: contare le occorrenze unisce le righe uguali
    items = unique;
    duplicatesRemoved = work.length - unique.length;
  } else if (o.mode === 'frequency') {
    items = work.map((text) => ({ text, count: groups.get(keyOf(text))!.count }));
  } else {
    items = work.map((text) => ({ text, count: 1 }));
  }

  const collator = new Intl.Collator(o.lang, {
    sensitivity: o.caseSensitive ? 'variant' : 'accent',
    numeric: o.mode === 'natural',
  });
  switch (o.mode) {
    case 'alpha':
    case 'natural':
      items.sort((a, b) => collator.compare(a.text, b.text));
      break;
    case 'length':
      items.sort((a, b) => [...a.text].length - [...b.text].length || collator.compare(a.text, b.text));
      break;
    case 'frequency':
      items.sort((a, b) => b.count - a.count || collator.compare(a.text, b.text));
      break;
    case 'random':
      items = shuffle(items, rnd);
      break;
    case 'none':
      break;
  }
  if (o.reverse) items.reverse();

  const start = Number.isFinite(o.numberStart) ? Math.trunc(o.numberStart) : 1;
  const out = items.map((it, i) => {
    let s = it.text;
    if (o.countOccurrences) s = `${it.count}× ${s}`;
    s = o.prefix + s + o.suffix;
    if (o.numbering) s = `${start + i}${o.numberSeparator}${s}`;
    return s;
  });
  return {
    text: out.join('\n') + (trailingNewline && out.length ? '\n' : ''),
    linesIn: lines.length,
    linesOut: out.length,
    duplicatesRemoved,
    emptyRemoved,
  };
}
