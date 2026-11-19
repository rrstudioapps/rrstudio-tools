// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { TOOLS } from '../tools/tools.registry';
import { HANDOFF_ACCEPTS, accepts, handoffTargets, isValidPayload } from './handoff-targets';

const ORDER = TOOLS.map((t) => t.id);

describe('compatibilità del passaggio tra strumenti', () => {
  it('ogni strumento della mappa esiste nel registry', () => {
    for (const id of Object.keys(HANDOFF_ACCEPTS)) expect(ORDER, id).toContain(id);
  });

  it('un JSON arriva agli strumenti JSON e a quelli di testo, non alle immagini', () => {
    const t = handoffTargets('json', 'json-formatter', ORDER);
    expect(t).toContain('json-viewer');
    expect(t).toContain('yaml-json-converter');
    expect(t).toContain('word-counter');
    expect(t).not.toContain('image-crop');
  });

  it('un testo semplice non arriva agli strumenti che accettano solo immagini', () => {
    const t = handoffTargets('text', 'base64', ORDER);
    expect(t).toContain('json-formatter');
    expect(t).toContain('qr-code-generator');
    expect(t).not.toContain('image-compressor');
  });

  it('un SVG arriva a svg-to-png e agli strumenti di testo, ma un testo semplice non arriva a svg-to-png', () => {
    expect(handoffTargets('svg', 'svg-optimizer', ORDER)).toEqual(expect.arrayContaining(['svg-to-png', 'base64']));
    expect(handoffTargets('text', 'base64', ORDER)).not.toContain('svg-to-png');
    expect(handoffTargets('json', 'json-formatter', ORDER)).not.toContain('svg-to-png');
    expect(isValidPayload({ kind: 'svg', text: '<svg/>', from: 'svg-optimizer' })).toBe(true);
  });

  it('il CSV arriva al convertitore CSV e agli strumenti di testo', () => {
    expect(accepts('csv-json-converter', 'csv')).toBe(true);
    expect(accepts('sort-lines', 'csv')).toBe(true);
    expect(accepts('image-crop', 'csv')).toBe(false);
  });

  it('le immagini arrivano solo agli strumenti per immagini', () => {
    const t = handoffTargets('image', 'image-crop', ORDER);
    expect(t).toEqual(expect.arrayContaining(['image-compressor', 'image-converter', 'exif-viewer', 'favicon-generator', 'images-to-pdf', 'qr-code-reader']));
    expect(t).not.toContain('json-formatter');
  });

  it('esclude lo strumento corrente', () => {
    expect(handoffTargets('json', 'json-viewer', ORDER)).not.toContain('json-viewer');
    expect(handoffTargets('image', 'image-compressor', ORDER)).not.toContain('image-compressor');
  });

  it('uno strumento sconosciuto non riceve nulla', () => {
    expect(accepts('non-esiste', 'text')).toBe(false);
  });

  it('un contenuto è valido solo se ha ciò che il tipo richiede', () => {
    expect(isValidPayload({ kind: 'text', text: '', from: 'a' })).toBe(true);
    expect(isValidPayload({ kind: 'json', from: 'a' })).toBe(false);
    expect(isValidPayload({ kind: 'image', files: [], from: 'a' })).toBe(false);
    expect(isValidPayload({ kind: 'image', files: [new File(['x'], 'a.png', { type: 'image/png' })], from: 'a' })).toBe(true);
  });
});
