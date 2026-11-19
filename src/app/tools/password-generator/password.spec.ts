// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS,
  DIGITS,
  LOWER,
  PasswordOptions,
  SYMBOLS,
  UPPER,
  activeSets,
  crackSeconds,
  describeDuration,
  generatePassphrase,
  generatePassword,
  log2BigInt,
  passphraseEntropy,
  passwordEntropy,
  strengthOf,
} from './password';
import { RandomSource, randomInt } from './random';

/** Generatore deterministico (xorshift32) per test ripetibili. */
function seeded(seed: number): RandomSource {
  let s = seed >>> 0 || 1;
  return (buf) => {
    for (let i = 0; i < buf.length; i++) {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      buf[i] = s;
    }
  };
}

/** Chi quadro di conformità a una distribuzione uniforme su k classi. */
function chiSquare(counts: number[], total: number): number {
  const expected = total / counts.length;
  return counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
}

const ALL: PasswordOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true, noAmbiguous: false };

describe('randomInt', () => {
  it('scarta i valori nel blocco incompleto (rejection sampling)', () => {
    // max=3: limite = 2^32 - 1 = 4294967295, quindi 0xFFFFFFFF va scartato
    const seq = [0xffffffff, 0xffffffff, 7];
    let i = 0;
    const src: RandomSource = (b) => {
      b[0] = seq[i++];
    };
    expect(randomInt(3, src)).toBe(1); // 7 % 3
    expect(i).toBe(3);
  });

  it('non ha bias su molti campioni (sorgente deterministica)', () => {
    for (const max of [3, 6, 10, 94]) {
      const counts = new Array<number>(max).fill(0);
      const src = seeded(12345);
      const n = 200_000;
      for (let i = 0; i < n; i++) counts[randomInt(max, src)]++;
      // soglia molto larga (p < 1e-6 circa): df+8*sqrt(2df)
      expect(chiSquare(counts, n)).toBeLessThan(max - 1 + 8 * Math.sqrt(2 * (max - 1)));
    }
  });

  it('con un max grande il rejection sampling evita il bias del modulo', () => {
    // max = 2^31+1: con il modulo diretto i resti bassi uscirebbero ~2 volte più spesso
    const max = 2 ** 31 + 1;
    const src = seeded(99);
    const n = 100_000;
    let low = 0;
    for (let i = 0; i < n; i++) if (randomInt(max, src) < max / 2) low++;
    expect(Math.abs(low / n - 0.5)).toBeLessThan(0.01);
  });

  it('con crypto.getRandomValues copre tutti i valori in modo uniforme', () => {
    const counts = new Array<number>(8).fill(0);
    const n = 40_000;
    for (let i = 0; i < n; i++) counts[randomInt(8)]++;
    expect(chiSquare(counts, n)).toBeLessThan(7 + 8 * Math.sqrt(14));
  });

  it('rifiuta max non validi', () => {
    expect(() => randomInt(0)).toThrow();
    expect(() => randomInt(1.5)).toThrow();
    expect(randomInt(1)).toBe(0);
  });
});

describe('generatePassword', () => {
  it('rispetta la lunghezza (4-128) e l\'alfabeto', () => {
    for (const length of [4, 5, 20, 64, 128]) {
      const p = generatePassword({ ...ALL, length }).text;
      expect(p).toHaveLength(length);
      for (const c of p) expect(LOWER + UPPER + DIGITS + SYMBOLS).toContain(c);
    }
  });

  it('garantisce almeno un carattere per ogni set scelto, anche alla lunghezza minima', () => {
    for (let i = 0; i < 400; i++) {
      const p = generatePassword({ ...ALL, length: 4 }, seeded(i + 1)).text;
      expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)).toBe(true);
      expect([...p].some((c) => SYMBOLS.includes(c))).toBe(true);
    }
  });

  it('usa solo i set attivi', () => {
    const p = generatePassword({ ...ALL, length: 50, upper: false, symbols: false }).text;
    expect(p).toMatch(/^[a-z0-9]+$/);
    expect(p).toMatch(/[a-z]/);
    expect(p).toMatch(/[0-9]/);
    const onlyDigits = generatePassword({ ...ALL, lower: false, upper: false, symbols: false }).text;
    expect(onlyDigits).toMatch(/^[0-9]{20}$/);
  });

  it('esclude i caratteri ambigui', () => {
    for (let i = 0; i < 100; i++) {
      const p = generatePassword({ ...ALL, length: 100, noAmbiguous: true }).text;
      for (const c of AMBIGUOUS) expect(p).not.toContain(c);
    }
    for (const s of activeSets({ ...ALL, noAmbiguous: true })) expect(s.length).toBeGreaterThan(0);
  });

  it('dentro ogni set i caratteri sono equiprobabili', () => {
    // il vincolo "almeno uno per set" sposta le frequenze tra set, non dentro lo stesso set
    const o: PasswordOptions = { ...ALL, length: 10, symbols: false, upper: false };
    const src = seeded(2024);
    const freq = new Map<string, number>([...(LOWER + DIGITS)].map((c) => [c, 0]));
    for (let i = 0; i < 30_000; i++) {
      for (const c of generatePassword(o, src).text) freq.set(c, freq.get(c)! + 1);
    }
    for (const set of [LOWER, DIGITS]) {
      const counts = [...set].map((c) => freq.get(c)!);
      const df = set.length - 1;
      expect(chiSquare(counts, counts.reduce((a, b) => a + b, 0))).toBeLessThan(df + 8 * Math.sqrt(2 * df));
    }
  });

  it('rifiuta configurazioni impossibili', () => {
    expect(() => generatePassword({ ...ALL, lower: false, upper: false, digits: false, symbols: false })).toThrow();
  });
});

