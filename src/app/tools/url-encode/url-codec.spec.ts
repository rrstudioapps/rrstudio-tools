// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { UrlCodecError, decodeUrl, encodeUrl, parseUrlParts } from './url-codec';

describe('encodeUrl', () => {
  it('componente: codifica anche i riservati', () => {
    expect(encodeUrl('a b&c=d/é', 'component', false)).toBe('a%20b%26c%3Dd%2F%C3%A9');
  });
  it('URL intero: lascia struttura e riservati', () => {
    expect(encodeUrl('https://x.it/a b?q=è&r=1#h', 'full', false)).toBe('https://x.it/a%20b?q=%C3%A8&r=1#h');
  });
  it('spazio come +', () => {
    expect(encodeUrl('a b c', 'component', true)).toBe('a+b+c');
    expect(encodeUrl('a+b', 'component', true)).toBe('a%2Bb');
  });
  it('emoji e surrogati spaiati', () => {
    expect(encodeUrl('👋', 'component', false)).toBe('%F0%9F%91%8B');
    expect(() => encodeUrl('\ud800', 'component', false)).toThrowError(UrlCodecError);
  });
});

describe('decodeUrl', () => {
  it('andata e ritorno', () => {
    const src = 'Ciao 👋 àèì & più';
    expect(decodeUrl(encodeUrl(src, 'component', false), 'component', false)).toBe(src);
    expect(decodeUrl(encodeUrl(src, 'component', true), 'component', true)).toBe(src);
  });
  it('+ resta + senza l\'opzione', () => {
    expect(decodeUrl('a+b%20c', 'component', false)).toBe('a+b c');
    expect(decodeUrl('a+b%20c', 'component', true)).toBe('a b c');
  });
  it('URL intero: i riservati restano codificati', () => {
    expect(decodeUrl('https://x.it/a%20b?q=1%262', 'full', false)).toBe('https://x.it/a b?q=1%262');
  });
  it('% non valido', () => {
    expect(() => decodeUrl('100% sicuro', 'component', false)).toThrowError(UrlCodecError);
    try {
      decodeUrl('ab%zz', 'component', false);
    } catch (e) {
      expect((e as UrlCodecError).code).toBe('badSequence');
      expect((e as UrlCodecError).detail).toBe('%zz');
    }
    try {
      decodeUrl('%E0%A4%A', 'component', false);
    } catch (e) {
      expect((e as UrlCodecError).code).toBe('badSequence');
    }
  });
  it('UTF-8 non valido', () => {
    try {
      decodeUrl('%C3%28', 'component', false);
    } catch (e) {
      expect((e as UrlCodecError).code).toBe('badUtf8');
    }
  });
});

describe('parseUrlParts', () => {
  it('scompone un URL con query', () => {
    const p = parseUrlParts('https://example.com:8080/a%20b/c?x=1&nome=Mario+Rossi&e=%C3%A8&x=2#sez%201');
    expect(p?.protocol).toBe('https:');
    expect(p?.host).toBe('example.com:8080');
    expect(p?.pathname).toBe('/a b/c');
    expect(p?.hash).toBe('#sez 1');
    expect(p?.params).toEqual([
      { key: 'x', value: '1' },
      { key: 'nome', value: 'Mario Rossi' },
      { key: 'e', value: 'è' },
      { key: 'x', value: '2' },
    ]);
  });
  it('non URL: null', () => {
    expect(parseUrlParts('ciao mondo')).toBeNull();
    expect(parseUrlParts('Nota: qualcosa')).toBeNull();
    expect(parseUrlParts('')).toBeNull();
    expect(parseUrlParts('/solo/percorso?a=1')).toBeNull();
  });
});
