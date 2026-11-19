// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { PaletteItem, searchPalette } from './palette-search';

const mk = (id: string, title: string, description = '', keywords = ''): PaletteItem => ({ id, title, description, keywords });
const items = [
  mk('a', 'Convertitore JSON', 'da e verso CSV'),
  mk('b', 'Formattatore JSON', 'abbellisce'),
  mk('c', 'Generatore di password', 'sicure', 'json no'),
  mk('d', 'Caffè', 'bar'),
];

describe('searchPalette', () => {
  it('senza ricerca restituisce le voci nell\'ordine dato, con limite', () => {
    expect(searchPalette(items, '  ').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(searchPalette(items, '', 2)).toHaveLength(2);
  });
  it('tutte le parole devono comparire, senza accenti e senza maiuscole', () => {
    expect(searchPalette(items, 'CAFFE').map((i) => i.id)).toEqual(['d']);
    expect(searchPalette(items, 'json csv').map((i) => i.id)).toEqual(['a']);
    expect(searchPalette(items, 'zzz')).toEqual([]);
  });
  it('mette prima chi inizia col testo, poi chi lo contiene, poi descrizione e parole chiave', () => {
    expect(searchPalette(items, 'json').map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(searchPalette(items, 'form').map((i) => i.id)).toEqual(['b']);
    expect(searchPalette(items, 'password json')[0].id).toBe('c');
  });
});
