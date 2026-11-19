// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { JsonPath, JsonType, PathKey, isContainer, toJsonPointer, typeOf } from './json-path';

/** Figli mostrati alla volta in ogni nodo (poi "mostra altri"). */
export const PAGE_SIZE = 100;
/** Tetto ai nodi aperti da "Espandi tutto" / "fino al livello N", per non riempire la memoria su JSON enormi. */
export const EXPAND_BUDGET = 3000;

export interface NodeRow {
  kind: 'node';
  /** JSON Pointer del nodo: identifica la riga ed è la chiave dello stato aperto/chiuso. */
  id: string;
  path: JsonPath;
  /** Chiave o indice nel genitore (null per la radice). */
  key: PathKey | null;
  depth: number;
  type: JsonType;
  value: unknown;
  /** Numero di figli (0 per i valori semplici). */
  count: number;
  expanded: boolean;
  /** Posizione tra i fratelli (0-based) e numero di fratelli: per aria-posinset/setsize. */
  index: number;
  size: number;
  parentType: 'object' | 'array' | null;
}

export interface MoreRow {
  kind: 'more';
  id: string;
  /** Id del nodo genitore, di cui si vogliono vedere altri figli. */
  parentId: string;
  depth: number;
  /** Figli ancora nascosti. */
  remaining: number;
}

export type TreeRow = NodeRow | MoreRow;

export const MORE_SUFFIX = '\u0000more';

export function childCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (isContainer(value)) return Object.keys(value).length;
  return 0;
}

/** Figli (chiave, valore) dei primi `limit` elementi, senza copiare tutto l'array. */
export function childrenSlice(value: unknown, limit: number): [PathKey, unknown][] {
  if (Array.isArray(value)) {
    const n = Math.min(limit, value.length);
    const out: [PathKey, unknown][] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = [i, value[i]];
    return out;
  }
  if (isContainer(value)) {
    const out: [PathKey, unknown][] = [];
    for (const k in value) {
      if (!Object.hasOwn(value, k)) continue;
      out.push([k, (value as Record<string, unknown>)[k]]);
      if (out.length >= limit) break;
    }
    return out;
  }
  return [];
}

type Work =
  | { kind: 'node'; value: unknown; key: PathKey | null; path: JsonPath; depth: number; index: number; size: number; parentType: 'object' | 'array' | null }
  | { kind: 'more'; parentId: string; depth: number; remaining: number };

/**
 * Appiattisce in righe SOLO la parte visibile dell'albero: i figli di un nodo compaiono se il nodo è
 * aperto, e solo i primi `shown` (PAGE_SIZE se non indicato). Visita iterativa: niente ricorsione.
 */
export function flattenTree(
  root: unknown,
  expanded: ReadonlySet<string>,
  shown: ReadonlyMap<string, number>,
  pageSize = PAGE_SIZE,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const stack: Work[] = [{ kind: 'node', value: root, key: null, path: [], depth: 0, index: 0, size: 1, parentType: null }];
  while (stack.length > 0) {
    const w = stack.pop()!;
    if (w.kind === 'more') {
      rows.push({ kind: 'more', id: w.parentId + MORE_SUFFIX, parentId: w.parentId, depth: w.depth, remaining: w.remaining });
      continue;
    }
    const id = toJsonPointer(w.path);
    const count = childCount(w.value);
    const isOpen = count > 0 && expanded.has(id);
    rows.push({
      kind: 'node',
      id,
      path: w.path,
      key: w.key,
      depth: w.depth,
      type: typeOf(w.value),
      value: w.value,
      count,
      expanded: isOpen,
      index: w.index,
      size: w.size,
      parentType: w.parentType,
    });
    if (!isOpen) continue;
    const limit = Math.max(shown.get(id) ?? pageSize, pageSize);
    const kids = childrenSlice(w.value, limit);
    const type = Array.isArray(w.value) ? 'array' : 'object';
    if (count > kids.length) stack.push({ kind: 'more', parentId: id, depth: w.depth + 1, remaining: count - kids.length });
    for (let i = kids.length - 1; i >= 0; i--) {
      const [k, v] = kids[i];
      stack.push({ kind: 'node', value: v, key: k, path: [...w.path, k], depth: w.depth + 1, index: i, size: count, parentType: type });
    }
  }
  return rows;
}

/**
 * Nodi da aprire perché i contenitori fino al livello `levels` siano visibili (1 = solo la radice).
 * `truncated` è vero se si è raggiunto il tetto di nodi.
 */
export function expandToLevel(root: unknown, levels: number, budget = EXPAND_BUDGET): { ids: Set<string>; truncated: boolean } {
  const ids = new Set<string>();
  let truncated = false;
  const queue: { value: unknown; path: JsonPath; depth: number }[] = [{ value: root, path: [], depth: 0 }];
  // visita in ampiezza: il tetto taglia i livelli più profondi, non i più alti
  for (let h = 0; h < queue.length; h++) {
    const { value, path, depth } = queue[h];
    if (depth >= levels || !isContainer(value) || childCount(value) === 0) continue;
    if (ids.size >= budget) {
      truncated = true;
      break;
    }
    ids.add(toJsonPointer(path));
    // oltre PAGE_SIZE figli non si scende: non sarebbero visibili senza "mostra altri"
    for (const [k, v] of childrenSlice(value, PAGE_SIZE)) queue.push({ value: v, path: [...path, k], depth: depth + 1 });
  }
  return { ids, truncated };
}

export interface Reveal {
  expanded: Set<string>;
  shown: Map<string, number>;
}

/** Posizione di una chiave tra i figli (indice per gli array; ordine di inserimento per gli oggetti). */
function positionOf(container: unknown, key: PathKey): number {
  if (Array.isArray(container)) return Number(key);
  let i = 0;
  for (const k in container as object) {
    if (!Object.hasOwn(container as object, k)) continue;
    if (k === String(key)) return i;
    i++;
  }
  return -1;
}

/** Apre tutti gli antenati del percorso e allarga la paginazione quanto basta perché il nodo sia nella lista. */
export function revealPath(
  root: unknown,
  path: JsonPath,
  expanded: ReadonlySet<string>,
  shown: ReadonlyMap<string, number>,
  pageSize = PAGE_SIZE,
): Reveal {
  const ex = new Set(expanded);
  const sh = new Map(shown);
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const id = toJsonPointer(path.slice(0, i));
    ex.add(id);
    const pos = positionOf(cur, path[i]);
    const needed = Math.ceil((pos + 1) / pageSize) * pageSize;
    if (needed > (sh.get(id) ?? pageSize)) sh.set(id, needed);
    cur = Array.isArray(cur) ? cur[Number(path[i])] : (cur as Record<string, unknown>)[String(path[i])];
  }
  return { expanded: ex, shown: sh };
}

/** Dopo il cambio di una chiave, sposta lo stato "aperto" dei nodi sotto `from` verso `to`. */
export function remapExpanded(expanded: ReadonlySet<string>, from: string, to: string): Set<string> {
  const out = new Set<string>();
  for (const id of expanded) {
    if (id === from) out.add(to);
    else if (id.startsWith(from + '/')) out.add(to + id.slice(from.length));
    else out.add(id);
  }
  return out;
}
