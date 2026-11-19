// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  aggregateByCategory,
  aggregateByPeriod,
  chooseGranularity,
  computeKpis,
  periodChange,
} from './aggregation';
import { buildExportHtml } from './export-html';

const d = (s: string) => new Date(s + 'T00:00:00Z');

describe('aggregateByPeriod', () => {
  it('raggruppa per mese e riempie i mesi vuoti', () => {
    const r = aggregateByPeriod(
      [d('2026-01-10'), d('2026-01-20'), d('2026-04-05')],
      [10, 5, 7],
      'sum',
    );
    expect(r.granularity).toBe('month');
    expect(r.points).toEqual([
      { key: '2026-01', value: 15 },
      { key: '2026-02', value: 0 },
      { key: '2026-03', value: 0 },
      { key: '2026-04', value: 7 },
    ]);
  });
  it('usa i giorni se l\'intervallo è < 60 giorni', () => {
    expect(chooseGranularity(d('2026-01-01'), d('2026-02-15'))).toBe('day');
    expect(chooseGranularity(d('2026-01-01'), d('2026-04-01'))).toBe('month');
    const r = aggregateByPeriod([d('2026-01-01'), d('2026-01-03')], [1, 2], 'sum');
    expect(r.points.map((p) => p.key)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
  it('media e conteggio; ignora date e valori nulli', () => {
    const dates = [d('2026-01-01'), d('2026-01-02'), null, d('2026-01-03')];
    expect(aggregateByPeriod(dates, [10, 20, 99, null], 'avg', 'month').points[0].value).toBe(15);
    expect(aggregateByPeriod(dates, [10, 20, 99, null], 'count', 'month').points[0].value).toBe(3);
  });
  it('serie vuota senza date', () => {
    expect(aggregateByPeriod([null], [1], 'sum').points).toEqual([]);
  });
});

describe('aggregateByCategory', () => {
  it('ordina per valore e raggruppa il resto in "Altro"', () => {
    const cats = ['a', 'b', 'c', 'd', 'a'];
    const r = aggregateByCategory(cats, [5, 4, 3, 2, 1], 'sum', 'Altro', 2);
    expect(r).toEqual([
      { name: 'a', value: 6 },
      { name: 'b', value: 4 },
      { name: 'Altro', value: 5 },
    ]);
  });
  it('la media dell\'"Altro" è pesata', () => {
    const r = aggregateByCategory(['a', 'b', 'c', 'c'], [100, 4, 2, 6], 'avg', 'Altro', 1);
    expect(r[1]).toEqual({ name: 'Altro', value: 4 });
  });
});

describe('KPI', () => {
  it('totale, media e variazione', () => {
    expect(computeKpis([1, null, 3], 3)).toEqual({ total: 4, average: 2, count: 3 });
    expect(periodChange([{ key: 'a', value: 100 }, { key: 'b', value: 125 }])).toBe(25);
    expect(periodChange([{ key: 'a', value: 0 }, { key: 'b', value: 5 }])).toBeNull();
    expect(periodChange([{ key: 'a', value: 1 }])).toBeNull();
  });
});

describe('buildExportHtml', () => {
  it('esegue l\'escape dei dati utente e non include risorse esterne', () => {
    const html = buildExportHtml({
      lang: 'it',
      title: '<script>alert(1)</script>',
      generatedLabel: 'x',
      kpis: [{ label: '<b>', value: '1' }],
      charts: [{ title: 'c', dataUrl: 'javascript:alert(1)' }],
      headers: ['<img src=x onerror=alert(1)>'],
      rows: [['"><script>x</script>']],
      rowsNote: '',
      credit: '',
      colors: { bg: '#fff', surface: '#fff', text: '#000', ink2: '#333', muted: '#555', line: '#ddd' },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
