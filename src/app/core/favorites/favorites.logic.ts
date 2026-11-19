// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Logica pura dei preferiti e dei menu personalizzati (nessun accesso a storage, DOM o Angular):
 * modello, validazione, migrazione, operazioni, unione, esportazione e link di condivisione.
 * Gli id degli strumenti validi li passa il chiamante (`known`), così la logica si prova senza registry.
 */

export const STORAGE_KEY = 'rrtools.favorites';
export const CURRENT_VERSION = 1;
export const MAX_GROUPS = 20;
export const MAX_NAME = 40;
/** Quanti strumenti al massimo in un gruppo (quanti ne offre oggi il sito). */
export const MAX_GROUP_TOOLS = 58;
/** Limiti di dimensione dei dati da importare (file e link). */
export const MAX_IMPORT_CHARS = 200_000;
export const MAX_HASH_CHARS = 20_000;

export interface FavGroup {
  id: string;
  name: string;
  tools: string[];
}

export interface FavState {
  v: 1;
  favorites: string[];
  groups: FavGroup[];
}

export type Known = ReadonlySet<string>;

export const emptyState = (): FavState => ({ v: CURRENT_VERSION, favorites: [], groups: [] });

export const isEmpty = (s: FavState): boolean => s.favorites.length === 0 && s.groups.length === 0;

/** Esito della validazione: lo stato pulito e quante cose sono state scartate. */
export interface Sanitized {
  state: FavState;
  /** Id di strumenti sconosciuti scartati. */
  unknown: number;
  /** Gruppi, strumenti o nomi tagliati per rispettare i limiti. */
  trimmed: number;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Nome ripulito: spazi normalizzati, senza caratteri di controllo, al massimo MAX_NAME caratteri. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, MAX_NAME).join('').trim();
}

/** Id di un nuovo gruppo, diverso da quelli già presenti. */
export function newGroupId(taken: Iterable<string>, rand: () => number = Math.random): string {
  const used = new Set(taken);
  for (;;) {
    const id = 'g' + Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');
    if (!used.has(id)) return id;
  }
}

/** Elenco di id validi: solo stringhe note, senza duplicati, ordine conservato. */
function cleanIds(raw: unknown, known: Known, max: number, counters: { unknown: number; trimmed: number }): string[] {
  const out: string[] = [];
  if (!Array.isArray(raw)) return out;
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string') {
      counters.unknown++;
      continue;
    }
    if (!known.has(x)) {
      counters.unknown++;
      continue;
    }
    if (seen.has(x)) continue;
    if (out.length >= max) {
      counters.trimmed++;
      continue;
    }
    seen.add(x);
    out.push(x);
  }
  return out;
}

/**
 * Porta uno stato letto da storage, file o link alla versione corrente.
 * Accetta: il formato v1, quello compatto dei link (`{v,f,g}`), una versione futura (si leggono i campi noti)
 * e il formato "v0" (un semplice elenco di id, o `{favorites}` senza versione). Restituisce null se non è riconoscibile.
 */
export function migrate(raw: unknown): { favorites: unknown; groups: unknown } | null {
  if (Array.isArray(raw)) return { favorites: raw, groups: [] }; // v0: solo l'elenco degli id
  if (!isObj(raw)) return null;
  const v = raw['v'];
  if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < 0)) return null;
  const favorites = raw['favorites'] ?? raw['f'];
  const groupsRaw = raw['groups'] ?? raw['g'];
  if (favorites === undefined && groupsRaw === undefined) return null;
  // formato compatto dei link: gruppi come [nome, [id…]]
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.map((g) => (Array.isArray(g) ? { name: g[0], tools: g[1] } : g))
    : groupsRaw;
  return { favorites: favorites ?? [], groups: groups ?? [] };
}

