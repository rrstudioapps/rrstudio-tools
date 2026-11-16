// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { analyzeVat, normalizeVat, vatCheckDigit } from './vat';
import { VAT_OFFICES } from './vat-offices';

/** Partita IVA costruita col calcolo: 7 cifre di progressivo + 3 dell'ufficio + controllo. */
const make = (progressive: string, office: string): string => {
  const p = progressive.padStart(7, '0') + office;
  return p + vatCheckDigit(p);
};

describe('cifra di controllo', () => {
  it('esempio da manuale: 1234567890 -> 3', () => {
    expect(vatCheckDigit('1234567890')).toBe(3);
  });
  it('calcolo a mano: 0000001015 -> dispari 0+0+0+1+1=2, pari 5*2=10-9=1, somma 3, controllo 7', () => {
    expect(vatCheckDigit('0000001015')).toBe(7);
    expect(analyzeVat('00000010157').valid).toBe(true);
  });
  it('è sempre una cifra', () => {
    for (let n = 1; n < 500; n++) {
      const c = vatCheckDigit(String(n * 7919).padStart(7, '0') + '001');
      expect(Number.isInteger(c) && c >= 0 && c <= 9).toBe(true);
    }
  });
});

describe('partita IVA valida', () => {
  it('12345678903', () => {
    const a = analyzeVat('12345678903');
    expect(a).toMatchObject({ valid: true, issues: [], progressive: '1234567', office: '890', expectedCheck: 3, hadPrefix: false });
    expect(a.province).toBeUndefined(); // 890 non è un codice storico di provincia
  });
  it('accetta il prefisso IT, minuscole, spazi e punti', () => {
    for (const v of ['IT12345678903', 'it 12345678903', 'IT 123 456 789 03', '12.345.678.903', ' IT-12345678903 ']) {
      expect(analyzeVat(v).valid, v).toBe(true);
    }
    expect(analyzeVat('IT12345678903').hadPrefix).toBe(true);
    expect(normalizeVat('it 1234 5678 903')).toEqual({ digits: '12345678903', hadPrefix: true });
  });
  it('ufficio provinciale con provincia', () => {
    const t = analyzeVat(make('1', '001'));
    expect(t).toMatchObject({ valid: true, office: '001', province: { sigla: 'TO', name: 'Torino' } });
    expect(analyzeVat(make('345', '015')).province).toMatchObject({ sigla: 'MI', name: 'Milano' });
    expect(analyzeVat(make('9876', '058')).province).toMatchObject({ sigla: 'RM' });
  });
  it('codici ufficio oltre 099 o speciali: valida, ma senza provincia', () => {
    for (const o of ['100', '120', '121', '888', '999', '000']) {
      const a = analyzeVat(make('55', o));
      expect(a.valid, o).toBe(true);
      expect(a.province, o).toBeUndefined();
    }
  });
  it('molte partite IVA costruite sono valide e ogni cifra cambiata invalida', () => {
    for (let n = 1; n <= 300; n++) {
      const v = make(String(n * 12347), String(n % 100).padStart(3, '0'));
      expect(analyzeVat(v).valid, v).toBe(true);
      // un errore su una sola cifra è sempre individuato
      const i = n % 11;
      const bad = v.slice(0, i) + String((Number(v[i]) + 1) % 10) + v.slice(i + 1);
      expect(analyzeVat(bad).valid, bad).toBe(false);
    }
  });
  it('la tabella degli uffici ha i 99 codici storici', () => {
    expect(Object.keys(VAT_OFFICES)).toHaveLength(99);
    expect(VAT_OFFICES['058']).toEqual(['RM', 'Roma']);
  });
});

describe('partita IVA non valida', () => {
  it('cifra di controllo sbagliata, con quella attesa', () => {
    const a = analyzeVat('12345678900');
    expect(a).toMatchObject({ valid: false, issues: ['check'], expectedCheck: 3 });
    expect(a.province).toBeUndefined();
  });
  it('lunghezza', () => {
    expect(analyzeVat('1234567890').issues).toEqual(['length']);
    expect(analyzeVat('123456789012').issues).toEqual(['length']);
    expect(analyzeVat('IT').issues).toEqual(['empty']);
  });
  it('caratteri non numerici e vuoto', () => {
    expect(analyzeVat('1234567890A').issues).toEqual(['chars']);
    expect(analyzeVat('DE123456789').issues).toEqual(['chars']);
    expect(analyzeVat('   ').issues).toEqual(['empty']);
  });
  it('progressivo tutto a zero', () => {
    const a = analyzeVat(make('0', '001'));
    expect(a.valid).toBe(false);
    expect(a.issues).toEqual(['progressive']);
    expect(analyzeVat('00000000000').issues).toEqual(['progressive']);
  });
});
