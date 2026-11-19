// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  addChild, changeType, convertValue, duplicateAt, editableText, moveAt, parseEditedValue, removeAt, renameKey, setValue, uniqueKey,
} from './json-edit';

const make = () => ({ a: 1, b: { c: [1, 2, 3], d: 'x' }, e: null });

/** Esegue l'operazione e verifica che il documento di partenza non sia cambiato. */
function immutably<T>(fn: (doc: ReturnType<typeof make>) => T): T {
  const doc = make();
  const snapshot = JSON.stringify(doc);
  const r = fn(doc);
  expect(JSON.stringify(doc)).toBe(snapshot);
  return r;
}

function must(r: { ok: boolean }): asserts r is { ok: true; root: unknown; path: readonly (string | number)[] } {
  expect(r.ok).toBe(true);
}

describe('setValue', () => {
  it('cambia un valore annidato senza toccare l\'originale', () => {
    const r = immutably((d) => setValue(d, ['b', 'c', 1], 99));
    must(r);
    expect(r.root).toEqual({ a: 1, b: { c: [1, 99, 3], d: 'x' }, e: null });
  });
  it('condivide i rami non modificati', () => {
    const d = make();
    const r = setValue(d, ['a'], 2);
    must(r);
    expect((r.root as typeof d).b).toBe(d.b);
  });
  it('sostituisce la radice', () => {
    const r = setValue(make(), [], 5);
    must(r);
    expect(r.root).toBe(5);
  });
  it('percorso inesistente', () => {
    expect(setValue(make(), ['zz', 'y'], 1)).toEqual({ ok: false, error: 'notfound' });
  });
  it('stesso valore: stesso riferimento', () => {
    const d = make();
    const r = setValue(d, ['a'], 1);
    must(r);
    expect(r.root).toBe(d);
  });
});

describe('renameKey', () => {
  it('rinomina mantenendo l\'ordine', () => {
    const r = immutably((d) => renameKey(d, ['b'], 'bb'));
    must(r);
    expect(Object.keys(r.root as object)).toEqual(['a', 'bb', 'e']);
    expect(r.path).toEqual(['bb']);
  });
  it('rinomina una chiave annidata', () => {
    const r = renameKey(make(), ['b', 'd'], 'dd');
    must(r);
    expect(r.root).toEqual({ a: 1, b: { c: [1, 2, 3], dd: 'x' }, e: null });
    expect(r.path).toEqual(['b', 'dd']);
  });
  it('rifiuta i duplicati', () => {
    expect(renameKey(make(), ['b'], 'a')).toEqual({ ok: false, error: 'duplicate' });
  });
  it('stesso nome: nessun cambiamento', () => {
    const d = make();
    const r = renameKey(d, ['a'], 'a');
    must(r);
    expect(r.root).toBe(d);
  });
  it('non si rinomina la radice né un elemento di array', () => {
    expect(renameKey(make(), [], 'x')).toEqual({ ok: false, error: 'root' });
    expect(renameKey(make(), ['b', 'c', 0], 'x')).toEqual({ ok: false, error: 'invalid' });
  });
  it('accetta la chiave vuota e "__proto__" come dati', () => {
    const r = renameKey({ a: 1 }, ['a'], '__proto__');
    must(r);
    expect(Object.keys(r.root as object)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(r.root)).toBe(Object.prototype);
    const r2 = renameKey({ a: 1 }, ['a'], '');
    must(r2);
    expect(Object.keys(r2.root as object)).toEqual(['']);
  });
});

describe('uniqueKey', () => {
  it('numera i duplicati', () => {
    expect(uniqueKey({}, 'k')).toBe('k');
    expect(uniqueKey({ k: 1 }, 'k')).toBe('k2');
    expect(uniqueKey({ k: 1, k2: 1 }, 'k')).toBe('k3');
  });
});

