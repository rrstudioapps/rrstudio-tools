// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { processLines, shuffle, splitLines } from './sort-lines';

const run = (text: string, o = {}) => processLines(text, o).text;

describe('splitLines', () => {
  it('gestisce i diversi a capo e quello finale', () => {
    expect(splitLines('a\r\nb\rc\nd')).toEqual({ lines: ['a', 'b', 'c', 'd'], trailingNewline: false });
    expect(splitLines('a\nb\n')).toEqual({ lines: ['a', 'b'], trailingNewline: true });
    expect(splitLines('')).toEqual({ lines: [], trailingNewline: false });
    expect(splitLines('\n')).toEqual({ lines: [''], trailingNewline: true });
  });
});

describe('ordinamento', () => {
  it('alfabetico senza distinguere maiuscole, con accenti italiani', () => {
    expect(run('zebra\nÈ\nape\nBar\nape2')).toBe('ape\nape2\nBar\nÈ\nzebra');
  });
  it('alfabetico: "sensibile alle maiuscole" separa minuscole e maiuscole uguali', () => {
    expect(run('b\nB\na\nA', { caseSensitive: true })).toBe('a\nA\nb\nB');
    // senza distinzione l\'ordine tra uguali resta quello di partenza (ordinamento stabile)
    expect(run('b\nB\na\nA')).toBe('a\nA\nb\nB');
    expect(run('B\nb\nA\na')).toBe('A\na\nB\nb');
  });
  it('naturale: i numeri contano come numeri', () => {
    expect(run('file10\nfile2\nfile1', { mode: 'natural' })).toBe('file1\nfile2\nfile10');
    expect(run('file10\nfile2\nfile1', { mode: 'alpha' })).toBe('file1\nfile10\nfile2');
  });
  it('per lunghezza (a parità, alfabetico)', () => {
    expect(run('ccc\na\nbb\naa\nb', { mode: 'length' })).toBe('a\nb\naa\nbb\nccc');
    expect(run('ccc\na\nbb', { mode: 'length', reverse: true })).toBe('ccc\nbb\na');
  });
  it('inverso', () => {
    expect(run('a\nc\nb', { reverse: true })).toBe('c\nb\na');
    expect(run('1\n2\n3', { mode: 'none', reverse: true })).toBe('3\n2\n1');
  });
  it('nessun ordinamento mantiene l\'ordine', () => {
    expect(run('c\na\nb', { mode: 'none' })).toBe('c\na\nb');
  });
  it('casuale: stessa lista di righe, rimescolata con il generatore dato', () => {
    const seq = [0.9, 0.1, 0.5];
    let i = 0;
    const out = processLines('a\nb\nc\nd', { mode: 'random' }, () => seq[i++ % seq.length]).text.split('\n');
    expect(out.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(out).not.toEqual(['a', 'b', 'c', 'd']);
  });
  it('shuffle non modifica l\'originale e conserva gli elementi', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.slice().sort()).toEqual(src);
  });
  it('lingua inglese e italiana usano le regole del collator', () => {
    // in svedese ä viene dopo z, ma it/en trattano ä come a: qui si verifica solo che la lingua sia accettata
    expect(run('b\na', { lang: 'en' })).toBe('a\nb');
  });
});

describe('duplicati', () => {
  it('esatti: tiene la prima occorrenza e conta i tolti', () => {
    const r = processLines('a\nb\na\nA\nb', { mode: 'none', dedupe: 'exact' });
    expect(r.text).toBe('a\nb\nA');
    expect(r.duplicatesRemoved).toBe(2);
    expect(r.linesIn).toBe(5);
    expect(r.linesOut).toBe(3);
  });
  it('ignorando le maiuscole', () => {
    expect(run('a\nb\nA\nB\nc', { mode: 'none', dedupe: 'ignoreCase' })).toBe('a\nb\nc');
  });
  it('ignorando gli spazi multipli', () => {
    expect(run('a  b\na b\n a b ', { mode: 'none', dedupe: 'exact', collapseSpaces: true })).toBe('a  b');
    expect(run('a  b\na b', { mode: 'none', dedupe: 'exact' })).toBe('a  b\na b');
  });
  it('con trim le righe con spazi ai margini diventano uguali', () => {
    expect(run('a\n a \na  ', { mode: 'none', dedupe: 'exact', trim: true })).toBe('a');
  });
});

describe('righe vuote e spazi', () => {
  it('toglie le righe vuote o di soli spazi', () => {
    const r = processLines('a\n\n  \nb', { mode: 'none', removeEmpty: true });
    expect(r.text).toBe('a\nb');
    expect(r.emptyRemoved).toBe(2);
  });
  it('trim ai margini di ogni riga', () => {
    expect(run('  a  \n\tb', { mode: 'none', trim: true })).toBe('a\nb');
  });
  it('mantiene l\'a capo finale e non crea righe vuote in più', () => {
    expect(run('b\na\n')).toBe('a\nb\n');
    expect(run('')).toBe('');
    expect(run('\n', { removeEmpty: true })).toBe('');
  });
  it('a capo Windows diventano \\n', () => {
    expect(run('b\r\na')).toBe('a\nb');
  });
});

describe('conteggi, prefissi, numerazione', () => {
  it('conta le occorrenze (righe uniche con conteggio)', () => {
    expect(run('mela\npera\nmela\nmela\npera\nkiwi', { mode: 'frequency', countOccurrences: true })).toBe('3× mela\n2× pera\n1× kiwi');
    expect(run('b\na\nb', { mode: 'alpha', countOccurrences: true })).toBe('1× a\n2× b');
  });
  it('ordine per frequenza senza unire le righe', () => {
    expect(run('a\nb\nb\nc\nb\nc', { mode: 'frequency' })).toBe('b\nb\nb\nc\nc\na');
  });
  it('prefisso e suffisso', () => {
    expect(run('a\nb', { mode: 'none', prefix: '- ', suffix: ';' })).toBe('- a;\n- b;');
  });
  it('numerazione con inizio e separatore', () => {
    expect(run('b\na', { numbering: true })).toBe('1. a\n2. b');
    expect(run('b\na', { numbering: true, numberStart: 10, numberSeparator: ') ' })).toBe('10) a\n11) b');
    expect(run('a', { numbering: true, numberStart: NaN })).toBe('1. a');
  });
  it('tutto insieme: pulizia, ordine, prefisso e numero', () => {
    const r = processLines('  pera\n\nMela\npera \nmela', {
      trim: true,
      removeEmpty: true,
      dedupe: 'ignoreCase',
      mode: 'alpha',
      prefix: '* ',
      numbering: true,
    });
    expect(r.text).toBe('1. * Mela\n2. * pera');
    expect(r.duplicatesRemoved).toBe(2);
    expect(r.emptyRemoved).toBe(1);
  });
});
