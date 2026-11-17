// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Inflate as InflateType } from 'fflate';
import { base64ToBytes, bytesToBase64 } from './base64';

/**
 * Link di condivisione: lo stato di uno strumento sta nell'hash dell'URL (`#s=<payload>`), mai inviato al server.
 * Payload = JSON compatto → deflate → base64url. Questo file è logica pura (niente DOM, niente Angular).
 */

/** Valori ammessi nello stato di uno strumento. */
export type ShareValue = string | number | boolean | string[];
export type ShareData = Record<string, ShareValue>;

/** Versione del formato: se cambia, i vecchi link vengono rifiutati invece di essere interpretati male. */
export const SHARE_VERSION = 1;
/** Prefisso dell'hash. */
export const SHARE_PREFIX = '#s=';
/** Lunghezza massima del link intero (oltre, alcuni browser, app di messaggistica e server lo troncano). */
export const MAX_LINK_LENGTH = 8000;
/** Limite dei dati decompressi (difesa da zip bomb). */
export const MAX_DECODED_BYTES = 256 * 1024;

/** Descrizione di un campo dello stato: tipi e valori ammessi. */
export type FieldSpec =
  | { type: 'string'; max?: number; /** Caratteri ammessi (se indicati, ogni carattere deve stare qui). */ chars?: string; /** Controllo in più sul valore (es. un fuso orario esistente). */ valid?: (value: string) => boolean }
  | { type: 'number'; min?: number; max?: number; int?: boolean }
  | { type: 'boolean' }
  | { type: 'enum'; values: readonly (string | number)[] }
  | { type: 'strings'; maxItems?: number; maxLength?: number; valid?: (value: string) => boolean };
export type Schema = Record<string, FieldSpec>;

/** Lunghezza massima predefinita di un campo testuale (caratteri). */
const DEFAULT_MAX_STRING = 100_000;

function validField(spec: FieldSpec, v: unknown): ShareValue | undefined {
  switch (spec.type) {
    case 'string':
      if (typeof v !== 'string' || v.length > (spec.max ?? DEFAULT_MAX_STRING)) return undefined;
      if (spec.chars !== undefined && [...v].some((c) => !spec.chars!.includes(c))) return undefined;
      return spec.valid && !spec.valid(v) ? undefined : v;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      if (spec.int && !Number.isInteger(v)) return undefined;
      if (spec.min !== undefined && v < spec.min) return undefined;
      if (spec.max !== undefined && v > spec.max) return undefined;
      return v;
    case 'boolean':
      return typeof v === 'boolean' ? v : undefined;
    case 'enum':
      return (typeof v === 'string' || typeof v === 'number') && spec.values.includes(v) ? v : undefined;
    case 'strings': {
      if (!Array.isArray(v) || v.length > (spec.maxItems ?? 100)) return undefined;
      const max = spec.maxLength ?? 1000;
      return v.every((x) => typeof x === 'string' && x.length <= max && (!spec.valid || spec.valid(x))) ? (v as string[]) : undefined;
    }
  }
}

/**
 * Tiene solo i campi dello schema con tipo e valore ammessi; il resto si ignora (anche `__proto__` e simili).
 * Restituisce null se non resta nessun campo valido.
 */
export function validateState(schema: Schema, raw: unknown): ShareData | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: ShareData = {};
  let n = 0;
  for (const key of Object.keys(schema)) {
    if (!Object.hasOwn(src, key)) continue;
    const v = validField(schema[key], src[key]);
    if (v === undefined) continue;
    out[key] = v;
    n++;
  }
  return n > 0 ? out : null;
}

/** fflate si carica solo quando serve (copia del link o apertura di un link): non pesa sul resto del sito. */
const loadFflate = () => import('fflate');

/** Codifica uno stato in `<payload>` (senza il prefisso `#s=`). */
export async function encodeState(toolId: string, state: ShareData): Promise<string> {
  const { deflateSync } = await loadFflate();
  const json = JSON.stringify({ v: SHARE_VERSION, t: toolId, s: state });
  return bytesToBase64(deflateSync(new TextEncoder().encode(json), { level: 9 }), true);
}

/** Decodifica un payload; null se corrotto, troncato, troppo grande, di un altro strumento o di un'altra versione. */
export async function decodeState(toolId: string, payload: string): Promise<{ state: unknown } | null> {
  try {
    // un payload più lungo di un link valido si scarta prima di decomprimere (limita anche la memoria di una zip bomb)
    if (payload.length < 4 || payload.length > MAX_LINK_LENGTH) return null;
    const packed = base64ToBytes(payload);
    const bytes = await inflateLimited(packed, MAX_DECODED_BYTES);
    if (!bytes) return null;
    const obj: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof obj !== 'object' || obj === null) return null;
    const o = obj as { v?: unknown; t?: unknown; s?: unknown };
    if (o.v !== SHARE_VERSION || o.t !== toolId) return null;
    return { state: o.s };
  } catch {
    return null;
  }
}

/** Decomprime a flusso con tetto sulla dimensione di uscita: oltre `max` byte si ferma e restituisce null. */
async function inflateLimited(data: Uint8Array, max: number): Promise<Uint8Array | null> {
  const { Inflate } = await loadFflate();
  let total = 0;
  let tooBig = false;
  const chunks: Uint8Array[] = [];
  const stream: InflateType = new Inflate((chunk) => {
    if (tooBig) return;
    total += chunk.length;
    if (total > max) {
      tooBig = true;
      return;
    }
    chunks.push(chunk);
  });
  stream.push(data, true);
  if (tooBig) return null;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export type ShareParse =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'ok'; state: ShareData };

/** Legge un hash (`location.hash`) per lo strumento dato: assente, non valido o stato valido. */
export async function parseHash(toolId: string, schema: Schema, hash: string): Promise<ShareParse> {
  if (!hash.startsWith(SHARE_PREFIX)) return { kind: 'none' };
  const dec = await decodeState(toolId, hash.slice(SHARE_PREFIX.length));
  const state = dec ? validateState(schema, dec.state) : null;
  return state ? { kind: 'ok', state } : { kind: 'invalid' };
}

export type ShareLinkResult = { ok: true; url: string } | { ok: false; reason: 'toolarge' };

/** Costruisce il link intero (indirizzo corrente senza hash + `#s=…`); `toolarge` se supera MAX_LINK_LENGTH. */
export async function buildShareUrl(base: string, toolId: string, state: ShareData): Promise<ShareLinkResult> {
  const url = base.split('#')[0] + SHARE_PREFIX + (await encodeState(toolId, state));
  return url.length > MAX_LINK_LENGTH ? { ok: false, reason: 'toolarge' } : { ok: true, url };
}
