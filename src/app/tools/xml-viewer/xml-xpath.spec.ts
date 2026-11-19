// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { Doc, getNode } from './xml-tree';
import { namespaceMap, resolveNs, runXpath } from './xml-xpath';

const load = (src: string): Doc => {
  const r = parseXml(normalizeNewlines(src));
  if (!r.ok) throw new Error('parse');
  return r.nodes;
};
const LIB = load(`<?xml version="1.0"?><lib><book id="a"><t>Uno</t></book><book id="b"><t>Due</t></book></lib>`);

describe('XPath', () => {
  it('nodi: riporta ai percorsi dell\'albero', () => {
    const r = runXpath(LIB, "//book[@id='b']/t");
    expect(r.ok && r.kind === 'nodes' && r.total).toBe(1);
    if (!r.ok || r.kind !== 'nodes') throw new Error();
    expect(r.items[0].label).toBe('<t> Due');
    expect(getNode(LIB, r.items[0].path!)).toMatchObject({ t: 'el', name: 't' });
    expect(xmlText(r.items[0].path!)).toBe('Due');
  });
  const xmlText = (p: readonly number[]): string => {
    const n = getNode(LIB, p);
    return n?.t === 'el' && n.children[0].t === 'text' ? n.children[0].value : '';
  };
  it('attributi e testo puntano all\'elemento che li contiene', () => {
    const a = runXpath(LIB, '//book/@id');
    if (!a.ok || a.kind !== 'nodes') throw new Error();
    expect(a.items.map((i) => i.label)).toEqual(['@id="a"', '@id="b"']);
    expect(getNode(LIB, a.items[1].path!)).toMatchObject({ name: 'book' });
    const t = runXpath(LIB, '//t/text()');
    if (!t.ok || t.kind !== 'nodes') throw new Error();
    expect(t.items.map((i) => i.label)).toEqual(['Uno', 'Due']);
  });
  it('valori: numeri, stringhe, booleani', () => {
    expect(runXpath(LIB, 'count(//book)')).toEqual({ ok: true, kind: 'value', value: '2' });
    expect(runXpath(LIB, 'string(//t)')).toEqual({ ok: true, kind: 'value', value: 'Uno' });
    expect(runXpath(LIB, 'boolean(//x)')).toEqual({ ok: true, kind: 'value', value: 'false' });
  });
  it('espressione non valida: errore, vuota: niente', () => {
    expect(runXpath(LIB, '//[').ok).toBe(false);
    expect(runXpath(LIB, '  ')).toEqual({ ok: false, message: '' });
  });
});

describe('namespace', () => {
  const NS = load(`<r xmlns="urn:d" xmlns:a="urn:a"><a:x><y/></a:x><z xmlns="urn:z"/></r>`);
  it('mappa dei prefissi e risoluzione per elemento', () => {
    expect([...namespaceMap(NS)]).toEqual([['', 'urn:d'], ['a', 'urn:a']]);
    expect(resolveNs(NS, [0, 0])).toMatchObject({ prefix: 'a', local: 'x', uri: 'urn:a' });
    expect(resolveNs(NS, [0, 0, 0])).toMatchObject({ prefix: '', local: 'y', uri: 'urn:d' });
    expect(resolveNs(NS, [0, 1])).toMatchObject({ uri: 'urn:z' });
    expect(resolveNs(LIB, [1])).toMatchObject({ uri: null });
  });
  it('XPath con i prefissi del documento', () => {
    const r = runXpath(NS, '//a:x/*');
    expect(r.ok && r.kind === 'nodes' && r.total).toBe(1);
    const x = runXpath(NS, '//a:x');
    expect(x.ok && x.kind === 'nodes' && x.total).toBe(1);
  });
});
