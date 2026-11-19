// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  ConvertError,
  Table,
  detectTextKind,
  flattenValue,
  guessDelimiter,
  neutralizeFormula,
  rowToRecord,
  tableFromJson,
  tableFromMatrix,
  tableToCsvRows,
  tableToJson,
  tableToXlsxRows,
  typedCell,
} from './convert';
import { parseCsv, readWorkbook, unparseCsv, writeXlsx } from './convert-io';

describe('tipi delle celle', () => {
  it('numeri e booleani solo se la conversione è esatta', () => {
    expect(typedCell('12')).toBe(12);
    expect(typedCell('-3.5')).toBe(-3.5);
    expect(typedCell('true')).toBe(true);
    expect(typedCell('false')).toBe(false);
    for (const s of ['007', '1.50', '1e3', '12,5', '+5', '-0', '', ' 3', '9007199254740993', 'True', '0x10']) expect(typedCell(s), s).toBe(s);
  });
});

describe('formule', () => {
  it('antepone un apice al testo che inizia con = + - @ tab CR', () => {
    expect(neutralizeFormula('=SOMMA(A1:A3)')).toBe("'=SOMMA(A1:A3)");
    expect(neutralizeFormula('+39 333 1234567')).toBe("'+39 333 1234567");
    expect(neutralizeFormula('-cmd|calc')).toBe("'-cmd|calc");
    expect(neutralizeFormula('@utente')).toBe("'@utente");
    expect(neutralizeFormula('\tcella')).toBe("'\tcella");
    expect(neutralizeFormula('normale = ok')).toBe('normale = ok');
  });
  it('non tocca i numeri, nemmeno negativi', () => {
    expect(neutralizeFormula('-5')).toBe('-5');
    expect(neutralizeFormula('+3,5')).toBe('+3,5');
  });
  it('CSV e XLSX: testo neutralizzato, numeri veri intatti, interruttore per disattivare', () => {
    const t: Table = { columns: ['a', '=b'], rows: [['=1+1', -4], ['ok', 2]], hasHeader: true };
    expect(tableToCsvRows(t, true)).toEqual([['a', "'=b"], ["'=1+1", '-4'], ['ok', '2']]);
    expect(tableToXlsxRows(t, true)).toEqual([['a', "'=b"], ["'=1+1", -4], ['ok', 2]]);
    expect(tableToCsvRows(t, false)[1][0]).toBe('=1+1');
  });
});

describe('appiattimento e ricostruzione', () => {
  it('oggetti e array annidati con notazione a punti', () => {
    expect(flattenValue({ a: { b: 1, c: [10, 20] }, d: 'x' })).toEqual({ 'a.b': 1, 'a.c.0': 10, 'a.c.1': 20, d: 'x' });
    expect(flattenValue({ v: [], o: {} })).toEqual({ v: '[]', o: '{}' });
  });
  it('JSON annidato → tabella → JSON annidato, identico', () => {
    const src = [
      { id: 1, nome: 'Anna', indirizzo: { via: 'Via Roma 1', citta: 'Torino' }, tag: ['a', 'b'] },
      { id: 2, nome: 'Bruno', indirizzo: { via: 'Via Po 2', citta: 'Asti' }, tag: ['c', 'd'] },
    ];
    const t = tableFromJson(JSON.stringify(src), { flatten: true, header: true });
    expect(t.columns).toEqual(['id', 'nome', 'indirizzo.via', 'indirizzo.citta', 'tag.0', 'tag.1']);
    expect(JSON.parse(tableToJson(t, 'objects', true))).toEqual(src);
  });
  it('senza appiattire: i valori annidati diventano testo JSON', () => {
    const t = tableFromJson('[{"a":{"b":1}}]', { flatten: false, header: true });
    expect(t.rows[0][0]).toBe('{"b":1}');
  });
  it('senza ricostruire le chiavi restano piatte; un conflitto non perde dati', () => {
    expect(rowToRecord(['a.b'], [1], false)).toEqual({ 'a.b': 1 });
    expect(rowToRecord(['a', 'a.b'], [5, 6], true)).toEqual({ a: 5, 'a.b': 6 });
  });
  it('celle vuote dei percorsi annidati omesse; array più corti senza buchi', () => {
    expect(rowToRecord(['t.0', 't.1', 't.2'], ['x', 'y', ''], true)).toEqual({ t: ['x', 'y'] });
    expect(rowToRecord(['n'], [''], true)).toEqual({ n: '' });
  });
  it('oggetti con chiavi diverse: unione delle colonne, null dove manca', () => {
    const t = tableFromJson('[{"a":1},{"b":2},{"a":3,"b":4}]', { flatten: true, header: true });
    expect(t.columns).toEqual(['a', 'b']);
    expect(t.rows).toEqual([[1, null], [null, 2], [3, 4]]);
  });
});

