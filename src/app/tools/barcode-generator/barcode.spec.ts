// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { FORMATS, MAX_BULK, MAX_LENGTH, bulkFileName, gtinCheckDigit, hasValidGtin, normalizeInput, planBulk } from './barcode';

describe('cifra di controllo GTIN', () => {
  it('esempi noti', () => {
    expect(gtinCheckDigit('400638133393')).toBe('1'); // EAN-13 4006381333931
    expect(gtinCheckDigit('590123412345')).toBe('7'); // 5901234123457
    expect(gtinCheckDigit('9638507')).toBe('4'); // EAN-8 96385074
    expect(gtinCheckDigit('03600029145')).toBe('2'); // UPC-A 036000291452
    expect(gtinCheckDigit('1234567890123')).toBe('1'); // ITF-14 12345678901231
  });
  it('hasValidGtin', () => {
    expect(hasValidGtin('4006381333931')).toBe(true);
    expect(hasValidGtin('4006381333932')).toBe(false);
    expect(hasValidGtin('0')).toBe(false);
  });
});

describe('normalizeInput: formati numerici con cifra di controllo', () => {
  it('aggiunge la cifra mancante', () => {
    expect(normalizeInput('EAN13', '590123412345')).toEqual({ ok: true, value: '5901234123457', checkDigit: '7', added: true });
    expect(normalizeInput('EAN8', '9638507')).toMatchObject({ ok: true, value: '96385074', added: true });
    expect(normalizeInput('UPC', '03600029145')).toMatchObject({ ok: true, value: '036000291452' });
    expect(normalizeInput('ITF14', '1234567890123')).toMatchObject({ ok: true, value: '12345678901231' });
  });
  it('accetta la cifra se è giusta e rifiuta se è sbagliata, dicendo qual è', () => {
    expect(normalizeInput('EAN13', '5901234123457')).toEqual({ ok: true, value: '5901234123457', checkDigit: '7', added: false });
    expect(normalizeInput('EAN13', '5901234123458')).toEqual({ ok: false, error: 'check', expected: '7' });
  });
  it('ignora spazi e trattini', () => {
    expect(normalizeInput('EAN13', '590 1234-12345')).toMatchObject({ ok: true, value: '5901234123457' });
  });
  it('errori di lunghezza e di caratteri', () => {
    expect(normalizeInput('EAN13', '12345')).toEqual({ ok: false, error: 'length', lengths: [12, 13] });
    expect(normalizeInput('EAN13', '12345678901234')).toMatchObject({ ok: false, error: 'length' });
    expect(normalizeInput('EAN13', '59012341234A')).toEqual({ ok: false, error: 'digits' });
    expect(normalizeInput('EAN8', '')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeInput('EAN8', '   ')).toEqual({ ok: false, error: 'empty' });
  });
});

describe('normalizeInput: altri formati', () => {
  it('Code 128 accetta ASCII e rifiuta il resto', () => {
    expect(normalizeInput('CODE128', 'Ciao-123!')).toMatchObject({ ok: true, value: 'Ciao-123!' });
    expect(normalizeInput('CODE128', 'perché')).toEqual({ ok: false, error: 'chars' });
    expect(normalizeInput('CODE128', 'a'.repeat(MAX_LENGTH + 1))).toEqual({ ok: false, error: 'tooLong' });
    expect(normalizeInput('CODE128', '')).toEqual({ ok: false, error: 'empty' });
  });
  it('Code 39 porta in maiuscolo e controlla i simboli', () => {
    expect(normalizeInput('CODE39', 'abc-12 $')).toMatchObject({ ok: true, value: 'ABC-12 $' });
    expect(normalizeInput('CODE39', 'a_b')).toEqual({ ok: false, error: 'chars' });
    expect(normalizeInput('CODE39', 'a*b')).toEqual({ ok: false, error: 'chars' });
  });
  it('ITF vuole cifre in numero pari', () => {
    expect(normalizeInput('ITF', '123456')).toMatchObject({ ok: true, value: '123456' });
    expect(normalizeInput('ITF', '12345')).toEqual({ ok: false, error: 'even' });
    expect(normalizeInput('ITF', '12a4')).toEqual({ ok: false, error: 'digits' });
  });
  it('Codabar vuole start e stop A-D', () => {
    expect(normalizeInput('codabar', 'a123456b')).toMatchObject({ ok: true, value: 'A123456B' });
    expect(normalizeInput('codabar', '123456')).toEqual({ ok: false, error: 'chars' });
  });
  it('MSI e Pharmacode', () => {
    expect(normalizeInput('MSI', '1234567')).toMatchObject({ ok: true });
    expect(normalizeInput('MSI', '12 34')).toMatchObject({ ok: true, value: '1234' });
    expect(normalizeInput('MSI', 'x')).toEqual({ ok: false, error: 'digits' });
    expect(normalizeInput('pharmacode', '1234')).toMatchObject({ ok: true, value: '1234' });
    expect(normalizeInput('pharmacode', '2')).toEqual({ ok: false, error: 'range' });
    expect(normalizeInput('pharmacode', '131071')).toEqual({ ok: false, error: 'range' });
    expect(normalizeInput('pharmacode', '131070')).toMatchObject({ ok: true });
  });
  it('gli esempi dei formati sono tutti validi', () => {
    for (const f of FORMATS) expect(normalizeInput(f.id, f.example), f.id).toMatchObject({ ok: true });
  });
});

describe('generazione in blocco', () => {
  it('ignora le righe vuote e numera i nomi', () => {
    const { entries, tooMany } = planBulk('EAN13', '590123412345\n\n  4006381333931  \r\n12');
    expect(tooMany).toBe(false);
    expect(entries.map((e) => e.line)).toEqual([1, 3, 4]);
    expect(entries.map((e) => e.result.ok)).toEqual([true, true, false]);
    expect(entries[0].name).toBe('001-5901234123457');
    expect(entries[1].name).toBe('002-4006381333931');
    expect(entries[2].name).toBeNull();
  });
  it('nomi unici anche per righe uguali', () => {
    const { entries } = planBulk('CODE128', 'A\nA\nA');
    expect(new Set(entries.map((e) => e.name)).size).toBe(3);
  });
  it('limita il numero di righe', () => {
    const text = Array.from({ length: MAX_BULK + 5 }, (_, i) => `ID${i}`).join('\n');
    const { entries, tooMany } = planBulk('CODE128', text);
    expect(entries.length).toBe(MAX_BULK);
    expect(tooMany).toBe(true);
  });
  it('nomi di file sicuri', () => {
    expect(bulkFileName('../../etc/passwd')).toBe('etc_passwd');
    expect(bulkFileName('A B/C')).toBe('A_B_C');
    expect(bulkFileName('***')).toBe('codice');
    expect(bulkFileName('x'.repeat(100)).length).toBe(40);
  });
});
