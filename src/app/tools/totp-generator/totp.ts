// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Codici monouso HOTP (RFC 4226) e TOTP (RFC 6238) con HMAC di WebCrypto. Logica pura, tutta nel browser. */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';
export const ALGORITHMS: readonly TotpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];
export const DIGIT_OPTIONS = [6, 7, 8] as const;
export const DEFAULT_PERIOD = 30;
export const MIN_PERIOD = 5;
export const MAX_PERIOD = 300;
export const MAX_WINDOW = 5;
/** Byte del segreto generato: 20 (160 bit) è la dimensione raccomandata dalla RFC 4226. */
export const SECRET_BYTES = 20;

export interface TotpParams {
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
}

export const DEFAULT_PARAMS: TotpParams = { algorithm: 'SHA-1', digits: 6, period: DEFAULT_PERIOD };

export type TotpErrorCode =
  | 'empty'
  | 'base32'
  | 'uri'
  | 'uri-type'
  | 'uri-secret'
  | 'algorithm'
  | 'digits'
  | 'period';

export class TotpError extends Error {
  constructor(readonly code: TotpErrorCode) {
    super(code);
  }
}

// ---- Base32 (RFC 4648) ----

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array, padding = false): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  if (padding) while (out.length % 8 !== 0) out += '=';
  return out;
}

