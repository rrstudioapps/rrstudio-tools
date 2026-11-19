// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { jsonSchemaToXsd, xsdToJsonSchema } from './schema-convert';

const XSD = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="ordine">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="cliente" type="xs:string"/>
        <xs:element name="riga" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="sku" type="Sku"/>
              <xs:element name="qta" type="xs:positiveInteger"/>
              <xs:element name="nota" type="xs:string" minOccurs="0"/>
            </xs:sequence>
            <xs:attribute name="n" type="xs:int" use="required"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="data" type="xs:date"/>
    </xs:complexType>
  </xs:element>
  <xs:simpleType name="Sku">
    <xs:restriction base="xs:string"><xs:pattern value="[A-Z]{3}-\\d{4}"/><xs:maxLength value="8"/></xs:restriction>
  </xs:simpleType>
</xs:schema>`;

const parse = (t: string): any => JSON.parse(t);

describe('xsdToJsonSchema', () => {
  it('elementi, array, attributi con prefisso, tipi con nome e faccette', () => {
    const r = xsdToJsonSchema(XSD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = parse(r.text);
    expect(s.required).toEqual(['ordine']);
    const o = s.properties.ordine;
    expect(o.required).toEqual(['cliente', 'riga']);
    expect(o.properties['@data']).toEqual({ type: 'string', format: 'date' });
    const riga = o.properties.riga;
    expect(riga.type).toBe('array');
    expect(riga.items.required).toEqual(['sku', 'qta', '@n']);
    expect(riga.items.properties.sku).toEqual({ $ref: '#/$defs/Sku' });
    expect(riga.items.properties.qta).toEqual({ type: 'integer', minimum: 1 });
    expect(s.$defs.Sku.pattern).toBe('^(?:[A-Z]{3}-\\d{4})$');
    expect(s.$defs.Sku.maxLength).toBe(8);
    expect(r.warnings).toEqual([]);
  });
  it('choice → oneOf, enumerazioni, simpleContent con attributi, nillable', () => {
    const r = xsdToJsonSchema(`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="p"><xs:complexType>
      <xs:choice><xs:element name="a" type="xs:string"/><xs:element name="b" type="xs:int"/></xs:choice></xs:complexType></xs:element>
      <xs:element name="q"><xs:complexType><xs:simpleContent><xs:extension base="xs:decimal"><xs:attribute name="valuta" type="xs:string"/></xs:extension></xs:simpleContent></xs:complexType></xs:element>
      </xs:schema>`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = parse(r.text);
    expect(s.properties.p.oneOf).toEqual([{ required: ['a'] }, { required: ['b'] }]);
    expect(s.properties.q.properties['#text']).toEqual({ type: 'number' });
    expect(r.warnings.map((w) => w.code)).toEqual(['multiRoot']);
  });
  it('ciò che non si converte è elencato come avviso', () => {
    const r = xsdToJsonSchema(`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:x">
      <xs:import namespace="urn:y" schemaLocation="y.xsd"/>
      <xs:element name="e"><xs:complexType mixed="true"><xs:sequence><xs:any/></xs:sequence></xs:complexType>
      <xs:unique name="u"><xs:selector xpath="."/><xs:field xpath="@a"/></xs:unique></xs:element></xs:schema>`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['namespace', 'import', 'mixed', 'any', 'identity']));
  });
  it('errori: XML non valido e documento che non è uno schema', () => {
    expect(xsdToJsonSchema('<xs:schema>')).toMatchObject({ ok: false, error: { kind: 'xml' } });
    expect(xsdToJsonSchema('<a/>')).toMatchObject({ ok: false, error: { kind: 'schema', code: 'notXsd' } });
  });
  it('prefisso degli attributi personalizzato', () => {
    const r = xsdToJsonSchema(XSD, { attrPrefix: '_' });
    expect(r.ok && parse(r.text).properties.ordine.properties['_data']).toBeTruthy();
  });
});

const JS = {
  type: 'object',
  properties: {
    persona: {
      type: 'object',
      description: 'Una persona',
      properties: {
        '@id': { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 40 },
        eta: { type: 'integer', minimum: 0, maximum: 130 },
        email: { type: 'string', pattern: '^[^@]+@[^@]+$' },
        nato: { type: 'string', format: 'date' },
        ruolo: { enum: ['admin', 'user'] },
        tag: { type: 'array', items: { type: 'string' }, minItems: 1 },
        indirizzo: { $ref: '#/$defs/Indirizzo' },
      },
      required: ['nome', '@id'],
    },
  },
  required: ['persona'],
  $defs: { Indirizzo: { type: 'object', properties: { via: { type: 'string' }, cap: { type: 'string', pattern: '^\\d{5}$' } }, required: ['via'] } },
};

describe('jsonSchemaToXsd', () => {
  it('elemento radice, sequenza, attributi, faccette, array e $defs', () => {
    const r = jsonSchemaToXsd(JSON.stringify(JS));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.text;
    expect(t).toContain('<xs:element name="persona">');
    expect(t).toContain('<xs:attribute name="id" type="xs:integer" use="required"/>');
    expect(t).toContain('<xs:element name="nome">');
    expect(t).toContain('<xs:maxLength value="40"/>');
    expect(t).toContain('<xs:element name="eta" minOccurs="0">');
    expect(t).toContain('<xs:maxInclusive value="130"/>');
    expect(t).toContain('<xs:pattern value="[^@]+@[^@]+"/>');
    expect(t).toContain('<xs:element name="nato" type="xs:date" minOccurs="0"/>');
    expect(t).toContain('<xs:enumeration value="admin"/>');
    expect(t).toContain('<xs:element name="tag" type="xs:string" maxOccurs="unbounded"/>');
    expect(t).toContain('<xs:element name="indirizzo" type="Indirizzo" minOccurs="0"/>');
    expect(t).toContain('<xs:complexType name="Indirizzo">');
    expect(t).toContain('<xs:documentation>Una persona</xs:documentation>');
    expect(r.warnings).toEqual([]);
  });
  it('avvisi per le parole chiave non convertibili', () => {
    const r = jsonSchemaToXsd(JSON.stringify({ type: 'object', properties: { a: { type: 'string', not: { const: 'x' }, uniqueItems: true }, b: { oneOf: [{ type: 'string' }, { type: 'integer' }] } }, if: {}, patternProperties: {} }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.warnings.map((x) => `${x.code}:${x.detail}`);
    expect(w).toEqual(expect.arrayContaining(['ignored:not', 'ignored:uniqueItems', 'ignored:if', 'ignored:patternProperties', 'alternatives:oneOf']));
  });
  it('oneOf di sole costanti diventa un\'enumerazione, allOf unisce le proprietà', () => {
    const r = jsonSchemaToXsd(JSON.stringify({ type: 'object', allOf: [{ properties: { a: { type: 'string' } } }, { properties: { b: { oneOf: [{ const: 'x' }, { const: 'y' }] } } }] }));
    expect(r.ok && r.text).toContain('<xs:enumeration value="y"/>');
    expect(r.ok && r.text).toContain('<xs:element name="a" type="xs:string" minOccurs="0"/>');
    expect(r.ok && r.warnings).toEqual([]);
  });
  it('errori: JSON non valido, non è uno schema, $ref non risolto', () => {
    expect(jsonSchemaToXsd('{')).toMatchObject({ ok: false, error: { kind: 'json' } });
    expect(jsonSchemaToXsd('[1]')).toMatchObject({ ok: false, error: { kind: 'schema', code: 'notJsonSchema' } });
    const r = jsonSchemaToXsd(JSON.stringify({ type: 'object', properties: { a: { $ref: 'http://x/y.json' }, b: { type: 'string' } } }));
    expect(r.ok && r.warnings.map((w) => w.code)).toContain('unresolvedRef');
  });
});

describe('andata e ritorno', () => {
  it('XSD → JSON Schema → XSD conserva elementi, attributi e vincoli', () => {
    const a = xsdToJsonSchema(XSD);
    if (!a.ok) throw new Error('a');
    const b = jsonSchemaToXsd(a.text);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.text).toContain('<xs:element name="ordine">');
    expect(b.text).toContain('<xs:attribute name="n" type="xs:int"'.replace('xs:int', 'xs:integer'));
    expect(b.text).toContain('<xs:element name="riga" maxOccurs="unbounded">');
    expect(b.text).toContain('<xs:simpleType name="Sku">');
    expect(b.text).toContain('<xs:pattern value="[A-Z]{3}-\\d{4}"/>');
  });
});
