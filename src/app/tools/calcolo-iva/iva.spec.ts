// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  InvoiceInput,
  addVat,
  computeInvoice,
  extractVat,
  formatMoney,
  formatPercent,
  parseMoney,
  parsePercent,
  percentOf,
  roundDiv,
  solveCompenso,
} from './iva';

/** Fattura base dei test: 1.000,00 di compenso, IVA 22%, ritenuta 20%, niente rivalsa né cassa. */
const base: InvoiceInput = {
  compenso: 100000,
  rivalsa: false,
  cassaBp: 0,
  cassaVat: true,
  vatBp: 2200,
  nature: 'N2.2',
  ritenutaBp: 2000,
  ritenutaOnCassa: false,
  bolloCharged: true,
  forfettario: false,
};

describe('arrotondamento', () => {
  it('mezzo in su al centesimo, anche per i negativi', () => {
    expect(roundDiv(5, 10)).toBe(1);
    expect(roundDiv(4, 10)).toBe(0);
    expect(roundDiv(-5, 10)).toBe(-1);
    // 0,01 € al 50%: 0,005 → 0,01 ; 0,03 € al 50%: 0,015 → 0,02
    expect(percentOf(1, 5000)).toBe(1);
    expect(percentOf(3, 5000)).toBe(2);
  });
});

describe('aggiungi IVA', () => {
  it('100,00 al 22% = 22,00 → 122,00', () => {
    expect(addVat(10000, 2200)).toEqual({ net: 10000, vat: 2200, gross: 12200 });
  });
  it('9,99 al 22%: 2,1978 → 2,20 → 12,19', () => {
    expect(addVat(999, 2200)).toEqual({ net: 999, vat: 220, gross: 1219 });
  });
  it('0,01 al 22%: 0,0022 → 0,00', () => {
    expect(addVat(1, 2200).vat).toBe(0);
  });
  it('aliquote ridotte e zero', () => {
    expect(addVat(10000, 1000).gross).toBe(11000);
    expect(addVat(10000, 500).gross).toBe(10500);
    expect(addVat(10000, 400).gross).toBe(10400);
    expect(addVat(10000, 0).gross).toBe(10000);
  });
  it('importo enorme senza errori di virgola mobile', () => {
    // 12.345.678.901,23 × 22% = 2.716.049.358,2706 → 2.716.049.358,27
    expect(addVat(1234567890123, 2200).vat).toBe(271604935827);
  });
});

