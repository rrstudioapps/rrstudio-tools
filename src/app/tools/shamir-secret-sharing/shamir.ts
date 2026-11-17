// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Condivisione di un segreto di Shamir sul campo GF(256) (polinomio di AES, 0x11B, generatore 3).
 * Ogni byte del segreto è il termine noto di un polinomio casuale di grado K-1; la parte con indice x contiene
 * i valori dei polinomi in x. Servono K parti per ricostruire il segreto (interpolazione di Lagrange in 0),
 * con meno di K non si ricava nulla. Prima di dividere si aggiunge al segreto un CRC-32: serve a riconoscere
 * parti sbagliate o di segreti diversi alla ricostruzione.
 */

export type ShamirErrorCode = 'params' | 'empty' | 'too-long' | 'format' | 'too-few' | 'inconsistent' | 'duplicate' | 'checksum' | 'crypto';

export class ShamirError extends Error {
  readonly code: ShamirErrorCode;
  /** Numeri utili al messaggio (es. parti date e necessarie). */
  readonly info: Record<string, number>;
  constructor(code: ShamirErrorCode, info: Record<string, number> = {}) {
    super(code);
    this.code = code;
    this.info = info;
  }
}

export const MAX_SHARES = 255;
/** Lunghezza massima del segreto, in byte. */
export const MAX_SECRET_BYTES = 16 * 1024;

// ---------- aritmetica GF(256) ----------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // x * 3 = x ^ (x * 2), con riduzione modulo 0x11B
    let x2 = x << 1;
    if (x2 & 0x100) x2 ^= 0x11b;
    x = x2 ^ x;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

export function gfAdd(a: number, b: number): number {
  return a ^ b;
}

export function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

export function gfInv(a: number): number {
  if (a === 0) throw new RangeError('0 non ha inverso');
  return EXP[255 - LOG[a]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new RangeError('divisione per zero');
  return a === 0 ? 0 : EXP[LOG[a] + 255 - LOG[b]];
}

// ---------- CRC-32 ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- divisione e ricostruzione ----------

export interface Share {
  /** Soglia: parti necessarie. */
  k: number;
  /** Parti create in tutto. */
  n: number;
  /** Indice della parte, da 1 a n (è la x in cui sono valutati i polinomi). */
  index: number;
  data: Uint8Array;
}

export type RandomFill = (buf: Uint8Array<ArrayBuffer>) => void;

const defaultRandom: RandomFill = (buf) => {
  if (!globalThis.crypto?.getRandomValues) throw new ShamirError('crypto');
  // getRandomValues accetta al massimo 65536 byte per chiamata
  for (let i = 0; i < buf.length; i += 65536) globalThis.crypto.getRandomValues(buf.subarray(i, i + 65536));
};

/** Divide `secret` in `n` parti con soglia `k`. La casualità viene da crypto.getRandomValues (o da `random`, per i test). */
export function splitSecret(secret: Uint8Array, n: number, k: number, random: RandomFill = defaultRandom): Share[] {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 2 || n < k || n > MAX_SHARES) throw new ShamirError('params');
  if (secret.length === 0) throw new ShamirError('empty');
  if (secret.length > MAX_SECRET_BYTES) throw new ShamirError('too-long');
  const payload = new Uint8Array(secret.length + 4);
  payload.set(secret);
  new DataView(payload.buffer).setUint32(secret.length, crc32(secret));
  // coefficienti casuali: (k-1) per ogni byte del segreto
  const coeffs = new Uint8Array(payload.length * (k - 1));
  random(coeffs);
  const shares: Share[] = Array.from({ length: n }, (_, i) => ({ k, n, index: i + 1, data: new Uint8Array(payload.length) }));
  for (let b = 0; b < payload.length; b++) {
    for (const s of shares) {
      // Horner: p(x) = c0 + x (c1 + x (c2 + …))
      let y = 0;
      for (let j = k - 1; j >= 1; j--) y = gfMul(y, s.index) ^ coeffs[b * (k - 1) + (j - 1)];
      s.data[b] = gfMul(y, s.index) ^ payload[b];
    }
  }
  return shares;
}

