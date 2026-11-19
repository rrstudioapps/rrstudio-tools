// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { diffCsv, diffYaml, parseKeyColumns, rowsToText, summarize } from './yaml-csv-diff';

describe('diffYaml', () => {
  it('stessi documenti: nessuna differenza, anche con ordine delle chiavi e commenti diversi', () => {
    const r = diffYaml('a: 1\nb: [x, y]\n# nota\n', 'b: [x, y]\na: 1\n');
    expect(r.ok && r.rows).toEqual([]);
  });
  it('valori cambiati, chiavi aggiunte e tolte con il percorso', () => {
    const r = diffYaml('svc:\n  porta: 80\n  vecchia: 1\n', 'svc:\n  porta: 8080\n  nuova: true\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byPath = Object.fromEntries(r.rows.map((x) => [x.path, x]));
    expect(byPath['svc.porta']).toMatchObject({ kind: 'changed', before: '80', after: '8080' });
    expect(byPath['svc.vecchia'].kind).toBe('removed');
    expect(byPath['svc.nuova'].kind).toBe('added');
    expect(summarize(r.rows)).toEqual({ added: 1, removed: 1, changed: 1 });
  });
  it('liste per chiave: un elemento in mezzo non sposta gli altri', () => {
    const a = '- id: 1\n  n: uno\n- id: 2\n  n: due\n';
    const b = '- id: 0\n  n: zero\n- id: 1\n  n: uno\n- id: 2\n  n: DUE\n';
    const r = diffYaml(a, b, { arrayMode: 'key', key: 'id' });
    expect(r.ok && r.rows.length).toBe(2);
  });
  it('errore con il lato e la posizione', () => {
    const r = diffYaml('a: 1\n', 'a: [1\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.side).toBe('b');
  });
  it('documenti multipli e date YAML non rompono il confronto', () => {
    expect(diffYaml('---\na: 1\n---\nb: 2\n', '---\na: 1\n---\nb: 3\n').ok).toBe(true);
    expect(diffYaml('d: 2026-11-19\n', 'd: 2026-11-19\n')).toMatchObject({ ok: true, rows: [] });
  });
});

const A = [['id', 'nome', 'prezzo'], ['1', 'Pane', '2.50'], ['2', 'Latte', '1.20'], ['3', 'Uova', '3.00']];
const B = [['id', 'nome', 'prezzo', 'iva'], ['1', 'Pane', '2.80', '4'], ['3', 'Uova', '3.00', '4'], ['4', 'Miele', '6.00', '10']];

describe('diffCsv', () => {
  it('per chiave: celle cambiate, righe tolte e aggiunte, colonne nuove', () => {
    const r = diffCsv(A, B, { keyColumns: ['id'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const text = rowsToText(r.rows);
    expect(text).toContain('+ column:iva');
    expect(text).toContain('~ [id=1].prezzo: 2.50 -> 2.80');
    expect(text).toContain('- [id=2]');
    expect(text).toContain('+ [id=4]');
    expect(r.rows.some((x) => x.path.startsWith('[id=3]'))).toBe(false);
    expect([r.rowsA, r.rowsB]).toEqual([3, 3]);
  });
  it('per posizione senza chiave', () => {
    const r = diffCsv(A, [['id', 'nome', 'prezzo'], ['1', 'Pane', '2.50'], ['9', 'Latte', '1.20']], {});
    expect(r.ok && rowsToText(r.rows)).toBe('~ [2].id: 2 -> 9\n- [3]: id=3; nome=Uova; prezzo=3.00');
  });
  it('chiave composta, spazi e maiuscole opzionali', () => {
    const a = [['a', 'b', 'v'], ['x', '1', ' Ciao ']];
    const b = [['a', 'b', 'v'], ['x', '1', 'ciao']];
    expect(diffCsv(a, b, { keyColumns: ['a', 'b'] })).toMatchObject({ ok: true, rows: [{ kind: 'changed' }] }); // trim sì, maiuscole no
    expect(diffCsv(a, [['a', 'b', 'v'], ['x', '1', ' Ciao']], { keyColumns: ['a', 'b'] })).toMatchObject({ ok: true, rows: [] });
    const strict = diffCsv(a, b, { keyColumns: ['a', 'b'], trim: false });
    expect(strict.ok && strict.rows.length).toBe(1);
    expect(diffCsv(a, [['a', 'b', 'v'], ['x', '1', ' Ciao']], { keyColumns: ['a', 'b'], trim: false })).toMatchObject({ ok: true, rows: [{ kind: 'changed' }] });
    expect(diffCsv(a, b, { keyColumns: ['a', 'b'], ignoreCase: true })).toMatchObject({ ok: true, rows: [] });
  });
  it('chiavi ripetute si distinguono per ordine', () => {
    const a = [['k', 'v'], ['x', '1'], ['x', '2']];
    const b = [['k', 'v'], ['x', '1'], ['x', '3']];
    const r = diffCsv(a, b, { keyColumns: ['k'] });
    expect(r.ok && rowsToText(r.rows)).toBe('~ [k=x]#2.v: 2 -> 3');
  });
  it('colonna chiave mancante e file vuoto', () => {
    expect(diffCsv(A, B, { keyColumns: ['sku'] })).toMatchObject({ ok: false, error: 'key', side: 'a', column: 'sku' });
    expect(diffCsv([], B)).toMatchObject({ ok: false, error: 'empty', side: 'a' });
  });
});

describe('parseKeyColumns', () => {
  it('separa per virgola e rispetta le virgolette', () => {
    expect(parseKeyColumns('id, nome')).toEqual(['id', 'nome']);
    expect(parseKeyColumns('"a,b",c')).toEqual(['a,b', 'c']);
    expect(parseKeyColumns('')).toEqual([]);
  });
});
