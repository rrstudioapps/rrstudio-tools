// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { FormatOptions, domCheck, formatXml, minifyXml, normalizeNewlines, parseXml, xmlToJson } from './xml';

const o2: FormatOptions = { indent: 2, keepComments: true };
const fmt = (s: string, o: FormatOptions = o2) => {
  const r = formatXml(s, o);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.text;
};
const err = (s: string) => {
  const r = parseXml(normalizeNewlines(s));
  if (r.ok) throw new Error('atteso errore');
  return r.error;
};

describe('formatXml', () => {
  it('rientra gli elementi annidati', () => {
    expect(fmt('<a><b><c>x</c></b><d/></a>')).toBe('<a>\n  <b>\n    <c>x</c>\n  </b>\n  <d/>\n</a>\n');
  });
  it('rispetta l\'indentazione scelta', () => {
    expect(fmt('<a><b/></a>', { ...o2, indent: 4 })).toBe('<a>\n    <b/>\n</a>\n');
    expect(fmt('<a><b/></a>', { ...o2, indent: 'tab' })).toBe('<a>\n\t<b/>\n</a>\n');
  });
  it('rifà il rientro di un XML già rientrato in modo diverso', () => {
    const messy = '<a>\r\n      <b>1</b>\r\n\t<c>\r\n<d>2</d></c>\r\n</a>';
    expect(fmt(messy)).toBe('<a>\n  <b>1</b>\n  <c>\n    <d>2</d>\n  </c>\n</a>\n');
  });
  it('conserva dichiarazione, doctype, commenti e CDATA', () => {
    const src = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE note [<!ENTITY a "b">]><note><!-- ciao --><s><![CDATA[<x> & y]]></s></note>';
    expect(fmt(src)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE note [<!ENTITY a "b">]>\n<note>\n  <!-- ciao -->\n  <s><![CDATA[<x> & y]]></s>\n</note>\n',
    );
  });
  it('toglie i commenti su richiesta', () => {
    expect(fmt('<a><!--x--><b/></a>', { ...o2, keepComments: false })).toBe('<a>\n  <b/>\n</a>\n');
  });
  it('non decodifica le entità e conserva le virgolette degli attributi', () => {
    expect(fmt(`<a  x = 'a"b'   y="&amp;&#233;">1 &lt; 2 &#x41;</a>`)).toBe(`<a x='a"b' y="&amp;&#233;">1 &lt; 2 &#x41;</a>\n`);
  });
  it('contenuto misto: resta in linea, il testo non cambia', () => {
    expect(fmt('<p>ciao <b>mondo</b> fine</p>')).toBe('<p>ciao <b>mondo</b> fine</p>\n');
  });
  it('elemento vuoto con tag di chiusura resta com\'è', () => {
    expect(fmt('<a><b></b></a>')).toBe('<a>\n  <b></b>\n</a>\n');
  });
  it('xml:space="preserve" lascia il contenuto intatto', () => {
    expect(fmt('<a><pre xml:space="preserve">  x\n   <b/>  </pre></a>')).toBe(
      '<a>\n  <pre xml:space="preserve">  x\n   <b/>  </pre>\n</a>\n',
    );
  });
  it('namespace e nomi con trattino o Unicode', () => {
    expect(fmt('<ns:a xmlns:ns="u"><ns:b-c/><città/></ns:a>')).toBe('<ns:a xmlns:ns="u">\n  <ns:b-c/>\n  <città/>\n</ns:a>\n');
  });
  it('è idempotente', () => {
    const once = fmt('<a><b x="1"><c>t</c><!--k--></b><d/></a>');
    expect(fmt(once)).toBe(once);
  });
});

describe('minifyXml', () => {
  it('toglie gli spazi tra i tag', () => {
    const r = minifyXml('<a>\n  <b> x </b>\n  <c/>\n</a>', o2);
    expect(r).toEqual({ ok: true, text: '<a><b> x </b><c/></a>' });
  });
  it('commenti e CDATA', () => {
    const src = '<a>\n<!-- c -->\n<![CDATA[ 1 < 2 ]]>\n</a>';
    expect(minifyXml(src, o2)).toEqual({ ok: true, text: '<a><!-- c --><![CDATA[ 1 < 2 ]]></a>' });
    expect(minifyXml(src, { ...o2, keepComments: false })).toEqual({ ok: true, text: '<a><![CDATA[ 1 < 2 ]]></a>' });
  });
  it('riduce a un unico tag gli elementi vuoti', () => {
    expect(minifyXml('<a><b></b></a>', o2)).toEqual({ ok: true, text: '<a><b/></a>' });
  });
});