/** Valore in `x` del polinomio che passa per i punti dati (interpolazione di Lagrange su GF(256)). */
function interpolate(x: number, points: { x: number; y: number }[]): number {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    let num = 1;
    let den = 1;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      num = gfMul(num, x ^ points[j].x);
      den = gfMul(den, points[i].x ^ points[j].x);
    }
    result ^= gfMul(points[i].y, gfDiv(num, den));
  }
  return result;
}

/** Ricostruisce il segreto da almeno K parti coerenti; errori chiari se sono poche, duplicate, incoerenti o non corrette. */
export function combineShares(shares: Share[]): Uint8Array {
  if (shares.length === 0) throw new ShamirError('too-few', { have: 0, need: 0 });
  const { k, n } = shares[0];
  const len = shares[0].data.length;
  if (shares.some((s) => s.k !== k || s.n !== n || s.data.length !== len)) throw new ShamirError('inconsistent');
  const seen = new Set<number>();
  for (const s of shares) {
    if (s.index < 1 || s.index > n) throw new ShamirError('inconsistent');
    if (seen.has(s.index)) throw new ShamirError('duplicate', { index: s.index });
    seen.add(s.index);
  }
  if (shares.length < k) throw new ShamirError('too-few', { have: shares.length, need: k });
  const base = shares.slice(0, k);
  const extra = shares.slice(k);
  const payload = new Uint8Array(len);
  for (let b = 0; b < len; b++) {
    const pts = base.map((s) => ({ x: s.index, y: s.data[b] }));
    payload[b] = interpolate(0, pts);
    // le parti in più devono stare sullo stesso polinomio
    for (const e of extra) if (interpolate(e.index, pts) !== e.data[b]) throw new ShamirError('checksum');
  }
  if (len < 5) throw new ShamirError('inconsistent');
  const secret = payload.subarray(0, len - 4);
  if (new DataView(payload.buffer).getUint32(len - 4) !== crc32(secret)) throw new ShamirError('checksum');
  return secret.slice();
}

// ---------- testo delle parti ----------

export type ShareFormat = 'hex' | 'base64';

/** Prefisso: S1 (versione del formato) + H o B (hex o Base64), poi soglia, totale e indice: `S1H-3-5-2-…`. */
export function formatShare(s: Share, format: ShareFormat): string {
  const body =
    format === 'hex'
      ? Array.from(s.data, (b) => b.toString(16).padStart(2, '0')).join('')
      : btoa(Array.from(s.data, (b) => String.fromCharCode(b)).join(''));
  return `S1${format === 'hex' ? 'H' : 'B'}-${s.k}-${s.n}-${s.index}-${body}`;
}

export function parseShare(text: string): Share {
  const m = /^S1([HB])-(\d{1,3})-(\d{1,3})-(\d{1,3})-([A-Za-z0-9+/=]+)$/i.exec(text.trim().replace(/\s+/g, ''));
  if (!m) throw new ShamirError('format');
  const k = Number(m[2]);
  const n = Number(m[3]);
  const index = Number(m[4]);
  if (k < 2 || k > n || n > MAX_SHARES || index < 1 || index > n) throw new ShamirError('format');
  let data: Uint8Array;
  if (m[1].toUpperCase() === 'H') {
    if (!/^[0-9a-fA-F]+$/.test(m[5]) || m[5].length % 2 !== 0) throw new ShamirError('format');
    data = Uint8Array.from(m[5].match(/../g)!, (h) => parseInt(h, 16));
  } else {
    try {
      data = Uint8Array.from(atob(m[5]), (c) => c.charCodeAt(0));
    } catch {
      throw new ShamirError('format');
    }
  }
  if (data.length < 5) throw new ShamirError('format');
  return { k, n, index, data };
}

/** Legge le parti incollate, una per riga (righe vuote ignorate). Il numero di riga errata, se c'è, è in `info.line`. */
export function parseShares(text: string): Share[] {
  const out: Share[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim() === '') return;
    try {
      out.push(parseShare(line));
    } catch (e) {
      if (e instanceof ShamirError) throw new ShamirError(e.code, { ...e.info, line: i + 1 });
      throw e;
    }
  });
  return out;
}
