// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Errore di decodifica con un codice stabile (tradotto dall'interfaccia). */
export class Base64Error extends Error {
  constructor(
    readonly code: 'chars' | 'length' | 'dataurl',
    readonly detail = '',
  ) {
    super(code);
  }
}

const CHUNK = 0x8000;

/** Base64 di byte arbitrari, a blocchi (niente limite di argomenti). Con `urlSafe`: alfabeto - e _ e nessun padding. */
export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(bin);
  return urlSafe ? b64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') : b64;
}

/**
 * Decodifica Base64 standard o URL-safe, con o senza padding, ignorando spazi e a capo.
 * Lancia Base64Error se l'input non è valido.
 */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, '').replace(/=+$/, '');
  const bad = /[^A-Za-z0-9+/_-]/.exec(clean);
  if (bad) throw new Base64Error('chars', bad[0]);
  if (clean.length % 4 === 1) throw new Base64Error('length');
  const std = clean.replaceAll('-', '+').replaceAll('_', '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Come `base64ToBytes`, ma restituisce null se l'input è vuoto o non valido. */
export function tryBase64ToBytes(input: string): Uint8Array | null {
  if (input.replace(/\s+/g, '').replace(/=+$/, '') === '') return null;
  try {
    return base64ToBytes(input);
  } catch {
    return null;
  }
}
