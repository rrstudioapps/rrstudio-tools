// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  NO_TIP, ROUND_STEPS, distribute, formatCents, parseConsumptionLines, parseMoney, parsePercent, splitByConsumption, splitEqual, tipCents,
  type Diner, type Tip,
} from './split-bill';

/** Generatore pseudo-casuale con seme (mulberry32): le prove sono ripetibili. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('parseMoney / parsePercent', () => {
  it('virgola e punto, simbolo euro, migliaia', () => {
    expect(parseMoney('12,50', 'it')).toBe(1250);
    expect(parseMoney('12.50', 'it')).toBe(1250);
    expect(parseMoney('12.50', 'en')).toBe(1250);
    expect(parseMoney('1.234,56 €', 'it')).toBe(123456);
    expect(parseMoney('€ 7', 'it')).toBe(700);
    expect(parseMoney('0,1', 'it')).toBe(10);
  });
  it('arrotonda al centesimo senza errori di virgola mobile', () => {
    expect(parseMoney('1,005', 'it')).toBe(101);
    expect(parseMoney('0,29', 'it')).toBe(29);
    expect(parseMoney('19,99', 'it')).toBe(1999);
  });
  it('rifiuta testo, negativi e importi enormi', () => {
    for (const t of ['', 'abc', '-5', '12,5,5', '99999999999']) expect(parseMoney(t, 'it'), t).toBeNull();
  });
  it('percentuale tra 0 e 100', () => {
    expect(parsePercent('10', 'it')).toBe(1000);
    expect(parsePercent('7,5 %', 'it')).toBe(750);
    expect(parsePercent('101', 'it')).toBeNull();
    expect(parsePercent('-1', 'it')).toBeNull();
    expect(parsePercent('', 'it')).toBeNull();
  });
});

describe('distribute', () => {
  it('10,00 in 3: 3,34 + 3,33 + 3,33, il resto al primo', () => {
    expect(distribute(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });
  it('resto più grande, parità risolta dall\'ordine', () => {
    expect(distribute(10, [1, 1, 1, 1, 1, 1, 1])).toEqual([2, 2, 2, 1, 1, 1, 1]);
    // 100 su pesi 1:2 -> 33,33 e 66,67: il resto va al secondo
    expect(distribute(100, [1, 2])).toEqual([33, 67]);
  });
  it('pesi tutti nulli: parti uguali; totale 0; nessuna persona', () => {
    expect(distribute(5, [0, 0])).toEqual([3, 2]);
    expect(distribute(0, [3, 4])).toEqual([0, 0]);
    expect(distribute(5, [])).toEqual([]);
  });
  it('è deterministica', () => {
    expect(distribute(777, [5, 9, 1])).toEqual(distribute(777, [5, 9, 1]));
  });
});

describe('splitEqual', () => {
  const base = { people: 3, tip: NO_TIP, step: 1 as const };
  it('10,00 € in 3 al centesimo: 3,34 a testa, 0,02 in più', () => {
    expect(splitEqual({ ...base, total: 1000 })).toEqual({ tip: 0, bill: 1000, share: 334, paid: 1002, surplus: 2 });
  });
  it('divisibile: nessun avanzo', () => {
    expect(splitEqual({ ...base, total: 900 })).toMatchObject({ share: 300, surplus: 0 });
  });
  it('un solo commensale', () => {
    expect(splitEqual({ total: 1234, people: 1, tip: NO_TIP, step: 1 })).toMatchObject({ share: 1234, paid: 1234, surplus: 0 });
  });
  it('mancia in percentuale sul totale e mancia fissa', () => {
    expect(splitEqual({ total: 10000, people: 4, tip: { kind: 'percent', hundredths: 1000 }, step: 1 })).toMatchObject({ tip: 1000, bill: 11000, share: 2750, surplus: 0 });
    expect(splitEqual({ total: 10000, people: 4, tip: { kind: 'amount', cents: 500 }, step: 1 })).toMatchObject({ tip: 500, bill: 10500, share: 2625 });
  });
  it('mancia 0%', () => {
    expect(splitEqual({ total: 5000, people: 2, tip: { kind: 'percent', hundredths: 0 }, step: 1 })).toMatchObject({ tip: 0, share: 2500 });
  });
  it('arrotondamento per eccesso a 0,05, 0,10, 0,50 e 1 €', () => {
    // 10,00 in 3 = 3,333...
    expect(splitEqual({ ...base, total: 1000, step: 5 })).toMatchObject({ share: 335, paid: 1005, surplus: 5 });
    expect(splitEqual({ ...base, total: 1000, step: 10 })).toMatchObject({ share: 340, surplus: 20 });
    expect(splitEqual({ ...base, total: 1000, step: 50 })).toMatchObject({ share: 350, surplus: 50 });
    expect(splitEqual({ ...base, total: 1000, step: 100 })).toMatchObject({ share: 400, paid: 1200, surplus: 200 });
    // già multiplo: nessuna aggiunta
    expect(splitEqual({ people: 2, total: 1000, tip: NO_TIP, step: 100 })).toMatchObject({ share: 500, surplus: 0 });
  });
  it('conto a zero', () => {
    expect(splitEqual({ ...base, total: 0 })).toMatchObject({ share: 0, paid: 0, surplus: 0 });
  });
  it('numero di persone non valido', () => {
    for (const p of [0, -1, 1.5, 101]) expect(() => splitEqual({ ...base, total: 100, people: p })).toThrow(RangeError);
  });
  it('proprietà: la quota è un multiplo del passo, copre il conto e lo supera meno di un passo a testa', () => {
    const r = rng(42);
    for (let i = 0; i < 1000; i++) {
      const total = Math.floor(r() * 500_000);
      const people = 1 + Math.floor(r() * 30);
      const step = ROUND_STEPS[Math.floor(r() * ROUND_STEPS.length)];
      const tip: Tip = r() < 0.5 ? { kind: 'percent', hundredths: Math.floor(r() * 3000) } : { kind: 'amount', cents: Math.floor(r() * 5000) };
      const x = splitEqual({ total, people, tip, step });
      expect(x.share % step).toBe(0);
      expect(x.paid).toBe(x.share * people);
      expect(x.paid).toBeGreaterThanOrEqual(x.bill);
      expect(x.surplus).toBeLessThan(people * step);
      expect(x.bill).toBe(total + tipCents(tip, total));
    }
  });
});

describe('parseConsumptionLines', () => {
  it('accetta i tre formati e le righe vuote', () => {
    const { diners, errors } = parseConsumptionLines('Anna: 12,50\n\nBruno; 8.20\nCarla 15\n  Dario Rossi   9,9 €  ', 'it');
    expect(errors).toEqual([]);
    expect(diners).toEqual([
      { name: 'Anna', cents: 1250 },
      { name: 'Bruno', cents: 820 },
      { name: 'Carla', cents: 1500 },
      { name: 'Dario Rossi', cents: 990 },
    ]);
  });
  it('somma la stessa persona su più righe, senza badare alle maiuscole', () => {
    const { diners } = parseConsumptionLines('Anna: 5\nanna 7,50', 'it');
    expect(diners).toEqual([{ name: 'Anna', cents: 1250 }]);
  });
  it('segnala le righe malformate col numero di riga', () => {
    const { diners, errors } = parseConsumptionLines('Anna: 10\nBruno\nCarla: abc\n: 5\nDario: -3\nEva 4', 'it');
    expect(diners.map((d) => d.name)).toEqual(['Anna', 'Eva']);
    expect(errors).toEqual([
      { line: 2, text: 'Bruno', reason: 'format' },
      { line: 3, text: 'Carla: abc', reason: 'amount' },
      { line: 4, text: ': 5', reason: 'name' },
      { line: 5, text: 'Dario: -3', reason: 'amount' },
    ]);
  });
  it('nome troppo lungo e troppe persone', () => {
    expect(parseConsumptionLines(`${'x'.repeat(41)}: 5`, 'it').errors[0]).toMatchObject({ line: 1, reason: 'name' });
    const many = Array.from({ length: 102 }, (_, i) => `P${i}: 1`).join('\n');
    const r = parseConsumptionLines(many, 'it');
    expect(r.diners).toHaveLength(100);
    expect(r.errors.map((e) => e.line)).toEqual([101, 102]);
    expect(r.errors[0].reason).toBe('tooMany');
  });
  it('importi in inglese con il punto', () => {
    expect(parseConsumptionLines('Ann 1,234.50', 'en').diners).toEqual([{ name: 'Ann', cents: 123450 }]);
  });
  it('testo vuoto: nessuna persona e nessun errore', () => {
    expect(parseConsumptionLines('  \n \n', 'it')).toEqual({ diners: [], errors: [] });
  });
});

describe('splitByConsumption', () => {
  const diners: Diner[] = [{ name: 'Anna', cents: 2000 }, { name: 'Bruno', cents: 1000 }, { name: 'Carla', cents: 1000 }];
  it('senza costi comuni né mancia ognuno paga il suo', () => {
    const r = splitByConsumption({ diners, common: 0, tip: NO_TIP });
    expect(r.rows.map((x) => x.total)).toEqual([2000, 1000, 1000]);
    expect(r.total).toBe(4000);
    expect(r.sum).toBe(4000);
  });
  it('costi comuni in parti uguali, resto al primo; mancia in proporzione ai consumi', () => {
    const r = splitByConsumption({ diners, common: 1000, tip: { kind: 'percent', hundredths: 1000 } });
    // mancia 10% su 5000 = 500, divisa 250/125/125
    expect(r.tip).toBe(500);
    expect(r.rows.map((x) => x.common)).toEqual([334, 333, 333]);
    expect(r.rows.map((x) => x.tip)).toEqual([250, 125, 125]);
    expect(r.rows.map((x) => x.total)).toEqual([2584, 1458, 1458]);
    expect(r.sum).toBe(r.total);
    expect(r.total).toBe(5500);
  });
  it('mancia fissa che non si divide esattamente', () => {
    const r = splitByConsumption({ diners, common: 0, tip: { kind: 'amount', cents: 101 } });
    expect(r.rows.map((x) => x.tip).reduce((a, b) => a + b, 0)).toBe(101);
    expect(r.rows.map((x) => x.tip)).toEqual([51, 25, 25]);
  });
  it('un solo commensale paga tutto', () => {
    const r = splitByConsumption({ diners: [{ name: 'Solo', cents: 1234 }], common: 250, tip: { kind: 'percent', hundredths: 500 } });
    expect(r.rows[0].total).toBe(1234 + 250 + 74);
    expect(r.sum).toBe(r.total);
  });
  it('consumi tutti a zero: mancia e costi comuni in parti uguali', () => {
    const r = splitByConsumption({ diners: [{ name: 'A', cents: 0 }, { name: 'B', cents: 0 }], common: 300, tip: { kind: 'amount', cents: 101 } });
    expect(r.rows.map((x) => x.tip)).toEqual([51, 50]);
    expect(r.sum).toBe(401);
  });
  it('nessuna persona: errore', () => {
    expect(() => splitByConsumption({ diners: [], common: 0, tip: NO_TIP })).toThrow(RangeError);
  });
  it('proprietà: la somma delle quote è sempre il totale (1000 casi con seme)', () => {
    const r = rng(2026);
    for (let i = 0; i < 1000; i++) {
      const n = 1 + Math.floor(r() * 15);
      const list: Diner[] = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, cents: r() < 0.1 ? 0 : Math.floor(r() * 30_000) }));
      const common = r() < 0.3 ? 0 : Math.floor(r() * 10_000);
      const tip: Tip = r() < 0.5 ? { kind: 'percent', hundredths: Math.floor(r() * 2500) } : { kind: 'amount', cents: Math.floor(r() * 4000) };
      const x = splitByConsumption({ diners: list, common, tip });
      const consumption = list.reduce((a, d) => a + d.cents, 0);
      expect(x.sum).toBe(x.total);
      expect(x.total).toBe(consumption + common + tipCents(tip, consumption + common));
      expect(x.rows.reduce((a, row) => a + row.common, 0)).toBe(common);
      expect(x.rows.reduce((a, row) => a + row.tip, 0)).toBe(x.tip);
      const cs = x.rows.map((row) => row.common);
      expect(Math.max(...cs) - Math.min(...cs)).toBeLessThanOrEqual(1);
      for (const row of x.rows) {
        expect(Number.isInteger(row.total)).toBe(true);
        expect(row.total).toBeGreaterThanOrEqual(row.consumption);
      }
    }
  });
});

describe('formatCents', () => {
  it('euro con la lingua', () => {
    expect(formatCents(1250, 'it-IT').replace(/\s/g, ' ')).toBe('12,50 €');
    expect(formatCents(123456, 'en-GB')).toBe('€1,234.56');
  });
});
