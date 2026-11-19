// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ArrayMode, compareValues, formatValue } from '../json-diff/json-diff';
import { normalize, parseInput } from '../yaml-json-converter/convert';

/**
 * Confronto di due YAML (differenze strutturali con percorso, sul motore di json-diff) e di due CSV
 * (righe abbinate per una o più colonne chiave scelte dall'utente, o per posizione).
 */

export type RowKind = 'added' | 'removed' | 'changed' | 'type';

export interface DiffRow {
  kind: RowKind;
  /** Percorso leggibile: `servizio.porte[1]` per lo YAML, `[id=7].prezzo` per i CSV; vuoto = radice. */
  path: string;
  before?: string;
  after?: string;
}

export const MAX_ROWS = 2000;

export type YamlDiffResult =
  | { ok: true; rows: DiffRow[]; truncated: boolean; total: number }
  | { ok: false; side: 'a' | 'b'; message: string; line?: number; column?: number };

export interface YamlDiffOptions {
  arrayMode: ArrayMode;
  /** Campo identificativo per `arrayMode: 'key'` (vuoto = rilevamento automatico). */
  key: string;
  ignoreCase: boolean;
}

export const DEFAULT_YAML_OPTIONS: YamlDiffOptions = { arrayMode: 'index', key: '', ignoreCase: false };

export function diffYaml(textA: string, textB: string, opts: Partial<YamlDiffOptions> = {}): YamlDiffResult {
  const o = { ...DEFAULT_YAML_OPTIONS, ...opts };
  const pa = parseInput(textA, 'yaml');
  if (!pa.ok) return { ok: false, side: 'a', ...pa.error };
  const pb = parseInput(textB, 'yaml');
  if (!pb.ok) return { ok: false, side: 'b', ...pb.error };
  const res = compareValues(normalize(pa.value, false, false), normalize(pb.value, false, false), {
    arrayMode: o.arrayMode,
    key: o.key.trim(),
    ignoreCase: o.ignoreCase,
  });
  const all: DiffRow[] = res.differences.map((d) => ({
    kind: d.kind,
    path: d.path,
    ...(d.kind !== 'added' ? { before: formatValue(d.oldValue) } : {}),
    ...(d.kind !== 'removed' ? { after: formatValue(d.newValue) } : {}),
  }));
  return { ok: true, rows: all.slice(0, MAX_ROWS), truncated: all.length > MAX_ROWS, total: all.length };
}

// ---------------------------------------------------------------- CSV

export interface CsvDiffOptions {
  /** Nomi delle colonne che identificano una riga; vuoto = si confronta per posizione. */
  keyColumns: string[];
  /** Toglie gli spazi ai bordi delle celle prima del confronto. */
  trim: boolean;
  ignoreCase: boolean;
}

export const DEFAULT_CSV_OPTIONS: CsvDiffOptions = { keyColumns: [], trim: true, ignoreCase: false };

export type CsvDiffResult =
  | { ok: true; rows: DiffRow[]; truncated: boolean; total: number; rowsA: number; rowsB: number }
  | { ok: false; error: 'empty' | 'key'; side?: 'a' | 'b'; column?: string };

/** Elenco di nomi separati da virgola (con virgolette doppie per i nomi che contengono virgole). */
export function parseKeyColumns(text: string): string[] {
  const out: string[] = [];
  const re = /\s*(?:"((?:[^"]|"")*)"|([^,]*?))\s*(?:,|$)/gy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < text.length && (m = re.exec(text)) !== null) {
    const v = m[1] !== undefined ? m[1].replace(/""/g, '"') : (m[2] ?? '');
    if (v !== '') out.push(v);
    if (m[0] === '') break;
  }
  return out;
}

const preview = (cols: string[], row: readonly string[]): string => {
  const s = cols.map((c, i) => `${c}=${row[i] ?? ''}`).join('; ');
  return s.length > 160 ? s.slice(0, 159) + '…' : s;
};

/** `[id=7]` oppure `[riga 3]`. */
const label = (keyCols: string[], values: string[], pos: number): string =>
  keyCols.length === 0 ? `[${pos}]` : `[${keyCols.map((c, i) => `${c}=${values[i]}`).join(', ')}]`;

