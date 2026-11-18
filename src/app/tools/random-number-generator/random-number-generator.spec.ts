// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  cryptoU32, flipCoins, formatDice, parseDice, parseList, pickFromList, randomInt, randomNumbers, rollDice, shuffle, splitTeams, type NumberSpec, type U32,
} from './random-number-generator';

/** Sorgente ripetibile (mulberry32) per test deterministici. */
function seeded(seed: number): U32 {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
}

const spec = (o: Partial<NumberSpec> = {}): NumberSpec => ({ min: 1, max: 10, count: 5, unique: false, decimals: 0, sorted: false, ...o });

describe('randomInt', () => {
  it('resta nell’intervallo e li raggiunge entrambi', () => {
    const u = seeded(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = randomInt(1, 6, u);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('scarta i valori che distorcerebbero la distribuzione', () => {
    // range 3 su 2^32: i valori ≥ 4294967295 vanno scartati (il limite è 2^32 − 1)
    const seq = [4294967295, 4294967294];
    expect(randomInt(0, 2, () => seq.shift()!)).toBe(4294967294 % 3);
  });
  it('intervalli enormi e negativi', () => {
    const v = randomInt(-(2 ** 40), 2 ** 40, seeded(7));
    expect(Math.abs(v)).toBeLessThanOrEqual(2 ** 40);
    expect(randomInt(5, 5, seeded(1))).toBe(5);
    expect(randomInt(-3, -3, seeded(1))).toBe(-3);
  });
  it('la sorgente reale produce numeri', () => {
    expect(Number.isInteger(cryptoU32())).toBe(true);
  });
});

describe('randomNumbers', () => {
  it('quantità, intervallo e ordinamento', () => {
    const r = randomNumbers(spec({ count: 50, sorted: true }), seeded(3));
    expect(r.ok && r.values.length).toBe(50);
    if (r.ok) {
      expect(r.values.every((v) => v >= 1 && v <= 10)).toBe(true);
      expect([...r.values].sort((a, b) => a - b)).toEqual(r.values);
    }
  });
  it('senza ripetizioni: tutti diversi, e con count = ampiezza esce una permutazione', () => {
    const r = randomNumbers(spec({ min: 1, max: 20, count: 20, unique: true }), seeded(5));
    expect(r.ok && [...r.values].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it('senza ripetizioni su un intervallo enorme', () => {
    const r = randomNumbers(spec({ min: 1, max: 1e12, count: 100, unique: true }), seeded(9));
    expect(r.ok && new Set(r.values).size).toBe(100);
  });
  it('decimali: rispetta il passo e i limiti', () => {
    const r = randomNumbers(spec({ min: 0, max: 1, count: 200, decimals: 2 }), seeded(11));
    expect(r.ok && r.values.every((v) => v >= 0 && v <= 1 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9)).toBe(true);
  });
  it('errori', () => {
    expect(randomNumbers(spec({ min: 5, max: 1 }))).toEqual({ ok: false, error: 'range' });
    expect(randomNumbers(spec({ count: 0 }))).toEqual({ ok: false, error: 'count' });
    expect(randomNumbers(spec({ count: 1001 }))).toEqual({ ok: false, error: 'tooMany' });
    expect(randomNumbers(spec({ min: 1, max: 3, count: 4, unique: true }))).toEqual({ ok: false, error: 'unique' });
    expect(randomNumbers(spec({ min: 0.2, max: 0.8 }))).toEqual({ ok: false, error: 'range' }); // nessun intero dentro
    expect(randomNumbers(spec({ min: NaN }))).toEqual({ ok: false, error: 'range' });
    expect(randomNumbers(spec({ min: 0, max: 1e300 }))).toEqual({ ok: false, error: 'tooBig' });
  });
});

describe('dadi', () => {
  it('notazione', () => {
    expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, mod: 3 });
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, mod: 0 });
    expect(parseDice(' 4D8 - 1 ')).toEqual({ count: 4, sides: 8, mod: -1 });
    for (const bad of ['', '2d', 'd1', '0d6', '101d6', 'd1001', '2d6+', 'abc', '2x6']) expect(parseDice(bad), bad).toBeNull();
  });
  it('formatDice è l’inverso', () => {
    expect(formatDice({ count: 2, sides: 6, mod: 3 })).toBe('2d6+3');
    expect(formatDice({ count: 1, sides: 20, mod: -2 })).toBe('1d20-2');
    expect(formatDice({ count: 3, sides: 4, mod: 0 })).toBe('3d4');
  });
  it('tiro: facce valide e totale con modificatore', () => {
    const r = rollDice({ count: 10, sides: 6, mod: 5 }, seeded(2));
    expect(r.rolls.length).toBe(10);
    expect(r.rolls.every((x) => x >= 1 && x <= 6)).toBe(true);
    expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0) + 5);
  });
});

describe('elenchi', () => {
  it('parseList: una voce per riga, oppure separata da virgole se su una riga', () => {
    expect(parseList('Anna\n Luca \n\nMarta\n')).toEqual(['Anna', 'Luca', 'Marta']);
    expect(parseList('Anna, Luca; Marta')).toEqual(['Anna', 'Luca', 'Marta']);
    expect(parseList('Rossi, Mario\nBianchi, Anna')).toEqual(['Rossi, Mario', 'Bianchi, Anna']);
    expect(parseList('  \n ')).toEqual([]);
  });
  it('shuffle: stessi elementi, originale intatto', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = shuffle(a, seeded(4));
    expect([...s].sort()).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('pickFromList: senza ripetizioni, al massimo quanti sono; con ripetizioni anche di più', () => {
    const items = ['a', 'b', 'c'];
    expect(new Set(pickFromList(items, 3, true, seeded(1))).size).toBe(3);
    expect(pickFromList(items, 10, true, seeded(1)).length).toBe(3);
    expect(pickFromList(items, 10, false, seeded(1)).length).toBe(10);
    expect(pickFromList([], 3, true)).toEqual([]);
  });
  it('splitTeams: dimensioni equilibrate e nessuno perso', () => {
    const t = splitTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3, seeded(6));
    expect(t.map((x) => x.length).sort()).toEqual([2, 2, 3]);
    expect(t.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

describe('moneta', () => {
  it('conteggi coerenti e distribuzione ragionevole', () => {
    const r = flipCoins(2000, seeded(8));
    expect(r.heads + r.tails).toBe(2000);
    expect(r.flips.length).toBe(2000);
    expect(r.heads).toBeGreaterThan(900);
    expect(r.heads).toBeLessThan(1100);
  });
});
