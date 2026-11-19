// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ALGOS, Algo, FileLike, HashCancelled, hashBytes, hashFile, hashText, matchingAlgos, toBase64, toHex } from './hash';
import { Md5, Sha256 } from './streaming-hash';

// jsdom non sempre espone crypto.subtle: si usa quello di Node
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const NIST_448 = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';

/** Vettori di prova standard (FIPS 180, RFC 1321, RFC 3174). */
const VECTORS: Record<string, Record<Algo, string>> = {
  '': {
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sha384: '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    sha512:
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  },
  abc: {
    md5: '900150983cd24fb0d6963f7d28e17f72',
    sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    sha384: 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    sha512:
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  },
  [NIST_448]: {
    md5: '8215ef0796a20bcaaae116d3876c664a',
    sha1: '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    sha256: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    sha384: '3391fdddfc8dc7393707a65b1b4709397cf8b1d162af05abfe8f450de5f36bc6b0455a8520bc4e6f5fe95b1fe3c8452b',
    sha512:
      '204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445',
  },
};

describe('vettori standard (Web Crypto + MD5)', () => {
  for (const [input, expected] of Object.entries(VECTORS)) {
    const label = input.length > 10 ? 'stringa NIST di 448 bit' : JSON.stringify(input);
    it(label, async () => {
      const h = await hashText(input);
      for (const a of ALGOS) expect(toHex(h[a]!)).toBe(expected[a]);
    });
  }

  it('MD5: tutti i vettori di RFC 1321', () => {
    const rfc: [string, string][] = [
      ['', 'd41d8cd98f00b204e9800998ecf8427e'],
      ['a', '0cc175b9c0f1b6a831c399e269772661'],
      ['abc', '900150983cd24fb0d6963f7d28e17f72'],
      ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
      ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
      ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
      ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a'],
    ];
    for (const [s, h] of rfc) expect(toHex(new Md5().update(enc(s)).digest())).toBe(h);
  });

  it('UTF-8: l\'hash è sui byte', async () => {
    const h = await hashText('àèì€');
    const direct = await hashBytes(new Uint8Array([0xc3, 0xa0, 0xc3, 0xa8, 0xc3, 0xac, 0xe2, 0x82, 0xac]));
    expect(toHex(h.sha256!)).toBe(toHex(direct.sha256!));
  });
});

describe('SHA-256 e MD5 incrementali', () => {
  it('vettori standard', () => {
    for (const [input, expected] of Object.entries(VECTORS)) {
      expect(toHex(new Sha256().update(enc(input)).digest())).toBe(expected.sha256);
      expect(toHex(new Md5().update(enc(input)).digest())).toBe(expected.md5);
    }
  });

  it('un milione di "a"', () => {
    const data = new Uint8Array(1_000_000).fill(97);
    expect(toHex(new Sha256().update(data).digest())).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
    expect(toHex(new Md5().update(data).digest())).toBe('7707d6ae4e027c70eea2a935c2296f21');
  });

  it('coincide con Web Crypto per ogni lunghezza intorno ai bordi dei blocchi, in pezzi di dimensione varia', async () => {
    let seed = 1;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const len of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 1000, 65537]) {
      const data = new Uint8Array(len).map(() => (rnd() * 256) | 0);
      const sha = new Sha256();
      const md5 = new Md5();
      for (let i = 0; i < len; ) {
        const n = Math.min(len - i, 1 + ((rnd() * 150) | 0));
        sha.update(data.subarray(i, i + n));
        md5.update(data.subarray(i, i + n));
        i += n;
      }
      expect(toHex(sha.digest())).toBe(toHex(await hashBytes(data).then((h) => h.sha256!)));
      expect(toHex(md5.digest())).toBe(toHex(new Md5().update(data).digest()));
    }
  });
});

describe('codifica e confronto', () => {
  it('esadecimale (anche maiuscolo) e Base64', async () => {
    const h = await hashText('abc');
    expect(toHex(h.sha1!, true)).toBe('A9993E364706816ABA3E25717850C26C9CD0D89D');
    expect(toBase64(h.sha1!)).toBe('qZk+NkcGgWq6PiVxeFDCbJzQ2J0=');
    expect(toBase64(h.md5!)).toBe('kAFQmDzST7DWlj99KOF/cg==');
  });

  it('trova l\'algoritmo corrispondente ignorando maiuscole e spazi', async () => {
    const h = await hashText('abc');
    expect(matchingAlgos('  BA7816BF 8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD\n', h)).toEqual(['sha256']);
    expect(matchingAlgos('a9993e364706816aba3e25717850c26c9cd0d89d', h)).toEqual(['sha1']);
    expect(matchingAlgos('kAFQmDzST7DWlj99KOF/cg==', h)).toEqual(['md5']);
    expect(matchingAlgos('deadbeef', h)).toEqual([]);
    expect(matchingAlgos('   ', h)).toEqual([]);
  });
});

/** File finto: un Uint8Array servito a pezzi di dimensione data. */
function fakeFile(data: Uint8Array, chunk: number): FileLike {
  return {
    size: data.length,
    stream: () => {
      let i = 0;
      return new ReadableStream<Uint8Array>({
        pull(c) {
          if (i >= data.length) return c.close();
          c.enqueue(data.slice(i, i + chunk));
          i += chunk;
        },
      });
    },
  };
}

describe('hashFile', () => {
  const data = new Uint8Array(300_001).map((_, i) => (i * 31 + 7) & 255);

  it('file in memoria: tutti gli algoritmi, uguale all\'hash del buffer, con avanzamento', async () => {
    const seen: number[] = [];
    const r = await hashFile(fakeFile(data, 65536), { onProgress: (f) => seen.push(f) });
    const direct = await hashBytes(data);
    expect(r.partial).toBe(false);
    for (const a of ALGOS) expect(toHex(r.hashes[a]!)).toBe(toHex(direct[a]!));
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('file grande (oltre il limite): solo MD5 e SHA-256, uguali a quelli del buffer', async () => {
    const r = await hashFile(fakeFile(data, 10_007), { bufferLimit: 1000 });
    const direct = await hashBytes(data);
    expect(r.partial).toBe(true);
    expect(Object.keys(r.hashes).sort()).toEqual(['md5', 'sha256']);
    expect(toHex(r.hashes.sha256!)).toBe(toHex(direct.sha256!));
    expect(toHex(r.hashes.md5!)).toBe(toHex(direct.md5!));
  });

  it('file vuoto', async () => {
    const r = await hashFile(fakeFile(new Uint8Array(0), 10));
    expect(toHex(r.hashes.sha256!)).toBe(VECTORS[''].sha256);
  });

  it('si può annullare', async () => {
    const ctrl = new AbortController();
    const p = hashFile(fakeFile(data, 1000), { signal: ctrl.signal, onProgress: (f) => f > 0.1 && ctrl.abort() });
    await expect(p).rejects.toBeInstanceOf(HashCancelled);
  });
});
