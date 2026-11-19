// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  buildDataset,
  detectColumnType,
  excelSerialToDate,
  parseDate,
  parseNumber,
  pickValueColumn,
} from './type-detection';

describe('parseNumber', () => {
  it('legge formato inglese e italiano', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1.234.567,8')).toBe(1234567.8);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('3.14')).toBe(3.14);
    expect(parseNumber('1,234,567')).toBe(1234567);
  });
  it('gestisce valute, percentuali e negativi', () => {
    expect(parseNumber('€ 1.250,00')).toBe(1250);
    expect(parseNumber('$1,250.50')).toBe(1250.5);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('-45,5')).toBe(-45.5);
    expect(parseNumber('(100)')).toBe(-100);
  });
  it('rifiuta testo, date e codici con zeri iniziali', () => {
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('2024-01-15')).toBeNull();
    expect(parseNumber('00123')).toBeNull();
    expect(parseNumber('1,2,x')).toBeNull();
  });
});

describe('parseDate', () => {
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
  it('riconosce i formati comuni', () => {
    expect(iso(parseDate('2026-03-15'))).toBe('2026-03-15');
    expect(iso(parseDate('15/03/2026'))).toBe('2026-03-15');
    expect(iso(parseDate('15-03-2026'))).toBe('2026-03-15');
    expect(iso(parseDate('2026/03'))).toBe('2026-03-01');
    expect(iso(parseDate('2026-03-15T10:30:00Z'))).toBe('2026-03-15');
    expect(iso(parseDate('1700000000'))).toBe('2023-11-14');
  });
  it('rifiuta date impossibili e testo', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('ciao')).toBeNull();
    expect(parseDate('12345')).toBeNull();
  });
  it('converte i seriali Excel', () => {
    expect(excelSerialToDate(45292).toISOString().slice(0, 10)).toBe('2024-01-01');
  });
});

describe('detectColumnType', () => {
  it('data, numero, categoria, testo', () => {
    expect(detectColumnType('x', ['2026-01-01', '2026-01-02']).type).toBe('date');
    expect(detectColumnType('x', ['1,5', '2,5', '3']).type).toBe('number');
    const cat = Array.from({ length: 20 }, (_, i) => ['A', 'B'][i % 2]);
    expect(detectColumnType('x', cat).type).toBe('category');
    const text = Array.from({ length: 20 }, (_, i) => `descrizione ${i}`);
    expect(detectColumnType('x', text).type).toBe('text');
  });
  it('tollera fino al 10% di valori non compatibili e ignora i vuoti', () => {
    const vals = [...Array.from({ length: 9 }, (_, i) => String(i + 10)), 'n/d', '', ''];
    expect(detectColumnType('x', vals).type).toBe('number');
    const bad = [...Array.from({ length: 8 }, (_, i) => String(i + 10)), 'a', 'b'];
    expect(detectColumnType('x', bad).type).not.toBe('number');
  });
  it('interpreta i seriali Excel solo se l\'intestazione sembra una data', () => {
    const serials = ['45292', '45293', '45300'];
    expect(detectColumnType('Data ordine', serials)).toMatchObject({ type: 'date', serialDate: true });
    expect(detectColumnType('Importo', serials).type).toBe('number');
  });
});

describe('buildDataset', () => {
  it('rende unici gli header, scarta righe vuote e rileva i tipi', () => {
    const ds = buildDataset('t', ['A', 'A', ''], [
      ['2026-01-01', '5', 'x'],
      ['', '', ''],
      ['2026-01-02', '6', 'y'],
    ]);
    expect(ds.columns.map((c) => c.name)).toEqual(['A', 'A_2', 'Colonna 3']);
    expect(ds.rows).toHaveLength(2);
    expect(ds.columns[0].type).toBe('date');
    expect(ds.columns[1].type).toBe('number');
  });
});

describe('pickValueColumn', () => {
  const col = (name: string, type: 'number' | 'text' = 'number') => ({ name, type, serialDate: false });
  it('preferisce i nomi da importo, con priorità all\'ordine dell\'elenco', () => {
    expect(pickValueColumn([col('Quantità'), col('Prezzo unitario'), col('Ricavo (€)')])).toBe(2);
    expect(pickValueColumn([col('Price'), col('Total')])).toBe(1);
  });
  it('ignora le colonne non numeriche e ripiega sulla prima numerica', () => {
    expect(pickValueColumn([col('Ricavo note', 'text'), col('Pezzi'), col('Altro')])).toBe(1);
    expect(pickValueColumn([col('Nome', 'text')])).toBeNull();
  });
});
