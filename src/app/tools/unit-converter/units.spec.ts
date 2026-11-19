// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { CATEGORIES, CategoryId, convert, normalize, searchUnits } from './units';

const conv = (cat: CategoryId, v: number, from: string, to: string): number => {
  const r = convert(cat, v, from, to);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('lunghezza', () => {
  it('km ↔ miglia', () => {
    expect(conv('length', 1, 'mi', 'km')).toBeCloseTo(1.609344, 10);
    expect(conv('length', 10, 'km', 'mi')).toBeCloseTo(6.2137119, 6);
  });
  it('pollici, piedi, iarde', () => {
    expect(conv('length', 1, 'in', 'cm')).toBeCloseTo(2.54, 10);
    expect(conv('length', 1, 'ft', 'in')).toBeCloseTo(12, 10);
    expect(conv('length', 1, 'yd', 'ft')).toBeCloseTo(3, 10);
    expect(conv('length', 1, 'nmi', 'm')).toBe(1852);
  });
});

describe('massa', () => {
  it('libbra e oncia', () => {
    expect(conv('mass', 1, 'kg', 'lb')).toBeCloseTo(2.2046226, 6);
    expect(conv('mass', 1, 'lb', 'oz')).toBeCloseTo(16, 10);
    expect(conv('mass', 1, 't', 'kg')).toBe(1000);
    expect(conv('mass', 1, 'st', 'lb')).toBeCloseTo(14, 8);
  });
});

describe('temperatura', () => {
  it('punti fissi', () => {
    expect(conv('temperature', 0, 'c', 'f')).toBeCloseTo(32, 10);
    expect(conv('temperature', 100, 'c', 'f')).toBeCloseTo(212, 10);
    expect(conv('temperature', 0, 'c', 'k')).toBeCloseTo(273.15, 10);
    expect(conv('temperature', 32, 'f', 'c')).toBeCloseTo(0, 10);
    expect(conv('temperature', -40, 'c', 'f')).toBeCloseTo(-40, 10);
    expect(conv('temperature', 0, 'k', 'c')).toBeCloseTo(-273.15, 10);
    expect(conv('temperature', 491.67, 'r', 'c')).toBeCloseTo(0, 10);
    expect(conv('temperature', 37, 'c', 'f')).toBeCloseTo(98.6, 10);
  });
  it('stessa unità: il valore non cambia', () => {
    expect(conv('temperature', 21.5, 'c', 'c')).toBeCloseTo(21.5, 12);
  });
  it('sotto lo zero assoluto è un errore, lo zero assoluto no', () => {
    expect(convert('temperature', -274, 'c', 'k')).toEqual({ ok: false, error: 'belowAbsoluteZero' });
    expect(convert('temperature', -1, 'k', 'c')).toEqual({ ok: false, error: 'belowAbsoluteZero' });
    expect(convert('temperature', -459.67, 'f', 'k').ok).toBe(true);
    expect(conv('temperature', 0, 'k', 'r')).toBeCloseTo(0, 10);
  });
});

describe('area, volume, velocità', () => {
  it('ettaro e acro', () => {
    expect(conv('area', 1, 'ha', 'm2')).toBe(10000);
    expect(conv('area', 1, 'ac', 'm2')).toBeCloseTo(4046.8564224, 6);
    expect(conv('area', 1, 'km2', 'ha')).toBe(100);
    expect(conv('area', 1, 'ft2', 'in2')).toBeCloseTo(144, 8);
  });
  it('litro e galloni', () => {
    expect(conv('volume', 1, 'galus', 'l')).toBeCloseTo(3.785411784, 9);
    expect(conv('volume', 1, 'galuk', 'l')).toBeCloseTo(4.54609, 9);
    expect(conv('volume', 1, 'm3', 'l')).toBe(1000);
    expect(conv('volume', 1, 'cup', 'ml')).toBeCloseTo(236.5882365, 6);
    expect(conv('volume', 1, 'galus', 'qt')).toBeCloseTo(4, 10);
    expect(conv('volume', 1, 'qt', 'pt')).toBeCloseTo(2, 10);
    expect(conv('volume', 1, 'tbsp', 'tsp')).toBeCloseTo(3, 10);
  });
  it('km/h, mph, nodi', () => {
    expect(conv('speed', 36, 'kmh', 'ms')).toBeCloseTo(10, 10);
    expect(conv('speed', 100, 'kmh', 'mph')).toBeCloseTo(62.1371192, 6);
    expect(conv('speed', 1, 'kn', 'kmh')).toBeCloseTo(1.852, 10);
  });
});

describe('tempo', () => {
  it('unità esatte', () => {
    expect(conv('time', 1, 'h', 'min')).toBe(60);
    expect(conv('time', 1, 'd', 'h')).toBe(24);
    expect(conv('time', 1, 'wk', 'd')).toBe(7);
    expect(conv('time', 1, 's', 'ms')).toBeCloseTo(1000, 9);
  });
  it('anno e mese medi (calendario gregoriano)', () => {
    expect(conv('time', 1, 'yr', 'd')).toBeCloseTo(365.2425, 9);
    expect(conv('time', 1, 'yr', 'mo')).toBeCloseTo(12, 9);
  });
});

describe('dati digitali: SI e binari', () => {
  it('1 KB = 1000 B, 1 KiB = 1024 B', () => {
    expect(conv('data', 1, 'kb', 'b')).toBe(1000);
    expect(conv('data', 1, 'kib', 'b')).toBe(1024);
  });
  it('1 GB in GiB e 1 GiB in MiB', () => {
    expect(conv('data', 1, 'gb', 'gib')).toBeCloseTo(0.931322574615, 9);
    expect(conv('data', 1, 'gib', 'mib')).toBe(1024);
    expect(conv('data', 1, 'tib', 'gib')).toBe(1024);
  });
  it('bit e byte', () => {
    expect(conv('data', 8, 'bit', 'b')).toBe(1);
    expect(conv('data', 1, 'mbit', 'kbit')).toBeCloseTo(1000, 9);
    expect(conv('data', 100, 'mbit', 'mb')).toBeCloseTo(12.5, 10);
  });
});

describe('pressione ed energia', () => {
  it('bar, atm, psi', () => {
    expect(conv('pressure', 1, 'bar', 'pa')).toBe(100000);
    expect(conv('pressure', 1, 'atm', 'pa')).toBe(101325);
    expect(conv('pressure', 1, 'atm', 'mmhg')).toBeCloseTo(760, 3);
    expect(conv('pressure', 1, 'bar', 'psi')).toBeCloseTo(14.5037738, 6);
    expect(conv('pressure', 1, 'atm', 'torr')).toBeCloseTo(760, 9);
  });
  it('kWh, kcal, BTU', () => {
    expect(conv('energy', 1, 'kwh', 'mj')).toBeCloseTo(3.6, 10);
    expect(conv('energy', 1, 'kcal', 'kj')).toBeCloseTo(4.184, 10);
    expect(conv('energy', 1, 'kwh', 'wh')).toBeCloseTo(1000, 9);
    expect(conv('energy', 1, 'btu', 'j')).toBeCloseTo(1055.05585262, 6);
  });
});

describe('coerenza dei dati', () => {
  it('id unici per categoria, fattori positivi, unità di default presenti', () => {
    for (const c of CATEGORIES) {
      const ids = c.units.map((x) => x.id);
      expect(new Set(ids).size, c.id).toBe(ids.length);
      expect(ids, c.id).toContain(c.defaultFrom);
      expect(ids, c.id).toContain(c.defaultTo);
      for (const x of c.units) expect(x.factor, `${c.id}/${x.id}`).toBeGreaterThan(0);
    }
  });
  it('andata e ritorno tra tutte le coppie di ogni categoria', () => {
    for (const c of CATEGORIES.filter((k) => k.id !== 'temperature')) {
      for (const a of c.units) {
        for (const b of c.units) {
          const there = conv(c.id, 123.456, a.id, b.id);
          const back = conv(c.id, there, b.id, a.id);
          expect(back / 123.456, `${c.id} ${a.id}->${b.id}`).toBeCloseTo(1, 9);
        }
      }
    }
  });
  it('unità sconosciuta lancia un errore', () => {
    expect(() => convert('length', 1, 'm', 'xx')).toThrow();
  });
});

describe('ricerca delle unità', () => {
  it('per simbolo, nome e sigla alternativa', () => {
    expect(searchUnits('kg', 'it')[0].unit.id).toBe('kg');
    expect(searchUnits('chilometro', 'it')[0].unit.id).toBe('km');
    expect(searchUnits('inch', 'en')[0].unit.id).toBe('in');
    expect(searchUnits('mq', 'it')[0].unit.id).toBe('m2');
    expect(searchUnits('µm', 'it')[0].unit.id).toBe('um');
    expect(searchUnits('MIB', 'en')[0].unit.id).toBe('mib');
  });
  it('trova unità in più categorie e può limitarsi a una', () => {
    const all = searchUnits('ton', 'en');
    expect(new Set(all.map((h) => h.category)).size).toBeGreaterThanOrEqual(1);
    expect(searchUnits('m', 'it', 'time').every((h) => h.category === 'time')).toBe(true);
  });
  it('senza accenti e maiuscole; vuoto restituisce niente', () => {
    expect(searchUnits('GRADO CELSIUS', 'it')[0].unit.id).toBe('c');
    expect(searchUnits('   ', 'it')).toEqual([]);
    expect(searchUnits('zzzzzz', 'it')).toEqual([]);
    expect(normalize('Èé µ²')).toBe('ee u2');
  });
});