describe('entropia', () => {
  it('senza vincoli di set coincide con L * log2(pool)', () => {
    const o: PasswordOptions = { ...ALL, length: 20, upper: false, digits: false, symbols: false };
    expect(passwordEntropy(o)).toBeCloseTo(20 * Math.log2(26), 6);
  });

  it('con più set è poco sotto L * log2(pool) e non supera mai quel valore', () => {
    const bits = passwordEntropy({ ...ALL, length: 20 });
    const naive = 20 * Math.log2(LOWER.length + UPPER.length + DIGITS.length + SYMBOLS.length);
    expect(bits).toBeLessThanOrEqual(naive);
    expect(bits).toBeGreaterThan(naive - 1);
  });

  it('conta esattamente le password valide (verifica per enumerazione)', () => {
    // pool minuscolo (26) + cifre (10) con lunghezza 4 non è enumerabile: si usa un caso calcolabile a mano
    // lunghezza 4, 2 set da 26 e 10: valide = 36^4 - 26^4 - 10^4 = 1679616 - 456976 - 10000
    const o: PasswordOptions = { length: 4, lower: true, upper: false, digits: true, symbols: false, noAmbiguous: false };
    expect(passwordEntropy(o)).toBeCloseTo(Math.log2(1_679_616 - 456_976 - 10_000), 9);
  });

  it('log2BigInt è accurato sui grandi numeri', () => {
    expect(log2BigInt(1n << 200n)).toBeCloseTo(200, 9);
    expect(log2BigInt(1000n)).toBeCloseTo(Math.log2(1000), 9);
  });

  it('passphrase: parole * log2(lista) più il numero opzionale', () => {
    expect(passphraseEntropy({ words: 5, separator: '-', capitalize: false, withNumber: false }, 7776)).toBeCloseTo(64.62, 2);
    expect(passphraseEntropy({ words: 6, separator: '-', capitalize: true, withNumber: true }, 7776)).toBeCloseTo(
      6 * Math.log2(7776) + Math.log2(100),
      9,
    );
  });

  it('etichette di robustezza alle soglie 50 / 80 / 110', () => {
    expect(strengthOf(49.9)).toBe('weak');
    expect(strengthOf(50)).toBe('fair');
    expect(strengthOf(79.9)).toBe('fair');
    expect(strengthOf(80)).toBe('strong');
    expect(strengthOf(109.9)).toBe('strong');
    expect(strengthOf(110)).toBe('veryStrong');
  });

  it('stima del tempo a 10^10 tentativi/s (media: metà dello spazio)', () => {
    expect(crackSeconds(1)).toBeCloseTo(1e-10, 20);
    expect(describeDuration(crackSeconds(30)).unit).toBe('instant');
    expect(describeDuration(crackSeconds(50))).toEqual({ unit: 'hour', value: 16 }); // 2^49/1e10 s ~ 15,6 ore
    expect(describeDuration(crackSeconds(70)).unit).toBe('year');
    expect(describeDuration(crackSeconds(128)).unit).toBe('overTrillion');
    expect(describeDuration(90)).toEqual({ unit: 'minute', value: 2 });
  });
});

describe('generatePassphrase', () => {
  const list = readFileSync('public/wordlists/eff-large.txt', 'utf8').trim().split('\n');

  it('la lista EFF ha 7776 parole uniche', () => {
    expect(list).toHaveLength(7776);
    expect(new Set(list).size).toBe(7776);
  });

  it('numero di parole, separatore, maiuscole e numero', () => {
    const base = { words: 5, separator: '-' as const, capitalize: false, withNumber: false };
    expect(generatePassphrase(base, list).text.split('-')).toHaveLength(5);
    expect(generatePassphrase({ ...base, words: 12, separator: ' ' }, list).text.split(' ')).toHaveLength(12);
    const dot = generatePassphrase({ ...base, separator: '.', capitalize: true }, list).text;
    for (const w of dot.split('.')) expect(w).toMatch(/^[A-Z]/);
    const num = generatePassphrase({ ...base, separator: '_', withNumber: true }, list).text.split('_');
    expect(num).toHaveLength(6);
    expect(num[5]).toMatch(/^\d{1,2}$/);
    // senza separatore e senza numero: solo lettere minuscole (e i pochi trattini della lista)
    expect(generatePassphrase({ ...base, separator: '' }, list).text).toMatch(/^[a-z-]+$/);
  });

  it('sceglie le parole in modo uniforme', () => {
    const small = ['a', 'b', 'c', 'd', 'e'];
    const src = seeded(7);
    const counts = new Map(small.map((w) => [w, 0]));
    for (let i = 0; i < 20_000; i++) {
      for (const w of generatePassphrase({ words: 3, separator: ' ', capitalize: false, withNumber: false }, small, src).text.split(' ')) {
        counts.set(w, counts.get(w)! + 1);
      }
    }
    expect(chiSquare([...counts.values()], 60_000)).toBeLessThan(4 + 8 * Math.sqrt(8));
  });
});
