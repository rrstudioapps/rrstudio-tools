// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { buildTable, findRepeating, recordsAt } from './xml-table';

const load = (s: string) => {
  const r = parseXml(normalizeNewlines(s));
  if (!r.ok) throw new Error('parse');
  return r.nodes;
};
const O = { attrs: true, depth: 3, typed: false };
const DOC = load(`<cat n="1">
  <libro id="a" lingua="it"><titolo>Uno &amp; due</titolo><autore><nome>Ada</nome></autore><tag>x</tag><tag>y</tag></libro>
  <libro id="b"><titolo>Tre</titolo><prezzo valuta="EUR">12.5</prezzo></libro>
  <editore>E</editore>
</cat>`);

describe('candidati', () => {
  it('elementi ripetuti, dai più numerosi', () => {
    expect(findRepeating(DOC)).toEqual([
      { path: '/cat/libro', count: 2 },
      { path: '/cat/libro/tag', count: 2 },
      { path: '/cat/libro/titolo', count: 2 },
    ]);
    expect(recordsAt(DOC, '/cat/libro')).toHaveLength(2);
    expect(recordsAt(DOC, '/cat/nulla')).toEqual([]);
  });
});

describe('tabella', () => {
  it('appiattisce attributi, figli, nipoti e ripetuti', () => {
    const { table } = buildTable(DOC, '/cat/libro', O);
    expect(table.columns).toEqual(['@id', '@lingua', 'titolo', 'autore/nome', 'tag', 'tag[2]', 'prezzo/@valuta', 'prezzo']);
    expect(table.rows[0]).toEqual(['a', 'it', 'Uno & due', 'Ada', 'x', 'y', '', '']);
    expect(table.rows[1]).toEqual(['b', '', 'Tre', '', '', '', 'EUR', '12.5']);
  });
  it('senza attributi e con profondità 1', () => {
    const { table } = buildTable(DOC, '/cat/libro', { attrs: false, depth: 1, typed: false });
    expect(table.columns).toEqual(['titolo', 'tag', 'tag[2]', 'prezzo']);
  });
  it('tipizza i numeri se richiesto', () => {
    const { table } = buildTable(DOC, '/cat/libro', { ...O, typed: true });
    expect(table.rows[1][table.columns.indexOf('prezzo')]).toBe(12.5);
  });
  it('testo di un elemento con anche figli: colonna #text', () => {
    const d = load('<r><i>ciao <b>x</b></i><i>y</i></r>');
    const { table } = buildTable(d, '/r/i', O);
    expect(table.columns).toEqual(['#text', 'b']);
    expect(table.rows).toEqual([['ciao', 'x'], ['y', '']]);
  });
  it('record senza figli: il testo sta in #text', () => {
    const { table } = buildTable(load('<r><v>1</v><v>2</v></r>'), '/r/v', O);
    expect(table.columns).toEqual(['#text']);
    expect(table.rows).toEqual([['1'], ['2']]);
  });
});
