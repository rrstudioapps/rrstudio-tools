// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { MAX_INT, convertNumber, integerToWords, parseNumber } from './numeri';

const w = (n: number | bigint, joined = false) => integerToWords(BigInt(n), { joined });

describe('numeri base', () => {
  it('da zero a diciannove', () => {
    expect([0, 1, 2, 3, 10, 11, 16, 17, 19].map((n) => w(n))).toEqual([
      'zero', 'uno', 'due', 'tre', 'dieci', 'undici', 'sedici', 'diciassette', 'diciannove',
    ]);
  });
  it('decine', () => {
    expect([20, 30, 40, 50, 60, 70, 80, 90].map((n) => w(n))).toEqual([
      'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta',
    ]);
  });
});

describe('elisioni delle decine (uno e otto)', () => {
  it('ventuno, ventotto, trentuno, trentotto, novantuno, novantotto', () => {
    expect([21, 28, 31, 38, 41, 48, 91, 98].map((n) => w(n))).toEqual([
      'ventuno', 'ventotto', 'trentuno', 'trentotto', 'quarantuno', 'quarantotto', 'novantuno', 'novantotto',
    ]);
  });
  it('le altre unità non elidono', () => {
    expect([22, 25, 27, 29, 66, 77].map((n) => w(n))).toEqual([
      'ventidue', 'venticinque', 'ventisette', 'ventinove', 'sessantasei', 'settantasette',
    ]);
  });
});

describe('accento su tré', () => {
  it('ventitré, trentatré, centotré; tre da solo senza accento', () => {
    expect(w(3)).toBe('tre');
    expect(w(23)).toBe('ventitré');
    expect(w(33)).toBe('trentatré');
    expect(w(103)).toBe('centotré');
    expect(w(13)).toBe('tredici');
  });
  it('nessun accento se "tre" non è in fondo: ventitremila', () => {
    expect(w(23_000)).toBe('ventitremila');
    expect(w(3_000)).toBe('tremila');
    expect(w(1_003)).toBe('milletré');
    expect(w(2_000_003)).toBe('due milioni tre');
    expect(w(23_000_000)).toBe('ventitré milioni');
    expect(w(2_000_023)).toBe('due milioni ventitré');
  });
});

describe('centinaia', () => {
  it('cento, duecento…', () => {
    expect([100, 200, 300, 500, 900].map((n) => w(n))).toEqual(['cento', 'duecento', 'trecento', 'cinquecento', 'novecento']);
  });
  it('cento non elide davanti a uno', () => {
    expect(w(101)).toBe('centouno');
    expect(w(121)).toBe('centoventuno');
    expect(w(201)).toBe('duecentouno');
  });
  it('cento perde la o davanti a otto e ottanta: centottanta, centotto', () => {
    expect(w(180)).toBe('centottanta');
    expect(w(108)).toBe('centotto');
    expect(w(188)).toBe('centottantotto');
    expect(w(181)).toBe('centottantuno');
    expect(w(280)).toBe('duecentottanta');
    expect(w(808)).toBe('ottocentotto');
    expect(w(988)).toBe('novecentottantotto');
  });
  it('senza elisione davanti ad altre cifre', () => {
    expect(w(170)).toBe('centosettanta');
    expect(w(190)).toBe('centonovanta');
    expect(w(118)).toBe('centodiciotto');
  });
});

describe('migliaia', () => {
  it('mille, milleuno, millecento, duemila', () => {
    expect(w(1000)).toBe('mille');
    expect(w(1001)).toBe('milleuno');
    expect(w(1100)).toBe('millecento');
    expect(w(1234)).toBe('milleduecentotrentaquattro');
    expect(w(2000)).toBe('duemila');
    expect(w(2001)).toBe('duemilauno');
    expect(w(10_000)).toBe('diecimila');
    expect(w(11_000)).toBe('undicimila');
  });
  it('ventunomila, centomila, centounomila', () => {
    expect(w(21_000)).toBe('ventunomila');
    expect(w(100_000)).toBe('centomila');
    expect(w(101_000)).toBe('centounomila');
    expect(w(999_999)).toBe('novecentonovantanovemilanovecentonovantanove');
    expect(w(88_000)).toBe('ottantottomila');
    expect(w(180_000)).toBe('centottantamila');
  });
  it('mille non si dice "unmila"', () => {
    expect(w(1000)).not.toContain('unmila');
    expect(w(1_000_000 + 1000)).toBe('un milione mille');
  });
});

