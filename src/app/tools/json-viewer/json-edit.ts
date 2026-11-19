// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { JsonPath, JsonType, childOf, getAt, isContainer, typeOf } from './json-path';

/**
 * Operazioni di modifica immutabili: non toccano mai il documento di partenza, copiano solo i nodi
 * lungo il percorso (il resto è condiviso), quindi annulla/ripeti costano poco anche su JSON grandi.
 * Gli oggetti si ricostruiscono da coppie (Object.fromEntries): sicuro anche con una chiave "__proto__".
 */

export type EditError = 'notfound' | 'duplicate' | 'invalid' | 'root' | 'type';
export type EditResult = { ok: true; root: unknown; path: JsonPath } | { ok: false; error: EditError };

const fail = (error: EditError): EditResult => ({ ok: false, error });
const ok = (root: unknown, path: JsonPath): EditResult => ({ ok: true, root, path });

type Obj = Record<string, unknown>;
const entriesOf = (o: object): [string, unknown][] => Object.entries(o);
const fromEntries = (e: [string, unknown][]): Obj => Object.fromEntries(e);

/** Sostituisce il valore al percorso, copiando i soli nodi lungo il cammino. */
export function setAt(root: unknown, path: JsonPath, value: unknown): { ok: true; root: unknown } | { ok: false } {
  if (path.length === 0) return { ok: true, root: value };
  const [head, ...rest] = path;
  const c = childOf(root, head);
  if (!c.found) return { ok: false };
  const inner = setAt(c.value, rest, value);
  if (!inner.ok) return inner;
  if (inner.root === c.value) return { ok: true, root };
  if (Array.isArray(root)) {
    const copy = root.slice();
    copy[Number(head)] = inner.root;
    return { ok: true, root: copy };
  }
  return { ok: true, root: fromEntries(entriesOf(root as object).map(([k, v]) => (k === String(head) ? [k, inner.root] : [k, v]))) };
}

export function setValue(root: unknown, path: JsonPath, value: unknown): EditResult {
  const r = setAt(root, path, value);
  return r.ok ? ok(r.root, path) : fail('notfound');
}

/** Rinomina una chiave mantenendo la posizione. Rifiuta i duplicati nello stesso oggetto. */
export function renameKey(root: unknown, path: JsonPath, newKey: string): EditResult {
  if (path.length === 0) return fail('root');
  const parent = path.slice(0, -1);
  const oldKey = String(path[path.length - 1]);
  const p = getAt(root, parent);
  if (!p.found || !isContainer(p.value) || Array.isArray(p.value)) return fail('invalid');
  if (!Object.hasOwn(p.value, oldKey)) return fail('notfound');
  if (newKey === oldKey) return ok(root, path);
  if (Object.hasOwn(p.value, newKey)) return fail('duplicate');
  const renamed = fromEntries(entriesOf(p.value).map(([k, v]) => (k === oldKey ? [newKey, v] : [k, v])));
  const r = setAt(root, parent, renamed);
  return r.ok ? ok(r.root, [...parent, newKey]) : fail('notfound');
}

/** Chiave libera nell'oggetto: `base`, poi `base2`, `base3`… */
export function uniqueKey(obj: object, base: string): string {
  if (!Object.hasOwn(obj, base)) return base;
  for (let i = 2; ; i++) {
    const k = `${base}${i}`;
    if (!Object.hasOwn(obj, k)) return k;
  }
}

/** Aggiunge un figlio a un oggetto (chiave nuova) o a un array (in coda, o in `at`). */
export function addChild(
  root: unknown,
  containerPath: JsonPath,
  value: unknown = null,
  keyBase = 'chiave',
): EditResult {
  const c = getAt(root, containerPath);
  if (!c.found || !isContainer(c.value)) return fail('type');
  if (Array.isArray(c.value)) {
    const r = setAt(root, containerPath, [...c.value, value]);
    return r.ok ? ok(r.root, [...containerPath, c.value.length]) : fail('notfound');
  }
  const key = uniqueKey(c.value, keyBase);
  const r = setAt(root, containerPath, fromEntries([...entriesOf(c.value), [key, value]]));
  return r.ok ? ok(r.root, [...containerPath, key]) : fail('notfound');
}

/** Elimina un nodo. Restituisce il percorso del nodo da selezionare dopo (successivo, o precedente, o genitore). */
export function removeAt(root: unknown, path: JsonPath): EditResult {
  if (path.length === 0) return fail('root');
  const parent = path.slice(0, -1);
  const key = path[path.length - 1];
  const p = getAt(root, parent);
  if (!p.found || !isContainer(p.value)) return fail('notfound');
  if (Array.isArray(p.value)) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= p.value.length) return fail('notfound');
    const next = [...p.value.slice(0, i), ...p.value.slice(i + 1)];
    const r = setAt(root, parent, next);
    if (!r.ok) return fail('notfound');
    return ok(r.root, next.length === 0 ? parent : [...parent, Math.min(i, next.length - 1)]);
  }
  const entries = entriesOf(p.value);
  const idx = entries.findIndex(([k]) => k === String(key));
  if (idx === -1) return fail('notfound');
  const next = entries.filter((_, j) => j !== idx);
  const r = setAt(root, parent, fromEntries(next));
  if (!r.ok) return fail('notfound');
  return ok(r.root, next.length === 0 ? parent : [...parent, next[Math.min(idx, next.length - 1)][0]]);
}

