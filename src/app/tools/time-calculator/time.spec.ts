// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  amountCents,
  computeSheet,
  convertAuto,
  dayIndex,
  decimalHours,
  decimalToSeconds,
  formatCents,
  formatHms,
  parseClock,
  parseDuration,
  parsePercent,
  parseRate,
  parseSheetLine,
  sumLines,
} from './time';

const H = 3600;
describe('parseDuration', () => {
  it('formato ore:minuti[:secondi]', () => {
    expect(parseDuration('1:30')).toBe(90 * 60);
    expect(parseDuration('0:45')).toBe(45 * 60);
    expect(parseDuration('01:30:15')).toBe(H + 30 * 60 + 15);
    expect(parseDuration('100:00')).toBe(100 * H);
  });
  it('minuti o secondi fuori scala', () => {
    expect(parseDuration('1:60')).toBeNull();
    expect(parseDuration('1:30:60')).toBeNull();
    expect(parseDuration('1:5')).toBeNull();
  });
  it('con unità', () => {
    expect(parseDuration('1h 30m')).toBe(90 * 60);
    expect(parseDuration('1h30m')).toBe(90 * 60);
    expect(parseDuration('1h30')).toBe(90 * 60);
    expect(parseDuration('90m')).toBe(90 * 60);
    expect(parseDuration('45 min')).toBe(45 * 60);
    expect(parseDuration('30s')).toBe(30);
    expect(parseDuration('1h 30m 15s')).toBe(H + 30 * 60 + 15);
    expect(parseDuration('2 ore e 15 minuti')).toBe(2 * H + 15 * 60);
    expect(parseDuration('2 hours and 15 minutes')).toBe(2 * H + 15 * 60);
    expect(parseDuration('1h, 30m')).toBe(90 * 60);
    expect(parseDuration('2H')).toBe(2 * H);
  });
  it('decimali', () => {
    expect(parseDuration('1,5h')).toBe(90 * 60);
    expect(parseDuration('1.5 h')).toBe(90 * 60);
    expect(parseDuration('0,25h')).toBe(15 * 60);
    expect(parseDuration('.5h')).toBe(30 * 60);
    expect(parseDuration('1,5m')).toBe(90);
  });
  it('numero senza unità: ore o minuti', () => {
    expect(parseDuration('1,5')).toBe(90 * 60);
    expect(parseDuration('2')).toBe(2 * H);
    expect(parseDuration('90', 'm')).toBe(90 * 60);
  });
  it('non valide', () => {
    for (const bad of ['', 'abc', '1x', 'h', '1h abc', '1:', ':30', '--1', '1:30m', '1 giorno']) expect(parseDuration(bad), bad).toBeNull();
  });
});

describe('somma di durate', () => {
  it('formati misti, una per riga', () => {
    const r = sumLines('1:30\n1h 30m\n90m\n1,5h\n01:30:15');
    expect(r.total).toBe(5 * 90 * 60 + 15);
    expect(r.count).toBe(5);
    expect(formatHms(r.total)).toBe('7:30:15');
  });
  it('sottrazione con - e addizione con +', () => {
    expect(sumLines('8:00\n-0:30\n+1h\n- 15m').total).toBe(8 * H + H - 45 * 60);
    expect(sumLines('1:00\n-2:00').total).toBe(-H);
  });
  it('commenti, righe vuote e righe non valide', () => {
    const r = sumLines('# titolo\n\n1:00 # riunione\nciao\n// altro\n2:00');
    expect(r.total).toBe(3 * H);
    expect(r.count).toBe(2);
    expect(r.rows.filter((x) => x.error).map((x) => x.line)).toEqual([4]);
  });
  it('numeri senza unità secondo l\'impostazione', () => {
    expect(sumLines('90\n30', 'm').total).toBe(2 * H);
    expect(sumLines('1\n2', 'h').total).toBe(3 * H);
  });
  it('testo vuoto', () => {
    expect(sumLines('')).toEqual({ rows: [], total: 0, count: 0 });
  });
});