describe('scorpora IVA', () => {
  it('122,00 al 22% → 100,00 + 22,00', () => {
    expect(extractVat(12200, 2200)).toEqual({ net: 10000, vat: 2200, gross: 12200 });
  });
  it('110,00 al 10% e 105,00 al 5%', () => {
    expect(extractVat(11000, 1000).net).toBe(10000);
    expect(extractVat(10500, 500).net).toBe(10000);
  });
  it('1,00 al 22%: 1/1,22 = 0,8197 → 0,82, IVA 0,18', () => {
    expect(extractVat(100, 2200)).toEqual({ net: 82, vat: 18, gross: 100 });
  });
  it('imponibile + IVA fa sempre il lordo', () => {
    for (let g = 1; g < 3000; g += 7) {
      for (const r of [2200, 1000, 500, 400, 0]) {
        const x = extractVat(g, r);
        expect(x.net + x.vat).toBe(g);
        expect(x.vat).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('notula di un professionista', () => {
  it('semplice: 1.000,00 + IVA 22% = 1.220,00; ritenuta 200,00; netto 1.020,00', () => {
    const r = computeInvoice(base);
    expect(r.vat).toBe(22000);
    expect(r.totalDocument).toBe(122000);
    expect(r.ritenuta).toBe(20000);
    expect(r.netToPay).toBe(102000);
    expect(r.bolloDue).toBe(0);
  });
  it('con rivalsa INPS 4% e cassa 4% soggetta a IVA: base IVA 1.080 → IVA 237,60; totale 1.317,60; netto 1.109,60', () => {
    const r = computeInvoice({ ...base, rivalsa: true, cassaBp: 400 });
    expect(r.rivalsa).toBe(4000);
    expect(r.cassa).toBe(4000);
    expect(r.vatBase).toBe(108000);
    expect(r.vat).toBe(23760);
    expect(r.totalDocument).toBe(131760);
    // la rivalsa INPS concorre al reddito ed è soggetta a ritenuta, il contributo della cassa no:
    // base 1.000 + 40 = 1.040, ritenuta 20% = 208,00, netto 1.317,60 − 208,00 = 1.109,60
    expect(r.ritenutaBase).toBe(104000);
    expect(r.ritenuta).toBe(20800);
    expect(r.netToPay).toBe(110960);
  });
  it('senza rivalsa INPS la ritenuta resta sul solo compenso: 20% di 1.000 = 200,00', () => {
    const r = computeInvoice({ ...base, cassaBp: 400 });
    expect(r.ritenutaBase).toBe(100000);
    expect(r.ritenuta).toBe(20000);
  });
  it('ritenuta anche sulla cassa: 20% di 1.080 = 216,00 → netto 1.101,60', () => {
    const r = computeInvoice({ ...base, rivalsa: true, cassaBp: 400, ritenutaOnCassa: true });
    expect(r.ritenuta).toBe(21600);
    expect(r.netToPay).toBe(110160);
  });
  it('cassa 4% fuori campo IVA: IVA solo su 1.000 = 220; totale 1.260; netto 1.060', () => {
    const r = computeInvoice({ ...base, cassaBp: 400, cassaVat: false });
    expect(r.vatBase).toBe(100000);
    expect(r.vat).toBe(22000);
    expect(r.totalDocument).toBe(126000);
    expect(r.netToPay).toBe(106000);
    expect(r.notes).toContain('cassaFuoriIva');
  });
  it('cassa con percentuale libera 2,5%: 25,00', () => {
    expect(computeInvoice({ ...base, cassaBp: 250 }).cassa).toBe(2500);
  });
  it('IVA 10% e 4%', () => {
    expect(computeInvoice({ ...base, vatBp: 1000 }).netToPay).toBe(100000 + 10000 - 20000);
    expect(computeInvoice({ ...base, vatBp: 400 }).vat).toBe(4000);
  });
  it('senza ritenuta (0): netto = totale', () => {
    const r = computeInvoice({ ...base, ritenutaBp: 0 });
    expect(r.ritenuta).toBe(0);
    expect(r.netToPay).toBe(r.totalDocument);
  });
});

describe('bollo da 2 euro', () => {
  const exempt: InvoiceInput = { ...base, vatBp: 0, nature: 'N4' };
  it('soglia: 77,47 no, 77,48 sì (oltre 77,47)', () => {
    expect(computeInvoice({ ...exempt, compenso: 7747 }).bolloDue).toBe(0);
    expect(computeInvoice({ ...exempt, compenso: 7748 }).bolloDue).toBe(200);
  });
  it('mai con IVA', () => {
    expect(computeInvoice({ ...base, compenso: 500000 }).bolloDue).toBe(0);
  });
  it('addebitato: entra nel totale; a carico del professionista: no', () => {
    const c = computeInvoice({ ...exempt, compenso: 10000, ritenutaBp: 0 });
    expect(c.bollo).toBe(200);
    expect(c.totalDocument).toBe(10200);
    const n = computeInvoice({ ...exempt, compenso: 10000, ritenutaBp: 0, bolloCharged: false });
    expect(n.bollo).toBe(0);
    expect(n.bolloDue).toBe(200);
    expect(n.totalDocument).toBe(10000);
  });
  it('N6.9 (inversione contabile) non è esente: niente bollo', () => {
    expect(computeInvoice({ ...exempt, nature: 'N6.9', compenso: 100000 }).bolloDue).toBe(0);
  });
  it('la soglia conta anche rivalsa e cassa: 75,00 + 4% = 78,00 → bollo', () => {
    const r = computeInvoice({ ...exempt, compenso: 7500, rivalsa: true, ritenutaBp: 0 });
    expect(r.bolloDue).toBe(200);
  });
});

describe('regime forfettario', () => {
  it('niente IVA né ritenuta; 1.000 + rivalsa 40 + bollo 2 = 1.042,00', () => {
    const r = computeInvoice({ ...base, forfettario: true, rivalsa: true });
    expect(r.vat).toBe(0);
    expect(r.ritenuta).toBe(0);
    expect(r.totalDocument).toBe(104200);
    expect(r.netToPay).toBe(104200);
    expect(r.nature).toBe('N2.2');
    expect(r.notes).toEqual(expect.arrayContaining(['forfettario', 'ritenutaForfettario', 'bollo']));
  });
  it('ignora aliquota e ritenuta impostate', () => {
    const r = computeInvoice({ ...base, forfettario: true, vatBp: 2200, ritenutaBp: 2000, compenso: 5000 });
    expect(r.vat).toBe(0);
    expect(r.netToPay).toBe(5000);
  });
});

describe('calcolo inverso: dal netto al compenso', () => {
  it('netto 1.000,00 con IVA 22% e ritenuta 20%: compenso 980,39 (IVA 215,69, ritenuta 196,08)', () => {
    // netto = compenso × (1,22 − 0,20) = 1,02 × compenso → 980,3921… → 980,39
    const r = solveCompenso(100000, { ...base })!;
    expect(r.compenso).toBe(98039);
    expect(r.invoice.vat).toBe(21569);
    expect(r.invoice.ritenuta).toBe(19608);
    expect(r.difference).toBe(0);
  });
  it('forfettario con rivalsa: netto 1.042,00 → compenso 1.000,00 (bollo incluso)', () => {
    const r = solveCompenso(104200, { ...base, forfettario: true, rivalsa: true })!;
    expect(r.compenso).toBe(100000);
    expect(r.invoice.bollo).toBe(200);
    expect(r.difference).toBe(0);
  });
  it('sotto la soglia del bollo: netto 50,00 forfettario → compenso 50,00', () => {
    const r = solveCompenso(5000, { ...base, forfettario: true })!;
    expect(r.compenso).toBe(5000);
    expect(r.invoice.bollo).toBe(0);
  });
  it('con rivalsa e cassa: il compenso trovato riproduce il netto entro un centesimo', () => {
    for (const target of [12345, 99999, 250000, 1234567]) {
      const r = solveCompenso(target, { ...base, rivalsa: true, cassaBp: 400 })!;
      expect(Math.abs(r.difference)).toBeLessThanOrEqual(1);
      expect(r.invoice.netToPay - target).toBe(r.difference);
    }
  });
  it('netto non positivo: nessun risultato', () => {
    expect(solveCompenso(0, base)).toBeNull();
  });
});

describe('numeri digitati', () => {
  it('parseMoney: formati italiani e internazionali', () => {
    expect(parseMoney('1.234,56')).toBe(123456);
    expect(parseMoney('1234,56')).toBe(123456);
    expect(parseMoney('1234.56')).toBe(123456);
    expect(parseMoney('1,234.56')).toBe(123456);
    expect(parseMoney('1.234')).toBe(123400);
    expect(parseMoney('12,5')).toBe(1250);
    expect(parseMoney('€ 10')).toBe(1000);
    expect(parseMoney('0,005')).toBe(1);
    expect(parseMoney('0,004')).toBe(0);
  });
  it('parseMoney: rifiuta valori non validi', () => {
    for (const bad of ['', 'abc', '-5', '1,2,3', '1.2.3,4,5', ',']) expect(parseMoney(bad), bad).toBeNull();
  });
  it('parsePercent', () => {
    expect(parsePercent('4')).toBe(400);
    expect(parsePercent('2,5 %')).toBe(250);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('x')).toBeNull();
  });
  it('formatMoney e formatPercent', () => {
    expect(formatMoney(123456)).toBe('1.234,56');
    expect(formatMoney(5)).toBe('0,05');
    expect(formatMoney(-100000)).toBe('-1.000,00');
    expect(formatMoney(123456789, 'en-GB')).toBe('1,234,567.89');
    expect(formatPercent(2200)).toBe('22%');
    expect(formatPercent(250)).toBe('2,5%');
  });
});
