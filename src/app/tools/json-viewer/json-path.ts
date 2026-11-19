// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Un passo del percorso: chiave di un oggetto (stringa) o indice di un array (numero). */
export type PathKey = string | number;
export type JsonPath = readonly PathKey[];

export type JsonType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

export function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'object';
  }
}

export const isContainer = (value: unknown): value is object => value !== null && typeof value === 'object';

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Percorso in stile JavaScript: `$.utenti[0].nome`, con `["chiave strana"]` quando serve. */
export function toJsPath(path: JsonPath): string {
  let out = '$';
  for (const k of path) {
    if (typeof k === 'number') out += `[${k}]`;
    else if (IDENT.test(k)) out += `.${k}`;
    else out += `[${JSON.stringify(k)}]`;
  }
  return out;
}

/** JSON Pointer (RFC 6901): `/utenti/0/nome`; la radice è la stringa vuota. */
export function toJsonPointer(path: JsonPath): string {
  let out = '';
  for (const k of path) out += '/' + String(k).replaceAll('~', '~0').replaceAll('/', '~1');
  return out;
}

/** Legge un figlio senza passare dal prototipo (una chiave "toString" non esiste se non è nel JSON). */
export function childOf(container: unknown, key: PathKey): { found: boolean; value: unknown } {
  if (Array.isArray(container)) {
    const i = typeof key === 'number' ? key : Number(key);
    return Number.isInteger(i) && i >= 0 && i < container.length
      ? { found: true, value: container[i] }
      : { found: false, value: undefined };
  }
  if (container !== null && typeof container === 'object' && Object.hasOwn(container, String(key))) {
    return { found: true, value: (container as Record<string, unknown>)[String(key)] };
  }
  return { found: false, value: undefined };
}

export function getAt(root: unknown, path: JsonPath): { found: boolean; value: unknown } {
  let cur = root;
  for (const k of path) {
    const c = childOf(cur, k);
    if (!c.found) return { found: false, value: undefined };
    cur = c.value;
  }
  return { found: true, value: cur };
}

/** Il più lungo prefisso del percorso che esiste ancora nel documento (dopo una modifica o un annulla). */
export function nearestValidPath(root: unknown, path: JsonPath): JsonPath {
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const c = childOf(cur, path[i]);
    if (!c.found) return path.slice(0, i);
    cur = c.value;
  }
  return path;
}

/** Percorso del genitore (la radice non ne ha: restituisce la radice). */
export const parentPath = (path: JsonPath): JsonPath => path.slice(0, -1);

export function isPrefix(prefix: JsonPath, path: JsonPath): boolean {
  return prefix.length <= path.length && prefix.every((k, i) => String(k) === String(path[i]));
}

/** Segmenti per la breadcrumb: etichetta e percorso fino a quel punto. */
export function breadcrumbs(path: JsonPath): { label: string; path: JsonPath }[] {
  const out = [{ label: '$', path: [] as JsonPath }];
  path.forEach((k, i) => out.push({ label: typeof k === 'number' ? `[${k}]` : k, path: path.slice(0, i + 1) }));
  return out;
}
