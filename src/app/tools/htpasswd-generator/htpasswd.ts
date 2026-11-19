// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { bytesToBase64 } from '../../shared/base64';
import { Md5 } from '../hash-generator/streaming-hash';

export type HtAlgo = 'bcrypt' | 'apr1' | 'sha1';
export const ALGOS: readonly HtAlgo[] = ['bcrypt', 'apr1', 'sha1'];

export const MIN_COST = 4;
export const MAX_COST = 14;
export const DEFAULT_COST = 10;
/** bcrypt considera solo i primi 72 byte della password. */
export const BCRYPT_MAX_BYTES = 72;

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const enc = new TextEncoder();

function bytesOf(s: string | Uint8Array): Uint8Array {
  return typeof s === 'string' ? enc.encode(s) : s;
}

export function passwordBytes(password: string): number {
  return enc.encode(password).length;
}

export function clampCost(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_COST;
  return Math.min(MAX_COST, Math.max(MIN_COST, Math.trunc(n)));
}

/** Salt casuale dall'alfabeto di crypt (64 simboli: con un byte casuale non c'è distorsione). */
export function randomSalt(length = 8): string {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += ITOA64[b & 63];
  return s;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function md5(data: Uint8Array): Uint8Array {
  return new Md5().update(data).digest();
}

function to64(v: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += ITOA64[v & 63];
    v >>>= 6;
  }
  return s;
}

/**
 * APR1-MD5 di Apache (`$apr1$salt$hash`), identico a `openssl passwd -apr1`.
 * Il salt è troncato a 8 caratteri. 1000 giri di MD5: debole per gli standard attuali.
 */
export function apr1(password: string | Uint8Array, salt: string): string {
  const pw = bytesOf(password);
  const s = enc.encode(salt.slice(0, 8));
  const magic = enc.encode('$apr1$');
  const final0 = md5(concat(pw, s, pw));
  const parts: Uint8Array[] = [pw, magic, s];
  for (let pl = pw.length; pl > 0; pl -= 16) parts.push(final0.subarray(0, Math.min(16, pl)));
  for (let i = pw.length; i > 0; i >>= 1) parts.push(i & 1 ? new Uint8Array(1) : pw.subarray(0, 1));
  let f = md5(concat(...parts));
  for (let i = 0; i < 1000; i++) {
    const p: Uint8Array[] = [];
    p.push(i & 1 ? pw : f);
    if (i % 3) p.push(s);
    if (i % 7) p.push(pw);
    p.push(i & 1 ? f : pw);
    f = md5(concat(...p));
  }
  const out =
    to64((f[0] << 16) | (f[6] << 8) | f[12], 4) +
    to64((f[1] << 16) | (f[7] << 8) | f[13], 4) +
    to64((f[2] << 16) | (f[8] << 8) | f[14], 4) +
    to64((f[3] << 16) | (f[9] << 8) | f[15], 4) +
    to64((f[4] << 16) | (f[10] << 8) | f[5], 4) +
    to64(f[11], 2);
  return `$apr1$${salt.slice(0, 8)}$${out}`;
}

/** `{SHA}` + base64 dello SHA-1: senza salt, quindi molto debole. */
export async function sha1Hash(password: string | Uint8Array): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-1', bytesOf(password) as BufferSource);
  return '{SHA}' + bytesToBase64(new Uint8Array(d));
}

type Bcrypt = { hash(pw: string, rounds: number): Promise<string>; compare(pw: string, hash: string): Promise<boolean> };

async function loadBcrypt(): Promise<Bcrypt> {
  const mod = (await import('bcryptjs')) as unknown as Bcrypt & { default?: Bcrypt };
  return mod.default ?? mod;
}

/** bcrypt con prefisso `$2y$` (quello di `htpasswd -B`; l'algoritmo è lo stesso di `$2a$`/`$2b$`). */
export async function bcryptHash(password: string, cost: number): Promise<string> {
  const bcrypt = await loadBcrypt();
  const h = await bcrypt.hash(password, clampCost(cost));
  return '$2y$' + h.slice(4);
}

export async function hashPassword(algo: HtAlgo, password: string, cost = DEFAULT_COST): Promise<string> {
  switch (algo) {
    case 'bcrypt':
      return bcryptHash(password, cost);
    case 'apr1':
      return apr1(password, randomSalt(8));
    case 'sha1':
      return sha1Hash(password);
  }
}

