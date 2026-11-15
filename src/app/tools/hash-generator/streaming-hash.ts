// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * SHA-256 e MD5 incrementali in TypeScript puro, per i file troppo grandi per essere tenuti in
 * memoria: Web Crypto (crypto.subtle.digest) non ha un'API a blocchi e vuole il buffer intero.
 * Le costanti si calcolano dalle definizioni (radici di numeri primi, seno) invece di essere
 * copiate a mano; i test le confrontano con Web Crypto e con i vettori ufficiali.
 */

function primes(count: number): number[] {
  const out: number[] = [];
  for (let n = 2; out.length < count; n++) {
    if (out.every((p) => n % p !== 0)) out.push(n);
  }
  return out;
}
const frac32 = (x: number): number => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
const P64 = primes(64);
const SHA256_K = Uint32Array.from(P64, (p) => frac32(Math.cbrt(p)));
const SHA256_H0 = Uint32Array.from(P64.slice(0, 8), (p) => frac32(Math.sqrt(p)));
const MD5_T = Uint32Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));
const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** Base comune: buffer da 64 byte, padding Merkle-Damgård e lunghezza del messaggio. */
abstract class BlockHasher {
  private readonly buf = new Uint8Array(64);
  private used = 0;
  private total = 0;
  private done = false;

  protected abstract readonly bigEndianLength: boolean;
  protected abstract block(data: Uint8Array, offset: number): void;
  protected abstract output(): Uint8Array;

  update(data: Uint8Array): this {
    if (this.done) throw new Error('digest già calcolato');
    this.total += data.length;
    let i = 0;
    if (this.used > 0) {
      const take = Math.min(64 - this.used, data.length);
      this.buf.set(data.subarray(0, take), this.used);
      this.used += take;
      i = take;
      if (this.used < 64) return this;
      this.block(this.buf, 0);
      this.used = 0;
    }
    for (; i + 64 <= data.length; i += 64) this.block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.used = data.length - i;
    }
    return this;
  }

  digest(): Uint8Array {
    if (this.done) throw new Error('digest già calcolato');
    const bits = this.total * 8;
    const padLen = this.used < 56 ? 56 - this.used : 120 - this.used;
    const pad = new Uint8Array(padLen + 8);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    const hi = Math.floor(bits / 4294967296);
    const lo = bits >>> 0;
    if (this.bigEndianLength) {
      view.setUint32(padLen, hi);
      view.setUint32(padLen + 4, lo);
    } else {
      view.setUint32(padLen, lo, true);
      view.setUint32(padLen + 4, hi, true);
    }
    // update() aggiornerebbe total, ma ormai non serve più
    this.update(pad);
    this.done = true;
    return this.output();
  }
}

export class Sha256 extends BlockHasher {
  protected readonly bigEndianLength = true;
  private readonly h = Uint32Array.from(SHA256_H0);
  private readonly w = new Uint32Array(64);

  protected block(d: Uint8Array, o: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = o + i * 4;
      w[i] = (d[j] << 24) | (d[j + 1] << 16) | (d[j + 2] << 8) | d[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    const h = this.h;
    let a = h[0], b = h[1], c = h[2], dd = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (dd + t1) | 0;
      dd = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += dd; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }

  protected output(): Uint8Array {
    const out = new Uint8Array(32);
    const view = new DataView(out.buffer);
    this.h.forEach((v, i) => view.setUint32(i * 4, v));
    return out;
  }
}

export class Md5 extends BlockHasher {
  protected readonly bigEndianLength = false;
  private readonly s = Uint32Array.of(0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476);
  private readonly m = new Uint32Array(16);

  protected block(d: Uint8Array, o: number): void {
    const m = this.m;
    for (let i = 0; i < 16; i++) {
      const j = o + i * 4;
      m[i] = d[j] | (d[j + 1] << 8) | (d[j + 2] << 16) | (d[j + 3] << 24);
    }
    let a = this.s[0], b = this.s[1], c = this.s[2], dd = this.s[3];
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & dd);
        g = i;
      } else if (i < 32) {
        f = (dd & b) | (~dd & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ dd;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~dd);
        g = (7 * i) % 16;
      }
      f = (f + a + MD5_T[i] + m[g]) | 0;
      a = dd;
      dd = c;
      c = b;
      b = (b + rotl(f, MD5_S[(i >> 4) * 4 + (i % 4)])) | 0;
    }
    this.s[0] += a; this.s[1] += b; this.s[2] += c; this.s[3] += dd;
  }

  protected output(): Uint8Array {
    const out = new Uint8Array(16);
    const view = new DataView(out.buffer);
    this.s.forEach((v, i) => view.setUint32(i * 4, v, true));
    return out;
  }
}
