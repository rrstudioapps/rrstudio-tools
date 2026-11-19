// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Cell, Table } from '../csv-json-converter/convert';
import { typedCell } from '../csv-json-converter/convert';
import type { XmlNode } from '../xml-formatter/xml';
import { El, unescapeXml } from '../xml-viewer/xml-tree';

/**
 * Da XML a tabella: si sceglie l'elemento che si ripete (un record per ciascuno) e si "appiattiscono" attributi,
 * figli e testo in colonne. Colonne: `@attr`, `figlio`, `figlio/nipote`, `figlio/@attr`; un figlio ripetuto
 * diventa `figlio`, `figlio[2]`, `figlio[3]`…; il testo di un elemento con anche figli sta in `…/#text`.
 */

export interface Candidate {
  /** Percorso dei nomi, per esempio `/catalogo/libro`. */
  path: string;
  count: number;
}

export interface TableOptions {
  attrs: boolean;
  /** Livelli sotto il record da appiattire (1 = solo i figli diretti). */
  depth: number;
  typed: boolean;
}

export const MAX_ROWS = 100_000;
export const MAX_COLUMNS = 200;

const elementsOf = (el: { children: XmlNode[] }): El[] => el.children.filter((c): c is El => c.t === 'el');

/** Elementi che compaiono più volte con lo stesso percorso di nomi, dai più numerosi ai meno; i discendenti di un elemento ripetuto restano. */
export function findRepeating(doc: XmlNode[], limit = 30): Candidate[] {
  const counts = new Map<string, number>();
  const walk = (els: El[], base: string): void => {
    for (const el of els) {
      const p = `${base}/${el.name}`;
      counts.set(p, (counts.get(p) ?? 0) + 1);
      walk(elementsOf(el), p);
    }
  };
  walk(elementsOf({ children: doc }), '');
  return [...counts]
    .filter(([, n]) => n > 1)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
    .slice(0, limit);
}

/** Elementi del documento con quel percorso di nomi, in ordine di documento. */
export function recordsAt(doc: XmlNode[], path: string): El[] {
  const names = path.split('/').filter(Boolean);
  if (names.length === 0) return [];
  const out: El[] = [];
  const walk = (els: El[], i: number): void => {
    for (const el of els) {
      if (el.name !== names[i]) continue;
      if (i === names.length - 1) out.push(el);
      else walk(elementsOf(el), i + 1);
    }
  };
  walk(elementsOf({ children: doc }), 0);
  return out;
}

const textOf = (el: El): string =>
  el.children
    .map((c) => (c.t === 'text' ? unescapeXml(c.value) : c.t === 'cdata' ? c.raw.slice(9, -3) : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

function flatten(el: El, prefix: string, depth: number, o: TableOptions, out: Map<string, string>): void {
  const key = (k: string): string => (prefix ? `${prefix}/${k}` : k);
  if (o.attrs) for (const a of el.attrs) out.set(key('@' + a.name), unescapeXml(a.value));
  const kids = elementsOf(el);
  const text = textOf(el);
  if (text !== '') out.set(kids.length === 0 && prefix ? prefix : key('#text'), text);
  if (depth <= 0) return;
  const seen = new Map<string, number>();
  for (const k of kids) {
    const n = (seen.get(k.name) ?? 0) + 1;
    seen.set(k.name, n);
    flatten(k, key(n === 1 ? k.name : `${k.name}[${n}]`), depth - 1, o, out);
  }
}

export interface BuiltTable {
  table: Table;
  /** Le righe sono state limitate a MAX_ROWS o le colonne a MAX_COLUMNS. */
  truncated: boolean;
}

export function buildTable(doc: XmlNode[], recordPath: string, o: TableOptions): BuiltTable {
  const records = recordsAt(doc, recordPath);
  const cols: string[] = [];
  const index = new Map<string, number>();
  const rows: Map<string, string>[] = [];
  let truncated = records.length > MAX_ROWS;
  for (const r of records.slice(0, MAX_ROWS)) {
    const m = new Map<string, string>();
    flatten(r, '', o.depth, o, m);
    for (const k of m.keys()) {
      if (index.has(k)) continue;
      if (cols.length >= MAX_COLUMNS) {
        truncated = true;
        m.delete(k);
        continue;
      }
      index.set(k, cols.length);
      cols.push(k);
    }
    rows.push(m);
  }
  const body: Cell[][] = rows.map((m) => cols.map((c) => (m.has(c) ? (o.typed ? typedCell(m.get(c)!) : m.get(c)!) : '')));
  return { table: { columns: cols, rows: body, hasHeader: true }, truncated };
}
