// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { ShamirError, Share, combineShares, crc32, formatShare, gfAdd, gfDiv, gfInv, gfMul, parseShare, parseShares, splitSecret } from './shamir';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Tutte le combinazioni di `size` elementi. */
function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map((c) => [first, ...c]), ...combinations(rest, size)];
}

describe('aritmetica GF(256)', () => {
  it('vettori noti di AES (FIPS 197)', () => {
    expect(gfMul(0x57, 0x83)).toBe(0xc1);
    expect(gfMul(0x57, 0x13)).toBe(0xfe);
    expect(gfMul(0x53, 0xca)).toBe(0x01);
  });
  it('addizione è XOR e 0 e 1 sono neutri', () => {
    expect(gfAdd(0x57, 0x83)).toBe(0xd4);
    for (let a = 0; a < 256; a++) {
      expect(gfMul(a, 1)).toBe(a);
      expect(gfMul(a, 0)).toBe(0);
      expect(gfAdd(a, a)).toBe(0);
    }
  });
  it('ogni elemento non nullo ha un inverso e la divisione lo usa', () => {
    for (let a = 1; a < 256; a++) {
      expect(gfMul(a, gfInv(a))).toBe(1);
      expect(gfDiv(a, a)).toBe(1);
      expect(gfDiv(gfMul(a, 7), 7)).toBe(a);
    }
    expect(() => gfInv(0)).toThrow(RangeError);
    expect(() => gfDiv(5, 0)).toThrow(RangeError);
  });
  it('commutativa, associativa e distributiva su un campione', () => {
    for (let a = 0; a < 256; a += 7) {
      for (let b = 0; b < 256; b += 11) {
        expect(gfMul(a, b)).toBe(gfMul(b, a));
        for (let c = 0; c < 256; c += 37) {
          expect(gfMul(gfMul(a, b), c)).toBe(gfMul(a, gfMul(b, c)));
          expect(gfMul(a, gfAdd(b, c))).toBe(gfAdd(gfMul(a, b), gfMul(a, c)));
        }
      }
    }
  });
  it('il generatore 3 percorre tutti i 255 elementi non nulli', () => {
    const seen = new Set<number>();
    let x = 1;
    for (let i = 0; i < 255; i++) {
      seen.add(x);
      x = gfMul(x, 3);
    }
    expect(seen.size).toBe(255);
    expect(x).toBe(1);
  });
  it('CRC-32 di "123456789"', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('split e combine', () => {
  it('con casualità fissa le parti sono quelle attese (k=2: y = s + a·x)', () => {
    const secret = Uint8Array.of(0x42);
    const shares = splitSecret(secret, 3, 2, (buf) => buf.fill(0x05));
    // payload = [0x42, crc32 (4 byte)]; ogni byte b: y = b ^ (5·x)
    const crc = crc32(secret);
    const payload = [0x42, (crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
    for (const s of shares) expect(Array.from(s.data)).toEqual(payload.map((b) => b ^ gfMul(5, s.index)));
  });

  for (const [n, k] of [
    [2, 2],
    [3, 2],
    [5, 3],
    [6, 4],
    [5, 5],
  ]) {
    it(`n=${n}, k=${k}: ogni combinazione di K parti ricostruisce il segreto, meno di K no`, () => {
      const secret = enc.encode('Segreto di prova: àèì €uro 🔑');
      const shares = splitSecret(secret, n, k);
      expect(shares).toHaveLength(n);
      for (const subset of combinations(shares, k)) expect(dec.decode(combineShares(subset))).toBe('Segreto di prova: àèì €uro 🔑');
      for (const subset of combinations(shares, k - 1)) {
        expect(() => combineShares(subset)).toThrowError(expect.objectContaining({ code: 'too-few' }));
      }
      // con più di K parti (tutte) funziona lo stesso
      expect(dec.decode(combineShares(shares))).toBe('Segreto di prova: àèì €uro 🔑');
      // l'ordine non conta
      expect(dec.decode(combineShares([...shares].reverse()))).toBe('Segreto di prova: àèì €uro 🔑');
    });
  }

  it('255 parti con soglia 255 e segreto binario con tutti i valori di byte', () => {
    const secret = Uint8Array.from({ length: 256 }, (_, i) => i);
    const shares = splitSecret(secret, 255, 128);
    expect(shares[254].index).toBe(255);
    expect(Array.from(combineShares(shares.slice(100, 228)))).toEqual(Array.from(secret));
  });

  it('parametri non validi', () => {
    const s = Uint8Array.of(1);
    for (const [n, k] of [
      [3, 1],
      [2, 3],
      [256, 2],
      [3, 2.5],
      [0, 0],
    ]) {
      expect(() => splitSecret(s, n, k)).toThrowError(expect.objectContaining({ code: 'params' }));
    }
    expect(() => splitSecret(new Uint8Array(0), 3, 2)).toThrowError(expect.objectContaining({ code: 'empty' }));
    expect(() => splitSecret(new Uint8Array(20000), 3, 2)).toThrowError(expect.objectContaining({ code: 'too-long' }));
  });

  it('le parti non contengono il segreto in chiaro e cambiano a ogni divisione', () => {
    const secret = enc.encode('uguale');
    const a = splitSecret(secret, 3, 2);
    const b = splitSecret(secret, 3, 2);
    expect(formatShare(a[0], 'hex')).not.toBe(formatShare(b[0], 'hex'));
  });
});

describe('errori alla ricostruzione', () => {
  const shares = splitSecret(enc.encode('segreto'), 5, 3);

  it('poche parti: dice quante ne servono', () => {
    try {
      combineShares(shares.slice(0, 2));
      expect.unreachable();
    } catch (e) {
      expect((e as ShamirError).code).toBe('too-few');
      expect((e as ShamirError).info).toEqual({ have: 2, need: 3 });
    }
    expect(() => combineShares([])).toThrowError(expect.objectContaining({ code: 'too-few' }));
  });
  it('parti duplicate', () => {
    expect(() => combineShares([shares[0], shares[0], shares[1]])).toThrowError(expect.objectContaining({ code: 'duplicate' }));
  });
  it('parti di divisioni diverse (soglia o totale diversi, lunghezza diversa)', () => {
    const other = splitSecret(enc.encode('segreto'), 4, 3);
    expect(() => combineShares([shares[0], shares[1], other[2]])).toThrowError(expect.objectContaining({ code: 'inconsistent' }));
    const longer = splitSecret(enc.encode('segreto più lungo'), 5, 3);
    expect(() => combineShares([shares[0], shares[1], longer[2]])).toThrowError(expect.objectContaining({ code: 'inconsistent' }));
  });
  it('parti dello stesso formato ma di segreti diversi: checksum', () => {
    const other = splitSecret(enc.encode('segreta'), 5, 3);
    expect(() => combineShares([shares[0], shares[1], other[2]])).toThrowError(expect.objectContaining({ code: 'checksum' }));
  });
  it('parte alterata, anche tra quelle in più', () => {
    const bad: Share = { ...shares[1], data: shares[1].data.slice() };
    bad.data[2] ^= 0x10;
    expect(() => combineShares([shares[0], bad, shares[2]])).toThrowError(expect.objectContaining({ code: 'checksum' }));
    expect(() => combineShares([shares[0], shares[2], shares[3], bad])).toThrowError(expect.objectContaining({ code: 'checksum' }));
  });
});

describe('testo delle parti', () => {
  const [s] = splitSecret(enc.encode('ciao'), 5, 3);
  it('round trip in hex e in Base64, con prefisso soglia/totale/indice', () => {
    const hex = formatShare(s, 'hex');
    const b64 = formatShare(s, 'base64');
    expect(hex).toMatch(/^S1H-3-5-1-[0-9a-f]+$/);
    expect(b64).toMatch(/^S1B-3-5-1-[A-Za-z0-9+/=]+$/);
    expect(parseShare(hex)).toEqual(s);
    expect(parseShare(b64)).toEqual(s);
    expect(parseShare('  ' + hex.toLowerCase() + '  \n')).toEqual(s);
  });
  it('rifiuta righe non valide', () => {
    for (const bad of ['', 'ciao', 'S1H-3-5-1-zz', 'S1H-3-5-1-abc', 'S1H-1-5-1-abcdabcdab', 'S1H-3-5-6-abcdabcdab', 'S1H-6-5-1-abcdabcdab', 'S1H-3-5-1-aabb', 'S2H-3-5-1-aabbccddeeff']) {
      expect(() => parseShare(bad), bad).toThrowError(expect.objectContaining({ code: 'format' }));
    }
  });
  it('parseShares legge una parte per riga e segnala la riga errata', () => {
    const all = splitSecret(enc.encode('ciao'), 3, 2);
    const text = all.map((x) => formatShare(x, 'hex')).join('\n\n') + '\n';
    expect(parseShares(text)).toEqual(all);
    try {
      parseShares(formatShare(all[0], 'hex') + '\nrotta');
      expect.unreachable();
    } catch (e) {
      expect((e as ShamirError).info['line']).toBe(2);
    }
  });
  it('dal testo al segreto', () => {
    const all = splitSecret(enc.encode('password: 1234'), 4, 2);
    const pasted = [formatShare(all[3], 'base64'), formatShare(all[1], 'hex')].join('\n');
    expect(dec.decode(combineShares(parseShares(pasted)))).toBe('password: 1234');
  });
});
