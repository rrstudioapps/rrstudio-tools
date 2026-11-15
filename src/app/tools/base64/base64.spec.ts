// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  Base64Error,
  base64ToBytes,
  bytesToBase64,
  bytesToText,
  decodeInput,
  detectFileKind,
  encodeText,
  parseDataUrl,
  toDataUrl,
} from './base64';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('encodeText / base64ToBytes', () => {
  it('codifica ASCII come btoa', () => {
    expect(encodeText('Hello')).toBe('SGVsbG8=');
  });
  it('gestisce UTF-8 (accenti ed emoji) andata e ritorno', () => {
    const src = 'Ciao 👋 àèì';
    const enc = encodeText(src);
    expect(enc).toBe('Q2lhbyDwn5GLIMOgw6jDrA==');
    expect(bytesToText(base64ToBytes(enc))).toBe(src);
  });
  it('URL-safe: usa - e _ senza padding', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
    expect(bytesToBase64(bytes)).toBe('+//+');
    expect(bytesToBase64(bytes, true)).toBe('-__-');
    expect(encodeText('a', true)).toBe('YQ');
  });
  it('decodifica accetta URL-safe, senza padding, spazi e a capo', () => {
    expect(Array.from(base64ToBytes('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
    expect(bytesToText(base64ToBytes('YQ'))).toBe('a');
    expect(bytesToText(base64ToBytes(' SGVs\nbG8 = '))).toBe('Hello');
  });
  it('input non valido: errori con codice', () => {
    expect(() => base64ToBytes('abc!')).toThrowError(Base64Error);
    try {
      base64ToBytes('ab$d');
    } catch (e) {
      expect((e as Base64Error).code).toBe('chars');
      expect((e as Base64Error).detail).toBe('$');
    }
    try {
      base64ToBytes('abcde');
    } catch (e) {
      expect((e as Base64Error).code).toBe('length');
    }
  });
  it('byte arbitrari sopra la dimensione del chunk', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(Array.from(base64ToBytes(bytesToBase64(big))).length).toBe(100_000);
    expect(base64ToBytes(bytesToBase64(big))[99_999]).toBe(99_999 % 251);
  });
  it('bytesToText restituisce null per byte non UTF-8', () => {
    expect(bytesToText(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
  });
});

describe('data URL e tipo di file', () => {
  it('riconosce i magic bytes', () => {
    expect(detectFileKind(base64ToBytes(PNG_1PX))?.mime).toBe('image/png');
    expect(detectFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(detectFileKind(new TextEncoder().encode('GIF89a'))?.ext).toBe('gif');
    expect(detectFileKind(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.ext).toBe('webp');
    expect(detectFileKind(new TextEncoder().encode('%PDF-1.7'))?.ext).toBe('pdf');
    expect(detectFileKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))?.ext).toBe('zip');
    expect(detectFileKind(new TextEncoder().encode('ciao'))).toBeNull();
  });
  it('toDataUrl e parseDataUrl sono inversi', () => {
    const bytes = base64ToBytes(PNG_1PX);
    const url = toDataUrl(bytes, 'image/png');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const p = parseDataUrl(url);
    expect(p.mime).toBe('image/png');
    expect(Array.from(p.bytes)).toEqual(Array.from(bytes));
  });
  it('data URL non base64 (percent-encoded)', () => {
    expect(bytesToText(parseDataUrl('data:text/plain,Ciao%20%F0%9F%91%8B').bytes)).toBe('Ciao 👋');
  });
  it('data URL malformato', () => {
    expect(() => parseDataUrl('data:image/png;base64')).toThrowError(Base64Error);
  });
});

describe('decodeInput', () => {
  it('testo semplice', () => {
    const r = decodeInput(encodeText('Ciao 👋'));
    expect(r.text).toBe('Ciao 👋');
    expect(r.asFile).toBe(false);
  });
  it('immagine in Base64 puro: binario, mime dai magic bytes', () => {
    const r = decodeInput(PNG_1PX);
    expect(r.text).toBeNull();
    expect(r.mime).toBe('image/png');
    expect(r.ext).toBe('png');
    expect(r.asFile).toBe(true);
  });
  it('data URL con mime dichiarato', () => {
    const r = decodeInput(toDataUrl(base64ToBytes(PNG_1PX), 'image/png'));
    expect(r.mime).toBe('image/png');
    expect(r.asFile).toBe(true);
  });
  it('byte sconosciuti: .bin', () => {
    const r = decodeInput(bytesToBase64(new Uint8Array([1, 2, 3, 0xff])));
    expect(r.text).toBeNull();
    expect(r.ext).toBe('bin');
    expect(r.asFile).toBe(true);
  });
});
