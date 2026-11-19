// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Conversione tra CSV, JSON ed Excel passando da una tabella "piatta" comune.
 * Qui c'è solo la logica pura (nessuna libreria): la lettura/scrittura dei file sta in convert-io.ts.
 */
export type Cell = string | number | boolean | null;

export interface Table {
  /** Nomi delle colonne (se non c'è intestazione sono "col1", "col2"…). */
  columns: string[];
  rows: Cell[][];
  /** La prima riga del file era un'intestazione (e va riscritta come tale). */
  hasHeader: boolean;
}

export class ConvertError extends Error {
  constructor(
    readonly code: 'json' | 'json-shape' | 'empty',
    readonly detail = '',
  ) {
    super(code);
  }
}

// ---- Tipi delle celle ----

/** Da testo a numero o booleano solo se la conversione è esatta (così "007", "1.50" e "1e3" restano testo). */
export function typedCell(s: string): Cell {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (String(n) === s) return n;
  }
  return s;
}

export function cellToString(c: Cell): string {
  return c === null ? '' : String(c);
}

// ---- Formule ----

/**
 * Neutralizza il testo che un foglio di calcolo potrebbe eseguire come formula (inizia con = + - @, tab o ritorno a capo):
 * si antepone un apice. I numeri veri (anche negativi) non vengono toccati.
 */
export function neutralizeFormula(s: string): string {
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  if (/^[+-]?\d+([.,]\d+)?$/.test(s)) return s;
  return "'" + s;
}

function safeCell(c: Cell, neutralize: boolean): Cell {
  return neutralize && typeof c === 'string' ? neutralizeFormula(c) : c;
}

// ---- Nomi di colonna ----

function uniqueNames(raw: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((r, i) => {
    const base = r.trim() === '' ? `col${i + 1}` : r;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

function pad(row: readonly Cell[], width: number): Cell[] {
  const out = row.slice();
  while (out.length < width) out.push('');
  return out;
}

// ---- Da matrici (CSV, XLSX, JSON array di array) a tabella ----

export function tableFromMatrix(matrix: readonly (readonly Cell[])[], opts: { header: boolean; typed: boolean }): Table {
  const rows = matrix.filter((r) => r.some((c) => c !== null && c !== ''));
  if (rows.length === 0) throw new ConvertError('empty');
  const width = Math.max(...rows.map((r) => r.length));
  // gli a capo dentro le celle diventano LF: Excel (XML) non conserva la differenza tra CRLF e LF
  const conv = (c: Cell): Cell => {
    if (typeof c !== 'string') return c;
    const s = c.replace(/\r\n?/g, '\n');
    return opts.typed ? typedCell(s) : s;
  };
  if (opts.header) {
    const columns = uniqueNames(pad(rows[0], width).map((c) => cellToString(conv(c))));
    return { columns, rows: rows.slice(1).map((r) => pad(r, width).map(conv)), hasHeader: true };
  }
  return { columns: Array.from({ length: width }, (_, i) => `col${i + 1}`), rows: rows.map((r) => pad(r, width).map(conv)), hasHeader: false };
}

// ---- Appiattimento e ricostruzione ----

/** { a: { b: 1 }, t: [x, y] } → { 'a.b': 1, 't.0': x, 't.1': y }. Array e oggetti vuoti restano come testo "[]" e "{}". */
export function flattenValue(value: unknown, prefix = '', out: Record<string, Cell> = {}): Record<string, Cell> {
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) out[prefix] = '[]';
    value.forEach((v, i) => flattenValue(v, prefix ? `${prefix}.${i}` : String(i), out));
  } else if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out[prefix] = '{}';
    for (const [k, v] of entries) flattenValue(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix || 'value'] = value === undefined ? null : (value as Cell);
  }
  return out;
}

/** Scrive `value` nel percorso a punti; i segmenti numerici creano array. False se il percorso entra in conflitto con un valore già presente. */
function setPath(root: Record<string, unknown>, path: string[], value: unknown): boolean {
  let node: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const last = i === path.length - 1;
    const slot = Array.isArray(node) ? Number(key) : key;
    const container = node as Record<string | number, unknown>;
    if (last) {
      if (container[slot] !== undefined) return false;
      container[slot] = value;
      return true;
    }
    let child = container[slot];
    if (child === undefined) {
      child = /^\d+$/.test(path[i + 1]) ? [] : {};
      container[slot] = child;
    } else if (child === null || typeof child !== 'object') return false;
    node = child as Record<string, unknown> | unknown[];
  }
  return true;
}