/** Decodifica un segreto Base32: ignora maiuscole, spazi, trattini e il riempimento "=". */
export function base32Decode(text: string): Uint8Array {
  const clean = text.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase();
  if (clean === '') throw new TotpError('empty');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new TotpError('base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/** Segreto casuale (crypto.getRandomValues) già in Base32. */
export function randomSecret(bytes = SECRET_BYTES): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Segreto raggruppato a blocchi di 4 caratteri per leggerlo meglio. */
export function groupSecret(secret: string): string {
  return secret.replace(/[\s-]+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

// ---- HOTP / TOTP ----

export function validateParams(p: TotpParams): void {
  if (!ALGORITHMS.includes(p.algorithm)) throw new TotpError('algorithm');
  if (!Number.isInteger(p.digits) || p.digits < 6 || p.digits > 8) throw new TotpError('digits');
  if (!Number.isInteger(p.period) || p.period < MIN_PERIOD || p.period > MAX_PERIOD) throw new TotpError('period');
}

/** HOTP (RFC 4226): HMAC del contatore a 8 byte, troncamento dinamico, modulo 10^cifre. */
export async function hotp(secret: Uint8Array, counter: number, algorithm: TotpAlgorithm, digits: number): Promise<string> {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new RangeError('counter');
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/** Contatore TOTP per un istante (millisecondi Unix). */
export function timeCounter(timeMs: number, period: number): number {
  return Math.floor(timeMs / 1000 / period);
}

/** Secondi che mancano al prossimo codice (da 1 a `period`). */
export function secondsRemaining(timeMs: number, period: number): number {
  return period - (Math.floor(timeMs / 1000) % period);
}

export async function totp(secret: Uint8Array, timeMs: number, params: TotpParams): Promise<string> {
  validateParams(params);
  return hotp(secret, Math.max(0, timeCounter(timeMs, params.period)), params.algorithm, params.digits);
}

export interface Neighbours {
  previous: string;
  current: string;
  next: string;
}

export async function totpNeighbours(secret: Uint8Array, timeMs: number, params: TotpParams): Promise<Neighbours> {
  validateParams(params);
  const c = timeCounter(timeMs, params.period);
  const at = (n: number) => hotp(secret, Math.max(0, n), params.algorithm, params.digits);
  const [previous, current, next] = await Promise.all([at(c - 1), at(c), at(c + 1)]);
  return { previous, current, next };
}

export interface VerifyResult {
  ok: boolean;
  /** Scostamento in periodi del codice trovato (−1 precedente, 0 corrente, +1 successivo…). */
  offset: number | null;
}

/** Verifica un codice con una finestra di ±`window` periodi attorno all'istante. */
export async function verifyTotp(
  code: string,
  secret: Uint8Array,
  timeMs: number,
  params: TotpParams,
  window = 1,
): Promise<VerifyResult> {
  validateParams(params);
  const clean = code.replace(/\s+/g, '');
  const w = Math.min(MAX_WINDOW, Math.max(0, Math.floor(window)));
  if (!new RegExp(`^[0-9]{${params.digits}}$`).test(clean)) return { ok: false, offset: null };
  const c = timeCounter(timeMs, params.period);
  // l'ordine parte dal periodo corrente e si allarga: il risultato non dipende dal tempo di calcolo
  const order = [0];
  for (let i = 1; i <= w; i++) order.push(-i, i);
  let found: number | null = null;
  for (const off of order) {
    if (c + off < 0) continue;
    const expected = await hotp(secret, c + off, params.algorithm, params.digits);
    if (found === null && constantTimeEqual(expected, clean)) found = off;
  }
  return found === null ? { ok: false, offset: null } : { ok: true, offset: found };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- URI otpauth:// ----

export interface OtpauthData {
  secret: string;
  params: TotpParams;
  label: string;
  issuer: string;
}

const ALGO_FROM_URI: Record<string, TotpAlgorithm> = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };
const ALGO_TO_URI: Record<TotpAlgorithm, string> = { 'SHA-1': 'SHA1', 'SHA-256': 'SHA256', 'SHA-512': 'SHA512' };

export function isOtpauthUri(text: string): boolean {
  return /^\s*otpauth:\/\//i.test(text);
}

/** Legge un URI otpauth://totp/Etichetta?secret=…&issuer=…&algorithm=…&digits=…&period=… */
export function parseOtpauth(uri: string): OtpauthData {
  let url: URL;
  try {
    url = new URL(uri.trim());
  } catch {
    throw new TotpError('uri');
  }
  if (url.protocol !== 'otpauth:') throw new TotpError('uri');
  if (url.hostname.toLowerCase() !== 'totp') throw new TotpError('uri-type');
  const secret = url.searchParams.get('secret');
  if (!secret) throw new TotpError('uri-secret');
  base32Decode(secret); // valida
  let label = '';
  try {
    label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    throw new TotpError('uri');
  }
  let issuer = url.searchParams.get('issuer') ?? '';
  const colon = label.indexOf(':');
  if (colon >= 0) {
    if (!issuer) issuer = label.slice(0, colon).trim();
    label = label.slice(colon + 1).trim();
  }
  const algRaw = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase();
  const algorithm = ALGO_FROM_URI[algRaw];
  if (!algorithm) throw new TotpError('algorithm');
  const digits = url.searchParams.has('digits') ? Number(url.searchParams.get('digits')) : 6;
  const period = url.searchParams.has('period') ? Number(url.searchParams.get('period')) : DEFAULT_PERIOD;
  const params: TotpParams = { algorithm, digits, period };
  validateParams(params);
  return { secret: secret.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase(), params, label, issuer };
}

/** Costruisce l'URI otpauth da inserire nel QR (i parametri a valore predefinito si scrivono comunque: più compatibile). */
export function buildOtpauth(data: OtpauthData): string {
  const secret = data.secret.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase();
  base32Decode(secret);
  validateParams(data.params);
  const label = data.issuer ? `${encodeURIComponent(data.issuer)}:${encodeURIComponent(data.label)}` : encodeURIComponent(data.label);
  const q = [`secret=${secret}`];
  if (data.issuer) q.push(`issuer=${encodeURIComponent(data.issuer)}`);
  q.push(`algorithm=${ALGO_TO_URI[data.params.algorithm]}`, `digits=${data.params.digits}`, `period=${data.params.period}`);
  return `otpauth://totp/${label}?${q.join('&')}`;
}

/** Codice a gruppi (123 456) per leggerlo meglio. */
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
