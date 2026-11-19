// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './generatore-codice-fiscale.share';

describe('generatore-codice-fiscale: schema di condivisione', () => {
  it('stato valido: solo opzioni', () => {
    const s = { mode: 'cf', count: 50, seed: 'abc', sex: 'F', birthExact: '1990-03-05', yearFrom: 1980, yearTo: 1999, placeCode: 'F205', homocodia: 8, office: '015', prefix: true };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('valori fuori dominio scartati', () => {
    expect(validateState(SHARE_SCHEMA, { mode: 'iban' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { count: 1001 })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { homocodia: 9 })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { placeCode: 'f205' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { mode: 'vat', office: '01a' })).toEqual({ mode: 'vat' });
  });
  it('nello schema non c\'è nessun campo per i codici generati', () => {
    expect(Object.keys(SHARE_SCHEMA).some((k) => /code$|codes|rows|text/i.test(k) && k !== 'placeCode')).toBe(false);
  });
});
