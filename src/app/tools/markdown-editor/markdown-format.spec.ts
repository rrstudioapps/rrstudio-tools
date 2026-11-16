// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { buildHtmlDocument, documentTitle } from './markdown-export';
import { applyFormat } from './markdown-format';

const st = (text: string, start: number, end = start) => ({ text, start, end });

describe('scorciatoie', () => {
  it('grassetto e corsivo attorno alla selezione, e secondo clic li toglie', () => {
    const a = applyFormat(st('ciao mondo', 5, 10), 'bold');
    expect(a).toEqual({ text: 'ciao **mondo**', start: 7, end: 12 });
    expect(applyFormat(a, 'bold')).toEqual({ text: 'ciao mondo', start: 5, end: 10 });
    expect(applyFormat(st('ciao', 0, 4), 'italic').text).toBe('*ciao*');
  });
  it('senza selezione inserisce un segnaposto selezionato', () => {
    const r = applyFormat(st('ab', 1), 'bold');
    expect(r.text).toBe('a**testo**b');
    expect(r.text.slice(r.start, r.end)).toBe('testo');
  });
  it('link: il testo selezionato diventa il testo del link e l’indirizzo è selezionato', () => {
    const r = applyFormat(st('vedi qui ora', 5, 8), 'link');
    expect(r.text).toBe('vedi [qui](https://) ora');
    expect(r.text.slice(r.start, r.end)).toBe('https://');
  });
  it('titolo: cicla # ## ### nessuno', () => {
    let s = st('Titolo', 3);
    s = applyFormat(s, 'heading');
    expect(s.text).toBe('# Titolo');
    s = applyFormat(s, 'heading');
    expect(s.text).toBe('## Titolo');
    s = applyFormat(s, 'heading');
    expect(s.text).toBe('### Titolo');
    s = applyFormat(s, 'heading');
    expect(s.text).toBe('Titolo');
    expect(applyFormat(st('uno\ndue', 5), 'heading').text).toBe('uno\n# due');
  });
  it('elenco: prefisso su ogni riga selezionata, e di nuovo lo toglie', () => {
    const a = applyFormat(st('a\nb\nc', 0, 3), 'list');
    expect(a.text).toBe('- a\n- b\nc');
    expect(applyFormat({ ...a, start: 0, end: 7 }, 'list').text).toBe('a\nb\nc');
    expect(applyFormat(st('x', 0), 'list').text).toBe('- x');
  });
  it('codice: in linea o a blocchi se la selezione è su più righe', () => {
    expect(applyFormat(st('a b', 0, 1), 'code').text).toBe('`a` b');
    expect(applyFormat(st('a\nb', 0, 3), 'code').text).toBe('```\na\nb\n```');
  });
});

describe('esportazione', () => {
  it('titolo del documento dal primo titolo', () => {
    expect(documentTitle('# Il **mio** [doc](x)\n\ntesto', 'Senza titolo')).toBe('Il mio doc');
    expect(documentTitle('niente titoli', 'Senza titolo')).toBe('Senza titolo');
    expect(documentTitle('', 'X')).toBe('X');
  });
  it('documento HTML autonomo, senza script né risorse esterne', () => {
    const html = buildHtmlDocument('A <b> & "c"', '<p>ciao</p>', 'it');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="it">');
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).toContain('<main>\n<p>ciao</p>\n</main>');
    expect(html).not.toMatch(/<script|<link|@import|url\(/i);
    expect(html).toContain('@media print');
  });
});
