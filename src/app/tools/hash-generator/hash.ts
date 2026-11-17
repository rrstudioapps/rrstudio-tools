// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { bytesToBase64 } from '../../shared/base64';
import { Md5, Sha256 } from './streaming-hash';

export type Algo = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';
export const ALGOS: readonly Algo[] = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
/** Nome mostrato e nome Web Crypto (assente per MD5, calcolato in TypeScript). */
export const ALGO_LABEL: Record<Algo, string> = { md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
const SUBTLE_NAME: Record<Exclude<Algo, 'md5'>, string> = {
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};
/** Lunghezza dell'esadecimale di ogni algoritmo. */
export const HEX_LENGTH: Record<Algo, number> = { md5: 32, sha1: 40, sha256: 64, sha384: 96, sha512: 128 };

/** Fino a questa dimensione il file si tiene in memoria e si usa Web Crypto per gli SHA. */
export const BUFFER_LIMIT = 500 * 1024 * 1024;
/** Dimensione massima accettata. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export type HashSet = Partial<Record<Algo, Uint8Array>>;

export class HashCancelled extends Error {
  constructor() {
    super('annullato');
    this.name = 'HashCancelled';
  }
}
export class WebCryptoUnavailable extends Error {
  constructor() {
    super('Web Crypto non disponibile');
    this.name = 'WebCryptoUnavailable';
  }
}

export function toHex(bytes: Uint8Array, upper = false): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return upper ? s.toUpperCase() : s;
}

export const toBase64 = (bytes: Uint8Array): string => bytesToBase64(bytes);

/** Digest di un buffer: SHA via Web Crypto, MD5 in TypeScript. */
export async function digest(algo: Algo, data: Uint8Array): Promise<Uint8Array> {
  if (algo === 'md5') return new Md5().update(data).digest();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new WebCryptoUnavailable();
  return new Uint8Array(await subtle.digest(SUBTLE_NAME[algo], data as BufferSource));
}

export async function hashBytes(data: Uint8Array): Promise<HashSet> {
  const out: HashSet = {};
  for (const a of ALGOS) out[a] = await digest(a, data);
  return out;
}

export function hashText(text: string): Promise<HashSet> {
  return hashBytes(new TextEncoder().encode(text));
}

/** Confronto con un checksum incollato: spazi ignorati, esadecimale senza badare alle maiuscole. */
export function matchingAlgos(expected: string, hashes: HashSet): Algo[] {
  const clean = expected.replace(/\s+/g, '');
  if (!clean) return [];
  const lower = clean.toLowerCase();
  return ALGOS.filter((a) => {
    const h = hashes[a];
    return h !== undefined && (toHex(h) === lower || toBase64(h) === clean);
  });
}

export interface FileLike {
  size: number;
  stream(): ReadableStream<Uint8Array>;
}

export interface HashFileOptions {
  signal?: AbortSignal;
  /** 0..1 e fase corrente. */
  onProgress?: (fraction: number, phase: 'read' | 'hash') => void;
  /** Sovrascrivibile nei test per provare il percorso dei file grandi. */
  bufferLimit?: number;
}

export interface FileHashResult {
  hashes: HashSet;
  /** true se il file era troppo grande per il buffer: solo gli algoritmi incrementali (MD5, SHA-256). */
  partial: boolean;
}

const yieldToUi = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Hash di un file letto a blocchi con file.stream(), con avanzamento e annullamento.
 * Fino a bufferLimit il file viene ricomposto in un buffer e hashato con Web Crypto (tutti gli
 * algoritmi); oltre, si calcolano solo MD5 e SHA-256 in modo incrementale, senza tenere il file in memoria.
 */
export async function hashFile(file: FileLike, opts: HashFileOptions = {}): Promise<FileHashResult> {
  const { signal, onProgress } = opts;
  const limit = opts.bufferLimit ?? BUFFER_LIMIT;
  const buffered = file.size <= limit;
  const reader = file.stream().getReader();
  const buffer = buffered ? new Uint8Array(file.size) : null;
  const sha = buffered ? null : new Sha256();
  const md5 = buffered ? null : new Md5();
  let read = 0;
  let lastYield = performance.now();
  try {
    for (;;) {
      if (signal?.aborted) throw new HashCancelled();
      const { done, value } = await reader.read();
      if (done) break;
      if (buffer) buffer.set(value, read);
      else {
        sha!.update(value);
        md5!.update(value);
      }
      read += value.length;
      onProgress?.(file.size ? read / file.size : 1, 'read');
      if (performance.now() - lastYield > 50) {
        await yieldToUi();
        lastYield = performance.now();
      }
    }
  } catch (e) {
    await reader.cancel().catch(() => undefined);
    throw e;
  }
  if (signal?.aborted) throw new HashCancelled();
  if (buffer) {
    onProgress?.(1, 'hash');
    await yieldToUi();
    return { hashes: await hashBytes(buffer.subarray(0, read)), partial: false };
  }
  return { hashes: { md5: md5!.digest(), sha256: sha!.digest() }, partial: true };
}
