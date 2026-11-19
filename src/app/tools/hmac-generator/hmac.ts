// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Algoritmi HMAC offerti (tutti disponibili in WebCrypto). */
export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number];
export type KeyFormat = 'text' | 'hex' | 'base64';
export type OutputFormat = 'hex' | 'base64' | 'base64url';

/** Lunghezza in byte dell'uscita per ogni algoritmo. */
export const DIGEST_BYTES: Readonly<Record<HmacAlgorithm, number>> = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };

export class HmacError extends Error {
  constructor(public readonly code: 'hex' | 'base64' | 'crypto') {
    super(code);
  }
}

const enc = new TextEncoder();

export function hexToBytes(text: string): Uint8Array {
  const s = text.replace(/[\s:]+/g, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) throw new HmacError('hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Base64 standard o URL-safe, con o senza padding, spazi ignorati. */
export function base64ToBytes(text: string): Uint8Array {
  const s = text.replace(/\s+/g, '').replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw new HmacError('base64');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function encodeOutput(bytes: Uint8Array, format: OutputFormat): string {
  if (format === 'hex') return bytesToHex(bytes);
  const b64 = bytesToBase64(bytes);
  return format === 'base64' ? b64 : b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Chiave in byte a partire dal testo inserito nel formato scelto. */
export function parseKey(text: string, format: KeyFormat): Uint8Array {
  if (format === 'hex') return hexToBytes(text);
  if (format === 'base64') return base64ToBytes(text);
  return enc.encode(text);
}

/** HMAC con WebCrypto. Una chiave vuota non è importabile: equivale a un solo byte a zero (la chiave viene comunque riempita con zeri). */
export async function hmac(key: Uint8Array, message: Uint8Array, algorithm: HmacAlgorithm): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new HmacError('crypto');
  const k = key.length === 0 ? new Uint8Array(1) : key;
  const cryptoKey = await subtle.importKey('raw', k as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', cryptoKey, message as BufferSource));
}

/** Confronto a tempo costante (rispetto al contenuto) di due sequenze di byte. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Interpreta una firma attesa incollata dall'utente: toglie spazi e un prefisso tipo `sha256=`, poi la legge
 * come hex se lo è e ha la lunghezza giusta, altrimenti come base64 / base64url. Null se non è leggibile.
 */
export function parseExpected(text: string, digestBytes: number): Uint8Array | null {
  const s = text.trim().replace(/^[a-z0-9-]+=(?=[A-Za-z0-9+/_-])/i, '').replace(/\s+/g, '');
  if (s === '') return null;
  if (/^[0-9a-fA-F]+$/.test(s) && s.length === digestBytes * 2) return hexToBytes(s);
  try {
    return base64ToBytes(s);
  } catch {
    try {
      return hexToBytes(s);
    } catch {
      return null;
    }
  }
}

export type VerifyOutcome = 'match' | 'mismatch' | 'unreadable';

export function verify(expected: string, computed: Uint8Array): VerifyOutcome {
  const e = parseExpected(expected, computed.length);
  if (!e) return 'unreadable';
  return constantTimeEqual(e, computed) ? 'match' : 'mismatch';
}
