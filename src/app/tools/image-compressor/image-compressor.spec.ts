// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  clampQuality,
  computeSize,
  extensionForMime,
  formatSaving,
  inputMime,
  outputFileName,
  resolveOutputMime,
  savingPercent,
  shouldKeepOriginal,
  uniqueNames,
} from './image-compressor';

describe('computeSize', () => {
  it('non ridimensiona senza modalità', () => {
    expect(computeSize(4000, 3000, 'none', 100)).toEqual({ width: 4000, height: 3000 });
  });
  it('larghezza massima mantiene le proporzioni', () => {
    expect(computeSize(4000, 3000, 'width', 1000)).toEqual({ width: 1000, height: 750 });
  });
  it('altezza massima mantiene le proporzioni', () => {
    expect(computeSize(4000, 3000, 'height', 600)).toEqual({ width: 800, height: 600 });
  });
  it('percentuale', () => {
    expect(computeSize(1001, 501, 'percent', 50)).toEqual({ width: 501, height: 251 });
  });
  it('non ingrandisce mai', () => {
    expect(computeSize(800, 600, 'width', 2000)).toEqual({ width: 800, height: 600 });
    expect(computeSize(800, 600, 'percent', 200)).toEqual({ width: 800, height: 600 });
  });
  it('valori non validi lasciano la dimensione invariata e il minimo è 1px', () => {
    expect(computeSize(800, 600, 'width', 0)).toEqual({ width: 800, height: 600 });
    expect(computeSize(800, 600, 'width', Number.NaN)).toEqual({ width: 800, height: 600 });
    expect(computeSize(1000, 10, 'width', 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('nomi dei file', () => {
  it('cambia estensione', () => {
    expect(outputFileName('foto.JPG', 'image/webp')).toBe('foto.webp');
    expect(outputFileName('a.b.c.png', 'image/jpeg')).toBe('a.b.c.jpg');
  });
  it('file senza estensione o nome vuoto', () => {
    expect(outputFileName('foto', 'image/png')).toBe('foto.png');
    expect(outputFileName('.png', 'image/png')).toBe('.png.png');
  });
  it('rende unici i duplicati', () => {
    expect(uniqueNames(['a.jpg', 'a.jpg', 'b.jpg', 'A.JPG', 'a.jpg'])).toEqual([
      'a.jpg',
      'a (2).jpg',
      'b.jpg',
      'A (3).JPG',
      'a (4).jpg',
    ]);
  });
  it('un nome già con suffisso non collide', () => {
    expect(uniqueNames(['a (2).jpg', 'a.jpg', 'a.jpg'])).toEqual(['a (2).jpg', 'a.jpg', 'a (3).jpg']);
  });
});

describe('formati', () => {
  it('riconosce il tipo da MIME o estensione', () => {
    expect(inputMime({ type: 'image/png', name: 'x' })).toBe('image/png');
    expect(inputMime({ type: '', name: 'x.JPEG' })).toBe('image/jpeg');
    expect(inputMime({ type: 'image/x-ms-bmp', name: 'x.bmp' })).toBe('image/bmp');
    expect(inputMime({ type: 'image/svg+xml', name: 'x.svg' })).toBeNull();
    expect(inputMime({ type: 'application/pdf', name: 'x.pdf' })).toBeNull();
  });
  it('uscita "originale": GIF e BMP diventano PNG, AVIF senza supporto pure', () => {
    const ok = new Set(['image/jpeg', 'image/png', 'image/webp']);
    expect(resolveOutputMime('image/jpeg', 'original', ok)).toBe('image/jpeg');
    expect(resolveOutputMime('image/gif', 'original', ok)).toBe('image/png');
    expect(resolveOutputMime('image/avif', 'original', ok)).toBe('image/png');
    expect(resolveOutputMime('image/png', 'webp', ok)).toBe('image/webp');
  });
  it('estensioni', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/avif')).toBe('avif');
  });
});

describe('risparmio', () => {
  it('percentuali', () => {
    expect(savingPercent(1000, 250)).toBe(75);
    expect(savingPercent(1000, 1100)).toBe(-10);
    expect(savingPercent(0, 10)).toBe(0);
    expect(formatSaving(75)).toBe('−75%');
    expect(formatSaving(-10)).toBe('+10%');
    expect(formatSaving(0)).toBe('0%');
  });
  it('tiene l\'originale solo a parità di formato e peso non inferiore', () => {
    expect(shouldKeepOriginal('image/jpeg', 'image/jpeg', 100, 120)).toBe(true);
    expect(shouldKeepOriginal('image/jpeg', 'image/jpeg', 100, 100)).toBe(true);
    expect(shouldKeepOriginal('image/jpeg', 'image/jpeg', 100, 80)).toBe(false);
    expect(shouldKeepOriginal('image/png', 'image/webp', 100, 120)).toBe(false);
  });
  it('qualità limitata a 1-100', () => {
    expect(clampQuality(0)).toBe(1);
    expect(clampQuality(150)).toBe(100);
    expect(clampQuality(55.4)).toBe(55);
    expect(clampQuality(Number.NaN)).toBe(80);
  });
});
