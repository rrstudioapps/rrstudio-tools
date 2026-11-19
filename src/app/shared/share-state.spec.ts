// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { deflateSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from './base64';
import {
  MAX_DECODED_BYTES,
  MAX_LINK_LENGTH,
  type Schema,
  SHARE_PREFIX,
  buildShareUrl,
  decodeState,
  encodeState,
  parseHash,
  validateState,
} from './share-state';

const SCHEMA: Schema = {
  text: { type: 'string', max: 50 },
  mode: { type: 'enum', values: ['a', 'b', 3] },
  n: { type: 'number', min: 0, max: 10, int: true },
  on: { type: 'boolean' },
  list: { type: 'strings', maxItems: 2, maxLength: 5 },
  hex: { type: 'string', chars: '#0123456789abcdef', valid: (s) => s.length === 7 },
};

const pack = (obj: unknown) => bytesToBase64(deflateSync(new TextEncoder().encode(JSON.stringify(obj))), true);

describe('shared/share-state: codec', () => {
  it('round-trip di uno stato con testo, numeri, booleani e liste', async () => {
    const state = { text: 'ciao', n: 3, on: true, list: ['x', 'y'] };
    const payload = await encodeState('tool', state);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeState('tool', payload)).toEqual({ state });
  });

  it('conserva unicode (accenti, emoji, CJK) e a capo', async () => {
    const state = { text: 'è già ✓ 😀 日本語\r\nriga 2\t"virgolette" \\' };
    const dec = await decodeState('t', await encodeState('t', state));
    expect(dec?.state).toEqual(state);
  });

  it('comprime testi ripetitivi', async () => {
    const payload = await encodeState('t', { text: 'abc '.repeat(5000) });
    expect(payload.length).toBeLessThan(300);
  });

  it('rifiuta payload corrotti, troncati o vuoti senza lanciare', async () => {
    const good = await encodeState('t', { text: 'x'.repeat(200) + Math.random() });
    for (const bad of ['', 'abc', '!!!!!!', 'AAAAAAAAAAAA', good.slice(0, good.length - 6), good.slice(5), good.replace(/.$/, '#')]) {
      expect(await decodeState('t', bad)).toBeNull();
    }
  });

  it('rifiuta un altro strumento e un\'altra versione', async () => {
    expect(await decodeState('altro', await encodeState('t', { a: 1 }))).toBeNull();
    expect(await decodeState('t', pack({ v: 2, t: 't', s: { a: 1 } }))).toBeNull();
    expect(await decodeState('t', pack({ t: 't', s: {} }))).toBeNull();
    expect(await decodeState('t', pack([1, 2, 3]))).toBeNull();
  });

  it('rifiuta un JSON non valido o byte non UTF-8', async () => {
    const enc = (b: Uint8Array) => bytesToBase64(deflateSync(b), true);
    expect(await decodeState('t', enc(new TextEncoder().encode('{"v":1,')))).toBeNull();
    expect(await decodeState('t', enc(Uint8Array.of(0xff, 0xfe, 0xfd, 0xfc, 0xfb)))).toBeNull();
  });

  it('rifiuta una zip bomb (decompresso oltre il limite) e un payload troppo lungo', async () => {
    const bomb = bytesToBase64(deflateSync(new Uint8Array(MAX_DECODED_BYTES * 20), { level: 9 }), true);
    expect(bomb.length).toBeLessThan(MAX_LINK_LENGTH);
    expect(await decodeState('t', bomb)).toBeNull();
    expect(await decodeState('t', 'A'.repeat(MAX_LINK_LENGTH + 1))).toBeNull();
  });

  it('il link: ok sotto il limite, "toolarge" sopra', async () => {
    const ok = await buildShareUrl('https://x.test/tool#vecchio', 't', { text: 'ciao' });
    expect(ok.ok && ok.url.startsWith('https://x.test/tool' + SHARE_PREFIX)).toBe(true);
    // testo non comprimibile: casuale
    let s = '';
    for (let i = 0; i < 20000; i++) s += String.fromCharCode(33 + Math.floor(Math.random() * 90));
    expect(await buildShareUrl('https://x.test/tool', 't', { text: s })).toEqual({ ok: false, reason: 'toolarge' });
  });
});

describe('shared/share-state: validazione', () => {
  it('tiene solo i campi validi e ignora il resto', () => {
    const r = validateState(SCHEMA, { text: 'ok', mode: 'b', n: 4, on: false, list: ['a'], extra: 1, __proto__: { x: 1 } });
    expect(r).toEqual({ text: 'ok', mode: 'b', n: 4, on: false, list: ['a'] });
  });

  it('scarta tipi sbagliati, fuori intervallo e oltre i limiti', () => {
    expect(validateState(SCHEMA, { text: 5, mode: 'z', n: 11, on: 'true', list: ['abcdefg'] })).toBeNull();
    expect(validateState(SCHEMA, { n: 1.5 })).toBeNull();
    expect(validateState(SCHEMA, { n: NaN })).toBeNull();
    expect(validateState(SCHEMA, { text: 'x'.repeat(51), on: true })).toEqual({ on: true });
    expect(validateState(SCHEMA, { list: ['a', 'b', 'c'] })).toBeNull();
    expect(validateState(SCHEMA, { mode: 3 })).toEqual({ mode: 3 });
  });

  it('applica chars e valid', () => {
    expect(validateState(SCHEMA, { hex: '#00ff00' })).toEqual({ hex: '#00ff00' });
    expect(validateState(SCHEMA, { hex: '#00ff0z' })).toBeNull();
    expect(validateState(SCHEMA, { hex: '#00ff' })).toBeNull();
  });

  it('non accetta valori che non sono oggetti', () => {
    for (const bad of [null, undefined, 3, 'x', ['text']]) expect(validateState(SCHEMA, bad)).toBeNull();
  });
});

describe('shared/share-state: hash', () => {
  it('distingue assente, non valido e valido', async () => {
    expect(await parseHash('t', SCHEMA, '')).toEqual({ kind: 'none' });
    expect(await parseHash('t', SCHEMA, '#altro')).toEqual({ kind: 'none' });
    expect(await parseHash('t', SCHEMA, '#s=@@@@')).toEqual({ kind: 'invalid' });
    const payload = await encodeState('t', { text: 'ciao', extra: 1 });
    expect(await parseHash('t', SCHEMA, SHARE_PREFIX + payload)).toEqual({ kind: 'ok', state: { text: 'ciao' } });
    // stato di forma giusta ma senza nessun campo valido
    expect(await parseHash('t', SCHEMA, SHARE_PREFIX + (await encodeState('t', { text: 5 })))).toEqual({ kind: 'invalid' });
  });
});
