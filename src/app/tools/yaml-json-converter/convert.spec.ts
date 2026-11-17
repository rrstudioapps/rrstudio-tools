// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, convert, findTomlProblem, formatFromFileName, locateJsonError, normalize, offsetOf, parseInput, positionOf } from './convert';

const opts = (o: Partial<typeof DEFAULT_OPTIONS> = {}) => ({ ...DEFAULT_OPTIONS, ...o });

describe('YAML verso JSON', () => {
  it('converte mappe, liste e scalari', () => {
    const r = convert('name: app\nports:\n  - 80\n  - 443\nenabled: true\nratio: 1.5\nempty: null\n', 'yaml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ name: 'app', ports: [80, 443], enabled: true, ratio: 1.5, empty: null });
  });
  it('usa l\'indentazione scelta', () => {
    const r2 = convert('a: {b: 1}', 'yaml', 'json', opts({ indent: '2' }));
    const r4 = convert('a: {b: 1}', 'yaml', 'json', opts({ indent: '4' }));
    const rt = convert('a: {b: 1}', 'yaml', 'json', opts({ indent: 'tab' }));
    expect(r2.ok && r2.text).toBe('{\n  "a": {\n    "b": 1\n  }\n}');
    expect(r4.ok && r4.text).toContain('\n    "a"');
    expect(rt.ok && rt.text).toContain('\n\t"a"');
  });
  it('più documenti diventano un array', () => {
    const r = convert('a: 1\n---\nb: 2\n---\n- x\n', 'yaml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual([{ a: 1 }, { b: 2 }, ['x']]);
    expect(r.ok && r.documents).toBe(3);
  });
  it('risolve ancore, alias e merge key', () => {
    const src = 'base: &b\n  x: 1\n  y: 2\nchild:\n  <<: *b\n  y: 3\n';
    const r = convert(src, 'yaml', 'json');
    expect(r.ok && JSON.parse(r.text).child).toEqual({ x: 1, y: 3 });
  });
  it('mantiene stringhe che sembrano valori e i caratteri Unicode', () => {
    const r = convert('a: "123"\nb: "true"\nc: caffè ☕\n', 'yaml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ a: '123', b: 'true', c: 'caffè ☕' });
  });
  it('legge i blocchi di testo multilinea', () => {
    const r = convert('t: |\n  riga1\n  riga2\nf: >\n  a\n  b\n', 'yaml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ t: 'riga1\nriga2\n', f: 'a b\n' });
  });
  it('segnala errori con riga e colonna', () => {
    const r = parseInput('a: 1\nb: [1, 2\nc: 3\n', 'yaml');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBeGreaterThanOrEqual(2);
      expect(r.error.column).toBeGreaterThanOrEqual(1);
      expect(r.error.message).not.toMatch(/\n/);
    }
  });
  it('rifiuta le chiavi duplicate', () => {
    const r = parseInput('a: 1\na: 2\n', 'yaml');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(2);
  });
  it('un errore nel secondo documento ha la riga giusta', () => {
    const r = parseInput('a: 1\n---\nb: [\n', 'yaml');
    expect(r.ok).toBe(false);
  });
});

describe('JSON verso YAML', () => {
  it('scrive YAML leggibile', () => {
    const r = convert('{"name":"app","ports":[80,443],"nested":{"k":"v"}}', 'json', 'yaml');
    expect(r.ok && r.text).toBe('name: app\nports:\n  - 80\n  - 443\nnested:\n  k: v\n');
  });
  it('non spezza le righe lunghe', () => {
    const long = 'parola '.repeat(40).trim();
    const r = convert(JSON.stringify({ t: long }), 'json', 'yaml');
    expect(r.ok && r.text).toBe(`t: ${long}\n`);
  });
  it('quota le stringhe ambigue', () => {
    const r = convert('{"a":"123","b":"true","c":"null","d":""}', 'json', 'yaml');
    expect(r.ok && r.text).toBe('a: "123"\nb: "true"\nc: "null"\nd: ""\n');
  });
  it('array radice come documenti separati su richiesta', () => {
    const r = convert('[{"a":1},{"b":2}]', 'json', 'yaml', opts({ arrayAsDocuments: true }));
    expect(r.ok && r.text).toBe('---\na: 1\n---\nb: 2\n');
    const plain = convert('[{"a":1},{"b":2}]', 'json', 'yaml');
    expect(plain.ok && plain.text).toBe('- a: 1\n- b: 2\n');
  });
  it('ordina le chiavi su richiesta, anche in profondità', () => {
    const r = convert('{"b":1,"a":{"z":1,"y":2}}', 'json', 'json', opts({ sortKeys: true, indent: '2' }));
    expect(r.ok && r.text).toBe('{\n  "a": {\n    "y": 2,\n    "z": 1\n  },\n  "b": 1\n}');
  });
  it('YAML con più documenti torna YAML con i separatori', () => {
    const r = convert('a: 1\n---\nb: 2\n', 'yaml', 'yaml');
    expect(r.ok && r.text).toBe('---\na: 1\n---\nb: 2\n');
  });
  it('JSON non valido: messaggio e posizione', () => {
    const r = parseInput('{\n  "a": 1,\n  "b": }\n', 'json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBeGreaterThan(1);
      expect(r.error.message.length).toBeGreaterThan(3);
    }
  });
  it('JSON con chiave __proto__ non altera i prototipi', () => {
    const r = convert('{"__proto__": {"x": 1}}', 'json', 'json');
    expect(r.ok && r.text).toContain('__proto__');
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('TOML', () => {
  const toml = 'title = "Esempio"\n\n[owner]\nname = "Ada"\nage = 36\n\n[[items]]\nid = 1\n\n[[items]]\nid = 2\n';
  it('TOML verso JSON', () => {
    const r = convert(toml, 'toml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ title: 'Esempio', owner: { name: 'Ada', age: 36 }, items: [{ id: 1 }, { id: 2 }] });
  });
  it('JSON verso TOML e ritorno senza perdite', () => {
    const src = { title: 'x', list: [1, 2, 3], owner: { name: 'Ada', tags: ['a', 'b'] }, items: [{ id: 1 }, { id: 2 }] };
    const r = convert(JSON.stringify(src), 'json', 'toml');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const back = convert(r.text, 'toml', 'json');
      expect(back.ok && JSON.parse(back.text)).toEqual(src);
    }
  });
  it('YAML verso TOML', () => {
    const r = convert('a: 1\nb:\n  c: "x"\n', 'yaml', 'toml');
    expect(r.ok && r.text).toContain('a = 1');
    expect(r.ok && r.text).toContain('[b]');
  });
  it('le date TOML diventano stringhe ISO in JSON', () => {
    const r = convert('d = 1979-05-27T07:32:00Z\nday = 1979-05-27\n', 'toml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ d: '1979-05-27T07:32:00.000Z', day: '1979-05-27' });
  });
  it('le date TOML restano date da TOML a TOML', () => {
    const r = convert('d = 1979-05-27\n', 'toml', 'toml');
    expect(r.ok && r.text.trim()).toBe('d = 1979-05-27');
  });
  it('interi TOML enormi non rompono JSON', () => {
    const r = convert('n = 9223372036854775807\n', 'toml', 'json');
    expect(r.ok && JSON.parse(r.text)).toEqual({ n: '9223372036854775807' });
  });
  it('errore TOML con riga e colonna', () => {
    const r = parseInput('a = 1\nb = \nc = 3\n', 'toml');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(2);
      expect(r.error.message).not.toMatch(/^Invalid TOML document/);
    }
  });
  it('TOML non può avere radice non oggetto', () => {
    const r = convert('[1,2]', 'json', 'toml');
    expect(r).toEqual({ ok: false, stage: 'write', error: { message: 'toml-root' } });
  });
  it('TOML non ha null: indica dove', () => {
    const r = convert('{"a":{"b":[1,null]}}', 'json', 'toml');
    expect(r).toEqual({ ok: false, stage: 'write', error: { message: 'toml-null:a.b[1]' } });
  });
});

describe('locateJsonError', () => {
  it('trova il primo carattere sbagliato', () => {
    expect(locateJsonError('{"a":1}')).toBeNull();
    expect(locateJsonError('  [1, 2, {"a": null}]  ')).toBeNull();
    expect(locateJsonError('{"a":}')).toBe(5);
    expect(locateJsonError('{"a":1,}')).toBe(7);
    expect(locateJsonError('[1 2]')).toBe(3);
    expect(locateJsonError("{'a':1}")).toBe(1);
    expect(locateJsonError('{"a":1} x')).toBe(8);
    expect(locateJsonError('01')).toBe(1);
    expect(locateJsonError('"abc')).toBe(4);
    expect(locateJsonError('"a\\qb"')).toBe(3);
    expect(locateJsonError('[1,')).toBe(3);
    expect(locateJsonError('')).toBe(0);
  });
  it('accetta numeri, escape e valori letterali validi', () => {
    expect(locateJsonError('[-1.5e+3, 0, "\\u00e8\\n", true, false, null]')).toBeNull();
    expect(locateJsonError('{"a":tru}')).not.toBeNull();
  });
});

describe('funzioni di supporto', () => {
  it('formatFromFileName', () => {
    expect(formatFromFileName('docker-compose.yml')).toBe('yaml');
    expect(formatFromFileName('A.YAML')).toBe('yaml');
    expect(formatFromFileName('x.json')).toBe('json');
    expect(formatFromFileName('Cargo.toml')).toBe('toml');
    expect(formatFromFileName('notes.txt')).toBeNull();
    expect(formatFromFileName('noext')).toBeNull();
  });
  it('positionOf e offsetOf sono inversi', () => {
    const text = 'ab\ncde\n\nf';
    expect(positionOf(text, 0)).toEqual({ line: 1, column: 1 });
    expect(positionOf(text, 4)).toEqual({ line: 2, column: 2 });
    expect(positionOf(text, 8)).toEqual({ line: 4, column: 1 });
    for (const off of [0, 1, 4, 6, 7, 8, 9]) {
      const p = positionOf(text, off);
      expect(offsetOf(text, p.line, p.column)).toBe(off);
    }
    expect(offsetOf(text, 99, 1)).toBe(text.length);
  });
  it('normalize converte Date e bigint', () => {
    expect(normalize({ d: new Date(Date.UTC(2026, 0, 2)), n: 5n, big: 2n ** 70n }, false, false)).toEqual({
      d: '2026-01-02T00:00:00.000Z',
      n: 5,
      big: (2n ** 70n).toString(),
    });
  });
  it('findTomlProblem', () => {
    expect(findTomlProblem({ a: 1 })).toBeNull();
    expect(findTomlProblem({ a: [{ b: null }] })).toBe('a[0].b');
  });
  it('verso JSON, Infinity e NaN non diventano null: errore con il percorso', () => {
    expect(convert('a:\n  b: [1, .inf]', 'yaml', 'json')).toEqual({ ok: false, stage: 'write', error: { message: 'json-nonfinite:a.b[1] = Infinity' } });
    expect(convert('x: .nan', 'yaml', 'json')).toEqual({ ok: false, stage: 'write', error: { message: 'json-nonfinite:x = NaN' } });
    expect(convert('x = -inf', 'toml', 'json')).toEqual({ ok: false, stage: 'write', error: { message: 'json-nonfinite:x = -Infinity' } });
  });
});