/** Valida e ripulisce qualunque cosa: id sconosciuti scartati, limiti applicati, id dei gruppi unici. */
export function sanitize(raw: unknown, known: Known): Sanitized | null {
  const m = migrate(raw);
  if (!m) return null;
  const counters = { unknown: 0, trimmed: 0 };
  const favorites = cleanIds(m.favorites, known, known.size, counters);
  const groups: FavGroup[] = [];
  const ids = new Set<string>();
  if (Array.isArray(m.groups)) {
    for (const g of m.groups) {
      if (!isObj(g)) {
        counters.trimmed++;
        continue;
      }
      if (groups.length >= MAX_GROUPS) {
        counters.trimmed++;
        continue;
      }
      const rawName = typeof g['name'] === 'string' ? g['name'] : '';
      const name = cleanName(rawName);
      if (!name) {
        counters.trimmed++;
        continue;
      }
      if (Array.from(rawName.trim()).length > MAX_NAME) counters.trimmed++;
      const rawId = typeof g['id'] === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(g['id']) ? g['id'] : '';
      const id = rawId && !ids.has(rawId) ? rawId : newGroupId(ids);
      ids.add(id);
      groups.push({ id, name, tools: cleanIds(g['tools'], known, MAX_GROUP_TOOLS, counters) });
    }
  }
  return { state: { v: CURRENT_VERSION, favorites, groups }, unknown: counters.unknown, trimmed: counters.trimmed };
}

/** Legge il JSON salvato: in caso di dati illeggibili o non riconoscibili riparte da uno stato vuoto. */
export function parseStored(text: string | null, known: Known): FavState {
  if (!text) return emptyState();
  try {
    return sanitize(JSON.parse(text), known)?.state ?? emptyState();
  } catch {
    return emptyState();
  }
}

export const serialize = (s: FavState): string => JSON.stringify(s);

// ---------- operazioni (restituiscono sempre un nuovo stato) ----------

/** Sposta un elemento da una posizione a un'altra (fuori intervallo = nessun cambiamento). */
export function moveInList<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

export const isFavorite = (s: FavState, id: string): boolean => s.favorites.includes(id);

export function toggleFavorite(s: FavState, id: string, known: Known): FavState {
  if (!known.has(id)) return s;
  const favorites = isFavorite(s, id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id];
  return { ...s, favorites };
}

export function removeFavorite(s: FavState, id: string): FavState {
  return { ...s, favorites: s.favorites.filter((x) => x !== id) };
}

export function addFavorite(s: FavState, id: string, known: Known): FavState {
  return known.has(id) && !isFavorite(s, id) ? { ...s, favorites: [...s.favorites, id] } : s;
}

export function moveFavorite(s: FavState, from: number, to: number): FavState {
  return { ...s, favorites: moveInList(s.favorites, from, to) };
}

/** Crea un gruppo. Restituisce null se il nome è vuoto o si è al limite dei gruppi. */
export function addGroup(s: FavState, name: string, id = newGroupId(s.groups.map((g) => g.id))): FavState | null {
  const n = cleanName(name);
  if (!n || s.groups.length >= MAX_GROUPS) return null;
  return { ...s, groups: [...s.groups, { id, name: n, tools: [] }] };
}

export function renameGroup(s: FavState, id: string, name: string): FavState {
  const n = cleanName(name);
  if (!n) return s;
  return { ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, name: n } : g)) };
}

export const deleteGroup = (s: FavState, id: string): FavState => ({ ...s, groups: s.groups.filter((g) => g.id !== id) });

export function moveGroup(s: FavState, from: number, to: number): FavState {
  return { ...s, groups: moveInList(s.groups, from, to) };
}

function mapGroup(s: FavState, id: string, fn: (g: FavGroup) => FavGroup): FavState {
  return { ...s, groups: s.groups.map((g) => (g.id === id ? fn(g) : g)) };
}