describe('addChild', () => {
  it('aggiunge una chiave a un oggetto con nome libero', () => {
    const r = immutably((d) => addChild(d, ['b']));
    must(r);
    expect(r.root).toEqual({ a: 1, b: { c: [1, 2, 3], d: 'x', chiave: null }, e: null });
    expect(r.path).toEqual(['b', 'chiave']);
  });
  it('due aggiunte di fila non si scontrano', () => {
    const r1 = addChild(make(), []);
    must(r1);
    const r2 = addChild(r1.root, []);
    must(r2);
    expect(r2.path).toEqual(['chiave2']);
  });
  it('aggiunge in coda a un array', () => {
    const r = addChild(make(), ['b', 'c'], 7);
    must(r);
    expect((r.root as ReturnType<typeof make>).b.c).toEqual([1, 2, 3, 7]);
    expect(r.path).toEqual(['b', 'c', 3]);
  });
  it('non si aggiunge a un valore semplice', () => {
    expect(addChild(make(), ['a'])).toEqual({ ok: false, error: 'type' });
  });
  it('funziona sulla radice array', () => {
    const r = addChild([], [], 'x');
    must(r);
    expect(r.root).toEqual(['x']);
  });
});

describe('removeAt', () => {
  it('elimina da un array e seleziona l\'elemento che prende il posto', () => {
    const r = immutably((d) => removeAt(d, ['b', 'c', 1]));
    must(r);
    expect((r.root as ReturnType<typeof make>).b.c).toEqual([1, 3]);
    expect(r.path).toEqual(['b', 'c', 1]);
  });
  it('elimina l\'ultimo elemento: seleziona il precedente', () => {
    const r = removeAt(make(), ['b', 'c', 2]);
    must(r);
    expect(r.path).toEqual(['b', 'c', 1]);
  });
  it('array che si svuota: seleziona il genitore', () => {
    const r = removeAt({ x: [1] }, ['x', 0]);
    must(r);
    expect(r.path).toEqual(['x']);
  });
  it('elimina una chiave di oggetto', () => {
    const r = immutably((d) => removeAt(d, ['a']));
    must(r);
    expect(r.root).toEqual({ b: { c: [1, 2, 3], d: 'x' }, e: null });
    expect(r.path).toEqual(['b']);
  });
  it('oggetto che si svuota: seleziona il genitore', () => {
    const r = removeAt({ o: { k: 1 } }, ['o', 'k']);
    must(r);
    expect(r.path).toEqual(['o']);
  });
  it('la radice non si elimina; un nodo inesistente dà errore', () => {
    expect(removeAt(make(), [])).toEqual({ ok: false, error: 'root' });
    expect(removeAt(make(), ['nope'])).toEqual({ ok: false, error: 'notfound' });
    expect(removeAt(make(), ['b', 'c', 9])).toEqual({ ok: false, error: 'notfound' });
  });
});

describe('duplicateAt', () => {
  it('duplica un elemento di array subito dopo', () => {
    const r = immutably((d) => duplicateAt(d, ['b', 'c', 0]));
    must(r);
    expect((r.root as ReturnType<typeof make>).b.c).toEqual([1, 1, 2, 3]);
    expect(r.path).toEqual(['b', 'c', 1]);
  });
  it('duplica una chiave con nome libero, subito dopo', () => {
    const r = immutably((d) => duplicateAt(d, ['a']));
    must(r);
    expect(Object.keys(r.root as object)).toEqual(['a', 'a_copia', 'b', 'e']);
    expect(r.path).toEqual(['a_copia']);
  });
  it('duplicare due volte numera la copia', () => {
    const r1 = duplicateAt({ k: 1 }, ['k']);
    must(r1);
    const r2 = duplicateAt(r1.root, ['k']);
    must(r2);
    expect(r2.path).toEqual(['k_copia2']);
  });
  it('la radice non si duplica', () => {
    expect(duplicateAt(make(), [])).toEqual({ ok: false, error: 'root' });
  });
  it('la copia è indipendente da una modifica successiva', () => {
    const r = duplicateAt({ o: { x: 1 } }, ['o']);
    must(r);
    const r2 = setValue(r.root, ['o', 'x'], 5);
    must(r2);
    expect(r2.root).toEqual({ o: { x: 5 }, o_copia: { x: 1 } });
  });
});

