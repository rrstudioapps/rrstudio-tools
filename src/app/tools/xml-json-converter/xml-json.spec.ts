// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, XmlJsonOptions, inferValue, jsonToXml, xmlToJson } from './xml-json';

const O = (p: Partial<XmlJsonOptions> = {}): XmlJsonOptions => ({ ...DEFAULT_OPTIONS, ...p });
const toJson = (xml: string, p: Partial<XmlJsonOptions> = {}) => {
  const r = xmlToJson(xml, O(p));
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.json;
};
const toXml = (json: string, p: Partial<XmlJsonOptions> = {}) => {
  const r = jsonToXml(json, O(p));
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.text;
};

describe('da XML a JSON', () => {
  it('attributi, testo, figli ripetuti ed elementi vuoti', () => {
    const xml = '<lib n="1"><book id="a">Uno &amp; due</book><book id="b"><t>Tre</t></book><empty/><x>  </x><note>ciao</note></lib>';
    expect(toJson(xml)).toEqual({
      lib: {
        '@n': '1',
        book: [{ '@id': 'a', '#text': 'Uno & due' }, { '@id': 'b', t: 'Tre' }],
        empty: null,
        x: '  ',
        note: 'ciao',
      },
    });
  });
  it('CDATA e contenuto misto', () => {
    expect(toJson('<p>a <b>x</b><![CDATA[<y>]]> c</p>')).toEqual({ p: { b: 'x', '#text': 'a <y> c' } });
  });
  it('opzioni: array sempre, prefisso, inferenza di tipo', () => {
    const xml = '<r a="1"><n>2</n><b>true</b><s>007</s></r>';
    expect(toJson(xml, { forceArrays: true, attrPrefix: '_', infer: true })).toEqual({ r: { _a: 1, n: [2], b: [true], s: ['007'] } });
  });
  it('inferValue non perde cifre', () => {
    expect(inferValue('12')).toBe(12);
    expect(inferValue('1.50')).toBe('1.50');
    expect(inferValue('1.5')).toBe(1.5);
    expect(inferValue('0123')).toBe('0123');
    expect(inferValue('12345678901234567890')).toBe('12345678901234567890');
    expect(inferValue('-0.25e2')).toBe('-0.25e2');
    expect(inferValue('-0.25')).toBe(-0.25);
  });
  it('XML non valido: errore con posizione', () => {
    const r = xmlToJson('<a><b></a>', O());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.stage).toBe('xml');
  });
});

describe('da JSON a XML', () => {
  it('radice unica, attributi, testo e array', () => {
    const json = JSON.stringify({ lib: { '@n': '1', book: [{ '@id': 'a', '#text': 'x & y' }, { t: 'Tre' }], empty: null } });
    expect(toXml(json, { declaration: false })).toBe(
      '<lib n="1">\n  <book id="a">x &amp; y</book>\n  <book>\n    <t>Tre</t>\n  </book>\n  <empty/>\n</lib>\n',
    );
  });
  it('senza radice unica usa rootName; riga sola con indent 0', () => {
    expect(toXml('{"a":1,"b":[true,"x"]}', { indent: 0, declaration: false, rootName: 'dati' })).toBe('<dati><a>1</a><b>true</b><b>x</b></dati>');
    expect(toXml('[1,2]', { indent: 0, declaration: false })).toBe('<root>1</root><root>2</root>');
  });
  it('dichiarazione e andata e ritorno', () => {
    const xml = '<r a="1"><x>1</x><x>2</x><y/></r>';
    const json = JSON.stringify(toJson(xml));
    expect(toXml(json, { declaration: true, indent: 0 })).toBe('<?xml version="1.0" encoding="UTF-8"?><r a="1"><x>1</x><x>2</x><y/></r>');
  });
  it('errori: nome non valido, attributo strutturato, JSON rotto', () => {
    expect(jsonToXml('{"a b":1}', O())).toMatchObject({ ok: false, error: { stage: 'write', code: 'name', detail: 'a b' } });
    expect(jsonToXml('{"r":{"@a":{"x":1}}}', O())).toMatchObject({ ok: false, error: { stage: 'write', code: 'attr' } });
    expect(jsonToXml('{"a":', O())).toMatchObject({ ok: false, error: { stage: 'json' } });
  });
  it('caratteri speciali negli attributi e nel testo', () => {
    expect(toXml('{"r":{"@a":"\\"<&>","#text":"<&>"}}', { declaration: false, indent: 0 })).toBe('<r a="&quot;&lt;&amp;&gt;">&lt;&amp;&gt;</r>');
  });
});
