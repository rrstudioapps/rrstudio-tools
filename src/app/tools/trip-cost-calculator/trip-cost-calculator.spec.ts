// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  CONS_UNITS, averageConsumption, convertConsumption, convertPrice, fromL100, kmFrom, kmTo, parseField, pricePerLiter, rangeFor, toCents, toL100,
  tripCost, volumeOf, type TripInput,
} from './trip-cost-calculator';

const base: TripInput = { distanceKm: 100, roundTrip: false, fuel: 'petrol', per100: 6, unitPrice: 1.8, fixedCents: 0, people: 1 };

describe('conversioni', () => {
  it('30 mpg US ≈ 7,84 l/100 km e 40 mpg UK ≈ 7,06 l/100 km', () => {
    expect(toL100(30, 'mpgUs')).toBeCloseTo(7.84, 2);
    expect(toL100(40, 'mpgUk')).toBeCloseTo(7.06, 2);
  });
  it('km/l e l/100 km', () => {
    expect(toL100(20, 'kml')).toBe(5);
    expect(fromL100(5, 'kml')).toBe(20);
    expect(toL100(7, 'l100')).toBe(7);
  });
  it('andata e ritorno tra tutte le unità senza perdere il valore', () => {
    for (const a of CONS_UNITS) {
      for (const b of CONS_UNITS) {
        const x = convertConsumption(convertConsumption(6.5, a, b), b, a);
        expect(x).toBeCloseTo(6.5, 9);
      }
    }
  });
  it('km e miglia', () => {
    expect(kmFrom(1, 'mi')).toBe(1.609344);
    expect(kmTo(kmFrom(42, 'mi'), 'mi')).toBeCloseTo(42, 10);
    expect(kmFrom(5, 'km')).toBe(5);
  });
  it('prezzo per gallone', () => {
    expect(pricePerLiter(3.785411784, 'galUs')).toBeCloseTo(1, 10);
    expect(convertPrice(convertPrice(1.85, 'l', 'galUk'), 'galUk', 'l')).toBeCloseTo(1.85, 10);
    expect(convertPrice(1.5, 'l', 'l')).toBe(1.5);
    expect(volumeOf('mpgUs')).toBe('galUs');
    expect(volumeOf('mpgUk')).toBe('galUk');
    expect(volumeOf('kml')).toBe('l');
  });
  it('consumo 0 in km/l dà Infinity (va escluso a monte)', () => {
    expect(toL100(0, 'kml')).toBe(Infinity);
  });
});

describe('parseField', () => {
  const o = { allowZero: false, max: 1000 };
  it('accetta virgola e punto', () => {
    expect(parseField('6,5', 'it', o)).toEqual({ ok: true, value: 6.5 });
    expect(parseField('6.5', 'en', o)).toEqual({ ok: true, value: 6.5 });
  });
  it('errori distinti', () => {
    expect(parseField('  ', 'it', o)).toEqual({ ok: false, error: 'empty' });
    expect(parseField('abc', 'it', o)).toEqual({ ok: false, error: 'nan' });
    expect(parseField('-3', 'it', o)).toEqual({ ok: false, error: 'negative' });
    expect(parseField('0', 'it', o)).toEqual({ ok: false, error: 'zero' });
    expect(parseField('0', 'it', { allowZero: true, max: 10 })).toEqual({ ok: true, value: 0 });
    expect(parseField('1001', 'it', o)).toEqual({ ok: false, error: 'big' });
    expect(parseField('1e400', 'it', o).ok).toBe(false);
  });
});

describe('toCents', () => {
  it('niente errori di virgola mobile', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(19.99)).toBe(1999);
  });
});

