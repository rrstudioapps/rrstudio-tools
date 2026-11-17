// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  canonicalDecimal,
  decodeFloat,
  encodeFloat,
  exactDecimal,
  groupFromRight,
  isExactMatch,
  parseFloatInput,
  parseInteger,
  toBase,
  twosComplement,
  twosRange,
} from './base';

const val = (text: string, base: number) => {
  const r = parseInteger(text, base);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('lettura di un intero in una base', () => {
  it('basi comuni', () => {
    expect(val('255', 10)).toBe(255n);
    expect(val('ff', 16)).toBe(255n);
    expect(val('FF', 16)).toBe(255n);
    expect(val('11111111', 2)).toBe(255n);
    expect(val('377', 8)).toBe(255n);
    expect(val('zz', 36)).toBe(1295n);
    expect(val('10', 3)).toBe(3n);
  });
  it('prefissi, segno e separatori', () => {
    expect(val('0xFF', 16)).toBe(255n);
    expect(val('0b1010', 2)).toBe(10n);
    expect(val('0o17', 8)).toBe(15n);
    expect(val('-0xff', 16)).toBe(-255n);
    expect(val('+12', 10)).toBe(12n);
    expect(val('1111 0000', 2)).toBe(240n);
    expect(val('1_000_000', 10)).toBe(1000000n);
    expect(val('−7', 10)).toBe(-7n);
    // in base 16 "0b1" è composto da cifre esadecimali, non è un prefisso
    expect(val('0b1', 16)).toBe(0xb1n);
  });
  it('numeri molto grandi senza perdere cifre', () => {
    expect(val('123456789012345678901234567890', 10)).toBe(123456789012345678901234567890n);
    expect(val('ffffffffffffffffffffffff', 16)).toBe((1n << 96n) - 1n);
  });
  it('errori', () => {
    expect(parseInteger('', 10)).toEqual({ ok: false, error: 'empty' });
    expect(parseInteger('  ', 10)).toEqual({ ok: false, error: 'empty' });
    expect(parseInteger('0x', 16)).toEqual({ ok: false, error: 'empty' });
    expect(parseInteger('12', 2)).toEqual({ ok: false, error: 'invalid', char: '2' });
    expect(parseInteger('1g', 16)).toEqual({ ok: false, error: 'invalid', char: 'g' });
    expect(parseInteger('1.5', 10)).toEqual({ ok: false, error: 'invalid', char: '.' });
    expect(parseInteger('1', 1)).toEqual({ ok: false, error: 'base' });
    expect(parseInteger('1', 37)).toEqual({ ok: false, error: 'base' });
    expect(parseInteger('1'.repeat(5001), 10)).toEqual({ ok: false, error: 'tooLong' });
  });
});

describe('scrittura in una base', () => {
  it('basi 2-36, negativi', () => {
    expect(toBase(255n, 2)).toBe('11111111');
    expect(toBase(255n, 16)).toBe('ff');
    expect(toBase(255n, 16, { upper: true })).toBe('FF');
    expect(toBase(-255n, 16)).toBe('-ff');
    expect(toBase(35n, 36)).toBe('z');
    expect(toBase(0n, 2)).toBe('0');
  });
  it('raggruppamento delle cifre da destra', () => {
    expect(toBase(255n, 2, { group: true })).toBe('1111 1111');
    expect(toBase(5n, 2, { group: true })).toBe('101');
    expect(toBase(0xdeadbeefn, 16, { group: true, upper: true })).toBe('DEAD BEEF');
    expect(toBase(1234567n, 10, { group: true })).toBe('1.234.567');
    expect(toBase(-1234567n, 10, { group: true })).toBe('-1.234.567');
    expect(toBase(1234567n, 10, { group: true, lang: 'en' })).toBe('1,234,567');
    expect(groupFromRight('abcdefg', 3)).toBe('a bcd efg');
  });
  it('andata e ritorno su tutte le basi', () => {
    const n = 987654321987654321n;
    for (let b = 2; b <= 36; b++) expect(val(toBase(n, b), b)).toBe(n);
  });
});

describe('complemento a due', () => {
  it('-1 a 8 bit = 11111111 = 0xFF', () => {
    const r = twosComplement(-1n, 8);
    expect(r.ok && r.value.bits).toBe('11111111');
    expect(r.ok && r.value.hex).toBe('FF');
    expect(r.ok && r.value.unsigned).toBe(255n);
    expect(r.ok && r.value.signed).toBe(-1n);
  });
  it('-128 a 8 bit = 10000000; 127 = 01111111; 128 vale 255 senza segno', () => {
    const a = twosComplement(-128n, 8);
    expect(a.ok && a.value.bits).toBe('10000000');
    const b = twosComplement(127n, 8);
    expect(b.ok && b.value.bits).toBe('01111111');
    const c = twosComplement(128n, 8);
    expect(c.ok && c.value.bits).toBe('10000000');
    expect(c.ok && c.value.signed).toBe(-128n);
    expect(c.ok && c.value.unsigned).toBe(128n);
  });
  it('fuori intervallo: -129 e 256 a 8 bit', () => {
    expect(twosComplement(-129n, 8)).toEqual({ ok: false, min: -128n, max: 255n });
    expect(twosComplement(256n, 8).ok).toBe(false);
  });
  it('16, 32 e 64 bit', () => {
    const a = twosComplement(-2n, 16);
    expect(a.ok && a.value.hex).toBe('FFFE');
    const b = twosComplement(-1n, 32);
    expect(b.ok && b.value.hex).toBe('FFFFFFFF');
    const c = twosComplement(-1n, 64);
    expect(c.ok && c.value.hex).toBe('FFFFFFFFFFFFFFFF');
    expect(c.ok && c.value.bits).toHaveLength(64);
    const d = twosComplement(2n ** 63n, 64);
    expect(d.ok && d.value.signed).toBe(-(2n ** 63n));
  });
  it('zero e padding', () => {
    const z = twosComplement(0n, 16);
    expect(z.ok && z.value.bits).toBe('0000000000000000');
    expect(z.ok && z.value.hex).toBe('0000');
  });
  it('intervalli', () => {
    expect(twosRange(8)).toEqual({ min: -128n, max: 255n });
    expect(twosRange(64).max).toBe(2n ** 64n - 1n);
  });
});

describe('IEEE-754 float32', () => {
  it('1.0 = 0x3F800000', () => {
    const d = decodeFloat(encodeFloat(1, 'f32'), 'f32');
    expect(d.hex).toBe('3F800000');
    expect([d.sign, d.exponent, d.mantissa]).toEqual([0, 127, 0n]);
    expect(d.unbiased).toBe(0);
    expect(d.exact).toBe('1');
    expect(d.cls).toBe('normal');
  });
  it('-2.5, 0.1 e pi', () => {
    expect(decodeFloat(encodeFloat(-2.5, 'f32'), 'f32').hex).toBe('C0200000');
    const t = decodeFloat(encodeFloat(0.1, 'f32'), 'f32');
    expect(t.hex).toBe('3DCCCCCD');
    expect(t.exact).toBe('0.100000001490116119384765625');
    expect(decodeFloat(encodeFloat(Math.PI, 'f32'), 'f32').hex).toBe('40490FDB');
  });
  it('campi separati', () => {
    const d = decodeFloat(0x3f800000n, 'f32');
    expect(d.signBits).toBe('0');
    expect(d.expBitsStr).toBe('01111111');
    expect(d.mantBitsStr).toBe('0'.repeat(23));
  });
  it('casi speciali: zero, zero negativo, infiniti, NaN', () => {
    expect(decodeFloat(0n, 'f32').cls).toBe('zero');
    const nz = decodeFloat(0x80000000n, 'f32');
    expect(nz.cls).toBe('zero');
    expect(Object.is(nz.value, -0)).toBe(true);
    expect(nz.exact).toBe('-0');
    expect(decodeFloat(0x7f800000n, 'f32').exact).toBe('Infinity');
    expect(decodeFloat(0xff800000n, 'f32').exact).toBe('-Infinity');
    expect(decodeFloat(0x7fc00000n, 'f32').cls).toBe('nan');
    expect(encodeFloat(NaN, 'f32')).toBe(0x7fc00000n);
  });
  it('numeri subnormali e limiti', () => {
    const min = decodeFloat(1n, 'f32');
    expect(min.cls).toBe('subnormal');
    expect(min.value).toBe(2 ** -149);
    expect(min.unbiased).toBe(-126);
    expect(decodeFloat(0x7f7fffffn, 'f32').value).toBe(3.4028234663852886e38);
  });
  it('overflow e underflow nella codifica', () => {
    expect(encodeFloat(1e39, 'f32')).toBe(0x7f800000n);
    expect(encodeFloat(1e-50, 'f32')).toBe(0n);
  });
  it('arrotondamento al più vicino, pari in caso di parità', () => {
    // 16777217 = 2^24 + 1 non è rappresentabile: è a metà tra 2^24 e 2^24 + 2, vince il pari (2^24)
    expect(decodeFloat(encodeFloat(16777217, 'f32'), 'f32').value).toBe(16777216);
    expect(decodeFloat(encodeFloat(16777219, 'f32'), 'f32').value).toBe(16777220);
  });
});

describe('IEEE-754 float64', () => {
  it('1.0, 0.1, -2 e pi', () => {
    expect(decodeFloat(encodeFloat(1, 'f64'), 'f64').hex).toBe('3FF0000000000000');
    const t = decodeFloat(encodeFloat(0.1, 'f64'), 'f64');
    expect(t.hex).toBe('3FB999999999999A');
    expect(t.exact).toBe('0.1000000000000000055511151231257827021181583404541015625');
    expect(decodeFloat(encodeFloat(-2, 'f64'), 'f64').hex).toBe('C000000000000000');
    expect(decodeFloat(encodeFloat(Math.PI, 'f64'), 'f64').hex).toBe('400921FB54442D18');
  });
  it('massimo, minimo normale e minimo subnormale', () => {
    expect(decodeFloat(0x7fefffffffffffffn, 'f64').value).toBe(Number.MAX_VALUE);
    expect(decodeFloat(0x0010000000000000n, 'f64').value).toBe(2.2250738585072014e-308);
    const sub = decodeFloat(1n, 'f64');
    expect(sub.value).toBe(5e-324);
    expect(sub.cls).toBe('subnormal');
    expect(sub.exact.startsWith('0.000')).toBe(true);
    expect(sub.exact.length).toBeGreaterThan(700);
  });
  it('interi grandi esatti', () => {
    expect(decodeFloat(encodeFloat(2 ** 60, 'f64'), 'f64').exact).toBe('1152921504606846976');
    expect(decodeFloat(encodeFloat(2 ** 53, 'f64'), 'f64').exact).toBe('9007199254740992');
  });
  it('andata e ritorno di numeri qualsiasi', () => {
    for (const v of [0, -0, 1.5, -123.456, 1e300, 5e-324, Math.E, 1 / 3]) {
      const d = decodeFloat(encodeFloat(v, 'f64'), 'f64');
      expect(Object.is(d.value, v), String(v)).toBe(true);
    }
  });
  it('NaN canonico', () => {
    expect(encodeFloat(NaN, 'f64')).toBe(0x7ff8000000000000n);
    expect(decodeFloat(0x7ff8000000000000n, 'f64').cls).toBe('nan');
  });
});

describe('valore esatto', () => {
  it('potenze di due positive e negative', () => {
    expect(exactDecimal(false, 1n, 10)).toBe('1024');
    expect(exactDecimal(false, 1n, -1)).toBe('0.5');
    expect(exactDecimal(true, 3n, -2)).toBe('-0.75');
    expect(exactDecimal(false, 0n, -5)).toBe('0');
    expect(exactDecimal(false, 5n, -3)).toBe('0.625');
    expect(exactDecimal(false, 8n, -3)).toBe('1');
  });
});

describe('lettura del campo float', () => {
  it('numeri decimali, anche con virgola ed esponente', () => {
    const a = parseFloatInput('0,5', 'f32');
    expect(a.ok && a.bits).toBe(0x3f000000n);
    const b = parseFloatInput('-1.5e2', 'f64');
    expect(b.ok && decodeFloat(b.bits, 'f64').value).toBe(-150);
    const c = parseFloatInput('-0', 'f64');
    expect(c.ok && c.bits).toBe(0x8000000000000000n);
    const d = parseFloatInput('.5', 'f64');
    expect(d.ok && d.requested).toBe(0.5);
  });
  it('NaN e infiniti, in qualsiasi maiuscola', () => {
    const n = parseFloatInput('NaN', 'f32');
    expect(n.ok && n.bits).toBe(0x7fc00000n);
    const i = parseFloatInput('-Infinity', 'f32');
    expect(i.ok && i.bits).toBe(0xff800000n);
    const j = parseFloatInput('inf', 'f64');
    expect(j.ok && j.bits).toBe(0x7ff0000000000000n);
  });
  it('schemi di bit in esadecimale e binario', () => {
    const h = parseFloatInput('0x3F800000', 'f32');
    expect(h.ok && h.fromBits).toBe(true);
    expect(h.ok && h.bits).toBe(0x3f800000n);
    const b = parseFloatInput('0b' + '0'.repeat(31) + '1', 'f32');
    expect(b.ok && b.bits).toBe(1n);
    const s = parseFloatInput('0x 3F80 0000', 'f32');
    expect(s.ok && s.bits).toBe(0x3f800000n);
  });
  it('schema troppo lungo, errori', () => {
    expect(parseFloatInput('0x1FFFFFFFF', 'f32')).toEqual({ ok: false, error: 'bitsTooLong' });
    expect(parseFloatInput('0x000000003F800000', 'f32').ok).toBe(true);
    expect(parseFloatInput('', 'f32')).toEqual({ ok: false, error: 'empty' });
    expect(parseFloatInput('abc', 'f32')).toEqual({ ok: false, error: 'invalid' });
    expect(parseFloatInput('1.2.3', 'f64')).toEqual({ ok: false, error: 'invalid' });
    expect(parseFloatInput('1e', 'f64')).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('confronto decimale esatto', () => {
  it('forma canonica', () => {
    expect(canonicalDecimal('007.500')).toBe('7.5');
    expect(canonicalDecimal('-0.0')).toBe('0');
    expect(canonicalDecimal('1e3')).toBe('1000');
    expect(canonicalDecimal('12.5e-1')).toBe('1.25');
    expect(canonicalDecimal('.5')).toBe('0.5');
    expect(canonicalDecimal('abc')).toBeNull();
    expect(canonicalDecimal('')).toBeNull();
    expect(canonicalDecimal('1e99999')).toBeNull();
  });
  it('0,5 è esatto; 0,1 no; 1e3 è esatto', () => {
    expect(isExactMatch('0,5', decodeFloat(encodeFloat(0.5, 'f64'), 'f64').exact)).toBe(true);
    expect(isExactMatch('0.1', decodeFloat(encodeFloat(0.1, 'f64'), 'f64').exact)).toBe(false);
    expect(isExactMatch('1e3', decodeFloat(encodeFloat(1000, 'f32'), 'f32').exact)).toBe(true);
    expect(isExactMatch('16777217', decodeFloat(encodeFloat(16777217, 'f32'), 'f32').exact)).toBe(false);
  });
});
