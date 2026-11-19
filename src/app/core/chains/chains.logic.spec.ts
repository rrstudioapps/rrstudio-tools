// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { MAX_CHAINS, MAX_STEPS, addChain, mergeChains, moveStep, parseStoredChains, removeChain, sanitizeChains, stepFor } from './chains.logic';

const known = new Set(['base64', 'json-formatter', 'hash-generator', 'url-encode']);

describe('sanitizeChains', () => {
  it('scarta ciò che non è valido e tiene il resto', () => {
    const r = sanitizeChains(
      [
        { id: 'a', name: '  Da base64 ', steps: ['base64', 'json-formatter'] },
        { id: 'b', name: '', steps: ['base64', 'json-formatter'] },
        { id: 'c', name: 'Corta', steps: ['base64'] },
        { id: 'd', name: 'Ignota', steps: ['base64', 'nope', 'hash-generator'] },
        'x',
      ],
      known,
    );
    expect(r.chains.map((c) => c.name)).toEqual(['Da base64', 'Ignota']);
    expect(r.chains[1].steps).toEqual(['base64', 'hash-generator']);
    expect(r.dropped).toBe(4);
  });
  it('id duplicati o non validi diventano unici; limiti rispettati', () => {
    const many = Array.from({ length: 30 }, () => ({ id: 'x', name: 'n', steps: ['base64', 'url-encode'] }));
    const r = sanitizeChains(many, known);
    expect(r.chains).toHaveLength(MAX_CHAINS);
    expect(new Set(r.chains.map((c) => c.id)).size).toBe(MAX_CHAINS);
    const longSteps = Array(20).fill('base64');
    expect(sanitizeChains([{ name: 'l', steps: longSteps }], known).chains[0].steps).toHaveLength(MAX_STEPS);
  });
  it('dati illeggibili = nessuna catena', () => {
    expect(parseStoredChains('{non json', known)).toEqual([]);
    expect(parseStoredChains(null, known)).toEqual([]);
    expect(sanitizeChains(undefined, known)).toEqual({ chains: [], dropped: 0 });
  });
});

describe('operazioni', () => {
  it('addChain valida nome, numero e id dei passi', () => {
    expect(addChain([], '', ['base64', 'url-encode'], known)).toBeNull();
    expect(addChain([], 'x', ['base64'], known)).toBeNull();
    expect(addChain([], 'x', ['base64', 'zzz'], known)).toBeNull();
    const l = addChain([], ' Mia ', ['base64', 'url-encode'], known)!;
    expect(l[0].name).toBe('Mia');
    expect(removeChain(l, l[0].id)).toEqual([]);
  });
  it('mergeChains non duplica e rinomina gli id in conflitto', () => {
    const a = [{ id: 'a', name: 'N', steps: ['base64', 'url-encode'] }];
    const m = mergeChains(a, [
      { id: 'z', name: 'N', steps: ['base64', 'url-encode'] },
      { id: 'a', name: 'Altra', steps: ['base64', 'hash-generator'] },
    ]);
    expect(m).toHaveLength(2);
    expect(m[1].id).not.toBe('a');
  });
  it('stepFor segue il percorso e riconosce i salti', () => {
    const s = ['base64', 'json-formatter', 'hash-generator'];
    expect(stepFor(s, 0, 'json-formatter')).toBe(1);
    expect(stepFor(s, 1, 'json-formatter')).toBe(1);
    expect(stepFor(s, 0, 'hash-generator')).toBe(2);
    expect(stepFor(s, 0, 'url-encode')).toBeNull();
  });
  it('moveStep', () => {
    expect(moveStep(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveStep(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
