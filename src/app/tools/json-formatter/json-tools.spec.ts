// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  describeParseError,
  findSyntaxErrorPosition,
  formatJson,
  jsonStats,
  lineColumnToPosition,
  minifyJson,
  parseJson,
  positionToLineColumn,
  sortKeysDeep,
  tokenizeJson,
} from './json-tools';

describe('posizioni', () => {
  const t = 'ab\ncde\nf';
  it('indice -> riga/colonna', () => {
    expect(positionToLineColumn(t, 0)).toEqual({ line: 1, column: 1 });
    expect(positionToLineColumn(t, 4)).toEqual({ line: 2, column: 2 });
    expect(positionToLineColumn(t, 7)).toEqual({ line: 3, column: 1 });
    expect(positionToLineColumn(t, 99)).toEqual({ line: 3, column: 2 });
  });
  it('riga/colonna -> indice', () => {
    expect(lineColumnToPosition(t, 2, 2)).toBe(4);
    expect(lineColumnToPosition(t, 3, 1)).toBe(7);
  });
});

describe('findSyntaxErrorPosition', () => {
  it('JSON valido: null', () => {
    expect(findSyntaxErrorPosition('{"a":[1,2,{"b":null}],"c":"x\\n\\u00e8"}')).toBeNull();
    expect(findSyntaxErrorPosition(' -1.5e+3 ')).toBeNull();
  });
  it('individua la posizione dell\'errore', () => {
    expect(findSyntaxErrorPosition('{"a":}')).toBe(5);
    expect(findSyntaxErrorPosition('{"a":1,}')).toBe(7);
    expect(findSyntaxErrorPosition("{'a':1}")).toBe(1);
    expect(findSyntaxErrorPosition('[1,2')).toBe(4);
    expect(findSyntaxErrorPosition('{"a":tru}')).toBe(8);
    expect(findSyntaxErrorPosition('[01]')).toBe(2);
    expect(findSyntaxErrorPosition('{"a":1} x')).toBe(8);
    expect(findSyntaxErrorPosition('"abc')).toBe(4);
  });
});

describe('describeParseError (formati dei motori)', () => {
  const text = '{\n  "a": 1,\n  "b": ,\n}';
  it('V8 recente con line/column', () => {
    const e = describeParseError(
      text,
      new SyntaxError(`Unexpected token ',', "{\n  "a": 1,\n  "b": ,\n}" is not valid JSON`),
    );
    expect(e.line).toBe(3);
    expect(e.column).toBe(8);
    expect(e.message).toBe("Unexpected token ','");
  });
  it('V8 con "at position N (line L column C)"', () => {
    const e = describeParseError(text, new SyntaxError("Expected property name or '}' in JSON at position 19 (line 3 column 8)"));
    expect(e.line).toBe(3);
    expect(e.column).toBe(8);
    expect(e.message).toBe("Expected property name or '}'");
  });
  it('V8 vecchio: solo position', () => {
    const e = describeParseError('{"a" 1}', new SyntaxError('Unexpected number in JSON at position 5'));
    expect(e).toMatchObject({ position: 5, line: 1, column: 6, message: 'Unexpected number' });
  });
  it('Firefox: line/column nel testo', () => {
    const e = describeParseError(text, new SyntaxError('JSON.parse: unexpected character at line 3 column 8 of the JSON data'));
    expect(e).toMatchObject({ line: 3, column: 8, message: 'unexpected character' });
  });
  it('Safari: nessuna posizione, usa lo scanner', () => {
    const e = describeParseError(text, new SyntaxError('JSON Parse error: Unexpected token \',\''));
    expect(e.line).toBe(3);
    expect(e.column).toBe(8);
  });
  it('fine input inattesa', () => {
    const e = describeParseError('[1,\n2,', new SyntaxError('Unexpected end of JSON input'));
    expect(e.position).toBe(6);
    expect(e.line).toBe(2);
  });
});

describe('parseJson con il motore reale', () => {
  it('valido', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });
  it('non valido: riga e colonna coerenti con lo scanner', () => {
    const text = '{\n  "nome": "Mario",\n  "eta": ,\n  "x": 1\n}';
    const r = parseJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBe(10);
    }
  });
  it('fine input inattesa nel motore reale', () => {
    const r = parseJson('{"a": [1, 2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(1);
  });
});

describe('formattazione', () => {
  const v = { b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } };
  it('indentazioni', () => {
    expect(formatJson(v, 2, false).split('\n')[1]).toBe('  "b": 1,');
    expect(formatJson(v, 4, false).split('\n')[1]).toBe('    "b": 1,');
    expect(formatJson(v, 'tab', false).split('\n')[1]).toBe('\t"b": 1,');
  });
  it('minifica', () => {
    expect(minifyJson(v, false)).toBe('{"b":1,"a":{"d":[3,{"z":1,"y":2}],"c":null}}');
  });
  it('ordina le chiavi in modo ricorsivo, senza toccare gli array', () => {
    expect(minifyJson(v, true)).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
    expect(sortKeysDeep([3, 1, 2])).toEqual([3, 1, 2]);
  });
  it('chiave __proto__ non inquina', () => {
    const parsed = JSON.parse('{"b":1,"__proto__":{"x":1}}');
    const sorted = sortKeysDeep(parsed) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(['__proto__', 'b']);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });
});

describe('jsonStats', () => {
  it('chiavi e profondità', () => {
    expect(jsonStats(1)).toEqual({ keys: 0, depth: 0 });
    expect(jsonStats({ a: 1 })).toEqual({ keys: 1, depth: 1 });
    expect(jsonStats({ a: { b: [1, { c: 2 }] }, d: 1 })).toEqual({ keys: 4, depth: 4 });
    expect(jsonStats([])).toEqual({ keys: 0, depth: 1 });
  });
});

describe('tokenizeJson', () => {
  it('distingue chiavi, stringhe, numeri e valori', () => {
    const t = tokenizeJson('{"a": "x:y", "n": -1.5e2, "t": true, "z": null}');
    const kinds = t.filter((x) => x.type !== 'space' && x.type !== 'punct').map((x) => `${x.type}:${x.text}`);
    expect(kinds).toEqual([
      'key:"a"',
      'string:"x:y"',
      'key:"n"',
      'number:-1.5e2',
      'key:"t"',
      'literal:true',
      'key:"z"',
      'literal:null',
    ]);
  });
  it('ricompone il testo originale', () => {
    const s = formatJson({ a: [1, 'due', { b: false }], "c\"d": 'e\\"f' }, 2, false);
    expect(
      tokenizeJson(s)
        .map((x) => x.text)
        .join(''),
    ).toBe(s);
  });
});