/** Confronta due tabelle (la prima riga è l'intestazione). */
export function diffCsv(rowsA: string[][], rowsB: string[][], options: Partial<CsvDiffOptions> = {}): CsvDiffResult {
  const o = { ...DEFAULT_CSV_OPTIONS, ...options };
  if (rowsA.length === 0 || rowsB.length === 0) return { ok: false, error: 'empty', side: rowsA.length === 0 ? 'a' : 'b' };
  const norm = (s: string | undefined): string => {
    let v = s ?? '';
    if (o.trim) v = v.trim();
    return o.ignoreCase ? v.toLowerCase() : v;
  };
  const headA = rowsA[0].map((h) => h.trim());
  const headB = rowsB[0].map((h) => h.trim());
  const keyIdxA: number[] = [];
  const keyIdxB: number[] = [];
  for (const c of o.keyColumns) {
    const ia = headA.indexOf(c);
    if (ia === -1) return { ok: false, error: 'key', side: 'a', column: c };
    const ib = headB.indexOf(c);
    if (ib === -1) return { ok: false, error: 'key', side: 'b', column: c };
    keyIdxA.push(ia);
    keyIdxB.push(ib);
  }

  const rows: DiffRow[] = [];
  for (const h of headA) if (!headB.includes(h)) rows.push({ kind: 'removed', path: `column:${h}` });
  for (const h of headB) if (!headA.includes(h)) rows.push({ kind: 'added', path: `column:${h}` });
  const common = headA.filter((h, i) => headB.includes(h) && headA.indexOf(h) === i);

  interface Entry {
    label: string;
    row: string[];
  }
  /** Abbina per chiave; una chiave ripetuta si distingue con il numero d'ordine (`#2`). */
  const index = (data: string[][], keyIdx: number[]): Map<string, Entry> => {
    const map = new Map<string, Entry>();
    const seen = new Map<string, number>();
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const vals = keyIdx.map((i) => (row[i] ?? '').trim());
      const base = keyIdx.length === 0 ? String(r) : vals.map(norm).join('\u0001');
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const lab = label(o.keyColumns, vals, r) + (n > 1 ? `#${n}` : '');
      map.set(n > 1 ? `${base}\u0002${n}` : base, { label: lab, row });
    }
    return map;
  };
  const ma = index(rowsA, keyIdxA);
  const mb = index(rowsB, keyIdxB);

  for (const [k, ea] of ma) {
    const eb = mb.get(k);
    if (!eb) {
      rows.push({ kind: 'removed', path: ea.label, before: preview(headA, ea.row) });
      continue;
    }
    for (const c of common) {
      const va = ea.row[headA.indexOf(c)] ?? '';
      const vb = eb.row[headB.indexOf(c)] ?? '';
      if (norm(va) !== norm(vb)) rows.push({ kind: 'changed', path: `${eb.label}.${c}`, before: va, after: vb });
    }
  }
  for (const [k, eb] of mb) if (!ma.has(k)) rows.push({ kind: 'added', path: eb.label, after: preview(headB, eb.row) });

  return { ok: true, rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS, total: rows.length, rowsA: rowsA.length - 1, rowsB: rowsB.length - 1 };
}

/** Conteggi per il riepilogo. */
export function summarize(rows: readonly DiffRow[]): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const r of rows) {
    if (r.kind === 'added') added++;
    else if (r.kind === 'removed') removed++;
    else changed++;
  }
  return { added, removed, changed };
}

/** Elenco come testo, una riga per differenza (per copiare). */
export function rowsToText(rows: readonly DiffRow[]): string {
  const sign = { added: '+', removed: '-', changed: '~', type: '~' } as const;
  return rows
    .map((r) => {
      const v = r.before !== undefined && r.after !== undefined ? `${r.before} -> ${r.after}` : (r.before ?? r.after ?? '');
      return `${sign[r.kind]} ${r.path === '' ? '(root)' : r.path}${v === '' ? '' : ': ' + v}`;
    })
    .join('\n');
}
