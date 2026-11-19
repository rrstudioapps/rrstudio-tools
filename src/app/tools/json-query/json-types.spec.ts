// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { jsonToSchema, jsonToSchemaText, jsonToTypeScript, pascalCase, singular } from './json-types';

const ts = (v: unknown, o = {}) => jsonToTypeScript(v, o);

describe('nomi', () => {
  it('pascalCase', () => {
    expect(pascalCase('user_name')).toBe('UserName');
    expect(pascalCase('user-name')).toBe('UserName');
    expect(pascalCase('userName')).toBe('UserName');
    expect(pascalCase('first name')).toBe('FirstName');
    expect(pascalCase('città')).toBe('Citta');
    expect(pascalCase('2024')).toBe('_2024');
    expect(pascalCase('???')).toBe('Item');
    expect(pascalCase('date')).toBe('DateValue');
    expect(pascalCase('URL')).toBe('URL');
  });
  it('singular', () => {
    expect(singular('Items')).toBe('Item');
    expect(singular('Categories')).toBe('Category');
    expect(singular('Address')).toBe('Address');
    expect(singular('Status')).toBe('Status');
    expect(singular('Data')).toBe('Data');
    expect(singular('S')).toBe('S');
  });
});

describe('JSON → TypeScript', () => {
  it('oggetto semplice con primitivi', () => {
    expect(ts({ name: 'Anna', age: 31, vip: true, score: 4.5, note: null })).toBe(
      'export interface Root {\n  name: string;\n  age: number;\n  vip: boolean;\n  score: number;\n  note: null;\n}\n',
    );
  });
  it('oggetti annidati con nome PascalCase dalla chiave', () => {
    const out = ts({ user_profile: { first_name: 'A', geo: { lat: 1, lng: 2 } } });
    expect(out).toContain('export interface Root {\n  user_profile: UserProfile;\n}');
    expect(out).toContain('export interface UserProfile {\n  first_name: string;\n  geo: Geo;\n}');
    expect(out).toContain('export interface Geo {\n  lat: number;\n  lng: number;\n}');
    expect(out.indexOf('interface Root')).toBeLessThan(out.indexOf('interface UserProfile'));
  });
  it('array di oggetti: elemento al singolare, chiavi mancanti opzionali, tipi uniti', () => {
    const out = ts({ items: [{ id: 1, tag: 'a' }, { id: 2, price: 3 }, { id: 'x', tag: null }] });
    expect(out).toContain('items: Item[];');
    expect(out).toContain('export interface Item {\n  id: string | number;');
    expect(out).toContain('  tag?: string | null;');
    expect(out).toContain('  price?: number;');
  });
  it('array di primitivi, misti e vuoti', () => {
    expect(ts({ a: [1, 2], b: ['x'], c: [1, 'x', null], d: [] })).toBe(
      'export interface Root {\n  a: number[];\n  b: string[];\n  c: (string | number | null)[];\n  d: unknown[];\n}\n',
    );
  });
  it('array di array', () => {
    expect(ts({ m: [[1, 2], [3]] })).toContain('m: number[][];');
    expect(ts({ m: [[1], ['a']] })).toContain('m: (string | number)[][];');
  });
  it('radice array di oggetti', () => {
    const out = ts([{ id: 1 }, { id: 2, n: 'x' }]);
    expect(out.startsWith('export type Root = RootItem[];')).toBe(true);
    expect(out).toContain('export interface RootItem {\n  id: number;\n  n?: string;\n}');
  });
  it('radice primitiva, vuota o con unione', () => {
    expect(ts('x')).toBe('export type Root = string;\n');
    expect(ts(5)).toBe('export type Root = number;\n');
    expect(ts(null)).toBe('export type Root = null;\n');
    expect(ts([])).toBe('export type Root = unknown[];\n');
    expect(ts({})).toBe('export interface Root {}\n');
  });
  it('oggetti uguali con lo stesso nome in punti diversi riusano la stessa interfaccia', () => {
    const out = ts({ a: { address: { city: 'x' } }, b: { address: { city: 'y' } } });
    expect(out.match(/interface Address /g)).toHaveLength(1);
    expect(out).not.toContain('Address2');
    expect(out).toContain('  address: Address;');
  });
  it('oggetti diversi con lo stesso nome ricevono un numero', () => {
    const out = ts({ a: { address: { street: 's' } }, b: { address: { zip: 1 } } });
    expect(out).toContain('interface Address {');
    expect(out).toContain('interface Address2 {');
  });
  it('chiavi non identificatore tra apici', () => {
    const out = ts({ 'my-key': 1, 'class': 2, '1a': 3, ok_1: 4 });
    expect(out).toContain('  "my-key": number;');
    expect(out).toContain('  class: number;');
    expect(out).toContain('  "1a": number;');
    expect(out).toContain('  ok_1: number;');
  });
  it('opzioni: nome radice, type al posto di interface, senza export', () => {
    expect(ts({ a: 1 }, { rootName: 'api response', style: 'type', exportKeyword: false })).toBe('type ApiResponse = {\n  a: number;\n};\n');
  });
  it('oggetto o null alla radice non crea un nome ricorsivo', () => {
    const out = ts([{ a: 1 }, null]);
    expect(out).toContain('export type Root = (RootItem | null)[];');
  });
  it('oggetto e stringa insieme in un array', () => {
    expect(ts({ v: [{ a: 1 }, 'x'] })).toContain('v: (string | V)[];');
  });
  it('mescola null e oggetto', () => {
    const out = ts({ list: [{ child: null }, { child: { x: 1 } }] });
    expect(out).toContain('child: Child | null;');
  });
  it('non si blocca con una profondità enorme', () => {
    let d: unknown = 1;
    for (let i = 0; i < 400; i++) d = { a: d };
    expect(ts(d).length).toBeGreaterThan(10);
  });
});

