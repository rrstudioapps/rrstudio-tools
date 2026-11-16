// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** UUID v4 e v7 (RFC 9562) e ULID: generazione, formattazione e analisi. Casualità solo da crypto.getRandomValues. */

export type IdKind = 'v4' | 'v7' | 'ulid';
export const MIN_COUNT = 1;
export const MAX_COUNT = 1000;

/** Sorgente di byte casuali: in produzione crypto.getRandomValues, nei test una finta deterministica. */
export type RandomSource = (length: number) => Uint8Array;

export const cryptoRandom: RandomSource = (length) => crypto.getRandomValues(new Uint8Array(length));

export function clampCount(n: number): number {
  if (!Number.isFinite(n)) return MIN_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.floor(n)));
}

const HEX = '0123456789abcdef';
function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += HEX[b >> 4] + HEX[b & 15];
  return s;
}
const withHyphens = (hex: string): string =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/** UUID v4: 122 bit casuali, versione 4 e variante 10xx. Restituisce la forma canonica minuscola con trattini. */
export function uuidV4(rand: RandomSource = cryptoRandom): string {
  const b = rand(16).slice();
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return withHyphens(toHex(b));
}

/** Stato del generatore monotono (v7 e ULID) tra una chiamata e l'altra. */
export interface MonotonicState {
  ms: number;
  /** v7: contatore a 12 bit (rand_a). ULID: i 10 byte casuali dell'ultimo identificativo. */
  counter: number;
  tail: Uint8Array | null;
}
export const newState = (): MonotonicState => ({ ms: -1, counter: 0, tail: null });

const MAX_MS = 2 ** 48 - 1;

/**
 * UUID v7: 48 bit di millisecondi Unix, versione 7, 12 bit di contatore (rand_a), variante 10xx e 62 bit casuali.
 * Nello stesso millisecondo (o se l'orologio torna indietro) il contatore cresce di 1, così l'ordine
 * lessicografico è quello di generazione; se il contatore finisce si avanza di un millisecondo.
 */