describe('formati di uscita', () => {
  it('ore:minuti', () => {
    expect(formatHms(0)).toBe('0:00');
    expect(formatHms(90 * 60)).toBe('1:30');
    expect(formatHms(100 * H + 5 * 60)).toBe('100:05');
    expect(formatHms(-(H + 60 * 15))).toBe('-1:15');
    expect(formatHms(H + 30 * 60 + 5)).toBe('1:30:05');
  });
  it('ore decimali', () => {
    expect(decimalHours(90 * 60)).toBe(1.5);
    expect(decimalHours(20 * 60)).toBe(0.3333);
    expect(decimalHours(0)).toBe(0);
    expect(decimalHours(-45 * 60, 2)).toBe(-0.75);
  });
});

describe('conversione decimali ↔ ore:minuti', () => {
  it('decimale → secondi', () => {
    expect(decimalToSeconds('1,75')).toBe(105 * 60);
    expect(decimalToSeconds('0.5')).toBe(30 * 60);
    expect(decimalToSeconds('-1,5')).toBe(-90 * 60);
    expect(decimalToSeconds('1:30')).toBeNull();
  });
  it('riconoscimento automatico del verso', () => {
    expect(convertAuto('1,75')).toEqual({ from: 'decimal', seconds: 105 * 60 });
    expect(convertAuto('1:45')).toEqual({ from: 'duration', seconds: 105 * 60 });
    expect(convertAuto('1h 45m')).toEqual({ from: 'duration', seconds: 105 * 60 });
    expect(convertAuto('-0,5')).toEqual({ from: 'decimal', seconds: -30 * 60 });
    expect(convertAuto('x')).toBeNull();
    expect(convertAuto('')).toBeNull();
  });
  it('andata e ritorno', () => {
    const a = convertAuto('7,75');
    expect(a && formatHms(a.seconds)).toBe('7:45');
    const b = convertAuto('7:45');
    expect(b && decimalHours(b.seconds)).toBe(7.75);
  });
});

describe('orari e giorni', () => {
  it('parseClock', () => {
    expect(parseClock('8:30')).toBe(510);
    expect(parseClock('08.30')).toBe(510);
    expect(parseClock('8h30')).toBe(510);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('8:60')).toBeNull();
    expect(parseClock('830')).toBeNull();
  });
  it('dayIndex', () => {
    expect(dayIndex('lun')).toBe(0);
    expect(dayIndex('Lunedì')).toBe(0);
    expect(dayIndex('dom')).toBe(6);
    expect(dayIndex('Tuesday')).toBe(1);
    expect(dayIndex('sat')).toBe(5);
    expect(dayIndex('lunghezza')).toBeNull();
    expect(dayIndex('pausa')).toBeNull();
    expect(dayIndex('lu')).toBeNull();
  });
});

describe('riga del foglio ore', () => {
  const ok = (s: string) => {
    const r = parseSheetLine(s, 1);
    if (!r || 'error' in r) throw new Error('riga non valida: ' + s);
    return r;
  };
  it('entrata, uscita e pausa in minuti', () => {
    const r = ok('lun 8:30 17:30 60');
    expect(r).toMatchObject({ day: 0, start: 510, end: 1050, breakSeconds: 3600, worked: 8 * H, crossesMidnight: false });
  });
  it('varie forme di scrittura', () => {
    expect(ok('9:00-13:00').worked).toBe(4 * H);
    expect(ok('9.00 – 13.00').worked).toBe(4 * H);
    expect(ok('mar 9:00 18:00 pausa 1h').worked).toBe(8 * H);
    expect(ok('9:00 18:00 pausa 0:45').worked).toBe(8 * H + 15 * 60);
    expect(ok('9:00 18:00 0:30').worked).toBe(8 * H + 30 * 60);
    expect(ok('Friday 9:00 12:00').day).toBe(4);
    expect(ok('9:00 12:00 # note').worked).toBe(3 * H);
  });
  it('passaggio della mezzanotte', () => {
    const r = ok('ven 22:00 06:00 30');
    expect(r.crossesMidnight).toBe(true);
    expect(r.worked).toBe(8 * H - 30 * 60);
    expect(ok('23:30-00:30').worked).toBe(H);
  });
  it('stessa ora di entrata e uscita: zero', () => {
    expect(ok('8:00 8:00').worked).toBe(0);
  });
  it('errori', () => {
    expect(parseSheetLine('lun 8:30', 3)).toEqual({ line: 3, text: 'lun 8:30', error: 'times' });
    expect(parseSheetLine('8:30 17:30 1:00 0:30', 1)).toMatchObject({ error: 'times' });
    expect(parseSheetLine('25:00 17:30', 1)).toMatchObject({ error: 'times' });
    expect(parseSheetLine('8:30 17:30 abc', 1)).toMatchObject({ error: 'break' });
    expect(parseSheetLine('8:30 9:00 90', 1)).toMatchObject({ error: 'breakTooLong' });
    expect(parseSheetLine('  # solo commento', 1)).toBeNull();
    expect(parseSheetLine('', 1)).toBeNull();
  });
});

