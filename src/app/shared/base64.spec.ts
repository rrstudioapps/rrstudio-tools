// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { Base64Error, base64ToBytes, bytesToBase64, tryBase64ToBytes } from './base64';

describe('shared/base64', () => {
  it('codifica standard e URL-safe senza padding', () => {
    expect(bytesToBase64(Uint8Array.of(0xfb, 0xff, 0xfe))).toBe('+//+');
    expect(bytesToBase64(Uint8Array.of(0xfb, 0xff, 0xfe), true)).toBe('-__-');
    expect(bytesToBase64(Uint8Array.of(97), true)).toBe('YQ');
    expect(bytesToBase64(Uint8Array.of(97))).toBe('YQ==');
  });
  it('decodifica anche URL-safe, senza padding, con spazi', () => {
    expect(Array.from(base64ToBytes('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
    expect(Array.from(base64ToBytes(' YQ\n'))).toEqual([97]);
  });
  it('errori e tryBase64ToBytes', () => {
    expect(() => base64ToBytes('ab$d')).toThrowError(Base64Error);
    expect(() => base64ToBytes('abcde')).toThrowError(Base64Error);
    expect(tryBase64ToBytes('')).toBeNull();
    expect(tryBase64ToBytes('@@@')).toBeNull();
    expect(tryBase64ToBytes('QUJD')).toEqual(Uint8Array.of(65, 66, 67));
  });
  it('blocchi grandi', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(base64ToBytes(bytesToBase64(big))[99_999]).toBe(99_999 % 251);
  });
});
