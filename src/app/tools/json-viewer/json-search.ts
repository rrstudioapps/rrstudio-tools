// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { JsonPath, PathKey, isContainer, toJsonPointer } from './json-path';

export interface SearchMatch {
  path: JsonPath;
  /** JSON Pointer del nodo. */
  id: string;
  /** Dove compare il testo: nel nome della chiave o nel valore. */
  field: 'key' | 'value';
}

export interface SearchResult {
  matches: SearchMatch[];
  /** Vero se la ricerca si è fermata al tetto di risultati. */
  truncated: boolean;
}

export const MAX_MATCHES = 5000;

const norm = (s: string) => s.toLowerCase();

/**
 * Cerca `query` (senza distinguere maiuscole) nelle chiavi degli oggetti e nei valori semplici
 * (stringhe, numeri, booleani, null), in ordine di documento. Visita iterativa.
 */
export function searchTree(root: unknown, query: string, max = MAX_MATCHES): SearchResult {
  const q = norm(query);
  const matches: SearchMatch[] = [];
  if (q === '') return { matches, truncated: false };
  type Item = { value: unknown; path: JsonPath; key: PathKey | null; inObject: boolean };
  const stack: Item[] = [{ value: root, path: [], key: null, inObject: false }];
  while (stack.length > 0) {
    const { value, path, key, inObject } = stack.pop()!;
    if (inObject && key !== null && norm(String(key)).includes(q)) {
      matches.push({ path, id: toJsonPointer(path), field: 'key' });
      if (matches.length >= max) return { matches, truncated: true };
    }
    if (isContainer(value)) {
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) stack.push({ value: value[i], path: [...path, i], key: i, inObject: false });
      } else {
        const keys = Object.keys(value);
        for (let i = keys.length - 1; i >= 0; i--) {
          const k = keys[i];
          stack.push({ value: (value as Record<string, unknown>)[k], path: [...path, k], key: k, inObject: true });
        }
      }
    } else if (norm(String(value)).includes(q)) {
      matches.push({ path, id: toJsonPointer(path), field: 'value' });
      if (matches.length >= max) return { matches, truncated: true };
    }
  }
  return { matches, truncated: false };
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Spezza un testo in parti, marcando le occorrenze di `query` (per evidenziarle con <mark>). */
export function highlightParts(text: string, query: string): TextPart[] {
  const q = norm(query);
  if (q === '') return [{ text, match: false }];
  const lower = norm(text);
  // toLowerCase può cambiare la lunghezza (es. "İ"): in quel caso non si evidenzia, meglio che sbagliare
  if (lower.length !== text.length) return [{ text, match: false }];
  const parts: TextPart[] = [];
  let from = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, from)) {
    if (i > from) parts.push({ text: text.slice(from, i), match: false });
    parts.push({ text: text.slice(i, i + q.length), match: true });
    from = i + q.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

/** Indice del risultato successivo/precedente, in modo circolare (-1 se non ce ne sono). */
export function stepMatch(current: number, count: number, direction: 1 | -1): number {
  if (count === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}