describe('errori di buona formazione', () => {
  it('tag di chiusura diverso', () => {
    const e = err('<a>\n  <b>\n  </c>\n</a>');
    expect(e.code).toBe('mismatch');
    expect(e.params).toMatchObject({ expected: 'b', found: 'c', line: 2 });
    expect(e.line).toBe(3);
    expect(e.column).toBe(3);
  });
  it('tag non chiuso a fine file', () => {
    const e = err('<a>\n<b>x</b>\n');
    expect(e.code).toBe('unclosed');
    expect(e.params).toMatchObject({ name: 'a', line: 1 });
  });
  it('tag di chiusura senza apertura', () => {
    expect(err('<a/></b>').code).toBe('unexpectedEnd');
  });
  it('più radici e testo fuori dalla radice', () => {
    expect(err('<a/><b/>')).toMatchObject({ code: 'multiRoot', line: 1, column: 5 });
    expect(err('x<a/>').code).toBe('textOutside');
    expect(err('<a/>x').code).toBe('textOutside');
  });
  it('documento senza radice', () => {
    expect(err('').code).toBe('noRoot');
    expect(err('<!-- solo commento -->').code).toBe('noRoot');
  });
  it('attributi: duplicati, senza valore, senza virgolette, "<" nel valore', () => {
    expect(err('<a x="1" x="2"/>')).toMatchObject({ code: 'dupAttr', column: 10 });
    expect(err('<a x/>').code).toBe('attrNoValue');
    expect(err('<a x=1/>').code).toBe('attrNoQuote');
    expect(err('<a x="<"/>').code).toBe('ltInAttr');
    expect(err('<a x="1"y="2"/>').code).toBe('badAttr');
  });
  it('nomi non validi', () => {
    expect(err('<1a/>').code).toBe('badName');
    expect(err('<a 1b="x"/>').code).toBe('badAttrName');
    expect(err('< a/>').code).toBe('badName');
  });
  it('e commerciale non valida', () => {
    expect(err('<a>R&D</a>')).toMatchObject({ code: 'badAmp', line: 1, column: 5 });
    expect(err('<a x="a&b"/>').code).toBe('badAmp');
    expect(parseXml('<a>&amp; &#65; &#x41; &nbsp;</a>').ok).toBe(true);
  });
  it('costrutti non terminati', () => {
    expect(err('<a><!-- x</a>').code).toBe('unterminatedComment');
    expect(err('<a><![CDATA[ x</a>').code).toBe('unterminatedCdata');
    expect(err('<a><?pi </a>').code).toBe('unterminatedPi');
    expect(err('<a x="1').code).toBe('unterminatedTag');
    expect(err('<a').code).toBe('unterminatedTag');
    expect(err('<!DOCTYPE a [<a/>').code).toBe('unterminatedDoctype');
  });
  it('CDATA fuori dalla radice e "]]>" nel testo', () => {
    expect(err('<![CDATA[x]]><a/>').code).toBe('cdataOutside');
    expect(err('<a>x ]]> y</a>').code).toBe('cdataEnd');
  });
  it('riga e colonna corrette in un documento lungo', () => {
    const e = err('<a>\n<b>\n  <c x="1" x="2"/>\n</b></a>');
    expect(e).toMatchObject({ line: 3, column: 12 });
  });
});

describe('xmlToJson (DOMParser)', () => {
  it('attributi con @, testo e array per i nomi ripetuti', () => {
    const r = xmlToJson('<lib id="1"><book>A</book><book lang="it">B</book><n/></lib>', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.text)).toEqual({
        lib: { '@id': '1', book: ['A', { '@lang': 'it', '#text': 'B' }], n: null },
      });
    }
  });
  it('CDATA e entità diventano testo normale', () => {
    const r = xmlToJson('<a><b><![CDATA[<x>]]></b><c>a &amp; b &#233;</c></a>', 4);
    expect(r.ok && JSON.parse(r.text)).toEqual({ a: { b: '<x>', c: 'a & b é' } });
  });
  it('rispetta l\'indentazione', () => {
    const r = xmlToJson('<a><b>1</b></a>', 'tab');
    expect(r.ok && r.text).toBe('{\n\t"a": {\n\t\t"b": "1"\n\t}\n}\n');
  });
  it('nome "__proto__" resta un dato', () => {
    const r = xmlToJson('<a><__proto__>x</__proto__></a>', 2);
    expect(r.ok && r.text).toContain('__proto__');
  });
  it('gli errori di buona formazione arrivano prima del DOM', () => {
    const r = xmlToJson('<a><b></a>', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('mismatch');
  });
});

describe('domCheck', () => {
  it('trova un\'entità non definita che il tokenizer accetta', () => {
    expect(parseXml('<a>&foo;</a>').ok).toBe(true);
    const e = domCheck('<a>&foo;</a>');
    expect(e).not.toBeNull();
    expect(e?.code).toBe('dom');
  });
  it('null per un XML valido', () => {
    expect(domCheck('<a><b/></a>')).toBeNull();
  });
});

describe('contenuto misto e xml:space', () => {
  it('la formattazione non altera il testo del contenuto misto', () => {
    expect(fmt('<p>Ciao <b>mondo</b> bello</p>')).toBe('<p>Ciao <b>mondo</b> bello</p>\n');
    expect(fmt('<p><b>a</b> <i>b</i> testo</p>')).toBe('<p><b>a</b> <i>b</i> testo</p>\n');
  });
  it('il minify conserva spazi e nodi di soli spazi nel contenuto misto', () => {
    expect(minifyXml('<p>Ciao <b>x</b> <i>y</i> fine</p>', o2)).toEqual({ ok: true, text: '<p>Ciao <b>x</b> <i>y</i> fine</p>' });
  });
  it('xml:space="default" su un discendente annulla il preserve', () => {
    const r = parseXml('<a xml:space="preserve"><b xml:space="default"><c/></b><d/></a>');
    if (!r.ok) throw new Error('parse');
    const a = r.nodes[0] as { children: { preserve: boolean; children: { preserve: boolean }[] }[] };
    expect(a.children[0].preserve).toBe(false);
    expect(a.children[0].children[0].preserve).toBe(false);
    expect(a.children[1].preserve).toBe(true);
  });
});