export function addToGroup(s: FavState, groupId: string, toolId: string, known: Known): FavState {
  if (!known.has(toolId)) return s;
  return mapGroup(s, groupId, (g) =>
    g.tools.includes(toolId) || g.tools.length >= MAX_GROUP_TOOLS ? g : { ...g, tools: [...g.tools, toolId] },
  );
}

export const removeFromGroup = (s: FavState, groupId: string, toolId: string): FavState =>
  mapGroup(s, groupId, (g) => ({ ...g, tools: g.tools.filter((x) => x !== toolId) }));

export const moveInGroup = (s: FavState, groupId: string, from: number, to: number): FavState =>
  mapGroup(s, groupId, (g) => ({ ...g, tools: moveInList(g.tools, from, to) }));

// ---------- unione ----------

/**
 * Unisce `incoming` a `base`: i preferiti nuovi si accodano; un gruppo con lo stesso nome (senza maiuscole)
 * riceve gli strumenti che non ha; gli altri gruppi si aggiungono finché c'è posto.
 */
export function mergeStates(base: FavState, incoming: FavState): FavState {
  const favorites = [...base.favorites, ...incoming.favorites.filter((x) => !base.favorites.includes(x))];
  const groups = base.groups.map((g) => ({ ...g, tools: [...g.tools] }));
  for (const g of incoming.groups) {
    const same = groups.find((x) => x.name.toLowerCase() === g.name.toLowerCase());
    if (same) {
      for (const t of g.tools) if (!same.tools.includes(t) && same.tools.length < MAX_GROUP_TOOLS) same.tools.push(t);
    } else if (groups.length < MAX_GROUPS) {
      groups.push({ id: newGroupId(groups.map((x) => x.id)), name: g.name, tools: [...g.tools] });
    }
  }
  return { v: CURRENT_VERSION, favorites, groups };
}

// ---------- esportazione e condivisione ----------

/** File JSON di esportazione (leggibile, rientrato). */
export const exportJson = (s: FavState): string => JSON.stringify(s, null, 2) + '\n';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const std = text.replaceAll('-', '+').replaceAll('_', '/');
  try {
    const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Dati del link di condivisione: JSON compatto `{v,f:[id…],g:[[nome,[id…]]…]}` in base64url (UTF-8). */
export function encodeShare(s: FavState): string {
  const compact = { v: CURRENT_VERSION, f: s.favorites, g: s.groups.map((g) => [g.name, g.tools]) };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(compact)));
}

export type ImportError = 'empty' | 'tooBig' | 'encoding' | 'json' | 'shape' | 'nothing';

export type ImportResult = ({ ok: true } & Sanitized) | { ok: false; error: ImportError };

function finish(raw: unknown, known: Known): ImportResult {
  const r = sanitize(raw, known);
  if (!r) return { ok: false, error: 'shape' };
  if (isEmpty(r.state)) return { ok: false, error: 'nothing' };
  return { ok: true, ...r };
}

/** Importa il testo di un file JSON (formato completo, compatto o elenco semplice di id). */
export function parseImport(text: string, known: Known): ImportResult {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) return { ok: false, error: 'empty' };
  if (t.length > MAX_IMPORT_CHARS) return { ok: false, error: 'tooBig' };
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch {
    return { ok: false, error: 'json' };
  }
  return finish(raw, known);
}

/** Decodifica i dati di un link di condivisione (il valore dopo `d=`). */
export function decodeShare(data: string, known: Known): ImportResult {
  const d = data.trim();
  if (!d) return { ok: false, error: 'empty' };
  if (d.length > MAX_HASH_CHARS) return { ok: false, error: 'tooBig' };
  const bytes = fromBase64Url(d);
  if (!bytes) return { ok: false, error: 'encoding' };
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, error: 'json' };
  }
  return finish(raw, known);
}

/** Estrae il valore `d` da un fragment (`#d=…`); null se non c'è. */
export function shareFromHash(hash: string): string | null {
  const m = /^#?(?:.*&)?d=([^&]*)/.exec(hash);
  return m ? m[1] : null;
}