export function uuidV7(state: MonotonicState, nowMs: number, rand: RandomSource = cryptoRandom): string {
  let ms = Math.min(Math.max(Math.floor(nowMs), 0), MAX_MS);
  if (ms > state.ms) {
    state.ms = ms;
    // parte da un valore casuale basso: restano almeno 2048 valori nel millisecondo
    state.counter = ((rand(2).reduce((a, v) => (a << 8) | v, 0) & 0x7ff) >>> 0) % 0x800;
  } else {
    ms = state.ms;
    state.counter++;
    if (state.counter > 0xfff) {
      state.ms = ms = Math.min(ms + 1, MAX_MS);
      state.counter = 0;
    }
  }
  const b = new Uint8Array(16);
  // 48 bit di tempo: i 32 alti con la divisione, perché gli operatori bit a bit lavorano a 32 bit
  const hi = Math.floor(ms / 2 ** 16);
  b[0] = (hi >>> 24) & 0xff;
  b[1] = (hi >>> 16) & 0xff;
  b[2] = (hi >>> 8) & 0xff;
  b[3] = hi & 0xff;
  b[4] = (ms >>> 8) & 0xff;
  b[5] = ms & 0xff;
  b[6] = 0x70 | (state.counter >> 8);
  b[7] = state.counter & 0xff;
  const r = rand(8);
  b.set(r, 8);
  b[8] = (b[8] & 0x3f) | 0x80;
  return withHyphens(toHex(b));
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeUlidTime(ms: number): string {
  let t = ms;
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeUlidRandom(bytes: Uint8Array): string {
  // 80 bit = 16 caratteri da 5 bit
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  return out;
}

/**
 * ULID: 48 bit di tempo + 80 bit casuali, in Crockford Base32 maiuscolo (26 caratteri).
 * Nello stesso millisecondo la parte casuale precedente viene incrementata di 1 (monotono, come da specifica).
 */
export function ulid(state: MonotonicState, nowMs: number, rand: RandomSource = cryptoRandom): string {
  let ms = Math.min(Math.max(Math.floor(nowMs), 0), MAX_MS);
  let tail: Uint8Array;
  if (ms > state.ms || !state.tail) {
    tail = rand(10).slice();
    state.ms = ms;
  } else {
    ms = state.ms;
    tail = state.tail.slice();
    let i = 9;
    while (i >= 0 && ++tail[i] === 256) tail[i--] = 0;
    if (i < 0) {
      // 2^80 identificativi nello stesso millisecondo: avanza il tempo e ricomincia
      ms = Math.min(ms + 1, MAX_MS);
      state.ms = ms;
      tail = rand(10).slice();
    }
  }
  state.tail = tail;
  return encodeUlidTime(ms) + encodeUlidRandom(tail);
}

/** Genera `count` identificativi (forma canonica: UUID minuscolo con trattini, ULID maiuscolo). */
export function generateIds(
  kind: IdKind,
  count: number,
  state: MonotonicState = newState(),
  nowMs: number = Date.now(),
  rand: RandomSource = cryptoRandom,
): string[] {
  const n = clampCount(count);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(kind === 'v4' ? uuidV4(rand) : kind === 'v7' ? uuidV7(state, nowMs, rand) : ulid(state, nowMs, rand));
  }
  return out;
}

export interface FormatOptions {
  upper: boolean;
  hyphens: boolean;
  braces: boolean;
}

/** Applica maiuscole, trattini e graffe. Trattini e graffe valgono solo per gli UUID (un ULID non li ha). */
export function formatId(id: string, kind: IdKind, o: FormatOptions): string {
  let s = id;
  if (kind !== 'ulid') {
    if (!o.hyphens) s = s.replaceAll('-', '');
    if (o.braces) s = `{${s}}`;
  }
  return o.upper ? s.toUpperCase() : s.toLowerCase();
}

// ---------------- analisi ----------------

export type Variant = 'ncs' | 'rfc' | 'microsoft' | 'future';
export type InspectError = 'empty' | 'length' | 'chars' | 'hyphens' | 'ulid-overflow';

export type Inspection =
  | { ok: false; error: InspectError }
  | {
      ok: true;
      kind: 'uuid';
      version: number;
      variant: Variant;
      nil: boolean;
      max: boolean;
      /** Istante contenuto (solo v7), in ms Unix. */
      ms: number | null;
      canonical: string;
    }
  | { ok: true; kind: 'ulid'; ms: number; canonical: string };

const ULID_VALUES: Record<string, number> = Object.fromEntries([...CROCKFORD].map((c, i) => [c, i]));
// la specifica ammette anche I, L → 1 e O → 0 in lettura
Object.assign(ULID_VALUES, { I: 1, L: 1, O: 0 });

/** Riconosce UUID (anche con graffe, prefisso urn:uuid: o senza trattini) e ULID e ne ricava versione, variante e data. */
export function inspectId(input: string): Inspection {
  let s = input.trim();
  if (s === '') return { ok: false, error: 'empty' };
  s = s.replace(/^urn:uuid:/i, '');
  if (/^\{.*\}$/.test(s)) s = s.slice(1, -1).trim();
  const upper = s.toUpperCase();

  if (s.length === 26 && !s.includes('-')) {
    if (![...upper].every((c) => c in ULID_VALUES)) return { ok: false, error: 'chars' };
    if (ULID_VALUES[upper[0]] > 7) return { ok: false, error: 'ulid-overflow' };
    let ms = 0;
    for (const c of upper.slice(0, 10)) ms = ms * 32 + ULID_VALUES[c];
    return { ok: true, kind: 'ulid', ms, canonical: upper };
  }

  const hex = s.replaceAll('-', '');
  if (s.includes('-') && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) {
    // trattini nel posto sbagliato, o caratteri o lunghezza non validi
    if (!/^[0-9a-fA-F-]+$/.test(s)) return { ok: false, error: 'chars' };
    return { ok: false, error: hex.length === 32 ? 'hyphens' : 'length' };
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) return { ok: false, error: 'chars' };
  if (hex.length !== 32) return { ok: false, error: 'length' };

  const h = hex.toLowerCase();
  const version = parseInt(h[12], 16);
  const v = parseInt(h[16], 16);
  const variant: Variant = v < 8 ? 'ncs' : v < 12 ? 'rfc' : v < 14 ? 'microsoft' : 'future';
  const nil = h === '0'.repeat(32);
  const max = h === 'f'.repeat(32);
  const ms = version === 7 && variant === 'rfc' ? parseInt(h.slice(0, 12), 16) : null;
  return { ok: true, kind: 'uuid', version, variant, nil, max, ms, canonical: withHyphens(h) };
}