describe('milioni e miliardi', () => {
  it('un milione / due milioni', () => {
    expect(w(1_000_000)).toBe('un milione');
    expect(w(2_000_000)).toBe('due milioni');
    expect(w(21_000_000)).toBe('ventuno milioni');
    expect(w(1_000_001)).toBe('un milione uno');
    expect(w(1_250_000)).toBe('un milione duecentocinquantamila');
    expect(w(123_456_789)).toBe('centoventitré milioni quattrocentocinquantaseimilasettecentottantanove');
  });
  it('un miliardo / due miliardi', () => {
    expect(w(1_000_000_000)).toBe('un miliardo');
    expect(w(2_000_000_000)).toBe('due miliardi');
    expect(w(1_000_000_001)).toBe('un miliardo uno');
    expect(w(3_500_000_000)).toBe('tre miliardi cinquecento milioni');
    expect(w(999_999_999_999)).toBe(
      'novecentonovantanove miliardi novecentonovantanove milioni novecentonovantanovemilanovecentonovantanove',
    );
  });
  it('modalità attaccata: unmilione, duemilioni…', () => {
    expect(w(1_000_000, true)).toBe('unmilione');
    expect(w(2_000_000, true)).toBe('duemilioni');
    expect(w(1_250_000, true)).toBe('unmilioneduecentocinquantamila');
    expect(w(3_000_000_000, true)).toBe('tremiliardi');
    expect(w(1_000_000_000, true)).toBe('unmiliardo');
    expect(w(23_000_000, true)).toBe('ventitremilioni');
  });
  it('fuori intervallo', () => {
    expect(() => integerToWords(MAX_INT + 1n)).toThrow(RangeError);
    expect(() => integerToWords(-1n)).toThrow(RangeError);
  });
});

describe('lettura del numero', () => {
  const ok = (s: string) => {
    const r = parseNumber(s);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  it('formati italiani e internazionali', () => {
    expect(ok('1.234,56')).toEqual({ negative: false, int: 1234n, frac: '56' });
    expect(ok('1234,5')).toEqual({ negative: false, int: 1234n, frac: '5' });
    expect(ok('1234.56')).toEqual({ negative: false, int: 1234n, frac: '56' });
    expect(ok('1,234.56')).toEqual({ negative: false, int: 1234n, frac: '56' });
    expect(ok('1.234')).toEqual({ negative: false, int: 1234n, frac: '' });
    expect(ok('1.234.567')).toEqual({ negative: false, int: 1234567n, frac: '' });
    expect(ok('-12,5')).toEqual({ negative: true, int: 12n, frac: '5' });
    expect(ok('−7')).toEqual({ negative: true, int: 7n, frac: '' });
    expect(ok(' € 10 ')).toEqual({ negative: false, int: 10n, frac: '' });
    expect(ok(',5')).toEqual({ negative: false, int: 0n, frac: '5' });
  });
  it('errori', () => {
    expect(parseNumber('')).toEqual({ ok: false, error: 'empty' });
    expect(parseNumber('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumber('1,2,3')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumber('1.2.3')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumber('-')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumber('1.234.56,7')).toEqual({ ok: false, error: 'invalid' });
    expect(parseNumber('1000000000000')).toEqual({ ok: false, error: 'range' });
  });
});

describe('modalità testo', () => {
  const t = (s: string, o = {}) => {
    const r = convertNumber(s, { mode: 'text', ...o });
    if (!r.ok) throw new Error(r.error);
    return r.text;
  };
  it('interi e negativi', () => {
    expect(t('0')).toBe('zero');
    expect(t('-3')).toBe('meno tre');
    expect(t('-0')).toBe('zero');
    expect(t('1.001')).toBe('milleuno');
  });
  it('decimali: virgola e parte decimale letta come numero', () => {
    expect(t('3,14')).toBe('tre virgola quattordici');
    expect(t('12,5')).toBe('dodici virgola cinque');
    expect(t('0,05')).toBe('zero virgola zero cinque');
    expect(t('0,007')).toBe('zero virgola zero zero sette');
    expect(t('-0,5')).toBe('meno zero virgola cinque');
    expect(t('2,0')).toBe('due virgola zero');
  });
  it('decimali molto lunghi: cifra per cifra', () => {
    expect(t('1,1234567890')).toBe('uno virgola uno due tre quattro cinque sei sette otto nove zero');
  });
  it('maiuscole', () => {
    expect(t('21', { letterCase: 'upper' })).toBe('VENTUNO');
    expect(t('21', { letterCase: 'capitalize' })).toBe('Ventuno');
  });
});

describe('modalità assegno', () => {
  const c = (s: string, o = {}) => {
    const r = convertNumber(s, { mode: 'cheque', ...o });
    return r.ok ? r.text : r.error;
  };
  it('importi con centesimi /xx', () => {
    expect(c('1.234,56')).toBe('milleduecentotrentaquattro/56');
    expect(c('1234,5')).toBe('milleduecentotrentaquattro/50');
    expect(c('100')).toBe('cento/00');
    expect(c('0,50')).toBe('zero/50');
    expect(c('21,08')).toBe('ventuno/08');
    expect(c('1.000.000,01')).toBe('un milione/01');
  });
  it('con "euro" davanti', () => {
    expect(c('180,00', { euro: true })).toBe('euro centottanta/00');
    expect(c('180,00', { euro: true, letterCase: 'capitalize' })).toBe('Euro centottanta/00');
  });
  it('oltre due decimali arrotonda al centesimo, con riporto', () => {
    expect(c('1,234')).toBe('uno/23');
    expect(c('1,235')).toBe('uno/24');
    expect(c('1,999')).toBe('due/00');
    expect(c('0,999')).toBe('uno/00');
  });
  it('un assegno negativo non ha senso', () => {
    expect(c('-5')).toBe('negativeCheque');
    expect(c('-0,00')).toBe('zero/00');
  });
  it('errori di input e di intervallo', () => {
    expect(c('')).toBe('empty');
    expect(c('x')).toBe('invalid');
    expect(c('999999999999,999')).toBe('range');
  });
});