describe('forme JSON in ingresso', () => {
  it('array di array con e senza intestazione', () => {
    const h = tableFromJson('[["n","v"],["a",1]]', { flatten: true, header: true });
    expect(h).toEqual({ columns: ['n', 'v'], rows: [['a', 1]], hasHeader: true });
    const nh = tableFromJson('[["a",1]]', { flatten: true, header: false });
    expect(nh).toEqual({ columns: ['col1', 'col2'], rows: [['a', 1]], hasHeader: false });
  });
  it('oggetto singolo, valori semplici, errori', () => {
    expect(tableFromJson('{"x":1}', { flatten: true, header: true }).rows).toEqual([[1]]);
    expect(tableFromJson('[1,2]', { flatten: true, header: true })).toEqual({ columns: ['value'], rows: [[1], [2]], hasHeader: true });
    expect(() => tableFromJson('{rotto', { flatten: true, header: true })).toThrow(ConvertError);
    expect(() => tableFromJson('42', { flatten: true, header: true })).toThrow(ConvertError);
    expect(() => tableFromJson('[]', { flatten: true, header: true })).toThrow(ConvertError);
  });
});

describe('matrici', () => {
  it('intestazioni vuote e duplicate; righe corte completate', () => {
    const t = tableFromMatrix([['a', '', 'a'], ['1', '2']], { header: true, typed: true });
    expect(t.columns).toEqual(['a', 'col2', 'a_2']);
    expect(t.rows).toEqual([[1, 2, '']]);
  });
  it('senza intestazione: colonne col1…; righe vuote scartate', () => {
    const t = tableFromMatrix([['x', 'y'], ['', ''], ['z', 'w']], { header: false, typed: false });
    expect(t.columns).toEqual(['col1', 'col2']);
    expect(t.rows).toHaveLength(2);
  });
  it('rilevamento del formato e del separatore', () => {
    expect(detectTextKind('  [1]')).toBe('json');
    expect(detectTextKind('a,b')).toBe('csv');
    expect(guessDelimiter('a;b;c\n1,2,3')).toBe(';');
    expect(guessDelimiter('a\tb\tc')).toBe('\t');
    expect(guessDelimiter('"a;b",c')).toBe(',');
    expect(guessDelimiter('solo')).toBe(',');
  });
});

describe('andata e ritorno CSV → JSON → XLSX → CSV', () => {
  // dati inventati: accenti, virgole, virgolette, a capo dentro una cella, numeri negativi e con la virgola decimale
  const csv =
    'nome;città;note;importo;attivo;codice\r\n' +
    '"Zoë Müller";Perugia;"Riga uno\r\nriga due";12,50;true;007\r\n' +
    '"Rossi, Mario";Roma;"Dice ""ciao"", poi esce";1200;false;010\r\n' +
    'Àlex;"Cagliari";;-3;true;1.50\r\n';

  it('nessuna perdita, con tutte le coppie di passaggi', async () => {
    const first = await parseCsv(csv, 'auto');
    expect(first.delimiter).toBe(';');
    const t1 = tableFromMatrix(first.rows, { header: true, typed: true });
    expect(t1.rows[0][4]).toBe(true);
    expect(t1.rows[2][3]).toBe(-3);
    expect(t1.rows[0][5]).toBe('007'); // lo zero iniziale non si perde

    // → JSON → tabella
    const json = tableToJson(t1, 'objects', true);
    const t2 = tableFromJson(json, { flatten: true, header: true });
    expect(t2).toEqual(t1);

    // → XLSX → tabella
    const bytes = await writeXlsx(tableToXlsxRows(t2, true));
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const wb = await readWorkbook(buf);
    expect(wb.sheets).toEqual(['Foglio1']);
    const t3 = tableFromMatrix(wb.read(0), { header: true, typed: false });
    expect(t3).toEqual(t1);

    // → CSV: le righe riparse sono uguali a quelle di partenza
    const out = await unparseCsv(tableToCsvRows(t3, true), ';', false);
    const again = await parseCsv(out, ';');
    expect(again.rows).toEqual(first.rows.map((r) => r.map((c) => c.replace(/\r\n/g, '\n'))));
    expect(out).toContain('"Riga uno\nriga due"'); // a capo nelle celle normalizzati a LF
  });

  it('JSON array di array e CSV senza intestazione', async () => {
    const p = await parseCsv('1,2\n3,4', 'auto');
    const t = tableFromMatrix(p.rows, { header: false, typed: true });
    expect(tableToJson(t, 'arrays', true, 0)).toBe('[[1,2],[3,4]]');
    const back = tableFromJson('[[1,2],[3,4]]', { flatten: true, header: false });
    expect(await unparseCsv(tableToCsvRows(back, true), ',', false)).toBe('1,2\r\n3,4');
  });

  it('virgolette sempre; BOM e separatore tab', async () => {
    expect(await unparseCsv([['a', 'b c']], ',', true)).toBe('"a","b c"');
    expect(await unparseCsv([['a', 'b']], '\t', false)).toBe('a\tb');
  });
});