describe('tripCost', () => {
  it('100 km a 6 l/100 km = 6 l', () => {
    const r = tripCost(base);
    expect(r.ok && r.energy).toBeCloseTo(6, 10);
    expect(r.ok && r.fuelCents).toBe(1080);
    expect(r.ok && r.co2Kg).toBeCloseTo(13.86, 10);
  });
  it('andata e ritorno, pedaggi e persone', () => {
    const r = tripCost({ ...base, roundTrip: true, fixedCents: 1250, people: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.distanceKm).toBe(200);
    expect(r.energy).toBeCloseTo(12, 10);
    expect(r.fuelCents).toBe(2160);
    expect(r.totalCents).toBe(3410);
    expect(r.perPersonCents).toBe(1137);
    expect(r.perKm).toBeCloseTo(0.1705, 10);
  });
  it('fattori di CO2 per diesel e GPL, nessuno per elettrico', () => {
    const d = tripCost({ ...base, fuel: 'diesel' });
    expect(d.ok && d.co2Kg).toBeCloseTo(6 * 2.68, 10);
    const g = tripCost({ ...base, fuel: 'lpg' });
    expect(g.ok && g.co2Kg).toBeCloseTo(6 * 1.51, 10);
    const e = tripCost({ ...base, fuel: 'electric', per100: 18, unitPrice: 0.3 });
    expect(e.ok && e.co2Kg).toBeNull();
    expect(e.ok && e.fuelCents).toBe(540);
  });
  it('prezzo zero consentito, costo solo fisso', () => {
    const r = tripCost({ ...base, unitPrice: 0, fixedCents: 500 });
    expect(r.ok && r.totalCents).toBe(500);
  });
  it('rifiuta zero, negativi, NaN, Infinity, persone non intere', () => {
    expect(tripCost({ ...base, per100: 0 })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, distanceKm: 0 })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, distanceKm: -1 })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, per100: NaN })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, unitPrice: Infinity })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, people: 0 })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, people: 2.5 })).toEqual({ ok: false, error: 'invalid' });
    expect(tripCost({ ...base, fixedCents: -1 })).toEqual({ ok: false, error: 'invalid' });
  });
  it('numeri enormi: errore invece di Infinity', () => {
    expect(tripCost({ ...base, distanceKm: 1e300, per100: 1e300 })).toEqual({ ok: false, error: 'overflow' });
    expect(tripCost({ ...base, distanceKm: 1e12, per100: 1e12, unitPrice: 1e4 })).toEqual({ ok: false, error: 'overflow' });
  });
  it('arrotondamento a persona al centesimo', () => {
    const r = tripCost({ ...base, distanceKm: 100, per100: 10, unitPrice: 1, fixedCents: 0, people: 3 });
    expect(r.ok && r.perPersonCents).toBe(333);
  });
});

describe('averageConsumption', () => {
  it('450 km con 30 l', () => {
    const r = averageConsumption(450, 30, 5400);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.l100).toBeCloseTo(6.6667, 4);
    expect(r.kml).toBeCloseTo(15, 10);
    expect(r.mpgUs).toBeCloseTo(35.28, 1);
    expect(r.mpgUk).toBeCloseTo(42.37, 1);
    expect(r.costPerKm).toBeCloseTo(0.12, 10);
    expect(r.costPer100Km).toBeCloseTo(12, 10);
  });
  it('senza spesa il costo è null; zero e NaN rifiutati', () => {
    const r = averageConsumption(100, 5, null);
    expect(r.ok && r.costPerKm).toBeNull();
    expect(averageConsumption(0, 5, null)).toEqual({ ok: false, error: 'invalid' });
    expect(averageConsumption(100, 0, null)).toEqual({ ok: false, error: 'invalid' });
    expect(averageConsumption(NaN, 5, null)).toEqual({ ok: false, error: 'invalid' });
    expect(averageConsumption(100, 5, -1)).toEqual({ ok: false, error: 'invalid' });
    expect(averageConsumption(1e-320, 1e300, null).ok).toBe(false);
  });
});

describe('rangeFor', () => {
  it('con il budget: 50 € a 1,8 €/l e 6 l/100 km', () => {
    const r = rangeFor('budget', 5000, 6, 1.8);
    expect(r.ok && r.km).toBeCloseTo(462.963, 3);
    expect(r.ok && r.energy).toBeCloseTo(27.7778, 4);
    expect(r.ok && r.costCents).toBe(5000);
  });
  it('con i litri nel serbatoio, prezzo facoltativo', () => {
    const r = rangeFor('tank', 40, 8, null);
    expect(r.ok && r.km).toBe(500);
    expect(r.ok && r.costCents).toBeNull();
    const c = rangeFor('tank', 40, 8, 1.5);
    expect(c.ok && c.costCents).toBe(6000);
  });
  it('rifiuta prezzo mancante o zero col budget, consumo zero, enormi', () => {
    expect(rangeFor('budget', 5000, 6, null)).toEqual({ ok: false, error: 'invalid' });
    expect(rangeFor('budget', 5000, 6, 0)).toEqual({ ok: false, error: 'invalid' });
    expect(rangeFor('tank', 40, 0, null)).toEqual({ ok: false, error: 'invalid' });
    expect(rangeFor('tank', NaN, 6, null)).toEqual({ ok: false, error: 'invalid' });
    expect(rangeFor('tank', 1e300, 1e-300, null)).toEqual({ ok: false, error: 'overflow' });
  });
});