function compact(v: unknown): unknown {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined).map(compact);
  if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v)) (v as Record<string, unknown>)[k] = compact((v as Record<string, unknown>)[k]);
  }
  return v;
}

/** Una riga della tabella come oggetto JSON, con o senza ricostruzione dei percorsi a punti. */
export function rowToRecord(columns: readonly string[], row: readonly Cell[], unflatten: boolean): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    const v = row[i] ?? null;
    if (!unflatten || !col.includes('.')) {
      rec[col] = v;
      return;
    }
    // le celle vuote dei percorsi annidati si omettono (un array più corto di un altro non deve avere buchi)
    if (v === '' || v === null) return;
    if (!setPath(rec, col.split('.'), v)) rec[col] = v;
  });
  return compact(rec) as Record<string, unknown>;
}

// ---- JSON ----

export type JsonShape = 'objects' | 'arrays';

/** Testo JSON → tabella: array di oggetti, array di array, un oggetto singolo o un array di valori semplici. */
export function tableFromJson(text: string, opts: { flatten: boolean; header: boolean }): Table {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ConvertError('json', e instanceof Error ? e.message : '');
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) data = [data];
  if (!Array.isArray(data)) throw new ConvertError('json-shape');
  if (data.length === 0) throw new ConvertError('empty');
  if (data.every((r) => Array.isArray(r))) {
    return tableFromMatrix(
      (data as unknown[][]).map((r) => r.map((c) => (c !== null && typeof c === 'object' ? JSON.stringify(c) : (c as Cell)))),
      { header: opts.header, typed: false },
    );
  }
  const columns: string[] = [];
  const index = new Map<string, number>();
  const flat: Record<string, Cell>[] = [];
  for (const item of data) {
    let rec: Record<string, Cell>;
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      rec = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        if (v !== null && typeof v === 'object') {
          if (opts.flatten) Object.assign(rec, flattenValue(v, k));
          else rec[k] = JSON.stringify(v);
        } else rec[k] = v === undefined ? null : (v as Cell);
      }
    } else if (Array.isArray(item)) throw new ConvertError('json-shape');
    else rec = { value: item as Cell };
    for (const k of Object.keys(rec)) {
      if (!index.has(k)) {
        index.set(k, columns.length);
        columns.push(k);
      }
    }
    flat.push(rec);
  }
  return { columns, rows: flat.map((r) => columns.map((c) => (c in r ? r[c] : null))), hasHeader: true };
}

export function tableToJson(t: Table, shape: JsonShape, unflatten: boolean, indent: number | string = 2): string {
  if (shape === 'arrays') {
    const rows: unknown[][] = t.rows.map((r) => r.slice());
    return JSON.stringify(t.hasHeader ? [t.columns, ...rows] : rows, null, indent);
  }
  return JSON.stringify(t.rows.map((r) => rowToRecord(t.columns, r, unflatten)), null, indent);
}

// ---- Uscite CSV / XLSX ----

/** Righe di testo pronte per l'unparse del CSV (celle vuote per null, formule neutralizzate). */
export function tableToCsvRows(t: Table, neutralize: boolean): string[][] {
  const conv = (c: Cell): string => (typeof c === 'string' && neutralize ? neutralizeFormula(c) : cellToString(c));
  const body = t.rows.map((r) => r.map(conv));
  return t.hasHeader ? [t.columns.map((c) => (neutralize ? neutralizeFormula(c) : c)), ...body] : body;
}

/** Righe tipizzate per il foglio Excel: numeri e booleani restano tali, il testo è neutralizzato. */
export function tableToXlsxRows(t: Table, neutralize: boolean): Cell[][] {
  const body = t.rows.map((r) => r.map((c) => safeCell(c, neutralize)));
  return t.hasHeader ? [t.columns.map((c) => safeCell(c, neutralize)), ...body] : body;
}

// ---- Rilevamento ----

/** JSON se il testo inizia con [ o {, altrimenti CSV. */
export function detectTextKind(text: string): 'json' | 'csv' {
  const s = text.trimStart();
  return s.startsWith('[') || s.startsWith('{') ? 'json' : 'csv';
}

/** Separatore usato da un testo CSV (il più frequente tra , ; tab | nella prima riga fuori dalle virgolette). */
export function guessDelimiter(text: string): ',' | ';' | '\t' | '|' {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let quoted = false;
  for (let i = 0; i < text.length && i < 20000; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const best = (Object.entries(counts) as [',' | ';' | '\t' | '|', number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}