/** Duplica un nodo subito dopo l'originale (array) o con una chiave libera `chiave_copia` (oggetto). */
export function duplicateAt(root: unknown, path: JsonPath): EditResult {
  if (path.length === 0) return fail('root');
  const parent = path.slice(0, -1);
  const key = path[path.length - 1];
  const p = getAt(root, parent);
  const me = getAt(root, path);
  if (!p.found || !me.found || !isContainer(p.value)) return fail('notfound');
  // i valori sono immutabili: la copia può condividere il sotto-albero
  if (Array.isArray(p.value)) {
    const i = Number(key);
    const next = [...p.value.slice(0, i + 1), me.value, ...p.value.slice(i + 1)];
    const r = setAt(root, parent, next);
    return r.ok ? ok(r.root, [...parent, i + 1]) : fail('notfound');
  }
  const entries = entriesOf(p.value);
  const idx = entries.findIndex(([k]) => k === String(key));
  const newKey = uniqueKey(p.value, `${String(key)}_copia`);
  const next = [...entries.slice(0, idx + 1), [newKey, me.value] as [string, unknown], ...entries.slice(idx + 1)];
  const r = setAt(root, parent, fromEntries(next));
  return r.ok ? ok(r.root, [...parent, newKey]) : fail('notfound');
}

/** Sposta un elemento di un array di `delta` posizioni (negativo = su). */
export function moveAt(root: unknown, path: JsonPath, delta: number): EditResult {
  if (path.length === 0) return fail('root');
  const parent = path.slice(0, -1);
  const p = getAt(root, parent);
  if (!p.found || !Array.isArray(p.value)) return fail('type');
  const i = Number(path[path.length - 1]);
  const j = i + delta;
  if (!Number.isInteger(i) || i < 0 || i >= p.value.length || j < 0 || j >= p.value.length) return fail('invalid');
  const next = p.value.slice();
  [next[i], next[j]] = [next[j], next[i]];
  const r = setAt(root, parent, next);
  return r.ok ? ok(r.root, [...parent, j]) : fail('notfound');
}

/** Converte un valore in un altro tipo, conservando il più possibile (testo ↔ numero, oggetto ↔ array). */
export function convertValue(value: unknown, to: JsonType): unknown {
  const from = typeOf(value);
  if (from === to) return value;
  switch (to) {
    case 'string':
      if (from === 'number' || from === 'boolean') return String(value);
      if (from === 'null') return '';
      return JSON.stringify(value);
    case 'number': {
      if (from === 'string') {
        const n = Number((value as string).trim());
        return (value as string).trim() !== '' && Number.isFinite(n) ? n : 0;
      }
      return from === 'boolean' ? (value ? 1 : 0) : 0;
    }
    case 'boolean':
      if (from === 'string') return /^(true|1|si|sì|yes)$/i.test((value as string).trim());
      if (from === 'number') return value !== 0;
      return false;
    case 'null':
      return null;
    case 'array':
      if (from === 'object') return Object.values(value as object);
      return [];
    case 'object':
      if (from === 'array') return fromEntries((value as unknown[]).map((v, i) => [String(i), v]));
      return {};
  }
}

export function changeType(root: unknown, path: JsonPath, to: JsonType): EditResult {
  const me = getAt(root, path);
  if (!me.found) return fail('notfound');
  const r = setAt(root, path, convertValue(me.value, to));
  return r.ok ? ok(r.root, path) : fail('notfound');
}

export type ParsedValue = { ok: true; value: string | number | boolean | null } | { ok: false; error: 'number' | 'boolean' | 'empty' };

const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** Interpreta il testo digitato in linea secondo il tipo del valore (le stringhe restano com'è). */
export function parseEditedValue(type: JsonType, text: string): ParsedValue {
  switch (type) {
    case 'string':
      return { ok: true, value: text };
    case 'number': {
      const t = text.trim();
      if (t === '') return { ok: false, error: 'empty' };
      if (!NUMBER_RE.test(t) || !Number.isFinite(Number(t))) return { ok: false, error: 'number' };
      return { ok: true, value: Number(t) };
    }
    case 'boolean': {
      const t = text.trim().toLowerCase();
      if (t === 'true') return { ok: true, value: true };
      if (t === 'false') return { ok: true, value: false };
      return { ok: false, error: 'boolean' };
    }
    default:
      return { ok: true, value: null };
  }
}

/** Testo da mostrare nel campo di modifica per un valore semplice. */
export function editableText(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}
