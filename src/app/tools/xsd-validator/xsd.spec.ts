// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { XsdIssue, validateXsd } from './xsd';

const X = (body: string): string => `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">${body}</xs:schema>`;
const run = (xsd: string, xml: string): XsdIssue[] => {
  const r = validateXsd(xsd, xml);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.issues;
};
const codes = (i: XsdIssue[]): string[] => i.map((x) => x.code);

const BOOKS = X(`
  <xs:element name="lib">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="book" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="title" type="xs:string"/>
              <xs:element name="year" type="xs:gYear" minOccurs="0"/>
              <xs:element name="price" type="Price"/>
            </xs:sequence>
            <xs:attribute name="id" type="xs:ID" use="required"/>
            <xs:attribute name="lang" type="Lang"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
  <xs:simpleType name="Price"><xs:restriction base="xs:decimal"><xs:minInclusive value="0"/><xs:fractionDigits value="2"/></xs:restriction></xs:simpleType>
  <xs:simpleType name="Lang"><xs:restriction base="xs:string"><xs:enumeration value="it"/><xs:enumeration value="en"/></xs:restriction></xs:simpleType>`);

describe('struttura', () => {
  it('documento valido', () => {
    expect(run(BOOKS, '<lib><book id="a" lang="it"><title>T</title><year>1999</year><price>12.50</price></book><book id="b"><title>U</title><price>1</price></book></lib>')).toEqual([]);
  });
  it('elemento obbligatorio mancante', () => {
    const i = run(BOOKS, '<lib><book id="a"><title>T</title></book></lib>');
    expect(i[0]).toMatchObject({ code: 'missing', xpath: '/lib/book', params: { expected: 'year, price' } });
  });
  it('elemento inatteso e ordine sbagliato', () => {
    const i = run(BOOKS, '<lib><book id="a"><price>1</price><title>T</title></book></lib>');
    expect(i[0]).toMatchObject({ code: 'unexpected', xpath: '/lib/book/price' });
    expect(i[0].params['expected']).toContain('title');
    expect(codes(run(BOOKS, '<lib><x/></lib>'))).toEqual(['unexpected']);
  });
  it('troppe occorrenze', () => {
    const s = X('<xs:element name="r"><xs:complexType><xs:sequence><xs:element name="a" maxOccurs="2"/></xs:sequence></xs:complexType></xs:element>');
    expect(run(s, '<r><a/><a/></r>')).toEqual([]);
    expect(codes(run(s, '<r><a/><a/><a/></r>'))).toEqual(['unexpected']);
    expect(codes(run(s, '<r/>'))).toEqual(['missing']);
  });
  it('choice e all', () => {
    const c = X('<xs:element name="r"><xs:complexType><xs:choice><xs:element name="a"/><xs:element name="b"/></xs:choice></xs:complexType></xs:element>');
    expect(run(c, '<r><b/></r>')).toEqual([]);
    expect(codes(run(c, '<r><a/><b/></r>'))).toEqual(['unexpected']);
    const a = X('<xs:element name="r"><xs:complexType><xs:all><xs:element name="a"/><xs:element name="b"/></xs:all></xs:complexType></xs:element>');
    expect(run(a, '<r><b/><a/></r>')).toEqual([]);
    expect(codes(run(a, '<r><b/></r>'))).toEqual(['missing']);
  });
  it('testo e figli dove non ammessi, mixed', () => {
    const s = X('<xs:element name="r"><xs:complexType><xs:sequence><xs:element name="a" minOccurs="0"/></xs:sequence></xs:complexType></xs:element>');
    expect(codes(run(s, '<r>testo</r>'))).toEqual(['noText']);
    const m = X('<xs:element name="r"><xs:complexType mixed="true"><xs:sequence><xs:element name="a" minOccurs="0"/></xs:sequence></xs:complexType></xs:element>');
    expect(run(m, '<r>testo <a/></r>')).toEqual([]);
    const t = X('<xs:element name="r" type="xs:string"/>');
    expect(codes(run(t, '<r><x/></r>'))).toEqual(['noChildren']);
  });
  it('radice non dichiarata', () => {
    expect(run(BOOKS, '<altro/>')[0]).toMatchObject({ code: 'noRootDecl' });
  });
});

