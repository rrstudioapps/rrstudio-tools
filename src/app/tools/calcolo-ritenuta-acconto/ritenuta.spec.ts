// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { RitenutaInput, computeRitenuta, solveFromNet } from './ritenuta';

/** Prestazione occasionale: 1.000,00 €, ritenuta 20%, niente IVA, bollo addebitato. */
const occ: RitenutaInput = {
  compenso: 100000,
  ritenutaBp: 2000,
  rivalsa: false,
  cassaBp: 0,
  vatBp: 0,
  ritenutaOnRivalsa: true,
  bolloCharged: true,
};

describe('prestazione occasionale', () => {
  it('1.000 € lordi: ritenuta 200 €, bollo 2 € addebitato, netto 802 €', () => {
    const r = computeRitenuta(occ);
    expect(r.ritenuta).toBe(20000);
    expect(r.bollo).toBe(200);
    expect(r.totale).toBe(100200);
    expect(r.netto).toBe(80200);
  });
  it('bollo a carico di chi emette: non entra nel totale, resta dovuto', () => {
    const r = computeRitenuta({ ...occ, bolloCharged: false });
    expect(r.bolloDue).toBe(200);
    expect(r.bollo).toBe(0);
    expect(r.totale).toBe(100000);
    expect(r.netto).toBe(80000);
  });
  it('soglia del bollo: 77,47 € no, 77,48 € sì', () => {
    expect(computeRitenuta({ ...occ, compenso: 7747 }).bolloDue).toBe(0);
    expect(computeRitenuta({ ...occ, compenso: 7748 }).bolloDue).toBe(200);
  });
  it('senza ritenuta il netto è il totale', () => {
    const r = computeRitenuta({ ...occ, ritenutaBp: 0 });
    expect(r.ritenuta).toBe(0);
    expect(r.netto).toBe(100200);
  });
});

describe('professionista', () => {
  const pro: RitenutaInput = { ...occ, vatBp: 2200, rivalsa: true, cassaBp: 400 };
  it('1.000 € con rivalsa 4%, cassa 4% e IVA 22%', () => {
    const r = computeRitenuta(pro);
    expect(r.rivalsa).toBe(4000);
    expect(r.cassa).toBe(4000);
    expect(r.imponibile).toBe(108000);
    expect(r.vat).toBe(23760);
    expect(r.bolloDue).toBe(0);
    expect(r.totale).toBe(131760);
    // ritenuta su compenso + rivalsa (la cassa ne resta fuori): 20% di 1.040
    expect(r.ritenutaBase).toBe(104000);
    expect(r.ritenuta).toBe(20800);
    expect(r.netto).toBe(110960);
  });
  it('ritenuta solo sul compenso se la rivalsa è esclusa', () => {
    const r = computeRitenuta({ ...pro, ritenutaOnRivalsa: false });
    expect(r.ritenutaBase).toBe(100000);
    expect(r.ritenuta).toBe(20000);
  });
  it('con IVA il bollo non scatta', () => {
    expect(computeRitenuta({ ...pro, compenso: 20000 }).bolloDue).toBe(0);
  });
  it('percentuale della ritenuta modificabile (es. 11,5%)', () => {
    expect(computeRitenuta({ ...occ, ritenutaBp: 1150, bolloCharged: false }).ritenuta).toBe(11500);
  });
});

describe('arrotondamenti', () => {
  it('ritenuta al centesimo, mezzo in su', () => {
    // 33,33 € al 20% = 6,666 -> 6,67
    expect(computeRitenuta({ ...occ, compenso: 3333 }).ritenuta).toBe(667);
    // 0,07 al 20% = 0,014 -> 0,01 ; 0,08 -> 0,016 -> 0,02
    expect(computeRitenuta({ ...occ, compenso: 7 }).ritenuta).toBe(1);
    expect(computeRitenuta({ ...occ, compenso: 8 }).ritenuta).toBe(2);
  });
  it('cassa 2% su 1,25 €: 0,025 -> 0,03', () => {
    expect(computeRitenuta({ ...occ, compenso: 125, cassaBp: 200 }).cassa).toBe(3);
  });
  it('l\'IVA si calcola su compenso + rivalsa + cassa, già arrotondati', () => {
    const r = computeRitenuta({ ...occ, compenso: 33333, vatBp: 2200, rivalsa: true, cassaBp: 400 });
    // 333,33: rivalsa 13,33 (13,3332) cassa 13,33 -> imponibile 359,99 -> IVA 79,1978 -> 79,20
    expect(r.rivalsa).toBe(1333);
    expect(r.cassa).toBe(1333);
    expect(r.imponibile).toBe(35999);
    expect(r.vat).toBe(7920);
  });
});

describe('dal netto al lordo', () => {
  it('occasionale: netto 802 € -> lordo 1.000 €', () => {
    const { bolloCharged, ...base } = occ;
    const s = solveFromNet(80200, { ...base, bolloCharged })!;
    expect(s.result.compenso).toBe(100000);
    expect(s.difference).toBe(0);
  });
  it('netto 800 € con bollo addebitato: lordo 997,50 €', () => {
    const { compenso: _c, ...base } = occ;
    const s = solveFromNet(80000, base)!;
    expect(s.result.compenso).toBe(99750);
    expect(s.result.netto).toBe(80000);
  });
  it('il risultato ricalcolato in avanti dà lo stesso netto', () => {
    const { compenso: _c, ...base } = { ...occ, vatBp: 2200, rivalsa: true, cassaBp: 400 };
    const s = solveFromNet(123456, base)!;
    expect(Math.abs(s.difference)).toBeLessThanOrEqual(1);
    expect(computeRitenuta({ ...base, compenso: s.result.compenso }).netto).toBe(s.result.netto);
  });
  it('rifiuta netti nulli o negativi', () => {
    const { compenso: _c, ...base } = occ;
    expect(solveFromNet(0, base)).toBeNull();
    expect(solveFromNet(-5, base)).toBeNull();
  });
  it('sulla soglia del bollo il netto esatto non esiste: sceglie il più vicino', () => {
    const { compenso: _c, ...base } = occ;
    // 77,47 € -> netto 61,98 € ; 77,48 € -> bollo, netto 63,98 €
    const s = solveFromNet(6200, base)!;
    expect(s.result.compenso).toBe(7747);
    expect(s.difference).toBe(-2);
  });
});