describe('JSON → JSON Schema', () => {
  const dialect = 'https://json-schema.org/draft/2020-12/schema';
  it('oggetto con required e tipi', () => {
    expect(jsonToSchema({ name: 'A', age: 3, ratio: 0.5, ok: true, nothing: null })).toEqual({
      $schema: dialect,
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        ratio: { type: 'number' },
        ok: { type: 'boolean' },
        nothing: { type: 'null' },
      },
      required: ['name', 'age', 'ratio', 'ok', 'nothing'],
    });
  });
  it('array di oggetti: required è l\'intersezione delle chiavi', () => {
    expect(jsonToSchema({ rows: [{ id: 1, a: 'x' }, { id: 2, b: 2 }] })).toMatchObject({
      properties: {
        rows: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'integer' }, a: { type: 'string' }, b: { type: 'integer' } }, required: ['id'] },
        },
      },
    });
  });
  it('intero e decimale diventano number; tipi misti, elenco di tipi', () => {
    expect(jsonToSchema([1, 2.5])).toEqual({ $schema: dialect, type: 'array', items: { type: 'number' } });
    expect(jsonToSchema(['a', null])).toEqual({ $schema: dialect, type: 'array', items: { type: ['string', 'null'] } });
    expect(jsonToSchema([1, 'a', true])).toMatchObject({ items: { type: ['string', 'integer', 'boolean'] } });
  });
  it('unioni con oggetti o array usano anyOf', () => {
    expect(jsonToSchema([{ a: 1 }, 'x'])).toMatchObject({ items: { anyOf: [{ type: 'string' }, { type: 'object' }] } });
    expect(jsonToSchema([[1], null])).toMatchObject({ items: { anyOf: [{ type: 'null' }, { type: 'array', items: { type: 'integer' } }] } });
  });
  it('array vuoto, oggetto vuoto, radici primitive', () => {
    expect(jsonToSchema([])).toEqual({ $schema: dialect, type: 'array' });
    expect(jsonToSchema({})).toEqual({ $schema: dialect, type: 'object', properties: {} });
    expect(jsonToSchema('x')).toEqual({ $schema: dialect, type: 'string' });
    expect(jsonToSchema(null)).toEqual({ $schema: dialect, type: 'null' });
  });
  it('proprietà null in alcuni elementi e assente in altri', () => {
    const s = jsonToSchema([{ a: null }, {}]) as { items: { properties: Record<string, unknown>; required?: string[] } };
    expect(s.items.properties['a']).toEqual({ type: 'null' });
    expect(s.items.required).toBeUndefined();
  });
  it('testo: JSON valido con $schema in testa', () => {
    const t = jsonToSchemaText({ a: 1 });
    expect(JSON.parse(t).$schema).toBe(dialect);
    expect(t.startsWith('{\n  "$schema"')).toBe(true);
    expect(t.endsWith('\n')).toBe(true);
  });
  it('chiavi come __proto__ non inquinano', () => {
    const s = jsonToSchema(JSON.parse('{"__proto__": {"x": 1}}')) as { properties: Record<string, unknown> };
    expect(Object.keys(s.properties)).toContain('__proto__');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});
