// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { XmlNode, normalizeNewlines, parseXml, XmlError } from '../xml-formatter/xml';
import { El, unescapeXml } from '../xml-viewer/xml-tree';

/**
 * Confronto strutturale di due XML: elementi, attributi e testo. Gli attributi si confrontano per nome (l'ordine non conta),
 * gli elementi figli si allineano con una sottosequenza comune (prima per nome + id, poi per solo nome); commenti,
 * istruzioni e DOCTYPE non si confrontano. Il testo si confronta decodificato, con gli spazi ridotti se richiesto.
 */

export type ChangeKind = 'added' | 'removed' | 'text' | 'attr-added' | 'attr-removed' | 'attr-changed' | 'renamed';

export interface Change {
  kind: ChangeKind;
  /** Percorso: nel secondo documento per aggiunte e modifiche, nel primo per le rimozioni. */
  xpath: string;
  /** Nome dell'attributo (per i tipi attr-*). */
  name?: string;
  before?: string;
  after?: string;
}

export interface DiffOptions {
  /** Toglie gli spazi ai bordi e riduce quelli interni a uno (default sì). */
  ignoreWhitespace: boolean;
}

export type DiffResult =
  | { ok: true; changes: Change[]; truncated: boolean }
  | { ok: false; side: 'a' | 'b'; error: XmlError };

export const MAX_CHANGES = 2000;
/** Oltre questo prodotto di lunghezze l'allineamento diventa posizionale (evita tempi e memoria enormi). */
const LCS_CELLS = 4_000_000;

const elementsOf = (el: El | { children: XmlNode[] }): El[] => el.children.filter((c): c is El => c.t === 'el');

function textOf(el: El, ws: boolean): string {
  const raw = el.children.map((c) => (c.t === 'text' ? unescapeXml(c.value) : c.t === 'cdata' ? c.raw.slice(9, -3) : '')).join('');
  return ws ? raw.replace(/\s+/g, ' ').trim() : raw;
}

const attrMap = (el: El): Map<string, string> => new Map(el.attrs.map((a) => [a.name, unescapeXml(a.value)]));
const keyOf = (el: El): string => {
  const a = el.attrs.find((x) => x.name === 'id') ?? el.attrs.find((x) => x.name === 'name');
  return el.name + (a ? `#${a.name}=${a.value}` : '');
};

/** Coppie di indici (i, j) di una sottosequenza comune più lunga. */
function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  if (n * m > LCS_CELLS) {
    const out: [number, number][] = [];
    for (let i = 0; i < Math.min(n, m); i++) if (eq(a[i], b[i])) out.push([i, i]);
    return out;
  }
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i * w + j] = eq(a[i], b[j]) ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (eq(a[i], b[j])) {
      out.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return out;
}

/** Allinea due liste di elementi: prima per nome e id, poi, nei vuoti tra le ancore, per solo nome. */
function align(a: El[], b: El[]): { pairs: [number, number][]; removed: number[]; added: number[] } {
  const strong = lcs(a, b, (x, y) => keyOf(x) === keyOf(y));
  const pairs: [number, number][] = [];
  const removed: number[] = [];
  const added: number[] = [];
  let pi = 0;
  let pj = 0;
  const gap = (ei: number, ej: number): void => {
    const ga = a.slice(pi, ei);
    const gb = b.slice(pj, ej);
    const weak = lcs(ga, gb, (x, y) => x.name === y.name);
    let ai = 0;
    let bi = 0;
    for (const [i, j] of [...weak, [ga.length, gb.length] as [number, number]]) {
      for (; ai < i; ai++) removed.push(pi + ai);
      for (; bi < j; bi++) added.push(pj + bi);
      if (i < ga.length) pairs.push([pi + i, pj + j]);
      ai = i + 1;
      bi = j + 1;
    }
  };
  for (const [i, j] of strong) {
    gap(i, j);
    pairs.push([i, j]);
    pi = i + 1;
    pj = j + 1;
  }
  gap(a.length, b.length);
  pairs.sort((x, y) => x[0] - y[0]);
  return { pairs, removed, added };
}

function stepName(list: El[], el: El): string {
  const same = list.filter((x) => x.name === el.name);
  return same.length > 1 ? `${el.name}[${same.indexOf(el) + 1}]` : el.name;
}

export function diffNodes(a: XmlNode[], b: XmlNode[], opt: DiffOptions): { changes: Change[]; truncated: boolean } {
  const changes: Change[] = [];
  let truncated = false;
  const push = (c: Change): void => {
    if (changes.length >= MAX_CHANGES) truncated = true;
    else changes.push(c);
  };

  const compare = (x: El, y: El, path: string): void => {
    if (x.name !== y.name) push({ kind: 'renamed', xpath: path, before: x.name, after: y.name });
    const ax = attrMap(x);
    const ay = attrMap(y);
    for (const [k, v] of ax) {
      if (!ay.has(k)) push({ kind: 'attr-removed', xpath: path, name: k, before: v });
      else if (ay.get(k) !== v) push({ kind: 'attr-changed', xpath: path, name: k, before: v, after: ay.get(k) });
    }
    for (const [k, v] of ay) if (!ax.has(k)) push({ kind: 'attr-added', xpath: path, name: k, after: v });
    const ex = elementsOf(x);
    const ey = elementsOf(y);
    const tx = textOf(x, opt.ignoreWhitespace);
    const ty = textOf(y, opt.ignoreWhitespace);
    if (tx !== ty) push({ kind: 'text', xpath: path, before: tx, after: ty });
    const { pairs, removed, added } = align(ex, ey);
    for (const i of removed) push({ kind: 'removed', xpath: `${path}/${stepName(ex, ex[i])}` });
    for (const [i, j] of pairs) compare(ex[i], ey[j], `${path}/${stepName(ey, ey[j])}`);
    for (const j of added) push({ kind: 'added', xpath: `${path}/${stepName(ey, ey[j])}` });
  };

  const ra = elementsOf({ children: a })[0];
  const rb = elementsOf({ children: b })[0];
  if (ra && rb) compare(ra, rb, '/' + rb.name);
  return { changes, truncated };
}

export function diffXml(a: string, b: string, opt: DiffOptions): DiffResult {
  const pa = parseXml(normalizeNewlines(a));
  if (!pa.ok) return { ok: false, side: 'a', error: pa.error };
  const pb = parseXml(normalizeNewlines(b));
  if (!pb.ok) return { ok: false, side: 'b', error: pb.error };
  return { ok: true, ...diffNodes(pa.nodes, pb.nodes, opt) };
}

/** Quanti cambiamenti per tipo (per il riepilogo). */
export function summarize(changes: readonly Change[]): { added: number; removed: number; changed: number } {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const c of changes) {
    if (c.kind === 'added' || c.kind === 'attr-added') added++;
    else if (c.kind === 'removed' || c.kind === 'attr-removed') removed++;
    else changed++;
  }
  return { added, removed, changed };
}
