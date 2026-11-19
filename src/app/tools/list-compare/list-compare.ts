// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Massimo di righe per elenco. */
export const MAX_LINES = 200_000;

export type SortMode = 'appearance' | 'az' | 'natural';

export interface CompareOptions {
  /** «Mela» e «mela» sono la stessa voce (la voce mostrata è la prima incontrata). */
  ignoreCase: boolean;
  /** Toglie spazi e tabulazioni a inizio e fine voce. */
  trim: boolean;
  /** Salta le righe vuote (o fatte di soli spazi). */
  ignoreEmpty: boolean;
  /** Ordine dei risultati: di apparizione, alfabetico o numerico naturale (2 prima di 10). */
  sort: SortMode;
  /** Lingua per l'ordinamento (di default italiano). */
  locale?: string;
}

export const DEFAULT_OPTIONS: CompareOptions = { ignoreCase: false, trim: true, ignoreEmpty: true, sort: 'appearance' };

export interface Duplicate {
  value: string;
  count: number;
}

export interface CompareResult {
  /** Voci lette (righe non scartate), doppioni compresi. */
  countA: number;
  countB: number;
  /** Voci diverse. */
  uniqueA: number;
  uniqueB: number;
  union: string[];
  common: string[];
  onlyA: string[];
  onlyB: string[];
  dupA: Duplicate[];
  dupB: Duplicate[];
}

/** Righe di un testo; un a capo finale non crea una riga vuota in più. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

interface Entry {
  value: string;
  count: number;
}

/** Voci distinte nell'ordine di apparizione, con la prima forma incontrata e quante volte compaiono. */
function collect(text: string, o: CompareOptions): { map: Map<string, Entry>; total: number } {
  const map = new Map<string, Entry>();
  let total = 0;
  for (const raw of splitLines(text)) {
    if (o.ignoreEmpty && raw.trim() === '') continue;
    const value = o.trim ? raw.trim() : raw;
    const key = o.ignoreCase ? value.toLowerCase() : value;
    total++;
    const e = map.get(key);
    if (e) e.count++;
    else map.set(key, { value, count: 1 });
  }
  return { map, total };
}

/** Confronta due elenchi (una voce per riga). Tempo lineare: usa solo Map. */
export function compareLists(a: string, b: string, o: CompareOptions = DEFAULT_OPTIONS): CompareResult {
  const A = collect(a, o);
  const B = collect(b, o);
  const union: string[] = [];
  const common: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const [key, e] of A.map) {
    union.push(e.value);
    (B.map.has(key) ? common : onlyA).push(e.value);
  }
  for (const [key, e] of B.map) {
    if (!A.map.has(key)) {
      union.push(e.value);
      onlyB.push(e.value);
    }
  }
  const dups = (m: Map<string, Entry>): Duplicate[] => {
    const out: Duplicate[] = [];
    for (const e of m.values()) if (e.count > 1) out.push({ value: e.value, count: e.count });
    return out;
  };
  const res: CompareResult = {
    countA: A.total,
    countB: B.total,
    uniqueA: A.map.size,
    uniqueB: B.map.size,
    union,
    common,
    onlyA,
    onlyB,
    dupA: dups(A.map),
    dupB: dups(B.map),
  };
  if (o.sort !== 'appearance') {
    const col = new Intl.Collator(o.locale ?? 'it', o.sort === 'natural' ? { numeric: true, sensitivity: 'base' } : undefined);
    const cmp = (x: string, y: string): number => col.compare(x, y);
    res.union.sort(cmp);
    res.common.sort(cmp);
    res.onlyA.sort(cmp);
    res.onlyB.sort(cmp);
    res.dupA.sort((x, y) => cmp(x.value, y.value));
    res.dupB.sort((x, y) => cmp(x.value, y.value));
  }
  return res;
}

/** Testo di un elenco di doppioni: «voce<TAB>volte», una per riga. */
export function duplicatesToText(d: Duplicate[]): string {
  return d.map((x) => `${x.value}\t${x.count}`).join('\n');
}
