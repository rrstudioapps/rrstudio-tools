// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  MAX_ANALYZED_LENGTH,
  analyze,
  charsetSize,
  crackTimesFromGuesses,
  describeDuration,
  feedbackKey,
  naiveEntropy,
  truncatePassword,
} from './strength';

describe('charsetSize e naiveEntropy', () => {
  it('conta gli alfabeti usati', () => {
    expect(charsetSize('abc')).toBe(26);
    expect(charsetSize('abcD')).toBe(52);
    expect(charsetSize('abcD1')).toBe(62);
    expect(charsetSize('abcD1!')).toBe(95);
    expect(charsetSize('àèì')).toBe(100);
    expect(charsetSize('')).toBe(0);
  });
  it('calcola l\'entropia teorica', () => {
    expect(naiveEntropy('')).toBe(0);
    expect(naiveEntropy('abcd')).toBeCloseTo(4 * Math.log2(26), 6);
    // i caratteri fuori dal piano base contano come uno solo
    expect(naiveEntropy('a😀')).toBeCloseTo(2 * Math.log2(126), 6);
  });
});

describe('describeDuration', () => {
  it('sotto il secondo è istantaneo', () => {
    expect(describeDuration(0)).toEqual({ kind: 'instant' });
    expect(describeDuration(0.4)).toEqual({ kind: 'instant' });
  });
  it('sceglie l\'unità più adatta', () => {
    expect(describeDuration(1)).toEqual({ kind: 'unit', unit: 'second', n: 1 });
    expect(describeDuration(59.9)).toEqual({ kind: 'unit', unit: 'second', n: 59 });
    expect(describeDuration(60)).toEqual({ kind: 'unit', unit: 'minute', n: 1 });
    expect(describeDuration(3600 * 5)).toEqual({ kind: 'unit', unit: 'hour', n: 5 });
    expect(describeDuration(86400 * 3)).toEqual({ kind: 'unit', unit: 'day', n: 3 });
    expect(describeDuration(86400 * 90)).toEqual({ kind: 'unit', unit: 'month', n: 2 });
    expect(describeDuration(86400 * 365 * 7)).toEqual({ kind: 'unit', unit: 'year', n: 7 });
  });
  it('oltre un secolo (o infinito) sono secoli', () => {
    expect(describeDuration(86400 * 365 * 100)).toEqual({ kind: 'centuries' });
    expect(describeDuration(Infinity)).toEqual({ kind: 'centuries' });
    expect(describeDuration(NaN)).toEqual({ kind: 'centuries' });
  });
});

describe('crackTimesFromGuesses', () => {
  it('usa le velocità dei quattro scenari', () => {
    const t = crackTimesFromGuesses(1e6);
    expect(t.throttled).toBeCloseTo(1e6 * 36, 3);
    expect(t.online).toBeCloseTo(1e5, 6);
    expect(t.offlineSlow).toBeCloseTo(100, 6);
    expect(t.offlineFast).toBeCloseTo(1e-4, 10);
  });
});

describe('truncatePassword e feedbackKey', () => {
  it('tronca oltre il limite', () => {
    const long = 'a'.repeat(MAX_ANALYZED_LENGTH + 10);
    const r = truncatePassword(long);
    expect(r.truncated).toBe(true);
    expect([...r.value].length).toBe(MAX_ANALYZED_LENGTH);
    expect(truncatePassword('corta')).toEqual({ value: 'corta', truncated: false });
  });
  it('estrae la chiave dal testo grezzo della libreria', () => {
    expect(feedbackKey('warnings.straightRow')).toBe('straightRow');
    expect(feedbackKey('anotherWord')).toBe('anotherWord');
    expect(feedbackKey(null)).toBeNull();
    expect(feedbackKey('')).toBeNull();
  });
});

describe('analyze (zxcvbn-ts con dizionari common, en, it)', () => {
  it('avvisi e suggerimenti sono chiavi (non testo): le traduce la pagina', async () => {
    const r = (await analyze('password'))!;
    expect(r.warning).toBe('topTen');
    expect(r.suggestions).toContain('anotherWord');
    expect((await analyze('aaaaaaaa'))!.warning).toBe('simpleRepeat');
    expect((await analyze('abcdefgh'))!.warning).toBe('sequences');
    expect((await analyze('p@ssw0rd'))!.suggestions).toContain('l33t');
  });
  it('una password vuota non si analizza', async () => {
    expect(await analyze('')).toBeNull();
  });
  it('password comuni: punteggio 0 o 1 e avviso', async () => {
    const r = (await analyze('password'))!;
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.warning).not.toBeNull();
    expect(r.patterns.some((p) => p.kind === 'dictionary')).toBe(true);
  });
  it('riconosce anche le parole italiane', async () => {
    const parola = (await analyze('mario'))!;
    const rnd = (await analyze('qzxkv'))!;
    expect(parola.guesses).toBeLessThan(rnd.guesses);
    expect(parola.patterns[0].kind).toBe('dictionary');
  });
  it('schemi da tastiera e ripetizioni abbassano il punteggio', async () => {
    expect((await analyze('qwertyuiop'))!.score).toBeLessThanOrEqual(1);
    expect((await analyze('aaaaaaaaaa'))!.score).toBeLessThanOrEqual(1);
    expect((await analyze('12345678'))!.score).toBe(0);
  });
  it('una frase lunga e casuale ha punteggio 4 e molti bit', async () => {
    const r = (await analyze('x7#Qm9!vTz2$Lk8&Wp4'))!;
    expect(r.score).toBe(4);
    expect(r.bits).toBeGreaterThan(60);
    expect(r.crackTimes.offlineFast).toBeGreaterThan(r.crackTimes.offlineSlow / 1e6 - 1);
    expect(r.crackTimes.throttled).toBeGreaterThan(r.crackTimes.online);
    expect(r.length).toBe(19);
    expect(r.truncated).toBe(false);
  });
  it('password lunghissime vengono troncate e segnalate', async () => {
    const r = (await analyze('Ab3$'.repeat(200)))!;
    expect(r.truncated).toBe(true);
    expect(r.length).toBe(MAX_ANALYZED_LENGTH);
  });
  it('il punteggio resta nell\'intervallo 0-4', async () => {
    for (const pw of ['a', '1', 'Zebra-Tavolo-Nuvola-Ponte-47!', 'ñandú🙂']) {
      const r = (await analyze(pw))!;
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(4);
      expect(Number.isFinite(r.bits)).toBe(true);
    }
  });
});
