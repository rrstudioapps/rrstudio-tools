// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  CONVERT_FORMATS,
  DEFAULT_SETTINGS,
  backgroundApplies,
  clampResizeValue,
  computeSize,
  encodedAsRequested,
  formatMime,
  formatOfMime,
  inputMime,
  isConvertFormat,
  isHexColor,
  outputName,
  outputNames,
  qualityApplies,
  resolveFormat,
  supportedFormats,
  toProcessorSettings,
} from './image-converter';
import { SHARE_SCHEMA } from './image-converter.share';
import { validateState } from '../../shared/share-state';

describe('formati', () => {
  it('MIME e ritorno dal MIME', () => {
    expect(CONVERT_FORMATS.map(formatMime)).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
    expect(formatOfMime('image/webp')).toBe('webp');
    expect(formatOfMime('image/gif')).toBeNull();
  });

  it('formati supportati: solo quelli che il browser sa codificare, nell\'ordine fisso', () => {
    expect(supportedFormats(new Set(['image/webp', 'image/png', 'image/jpeg']))).toEqual(['png', 'jpeg', 'webp']);
    expect(supportedFormats(new Set())).toEqual([]);
    expect(supportedFormats(new Set(['image/avif', 'image/png']))).toEqual(['png', 'avif']);
  });

  it('resolveFormat torna a PNG se il formato voluto non è disponibile', () => {
    const sup = new Set(['image/png', 'image/jpeg']);
    expect(resolveFormat('jpeg', sup)).toBe('jpeg');
    expect(resolveFormat('avif', sup)).toBe('png');
  });

  it('qualità e sfondo contano solo dove hanno senso', () => {
    expect(qualityApplies('png')).toBe(false);
    expect(qualityApplies('jpeg') && qualityApplies('webp') && qualityApplies('avif')).toBe(true);
    expect(backgroundApplies('jpeg')).toBe(true);
    expect(backgroundApplies('png')).toBe(false);
    expect(backgroundApplies('webp')).toBe(false);
  });

  it('il blob è del formato chiesto solo se il tipo coincide', () => {
    expect(encodedAsRequested('image/avif', 'image/avif')).toBe(true);
    expect(encodedAsRequested('image/png', 'image/avif')).toBe(false);
  });

  it('isConvertFormat', () => {
    expect(isConvertFormat('jpeg')).toBe(true);
    expect(isConvertFormat('gif')).toBe(false);
    expect(isConvertFormat(3)).toBe(false);
  });
});

describe('dimensioni', () => {
  it('nessun ridimensionamento', () => {
    expect(computeSize(4000, 3000, 'none', 0)).toEqual({ width: 4000, height: 3000 });
  });
  it('larghezza massima con proporzioni', () => {
    expect(computeSize(4000, 3000, 'width', 1000)).toEqual({ width: 1000, height: 750 });
  });
  it('altezza massima con proporzioni', () => {
    expect(computeSize(4000, 3000, 'height', 600)).toEqual({ width: 800, height: 600 });
  });
  it('percentuale', () => {
    expect(computeSize(1000, 501, 'percent', 50)).toEqual({ width: 500, height: 251 });
  });
  it('non ingrandisce mai', () => {
    expect(computeSize(800, 600, 'width', 2000)).toEqual({ width: 800, height: 600 });
    expect(computeSize(800, 600, 'percent', 150)).toEqual({ width: 800, height: 600 });
  });
  it('mai sotto 1 pixel', () => {
    expect(computeSize(1000, 2, 'width', 10)).toEqual({ width: 10, height: 1 });
  });
  it('valori non validi lasciano l\'immagine com\'è', () => {
    expect(computeSize(800, 600, 'width', 0)).toEqual({ width: 800, height: 600 });
    expect(computeSize(800, 600, 'width', NaN)).toEqual({ width: 800, height: 600 });
  });

  it('clampResizeValue', () => {
    expect(clampResizeValue('percent', 250)).toBe(100);
    expect(clampResizeValue('width', 0)).toBe(1);
    expect(clampResizeValue('width', 99999)).toBe(20000);
    expect(clampResizeValue('height', 720.4)).toBe(720);
    expect(clampResizeValue('width', NaN)).toBe(1920);
    expect(clampResizeValue('none', 5)).toBe(0);
  });
});

describe('nomi dei file', () => {
  it('sostituisce l\'estensione (jpeg → .jpg)', () => {
    expect(outputName('foto.PNG', 'jpeg')).toBe('foto.jpg');
    expect(outputName('a.b.c.webp', 'png')).toBe('a.b.c.png');
    expect(outputName('scatto', 'avif')).toBe('scatto.avif');
    expect(outputName('.hidden', 'webp')).toBe('.hidden.webp');
    expect(outputName('', 'png')).toBe('immagine.png');
  });

  it('nomi unici dopo la conversione', () => {
    expect(outputNames(['a.png', 'a.jpg', 'A.webp', 'b.png'], 'webp')).toEqual(['a.webp', 'a (2).webp', 'A (3).webp', 'b.webp']);
  });
});

describe('file in ingresso e impostazioni', () => {
  it('riconosce il tipo dal MIME o dall\'estensione', () => {
    expect(inputMime({ type: 'image/png', name: 'x' })).toBe('image/png');
    expect(inputMime({ type: '', name: 'x.JPEG' })).toBe('image/jpeg');
    expect(inputMime({ type: 'application/pdf', name: 'x.pdf' })).toBeNull();
  });

  it('impostazioni per l\'elaborazione: qualità limitata e sfondo valido', () => {
    const s = toProcessorSettings({ ...DEFAULT_SETTINGS, format: 'jpeg', quality: 500, background: 'rosso' });
    expect(s.quality).toBe(100);
    expect(s.background).toBe('#ffffff');
    expect(s.format).toBe('jpeg');
    expect(toProcessorSettings({ ...DEFAULT_SETTINGS, background: '#112233' }).background).toBe('#112233');
  });

  it('isHexColor', () => {
    expect(isHexColor('#a1B2c3')).toBe(true);
    expect(isHexColor('#abc')).toBe(false);
  });
});

describe('condivisione', () => {
  it('lo schema accetta solo le opzioni e scarta il resto', () => {
    const ok = validateState(SHARE_SCHEMA, { format: 'avif', quality: 70, resizeMode: 'width', resizeValue: 1200, background: '#101010' });
    expect(ok).toEqual({ format: 'avif', quality: 70, resizeMode: 'width', resizeValue: 1200, background: '#101010' });
    expect(validateState(SHARE_SCHEMA, { format: 'gif', quality: 0, resizeMode: 'x', resizeValue: -1, background: 'red', files: ['a'] })).toBeNull();
    expect(Object.keys(SHARE_SCHEMA).sort()).toEqual(['background', 'format', 'quality', 'resizeMode', 'resizeValue']);
  });
});