describe('foglio ore: totali e straordinario', () => {
  const week = ['lun 8:00 17:00 60', 'mar 8:00 18:00 60', 'mer 8:00 17:00 60', 'gio 8:00 17:00 60', 'ven 8:00 17:00 60'].join('\n');
  it('totale giornaliero e settimanale', () => {
    const r = computeSheet(week, null, 'week');
    expect(r.total).toBe(41 * H);
    expect(r.days.map((d) => d.seconds / H)).toEqual([8, 9, 8, 8, 8]);
    expect(r.overtime).toBe(0);
    expect(r.regular).toBe(41 * H);
  });
  it('straordinario oltre la soglia settimanale', () => {
    const r = computeSheet(week, 40 * H, 'week');
    expect(r.overtime).toBe(H);
    expect(r.regular).toBe(40 * H);
  });
  it('straordinario oltre la soglia giornaliera', () => {
    const r = computeSheet(week, 8 * H, 'day');
    expect(r.overtime).toBe(H);
    const two = computeSheet('lun 8:00 12:00\nlun 13:00 19:00', 8 * H, 'day');
    expect(two.days).toEqual([{ day: 0, seconds: 10 * H }]);
    expect(two.overtime).toBe(2 * H);
  });
  it('righe senza giorno contano una per una nel limite giornaliero', () => {
    const r = computeSheet('8:00 18:00\n8:00 17:00', 8 * H, 'day');
    expect(r.days).toEqual([]);
    expect(r.overtime).toBe(3 * H);
  });
  it('turno notturno nel totale', () => {
    expect(computeSheet('dom 22:00 06:00', null, 'week').total).toBe(8 * H);
  });
  it('righe errate fuori dal totale', () => {
    const r = computeSheet('8:00 12:00\nxx\n13:00 17:00', null, 'week');
    expect(r.total).toBe(8 * H);
    expect(r.errors.map((e) => e.line)).toEqual([2]);
  });
  it('soglia zero', () => {
    expect(computeSheet('8:00 10:00', 0, 'week').overtime).toBe(2 * H);
  });
});

describe('importo', () => {
  it('tariffa e percentuale', () => {
    expect(parseRate('12,50')).toBe(125000n);
    expect(parseRate('12')).toBe(120000n);
    expect(parseRate('0.0001')).toBe(1n);
    expect(parseRate('12,12345')).toBeNull();
    expect(parseRate('-5')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parsePercent('25')).toBe(2500n);
    expect(parsePercent('12,5%')).toBe(1250n);
    expect(parsePercent('x')).toBeNull();
  });
  it('importo = ore × tariffa, arrotondato al centesimo', () => {
    expect(amountCents(8 * H, 0, 125000n)).toBe(10000n); // 8 h × 12,50
    expect(amountCents(90 * 60, 0, 100000n)).toBe(1500n); // 1,5 h × 10
    expect(amountCents(20 * 60, 0, 100000n)).toBe(333n); // 3,333…
    expect(amountCents(0, 0, 100000n)).toBe(0n);
  });
  it('maggiorazione dello straordinario', () => {
    // 40 h a 10 + 2 h a 10 con +25 % = 400 + 25 = 425
    expect(amountCents(40 * H, 2 * H, 100000n, 2500n)).toBe(42500n);
    expect(amountCents(0, 2 * H, 100000n, 0n)).toBe(2000n);
  });
  it('metà centesimo per eccesso', () => {
    // 1 secondo a 18 €/h = 0,005 € → 1 centesimo
    expect(amountCents(1, 0, 180000n)).toBe(1n);
    expect(amountCents(1, 0, 170000n)).toBe(0n);
  });
  it('formattazione', () => {
    expect(formatCents(123456n, ',', '.')).toBe('1.234,56');
    expect(formatCents(5n, '.', ',')).toBe('0.05');
    expect(formatCents(-100000n, '.', ',')).toBe('-1,000.00');
  });
});
