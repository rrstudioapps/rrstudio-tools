// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { encodeQr } from '../qr-code/qr-encoder';
import { decodePixels, fitSize } from './qr-scan';

/** QR → pixel RGBA, `scale` pixel per modulo e quiet zone di 4 moduli; `invert` scambia scuro e chiaro. */
function pixels(text: string, scale: number, invert = false): { data: Uint8ClampedArray; size: number } {
  const qr = encodeQr(text, { ecl: 'M' });
  const size = (qr.size + 8) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - 4;
      const my = Math.floor(y / scale) - 4;
      const dark = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
      const v = dark !== invert ? 0 : 255;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, size };
}

describe('decodePixels (jsQR)', () => {
  it('legge un QR generato dallo strumento QR', async () => {
    const { data, size } = pixels('https://example.com/ciao', 4);
    const r = await decodePixels(data, size, size);
    expect(r?.text).toBe('https://example.com/ciao');
    expect(r?.corners.length).toBe(4);
  });
  it('legge testo con accenti e simboli', async () => {
    const t = 'Perché è così? 100% €';
    const { data, size } = pixels(t, 5);
    expect((await decodePixels(data, size, size))?.text).toBe(t);
  });
  it('legge un QR invertito solo se si provano entrambe le polarità', async () => {
    const { data, size } = pixels('WIFI:T:WPA;S:Casa;P:x;;', 4, true);
    expect((await decodePixels(data, size, size, 'attemptBoth'))?.text).toBe('WIFI:T:WPA;S:Casa;P:x;;');
    expect(await decodePixels(data, size, size, 'dontInvert')).toBeNull();
  });
  it('immagine bianca o troppo piccola: nessun risultato', async () => {
    const white = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(await decodePixels(white, 100, 100)).toBeNull();
    expect(await decodePixels(new Uint8ClampedArray(4), 1, 1)).toBeNull();
    expect(await decodePixels(new Uint8ClampedArray(10), 100, 100)).toBeNull();
  });
});

describe('fitSize', () => {
  it('riduce in proporzione e non ingrandisce', () => {
    expect(fitSize(4000, 2000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(fitSize(800, 600, 1000)).toEqual({ width: 800, height: 600 });
    expect(fitSize(1, 5000, 100)).toEqual({ width: 1, height: 100 });
  });
});
