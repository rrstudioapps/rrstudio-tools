// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { PlacesFile, PlacesIndex, normalizeSearch } from './places';

const FILE: PlacesFile = {
  updated: '2026-01-01',
  source: 'prova',
  comuni: [
    ['Roma', 'H501', 'RM'],
    ['Romano di Lombardia', 'H509', 'BG'],
    ['Villa Romana di Prova', 'X001', 'ZZ'],
    ['Bolzano/Bozen', 'A952', 'BZ'],
    ["Sant'Angelo Lodigiano", 'I386', 'LO'],
    ['Forlì', 'D704', 'FC'],
    ['Milano', 'F205', 'MI'],
  ],
  soppressi: [['Romana Vecchia', 'M998', 'XX', 2019]],
  esteri: [['Stato di prova', 'Z999']],
};
const idx = new PlacesIndex(FILE);
const names = (q: string, kinds: ('comune' | 'soppresso' | 'estero')[] = ['comune', 'soppresso']) => idx.search(q, kinds).map((p) => p.name);

describe('normalizeSearch', () => {
  it('toglie accenti, punteggiatura e maiuscole', () => {
    expect(normalizeSearch("  Sant'Angelo-Lodigiano ")).toBe('sant angelo lodigiano');
    expect(normalizeSearch('Forlì')).toBe('forli');
    expect(normalizeSearch('Bolzano/Bozen')).toBe('bolzano bozen');
  });
});

describe('ricerca dei luoghi', () => {
  it('prima la corrispondenza esatta, poi inizio nome, poi inizio parola, poi il resto', () => {
    expect(names('roma')).toEqual(['Roma', 'Romano di Lombardia', 'Romana Vecchia', 'Villa Romana di Prova']);
  });
  it('trova per la seconda lingua e senza accenti', () => {
    expect(names('bozen')).toEqual(['Bolzano/Bozen']);
    expect(names('forli')).toEqual(['Forlì']);
    expect(names('sant angelo')).toEqual(["Sant'Angelo Lodigiano"]);
    expect(names("Sant'Ang")).toEqual(["Sant'Angelo Lodigiano"]);
  });
  it('per codice catastale esatto, anche in minuscolo', () => {
    expect(names('F205')).toEqual(['Milano']);
    expect(names('h501')).toEqual(['Roma']);
  });
  it('filtra per tipo', () => {
    expect(names('prova', ['estero'])).toEqual(['Stato di prova']);
    expect(names('prova', ['comune'])).toEqual(['Villa Romana di Prova']);
    expect(names('romana', ['soppresso'])).toEqual(['Romana Vecchia']);
  });
  it('nessun risultato e limite', () => {
    expect(names('')).toEqual([]);
    expect(names('qqqq')).toEqual([]);
    expect(idx.search('o', ['comune'], 2)).toHaveLength(2);
  });
  it('lookup per codice e dimensioni', () => {
    expect(idx.byCatastale('h501')[0]).toMatchObject({ name: 'Roma', sigla: 'RM', kind: 'comune' });
    expect(idx.byCatastale('Q000')).toEqual([]);
    expect(idx.size).toBe(9);
    expect(idx.hasKind('estero')).toBe(true);
    expect(new PlacesIndex({ ...FILE, esteri: [] }).hasKind('estero')).toBe(false);
  });
});
