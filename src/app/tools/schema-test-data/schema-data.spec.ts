// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { makeRandom } from '../fake-data-generator/fake-data';
import { detectKind, fromPattern, generateRecords, renderRecords } from './schema-data';

const O = { seed: 'abc', count: 5, attrPrefix: '@', textKey: '#text' };
const SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 10, maximum: 20 },
    nome: { type: 'string' },
    email: { type: 'string', format: 'email' },
    codice: { type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' },
    stato: { enum: ['nuovo', 'chiuso'] },
    prezzo: { type: 'number', minimum: 1, maximum: 2, multipleOf: 0.25 },
    tag: { type: 'array', items: { type: 'string', minLength: 3, maxLength: 5 }, minItems: 2, maxItems: 4, uniqueItems: true },
    indirizzo: { $ref: '#/$defs/Indirizzo' },
  },
  required: ['id', 'nome', 'email', 'codice', 'stato', 'prezzo', 'tag', 'indirizzo'],
  $defs: { Indirizzo: { type: 'object', properties: { cap: { type: 'string', pattern: '^\\d{5}$' }, citta: { type: 'string' } }, required: ['cap', 'citta'] } },
};

describe('fromPattern', () => {
  it('rispetta il pattern', () => {
    const r = makeRandom(1);
    for (const p of ['^[A-Z]{3}-\\d{4}$', '^(ab|cd)+x?$', '^\\w{2,5}@[a-z]+\\.(it|com)$', '[^0-9]{4}']) {
      const re = new RegExp(p.startsWith('^') ? p : `^${p}$`);
      for (let i = 0; i < 30; i++) expect(fromPattern(p, r) ?? '').toMatch(re);
    }
  });
  it('sintassi fuori dal sottoinsieme: null', () => {
    expect(fromPattern('(?=a)b', makeRandom(1))).toBeNull();
  });
});

describe('generateRecords', () => {
  it('i valori rispettano lo schema', () => {
    const r = generateRecords(JSON.stringify(SCHEMA), O);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.records.length).toBe(5);
    for (const rec of r.records as any[]) {
      expect(rec.id).toBeGreaterThanOrEqual(10);
      expect(rec.id).toBeLessThanOrEqual(20);
      expect(['nuovo', 'chiuso']).toContain(rec.stato);
      expect(rec.email).toMatch(/^[^@]+@example\.com$/);
      expect(rec.codice).toMatch(/^[A-Z]{3}-\d{4}$/);
      expect((rec.prezzo * 4) % 1).toBeCloseTo(0, 6);
      expect(rec.tag.length).toBeGreaterThanOrEqual(2);
      expect(rec.tag.length).toBeLessThanOrEqual(4);
      expect(new Set(rec.tag).size).toBe(rec.tag.length);
      expect(rec.indirizzo.cap).toMatch(/^\d{5}$/);
    }
    expect(r.warnings).toEqual([]);
  });
  it('stesso seme, stessi dati; seme diverso, dati diversi', () => {
    const a = generateRecords(JSON.stringify(SCHEMA), O);
    const b = generateRecords(JSON.stringify(SCHEMA), O);
    const c = generateRecords(JSON.stringify(SCHEMA), { ...O, seed: 'altro' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
  it('il numero di record è limitato', () => {
    const r = generateRecords('{"type":"integer"}', { ...O, count: 99999 });
    expect(r.ok && r.records.length).toBe(1000);
  });
  it('da XSD: attributi con prefisso e radice unica', () => {
    const xsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="libro"><xs:complexType><xs:sequence>
      <xs:element name="titolo" type="xs:string"/><xs:element name="prezzo" type="xs:decimal"/></xs:sequence>
      <xs:attribute name="isbn" type="xs:string" use="required"/></xs:complexType></xs:element></xs:schema>`;
    expect(detectKind(xsd)).toBe('xsd');
    const r = generateRecords(xsd, { ...O, count: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.records[0] as object)).toEqual(['libro']);
    expect((r.records[0] as any).libro['@isbn']).toBeTruthy();
    const xml = renderRecords(r.records, 'xml', { attrPrefix: '@', textKey: '#text', indent: 2 });
    expect(xml.ok && xml.text).toMatch(/<records>[\s\S]*<libro isbn="[^"]+">[\s\S]*<libro isbn=/);
  });
  it('avvisi: pattern fuori sottoinsieme e intervallo vuoto', () => {
    const r = generateRecords(JSON.stringify({ type: 'object', properties: { a: { type: 'string', pattern: '(?=x)y' }, b: { type: 'integer', minimum: 5, maximum: 1 } }, required: ['a', 'b'] }), O);
    expect(r.ok && r.warnings.map((w) => w.code).sort()).toEqual(['patternUnsupported', 'rangeEmpty']);
  });
  it('errori: JSON non valido, XSD non valido', () => {
    expect(generateRecords('{', O)).toMatchObject({ ok: false, error: { kind: 'json' } });
    expect(generateRecords('<xs:schema>', O)).toMatchObject({ ok: false, error: { kind: 'xml' } });
    expect(generateRecords('[1]', O)).toMatchObject({ ok: false, error: { kind: 'schema' } });
  });
  it('ricorsione: lo schema che rimanda a se stesso termina', () => {
    const r = generateRecords(JSON.stringify({ $ref: '#/$defs/N', $defs: { N: { type: 'object', properties: { v: { type: 'integer' }, f: { type: 'array', items: { $ref: '#/$defs/N' } } }, required: ['v', 'f'] } } }), { ...O, count: 1 });
    expect(r.ok).toBe(true);
  });
});

describe('renderRecords', () => {
  const recs = [{ id: 1, nome: 'A', dati: { x: 1 } }, { id: 2, nome: 'B, "c"', dati: { x: 2 } }];
  it('JSON: un record = oggetto, più record = array', () => {
    expect(JSON.parse((renderRecords([recs[0]], 'json', { attrPrefix: '@', textKey: '#text', indent: 2 }) as any).text)).toEqual(recs[0]);
    expect(JSON.parse((renderRecords(recs, 'json', { attrPrefix: '@', textKey: '#text', indent: 2 }) as any).text)).toHaveLength(2);
  });
  it('CSV: colonne appiattite e virgolette', () => {
    const r = renderRecords(recs, 'csv', { attrPrefix: '@', textKey: '#text', indent: 2 });
    expect(r.ok && r.text).toBe('id,nome,dati.x\n1,A,1\n2,"B, ""c""",2\n');
  });
  it('XML di più record senza radice unica', () => {
    const r = renderRecords(recs, 'xml', { attrPrefix: '@', textKey: '#text', indent: 2 });
    expect(r.ok && r.text).toContain('<records>');
    expect(r.ok && (r.text.match(/<record>/g) ?? []).length).toBe(2);
  });
});
