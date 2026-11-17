// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { BANKNOTES, COINS, denominationEuro, euroToLire, formatScaled, lireToEuro, toHundredths } from './lire';

const l2e = (x: number) => formatScaled(lireToEuro(toHundredths(x)!).rounded, 2);
const e2l = (x: number) => formatScaled(euroToLire(toHundredths(x)!).rounded, 0);

describe('lire → euro', () => {
  it('1936,27 lire = 1 euro', () => expect(l2e(1936.27)).toBe('1,00'));
  it('1000 lire = 0,52 euro', () => expect(l2e(1000)).toBe('0,52'));
  it('100.000 lire = 51,65 euro', () => expect(l2e(100000)).toBe('51,65'));
  it('1.000.000 lire = 516,46 euro', () => expect(l2e(1000000)).toBe('516,46'));
  it('zero', () => expect(l2e(0)).toBe('0,00'));
  it('valore esatto a 4 decimali', () => expect(formatScaled(lireToEuro(100000n * 100n).exact, 4)).toBe('51,6457'));
  it('importi sotto il centesimo di euro', () => {
    expect(l2e(9)).toBe('0,00');
    expect(l2e(10)).toBe('0,01');
  });
});

describe('euro → lire', () => {
  it('1 euro = 1936 lire (arrotondato)', () => expect(e2l(1)).toBe('1.936'));
  it('10 euro = 19.363 lire', () => expect(e2l(10)).toBe('19.363'));
  it('0,50 euro = 968 lire', () => expect(e2l(0.5)).toBe('968'));
  it('1000 euro = 1.936.270 lire', () => expect(e2l(1000)).toBe('1.936.270'));
  it('importi grandi senza perdita di precisione', () => expect(e2l(999999999999)).toBe('1.936.269.999.998.064'));
  it('0,01 euro = 19 lire', () => expect(e2l(0.01)).toBe('19'));
  it('valore esatto con due decimali di lira', () => expect(formatScaled(euroToLire(100n).exact, 2)).toBe('1.936,27'));
});

describe('andata e ritorno', () => {
  it('euro → lire → euro torna all\'importo di partenza per importi di cent', () => {
    for (const e of [0.01, 0.5, 1, 12.34, 99.99, 1500]) {
      const lire = euroToLire(toHundredths(e)!).rounded;
      const back = lireToEuro(lire * 100n).rounded;
      expect(Math.abs(Number(back) - Math.round(e * 100))).toBeLessThanOrEqual(1);
    }
  });
});

describe('input', () => {
  it('rifiuta negativi, NaN e valori enormi', () => {
    expect(toHundredths(-1)).toBeNull();
    expect(toHundredths(NaN)).toBeNull();
    expect(toHundredths(1e13)).toBeNull();
  });
  it('converte in centesimi', () => expect(toHundredths(12.34)).toBe(1234n));
});

describe('formatScaled', () => {
  it('migliaia e decimali, in italiano e inglese', () => {
    expect(formatScaled(123456n, 2)).toBe('1.234,56');
    expect(formatScaled(123456n, 2, 'en')).toBe('1,234.56');
    expect(formatScaled(5n, 2)).toBe('0,05');
    expect(formatScaled(-5n, 2)).toBe('-0,05');
  });
});

describe('tagli', () => {
  it('valore in euro dei tagli', () => {
    expect(formatScaled(denominationEuro(1000), 2)).toBe('0,52');
    expect(formatScaled(denominationEuro(500000), 2)).toBe('258,23');
    expect(formatScaled(denominationEuro(1), 2)).toBe('0,00');
  });
  it('elenchi ordinati', () => {
    expect(BANKNOTES.map((b) => b.lire)).toEqual([...BANKNOTES.map((b) => b.lire)].sort((a, b) => a - b));
    expect(COINS.length).toBe(10);
  });
});