describe('attributi', () => {
  it('obbligatorio mancante, sconosciuto, valore non ammesso', () => {
    const i = run(BOOKS, '<lib><book lang="fr" x="1"><title>T</title><price>1</price></book></lib>');
    expect(codes(i).sort()).toEqual(['badEnum', 'missingAttr', 'unknownAttr']);
    expect(i.find((x) => x.code === 'badEnum')).toMatchObject({ xpath: '/lib/book/@lang', params: { value: 'fr', list: 'it, en' } });
  });
  it('xmlns e xsi sono ammessi', () => {
    expect(run(BOOKS, '<lib xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="a.xsd"><book id="a"><title>T</title><price>1</price></book></lib>')).toEqual([]);
  });
  it('ID duplicati', () => {
    const i = run(BOOKS, '<lib><book id="a"><title>T</title><price>1</price></book><book id="a"><title>U</title><price>1</price></book></lib>');
    expect(codes(i)).toEqual(['dupId']);
  });
});

describe('tipi semplici', () => {
  const t = (type: string, v: string) => {
    const s = X(`<xs:element name="r" type="${type}"/>`);
    return codes(run(s, `<r>${v}</r>`));
  };
  it('predefiniti', () => {
    expect(t('xs:integer', '12')).toEqual([]);
    expect(t('xs:integer', '1.5')).toEqual(['badType']);
    expect(t('xs:int', '2147483648')).toEqual(['badType']);
    expect(t('xs:positiveInteger', '0')).toEqual(['badType']);
    expect(t('xs:unsignedByte', '256')).toEqual(['badType']);
    expect(t('xs:boolean', 'true')).toEqual([]);
    expect(t('xs:boolean', 'yes')).toEqual(['badType']);
    expect(t('xs:date', '2026-02-30')).toEqual(['badType']);
    expect(t('xs:date', '2024-02-29')).toEqual([]);
    expect(t('xs:dateTime', '2026-11-19T10:00:00Z')).toEqual([]);
    expect(t('xs:dateTime', '2026-11-19')).toEqual(['badType']);
    expect(t('xs:double', '1.5e3')).toEqual([]);
    expect(t('xs:decimal', ' 3.14 ')).toEqual([]);
    expect(t('xs:string', 'qualsiasi cosa')).toEqual([]);
  });
  it('faccette: pattern, lunghezza, intervallo, cifre', () => {
    const s = (inner: string, base = 'xs:string') => X(`<xs:element name="r"><xs:simpleType><xs:restriction base="${base}">${inner}</xs:restriction></xs:simpleType></xs:element>`);
    expect(codes(run(s('<xs:pattern value="[A-Z]{2}\\d{3}"/>'), '<r>AB123</r>'))).toEqual([]);
    expect(codes(run(s('<xs:pattern value="[A-Z]{2}\\d{3}"/>'), '<r>AB12</r>'))).toEqual(['badPattern']);
    expect(codes(run(s('<xs:minLength value="3"/><xs:maxLength value="5"/>'), '<r>ab</r>'))).toEqual(['badLength']);
    expect(codes(run(s('<xs:maxInclusive value="10"/>', 'xs:integer'), '<r>11</r>'))).toEqual(['badRange']);
    expect(codes(run(s('<xs:minExclusive value="0"/>', 'xs:integer'), '<r>0</r>'))).toEqual(['badRange']);
    expect(codes(run(s('<xs:totalDigits value="4"/><xs:fractionDigits value="2"/>', 'xs:decimal'), '<r>12.345</r>'))).toEqual(['badDigits']);
  });
  it('list e union', () => {
    const l = X('<xs:element name="r"><xs:simpleType><xs:list itemType="xs:integer"/></xs:simpleType></xs:element>');
    expect(run(l, '<r>1 2 3</r>')).toEqual([]);
    expect(codes(run(l, '<r>1 x</r>'))).toEqual(['badType']);
    const u = X('<xs:element name="r"><xs:simpleType><xs:union memberTypes="xs:integer xs:boolean"/></xs:simpleType></xs:element>');
    expect(run(u, '<r>true</r>')).toEqual([]);
    expect(codes(run(u, '<r>ciao</r>'))).toEqual(['badType']);
  });
});

