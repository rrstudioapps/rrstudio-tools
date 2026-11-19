// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { breadcrumbs, childOf, getAt, isPrefix, nearestValidPath, parentPath, toJsPath, toJsonPointer, typeOf } from './json-path';

const doc = { utenti: [{ nome: 'Ada', 'e-mail': 'a@b.c' }, { nome: 'Bo' }], 'a/b': { '~x': 1 } };

describe('typeOf', () => {
  it('distingue i sei tipi', () => {
    expect(typeOf('a')).toBe('string');
    expect(typeOf(1)).toBe('number');
    expect(typeOf(true)).toBe('boolean');
    expect(typeOf(null)).toBe('null');
    expect(typeOf([])).toBe('array');
    expect(typeOf({})).toBe('object');
  });
});

describe('toJsPath', () => {
  it('radice, chiavi, indici', () => {
    expect(toJsPath([])).toBe('$');
    expect(toJsPath(['utenti', 0, 'nome'])).toBe('$.utenti[0].nome');
  });
  it('chiavi non-identificatore con parentesi e virgolette', () => {
    expect(toJsPath(['utenti', 0, 'e-mail'])).toBe('$.utenti[0]["e-mail"]');
    expect(toJsPath(['a b', 'x"y'])).toBe('$["a b"]["x\\"y"]');
    expect(toJsPath(['1abc'])).toBe('$["1abc"]');
    expect(toJsPath([''])).toBe('$[""]');
  });
  it('$ e _ sono validi negli identificatori', () => {
    expect(toJsPath(['$a', '_b'])).toBe('$.$a._b');
  });
});

describe('toJsonPointer', () => {
  it('radice vuota', () => expect(toJsonPointer([])).toBe(''));
  it('percorso semplice', () => expect(toJsonPointer(['utenti', 0, 'nome'])).toBe('/utenti/0/nome'));
  it('escape di ~ e /', () => {
    expect(toJsonPointer(['a/b', '~x'])).toBe('/a~1b/~0x');
  });
  it('chiave vuota', () => expect(toJsonPointer(['', 'a'])).toBe('//a'));
});

describe('getAt / childOf', () => {
  it('legge in profondità', () => {
    expect(getAt(doc, ['utenti', 1, 'nome'])).toEqual({ found: true, value: 'Bo' });
    expect(getAt(doc, [])).toEqual({ found: true, value: doc });
    expect(getAt(doc, ['a/b', '~x'])).toEqual({ found: true, value: 1 });
  });
  it('non trova ciò che non esiste', () => {
    expect(getAt(doc, ['utenti', 5]).found).toBe(false);
    expect(getAt(doc, ['nope']).found).toBe(false);
    expect(getAt(doc, ['utenti', 0, 'nome', 'x']).found).toBe(false);
  });
  it('non pesca dal prototipo', () => {
    expect(childOf({}, 'toString').found).toBe(false);
    expect(childOf({}, 'constructor').found).toBe(false);
    expect(childOf([1], 'length').found).toBe(false);
  });
  it('accetta indici come stringa su un array', () => {
    expect(childOf([10, 20], '1')).toEqual({ found: true, value: 20 });
    expect(childOf([10, 20], -1).found).toBe(false);
  });
});

describe('nearestValidPath', () => {
  it('lascia un percorso valido', () => expect(nearestValidPath(doc, ['utenti', 0])).toEqual(['utenti', 0]));
  it('torna al prefisso esistente', () => {
    expect(nearestValidPath(doc, ['utenti', 9, 'nome'])).toEqual(['utenti']);
    expect(nearestValidPath(doc, ['zzz', 1])).toEqual([]);
  });
});

describe('prefissi e breadcrumb', () => {
  it('parentPath e isPrefix', () => {
    expect(parentPath(['a', 1])).toEqual(['a']);
    expect(parentPath([])).toEqual([]);
    expect(isPrefix(['a'], ['a', 1])).toBe(true);
    expect(isPrefix(['a', 1], ['a'])).toBe(false);
    expect(isPrefix([1], ['1', 'x'])).toBe(true);
    expect(isPrefix([], [])).toBe(true);
  });
  it('breadcrumbs', () => {
    expect(breadcrumbs([])).toEqual([{ label: '$', path: [] }]);
    expect(breadcrumbs(['utenti', 0, 'nome'])).toEqual([
      { label: '$', path: [] },
      { label: 'utenti', path: ['utenti'] },
      { label: '[0]', path: ['utenti', 0] },
      { label: 'nome', path: ['utenti', 0, 'nome'] },
    ]);
  });
});