describe('moveAt', () => {
  it('sposta giù e su', () => {
    const r = immutably((d) => moveAt(d, ['b', 'c', 0], 1));
    must(r);
    expect((r.root as ReturnType<typeof make>).b.c).toEqual([2, 1, 3]);
    expect(r.path).toEqual(['b', 'c', 1]);
    const r2 = moveAt(r.root, r.path, -1);
    must(r2);
    expect((r2.root as ReturnType<typeof make>).b.c).toEqual([1, 2, 3]);
  });
  it('rifiuta i bordi, gli oggetti e la radice', () => {
    expect(moveAt(make(), ['b', 'c', 0], -1)).toEqual({ ok: false, error: 'invalid' });
    expect(moveAt(make(), ['b', 'c', 2], 1)).toEqual({ ok: false, error: 'invalid' });
    expect(moveAt(make(), ['a'], 1)).toEqual({ ok: false, error: 'type' });
    expect(moveAt(make(), [], 1)).toEqual({ ok: false, error: 'root' });
  });
});

describe('convertValue / changeType', () => {
  it('stringa ↔ numero', () => {
    expect(convertValue('42', 'number')).toBe(42);
    expect(convertValue(' 4.5 ', 'number')).toBe(4.5);
    expect(convertValue('abc', 'number')).toBe(0);
    expect(convertValue('', 'number')).toBe(0);
    expect(convertValue(42, 'string')).toBe('42');
  });
  it('booleani', () => {
    expect(convertValue('true', 'boolean')).toBe(true);
    expect(convertValue('boh', 'boolean')).toBe(false);
    expect(convertValue(0, 'boolean')).toBe(false);
    expect(convertValue(3, 'boolean')).toBe(true);
    expect(convertValue(true, 'number')).toBe(1);
    expect(convertValue(true, 'string')).toBe('true');
  });
  it('null', () => {
    expect(convertValue('x', 'null')).toBeNull();
    expect(convertValue(null, 'string')).toBe('');
    expect(convertValue(null, 'number')).toBe(0);
  });
  it('oggetto ↔ array', () => {
    expect(convertValue({ a: 1, b: 2 }, 'array')).toEqual([1, 2]);
    expect(convertValue(['x', 'y'], 'object')).toEqual({ 0: 'x', 1: 'y' });
    expect(convertValue('x', 'object')).toEqual({});
    expect(convertValue('x', 'array')).toEqual([]);
  });
  it('contenitore → stringa JSON', () => {
    expect(convertValue({ a: 1 }, 'string')).toBe('{"a":1}');
  });
  it('stesso tipo: stesso valore', () => {
    const o = { a: 1 };
    expect(convertValue(o, 'object')).toBe(o);
  });
  it('changeType sul documento', () => {
    const r = immutably((d) => changeType(d, ['a'], 'string'));
    must(r);
    expect((r.root as { a: unknown }).a).toBe('1');
    expect(changeType(make(), ['zz'], 'null')).toEqual({ ok: false, error: 'notfound' });
  });
});

describe('parseEditedValue', () => {
  it('stringhe: così come sono', () => {
    expect(parseEditedValue('string', '  ciao ')).toEqual({ ok: true, value: '  ciao ' });
    expect(parseEditedValue('string', '')).toEqual({ ok: true, value: '' });
  });
  it('numeri validi', () => {
    expect(parseEditedValue('number', '12')).toEqual({ ok: true, value: 12 });
    expect(parseEditedValue('number', '-0.5e3')).toEqual({ ok: true, value: -500 });
    expect(parseEditedValue('number', ' 7 ')).toEqual({ ok: true, value: 7 });
  });
  it('numeri non validi per JSON', () => {
    for (const t of ['abc', '1,5', '0x10', '01', '.5', '5.', 'NaN', 'Infinity', '1e999', '+1'])
      expect(parseEditedValue('number', t), t).toEqual({ ok: false, error: 'number' });
    expect(parseEditedValue('number', '  ')).toEqual({ ok: false, error: 'empty' });
  });
  it('booleani', () => {
    expect(parseEditedValue('boolean', 'TRUE')).toEqual({ ok: true, value: true });
    expect(parseEditedValue('boolean', 'false')).toEqual({ ok: true, value: false });
    expect(parseEditedValue('boolean', 'si')).toEqual({ ok: false, error: 'boolean' });
  });
  it('editableText', () => {
    expect(editableText('a')).toBe('a');
    expect(editableText(3)).toBe('3');
    expect(editableText(false)).toBe('false');
  });
});