export type UserError = 'empty' | 'colon' | 'control' | 'long';

/** Il nome utente non può essere vuoto, contenere i due punti o caratteri di controllo. */
export function validateUser(user: string): UserError | null {
  if (user === '') return 'empty';
  if (user.includes(':')) return 'colon';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(user)) return 'control';
  if (enc.encode(user).length > 255) return 'long';
  return null;
}

export type MakeError = 'user-empty' | 'user-colon' | 'user-control' | 'user-long' | 'password-empty';

export type MakeResult = { ok: true; line: string } | { ok: false; error: MakeError };

/** Riga `utente:hash` per il file .htpasswd. */
export async function makeLine(user: string, password: string, algo: HtAlgo, cost = DEFAULT_COST): Promise<MakeResult> {
  const ue = validateUser(user);
  if (ue) return { ok: false, error: ('user-' + ue) as MakeError };
  if (password === '') return { ok: false, error: 'password-empty' };
  return { ok: true, line: `${user}:${await hashPassword(algo, password, cost)}` };
}

export type HashType = 'bcrypt' | 'apr1' | 'sha1' | 'md5crypt' | 'sha256crypt' | 'sha512crypt' | 'crypt' | 'unknown';

export interface ParsedLine {
  user: string;
  hash: string;
  type: HashType;
}

export type ParseError = 'empty' | 'no-colon' | 'no-hash';

export function detectType(hash: string): HashType {
  if (/^\$2[abxy]\$\d\d\$[./A-Za-z0-9]{53}$/.test(hash)) return 'bcrypt';
  if (/^\$apr1\$[^$]{0,8}\$[./0-9A-Za-z]{22}$/.test(hash)) return 'apr1';
  if (/^\{SHA\}[A-Za-z0-9+/]{27}=$/.test(hash)) return 'sha1';
  if (hash.startsWith('$1$')) return 'md5crypt';
  if (hash.startsWith('$5$')) return 'sha256crypt';
  if (hash.startsWith('$6$')) return 'sha512crypt';
  if (/^[./0-9A-Za-z]{13}$/.test(hash)) return 'crypt';
  return 'unknown';
}

/** Spezza `utente:hash` al primo due punti (il nome utente non può contenerne). Usa solo la prima riga. */
export function parseLine(line: string): { ok: true; parsed: ParsedLine } | { ok: false; error: ParseError } {
  const text = (line.split(/\r?\n/).find((l) => l.trim() !== '') ?? '').trim();
  if (text === '') return { ok: false, error: 'empty' };
  const i = text.indexOf(':');
  if (i < 0) return { ok: false, error: 'no-colon' };
  const user = text.slice(0, i);
  const hash = text.slice(i + 1);
  if (user === '' || hash === '') return { ok: false, error: 'no-hash' };
  return { ok: true, parsed: { user, hash, type: detectType(hash) } };
}

export type VerifyResult =
  | { ok: true; user: string; type: HashType; match: boolean; cost?: number }
  | { ok: false; error: ParseError | 'unsupported' | 'bad-hash'; type?: HashType };

/** Controlla se la password corrisponde alla riga. Supporta bcrypt, APR1-MD5 e {SHA}. */
export async function verifyLine(line: string, password: string): Promise<VerifyResult> {
  const r = parseLine(line);
  if (!r.ok) return r;
  const { user, hash, type } = r.parsed;
  switch (type) {
    case 'bcrypt': {
      const bcrypt = await loadBcrypt();
      try {
        // bcryptjs legge $2a$ e $2b$: $2x$ e $2y$ si trattano come $2b$
        const match = await bcrypt.compare(password, '$2b$' + hash.slice(4));
        return { ok: true, user, type, match, cost: parseInt(hash.slice(4, 6), 10) };
      } catch {
        return { ok: false, error: 'bad-hash', type };
      }
    }
    case 'apr1': {
      const salt = hash.split('$')[2] ?? '';
      return { ok: true, user, type, match: apr1(password, salt) === hash };
    }
    case 'sha1':
      return { ok: true, user, type, match: (await sha1Hash(password)) === hash };
    case 'unknown':
      return { ok: false, error: 'bad-hash', type };
    default:
      return { ok: false, error: 'unsupported', type };
  }
}
