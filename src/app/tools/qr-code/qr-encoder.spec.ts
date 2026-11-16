// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  MAX_VERSION,
  QrError,
  addEccAndInterleave,
  alignmentPositions,
  buildDataCodewords,
  detectMode,
  encodeQr,
  maxByteCapacity,
  numDataCodewords,
  numRawDataModules,
  type Ecl,
} from './qr-encoder';
import { decodeMatrix } from './qr-decoder.testing';

describe('tabelle e capacità', () => {
  it('moduli grezzi noti (ISO 18004, tabella 1)', () => {
    expect(numRawDataModules(1)).toBe(208); // 26 codeword + 0 bit
    expect(numRawDataModules(2)).toBe(359); // 44 codeword + 7 bit
    expect(numRawDataModules(7)).toBe(1568); // 196 codeword
    expect(numRawDataModules(40)).toBe(29648); // 3706 codeword + 0
  });
  it('codeword di dati per versione e livello (tabella 7)', () => {
    expect(numDataCodewords(1, 'L')).toBe(19);
    expect(numDataCodewords(1, 'M')).toBe(16);
    expect(numDataCodewords(1, 'Q')).toBe(13);
    expect(numDataCodewords(1, 'H')).toBe(9);
    expect(numDataCodewords(10, 'M')).toBe(216);
    expect(numDataCodewords(40, 'L')).toBe(2956);
    expect(numDataCodewords(40, 'M')).toBe(2334);
    expect(numDataCodewords(40, 'Q')).toBe(1666);
    expect(numDataCodewords(40, 'H')).toBe(1276);
  });
  it('capacità in byte alla versione 40: 2953 / 2331 / 1663 / 1273', () => {
    expect(maxByteCapacity('L')).toBe(2953);
    expect(maxByteCapacity('M')).toBe(2331);
    expect(maxByteCapacity('Q')).toBe(1663);
    expect(maxByteCapacity('H')).toBe(1273);
  });
  it('posizioni dei pattern di allineamento', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });
});

describe('modi', () => {
  it('riconosce numerico, alfanumerico e byte', () => {
    expect(detectMode('0123456789')).toBe('numeric');
    expect(detectMode('HELLO WORLD $%*+-./:')).toBe('alphanumeric');
    expect(detectMode('hello')).toBe('byte');
    expect(detectMode('Città')).toBe('byte');
  });
});

describe('vettori noti (esempi dell\'ISO 18004 e di manuali diffusi)', () => {
  it('"01234567" v1-M: codeword di dati e correzione dell\'esempio della norma', () => {
    const data = buildDataCodewords('01234567', 'numeric', 1, 'M');
    expect(data).toEqual([16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17]);
    expect(addEccAndInterleave(data, 1, 'M').slice(16)).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
  });
  it('"HELLO WORLD" v1-M (alfanumerico): dati e correzione', () => {
    const data = buildDataCodewords('HELLO WORLD', 'alphanumeric', 1, 'M');
    expect(data).toEqual([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
    expect(addEccAndInterleave(data, 1, 'M').slice(16)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
  it('"HELLO WORLD" v1-Q sceglie la versione 1 e v1-H la 2', () => {
    expect(encodeQr('HELLO WORLD', { ecl: 'Q' }).version).toBe(1);
    expect(encodeQr('HELLO WORLD', { ecl: 'H' }).version).toBe(2);
  });
  it('dimensione e struttura: lato 17+4v, finder e timing al loro posto', () => {
    const q = encodeQr('01234567', { ecl: 'M' });
    expect(q.size).toBe(21);
    const m = q.modules;
    for (let i = 0; i < 7; i++) {
      expect(m[0][i] && m[6][i] && m[i][0] && m[i][6]).toBe(true);
    }
    expect(m[1][1] || m[1][5] || m[5][1]).toBe(false);
    expect(m[3][3] && m[2][2] && m[4][4]).toBe(true); // centro 3x3 scuro
    for (let i = 8; i < 13; i++) expect(m[6][i]).toBe(i % 2 === 0);
    expect(m[13][8]).toBe(true); // modulo scuro fisso
  });
});

describe('versioni, correzione e limiti', () => {
  it('rifiuta testi troppo lunghi', () => {
    expect(() => encodeQr('a'.repeat(maxByteCapacity('L') + 1), { ecl: 'L' })).toThrow(QrError);
  });
  it('un testo al limite esatto sta nella versione 40', () => {
    const q = encodeQr('a'.repeat(maxByteCapacity('H')), { ecl: 'H' });
    expect(q.version).toBe(MAX_VERSION);
    expect(q.size).toBe(177);
  });
  it('minVersion forza una versione più grande', () => {
    expect(encodeQr('1', { ecl: 'L', minVersion: 5 }).version).toBe(5);
  });
});

describe('andata e ritorno con il decoder di test', () => {
  const ecls: Ecl[] = ['L', 'M', 'Q', 'H'];
  const samples = ['', '7', '0123456789012345678901234567890', 'HELLO WORLD 123 $%*+-./:', 'ciao mondo', 'Caffè, perché? è già così: 日本語 😀', 'https://example.com/percorso?x=1&y=due#frammento'];
  it('ogni modo e ogni livello, con tutte le maschere', () => {
    for (const ecl of ecls) {
      for (const text of samples) {
        for (let mask = 0; mask < 8; mask++) {
          const q = encodeQr(text, { ecl, mask });
          const d = decodeMatrix(q.modules);
          expect(d.text, `${ecl} m${mask} ${text}`).toBe(text);
          expect(d.mask).toBe(mask);
          expect(d.ecl).toBe(ecl);
          expect(d.corrected).toBe(0);
        }
      }
    }
  });
  it('maschera automatica: sceglie quella a penalità minore e il simbolo si legge', () => {
    const q = encodeQr('Prova della maschera automatica', { ecl: 'M' });
    expect(q.mask).toBeGreaterThanOrEqual(0);
    expect(decodeMatrix(q.modules).text).toBe('Prova della maschera automatica');
  });
  it('tutte le versioni 1-40 a tutti i livelli (testo che riempie la versione)', () => {
    for (const ecl of ecls) {
      for (let v = 1; v <= 40; v++) {
        const cap = Math.floor((numDataCodewords(v, ecl) * 8 - 4 - (v <= 9 ? 8 : 16)) / 8);
        const text = Array.from({ length: cap }, (_, i) => String.fromCharCode(97 + ((i * 7) % 26))).join('');
        const q = encodeQr(text, { ecl, minVersion: v });
        expect(q.version, `${ecl}${v}`).toBe(v);
        expect(decodeMatrix(q.modules).text, `${ecl}${v}`).toBe(text);
      }
    }
  });
  it('il Reed-Solomon corregge i moduli coperti (come un logo al centro)', () => {
    const q = encodeQr('https://example.com/logo-al-centro', { ecl: 'H' });
    const m = q.modules.map((r) => r.slice());
    const c = Math.floor(q.size / 2);
    const half = Math.floor(q.size * 0.1);
    for (let y = c - half; y <= c + half; y++) for (let x = c - half; x <= c + half; x++) m[y][x] = false;
    const d = decodeMatrix(m);
    expect(d.text).toBe('https://example.com/logo-al-centro');
    expect(d.corrected).toBeGreaterThan(0);
  });
});
