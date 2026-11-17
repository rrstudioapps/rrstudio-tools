// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { bytesToBase64, tryBase64ToBytes } from '../../shared/base64';

/**
 * Cifratura con passphrase: AES-256-GCM, chiave derivata con PBKDF2-HMAC-SHA256 (WebCrypto).
 *
 * Formato del file (tutti i numeri big-endian):
 *
 *   offset  byte  contenuto
 *   0       5     firma "RRENC"
 *   5       1     versione del formato (1)
 *   6       4     iterazioni PBKDF2 (almeno 600000)
 *   10      16    salt casuale
 *   26      12    IV (nonce) casuale
 *   38      n+16  testo cifrato AES-GCM seguito dal tag di autenticazione di 16 byte
 *
 * I primi 38 byte (l'intestazione) sono dati aggiuntivi autenticati (AAD): modificarli fa fallire
 * la decifratura. Una passphrase sbagliata e un file manomesso sono indistinguibili (GCM non lo permette).
 */

export const MAGIC = new TextEncoder().encode('RRENC');
export const FORMAT_VERSION = 1;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES + IV_BYTES; // 38
export const MIN_FILE_BYTES = HEADER_BYTES + TAG_BYTES;
/** Iterazioni PBKDF2-SHA256 (indicazione OWASP 2023: 600000). Si rifiutano file con meno iterazioni. */
export const PBKDF2_ITERATIONS = 600_000;
/** Limite superiore accettato in lettura: protegge da file che farebbero calcolare per minuti. */
export const MAX_ITERATIONS = 10_000_000;
/** Dimensione massima di un file: AES-GCM di WebCrypto lavora in memoria, in un solo blocco. */
export const MAX_FILE_BYTES = 256 * 1024 * 1024;
export const FILE_EXTENSION = '.rrenc';

export type CryptErrorCode =
  | 'empty-password'
  | 'not-encrypted'
  | 'version'
  | 'params'
  | 'truncated'
  | 'auth'
  | 'base64'
  | 'too-big'
  | 'no-crypto';

export class CryptError extends Error {
  constructor(readonly code: CryptErrorCode) {
    super(code);
  }
}

export interface EncryptOptions {
  iterations?: number;
  /** Solo per i test. */
  salt?: Uint8Array;
  iv?: Uint8Array;
}

export interface Encrypted {
  header: Uint8Array;
  /** Testo cifrato + tag. */
  body: Uint8Array;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new CryptError('no-crypto');
  return s;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const s = subtle();
  // NFC: la stessa passphrase digitata su tastiere o sistemi diversi produce gli stessi byte
  const raw = new TextEncoder().encode(password.normalize('NFC'));
  const base = await s.importKey('raw', raw as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return s.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function buildHeader(iterations: number, salt: Uint8Array, iv: Uint8Array): Uint8Array {
  const h = new Uint8Array(HEADER_BYTES);
  h.set(MAGIC, 0);
  h[MAGIC.length] = FORMAT_VERSION;
  new DataView(h.buffer).setUint32(MAGIC.length + 1, iterations);
  h.set(salt, MAGIC.length + 5);
  h.set(iv, MAGIC.length + 5 + SALT_BYTES);
  return h;
}

export interface ParsedHeader {
  version: number;
  iterations: number;
  salt: Uint8Array;
  iv: Uint8Array;
}

/** Legge e controlla l'intestazione; lancia CryptError se non è un file di questo formato. */
export function parseHeader(data: Uint8Array): ParsedHeader {
  if (data.length < MAGIC.length || !MAGIC.every((b, i) => data[i] === b)) throw new CryptError('not-encrypted');
  if (data.length < MIN_FILE_BYTES) throw new CryptError('truncated');
  const version = data[MAGIC.length];
  if (version !== FORMAT_VERSION) throw new CryptError('version');
  const iterations = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(MAGIC.length + 1);
  if (iterations < PBKDF2_ITERATIONS || iterations > MAX_ITERATIONS) throw new CryptError('params');
  const saltStart = MAGIC.length + 5;
  return {
    version,
    iterations,
    salt: data.slice(saltStart, saltStart + SALT_BYTES),
    iv: data.slice(saltStart + SALT_BYTES, saltStart + SALT_BYTES + IV_BYTES),
  };
}

/** Cifra e restituisce intestazione e corpo separati (per costruire un Blob senza copiare tutto). */
export async function encryptParts(plain: Uint8Array, password: string, opts: EncryptOptions = {}): Promise<Encrypted> {
  if (password === '') throw new CryptError('empty-password');
  if (plain.length > MAX_FILE_BYTES) throw new CryptError('too-big');
  const iterations = opts.iterations ?? PBKDF2_ITERATIONS;
  if (iterations < PBKDF2_ITERATIONS || iterations > MAX_ITERATIONS) throw new CryptError('params');
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = opts.iv ?? crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = buildHeader(iterations, salt, iv);
  const key = await deriveKey(password, salt, iterations);
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: header as BufferSource, tagLength: 128 },
    key,
    plain as BufferSource,
  );
  return { header, body: new Uint8Array(cipher) };
}

export async function encrypt(plain: Uint8Array, password: string, opts: EncryptOptions = {}): Promise<Uint8Array> {
  const { header, body } = await encryptParts(plain, password, opts);
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

export async function decrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (password === '') throw new CryptError('empty-password');
  const h = parseHeader(data);
  const key = await deriveKey(password, h.salt, h.iterations);
  try {
    const plain = await subtle().decrypt(
      {
        name: 'AES-GCM',
        iv: h.iv as BufferSource,
        additionalData: data.subarray(0, HEADER_BYTES) as BufferSource,
        tagLength: 128,
      },
      key,
      data.subarray(HEADER_BYTES) as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new CryptError('auth');
  }
}

// ---- testo (formato binario scritto in Base64) ----

export const toBase64 = (bytes: Uint8Array): string => bytesToBase64(bytes);

/** Base64 (anche URL-safe, con spazi e a capo). */
export function fromBase64(text: string): Uint8Array {
  const bytes = tryBase64ToBytes(text);
  if (!bytes) throw new CryptError('base64');
  return bytes;
}

export async function encryptText(text: string, password: string, opts?: EncryptOptions): Promise<string> {
  return toBase64(await encrypt(new TextEncoder().encode(text), password, opts));
}

export async function decryptText(b64: string, password: string): Promise<string> {
  const plain = await decrypt(fromBase64(b64), password);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    // la passphrase è giusta ma il contenuto non è testo: lo si dice invece di mostrare caratteri strani
    throw new CryptError('not-encrypted');
  }
}

// ---- nomi dei file ----

export function encryptedName(name: string): string {
  return name + FILE_EXTENSION;
}

/** "relazione.pdf.rrenc" diventa "relazione.pdf"; senza l'estensione si aggiunge ".dec". */
export function decryptedName(name: string): string {
  if (name.toLowerCase().endsWith(FILE_EXTENSION) && name.length > FILE_EXTENSION.length) {
    return name.slice(0, -FILE_EXTENSION.length);
  }
  return name + '.dec';
}