describe('tipi complessi', () => {
  it('estensione e simpleContent con attributi', () => {
    const s = X(`
      <xs:element name="r" type="Ext"/>
      <xs:complexType name="Base"><xs:sequence><xs:element name="a"/></xs:sequence><xs:attribute name="x" use="required"/></xs:complexType>
      <xs:complexType name="Ext"><xs:complexContent><xs:extension base="Base"><xs:sequence><xs:element name="b"/></xs:sequence></xs:extension></xs:complexContent></xs:complexType>`);
    expect(run(s, '<r x="1"><a/><b/></r>')).toEqual([]);
    expect(codes(run(s, '<r><a/></r>')).sort()).toEqual(['missing', 'missingAttr']);
    const m = X(`<xs:element name="p"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal"><xs:attribute name="cur" type="xs:string" use="required"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>`);
    expect(run(m, '<p cur="EUR">12.5</p>')).toEqual([]);
    expect(codes(run(m, '<p cur="EUR">x</p>'))).toEqual(['badType']);
  });
  it('group e attributeGroup', () => {
    const s = X(`
      <xs:group name="G"><xs:sequence><xs:element name="a"/><xs:element name="b"/></xs:sequence></xs:group>
      <xs:attributeGroup name="AG"><xs:attribute name="k" use="required"/></xs:attributeGroup>
      <xs:element name="r"><xs:complexType><xs:group ref="G"/><xs:attributeGroup ref="AG"/></xs:complexType></xs:element>`);
    expect(run(s, '<r k="1"><a/><b/></r>')).toEqual([]);
    expect(codes(run(s, '<r><a/></r>')).sort()).toEqual(['missing', 'missingAttr']);
  });
  it('indice tra fratelli omonimi nel percorso', () => {
    const i = run(BOOKS, '<lib><book id="a"><title>T</title><price>1</price></book><book id="b"><title>U</title><price>-1</price></book></lib>');
    expect(i).toHaveLength(1);
    expect(i[0]).toMatchObject({ code: 'badRange', xpath: '/lib/book[2]/price' });
  });
});

describe('errori di schema e di documento', () => {
  it('XML o XSD non ben formato', () => {
    const a = validateXsd('<xs:schema', '<a/>');
    expect(a.ok === false && a.which).toBe('xsd');
    const b = validateXsd(X('<xs:element name="a"/>'), '<a>');
    expect(b.ok === false && b.which).toBe('xml');
  });
  it('non è uno schema, import non supportato', () => {
    expect(validateXsd('<a/>', '<a/>')).toMatchObject({ ok: false, which: 'schema', code: 'notSchema' });
    expect(validateXsd(X('<xs:import namespace="u"/>'), '<a/>')).toMatchObject({ ok: false, which: 'schema', code: 'unsupported', params: { what: 'import' } });
  });
  it('tetto agli errori', () => {
    const s = X('<xs:element name="r"><xs:complexType><xs:sequence><xs:element name="a" type="xs:int" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>');
    const r = validateXsd(s, '<r>' + '<a>x</a>'.repeat(300) + '</r>');
    expect(r.ok && r.issues.length).toBe(200);
    expect(r.ok && r.truncated).toBe(true);
  });
});
