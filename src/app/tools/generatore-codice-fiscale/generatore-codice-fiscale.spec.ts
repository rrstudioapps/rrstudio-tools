// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { analyzeCodiceFiscale } from '../codice-fiscale/codice-fiscale';
import { analyzeVat } from '../iban-partita-iva/vat';
import { VAT_OFFICES } from '../iban-partita-iva/vat-offices';
import {
  CfConfig, CfRow, DEFAULT_CF_CONFIG, DEFAULT_VAT_CONFIG, VatConfig, cfToCsv, cfToJson, generateCodiciFiscali, generatePartiteIva, validateCf, vatToCsv, vatToJson,
} from './generatore-codice-fiscale';

const NOW = new Date(2026, 10, 18);
const cf = (over: Partial<CfConfig> = {}): CfConfig => ({ ...DEFAULT_CF_CONFIG, seed: 'prova', ...over });
const vat = (over: Partial<VatConfig> = {}): VatConfig => ({ ...DEFAULT_VAT_CONFIG, seed: 'prova', ...over });

function rowsOf(over: Partial<CfConfig>): CfRow[] {
  const r = generateCodiciFiscali(cf(over), NOW);
  if (!r.ok) throw new Error('errore ' + r.error);
  return r.rows;
}

/** La data di nascita decodificata dal validatore (anche il secolo alternativo) contiene quella della riga? */
function birthMatches(row: CfRow): boolean {
  const a = analyzeCodiceFiscale(row.code, NOW);
  const [y, m, d] = row.birth.split('-').map(Number);
  return [a.birth, a.birthAlt].some((b) => b && b.year === y && b.month === m && b.day === d);
}

describe('generateCodiciFiscali', () => {
  it('ogni codice è valido per il validatore ed è coerente con la riga', () => {
    const rows = rowsOf({ count: 300 });
    expect(rows).toHaveLength(300);
    for (const r of rows) {
      const a = analyzeCodiceFiscale(r.code, NOW);
      expect(a.valid, r.code).toBe(true);
      expect(a.sex).toBe(r.sex);
      expect(a.placeCode).toBe(r.placeCode);
      expect(birthMatches(r), r.code).toBe(true);
      expect(a.omocodiaLevel).toBe(0);
    }
  });

  it('sesso: rispetta il filtro', () => {
    for (const sex of ['M', 'F'] as const) {
      const rows = rowsOf({ count: 100, sex });
      expect(rows.every((r) => r.sex === sex && analyzeCodiceFiscale(r.code, NOW).sex === sex)).toBe(true);
    }
    const mix = new Set(rowsOf({ count: 100 }).map((r) => r.sex));
    expect(mix.size).toBe(2);
  });

  it('data esatta: tutte le righe hanno quella data', () => {
    const rows = rowsOf({ count: 50, birthExact: '1985-08-17' });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.birth).toBe('1985-08-17');
      expect(birthMatches(r)).toBe(true);
    }
  });

  it('data esatta: 29 febbraio e inizio/fine anno restano coerenti', () => {
    for (const d of ['2000-02-29', '1999-01-01', '1999-12-31']) {
      for (const r of rowsOf({ count: 10, birthExact: d })) {
        expect(r.birth).toBe(d);
        expect(birthMatches(r)).toBe(true);
      }
    }
  });

  it('intervallo di anni: le date cadono nell\'intervallo', () => {
    const rows = rowsOf({ count: 200, yearFrom: 1990, yearTo: 1992 });
    for (const r of rows) {
      const y = Number(r.birth.slice(0, 4));
      expect(y).toBeGreaterThanOrEqual(1990);
      expect(y).toBeLessThanOrEqual(1992);
      expect(birthMatches(r)).toBe(true);
    }
    expect(new Set(rows.map((r) => r.birth.slice(0, 4))).size).toBe(3);
  });

  it('comune o Stato estero: tutte le righe hanno il luogo scelto', () => {
    const milano = rowsOf({ count: 40, place: { code: 'F205', name: 'Milano', sigla: 'MI' } });
    for (const r of milano) {
      expect(r.place).toBe('Milano (MI)');
      expect(analyzeCodiceFiscale(r.code, NOW).placeCode).toBe('F205');
    }
    const francia = rowsOf({ count: 40, place: { code: 'Z110', name: 'Francia', sigla: '' } });
    for (const r of francia) {
      expect(r.place).toBe('Francia');
      expect(analyzeCodiceFiscale(r.code, NOW).placeCode).toBe('Z110');
      expect(analyzeCodiceFiscale(r.code, NOW).valid).toBe(true);
    }
  });

  it('filtri insieme: sesso, data e luogo', () => {
    const rows = rowsOf({ count: 20, sex: 'F', birthExact: '1990-03-05', place: { code: 'H501', name: 'Roma', sigla: 'RM' } });
    for (const r of rows) {
      const a = analyzeCodiceFiscale(r.code, NOW);
      expect(a.valid && a.sex === 'F' && a.placeCode === 'H501').toBe(true);
      expect(r.birth).toBe('1990-03-05');
    }
  });

  it('i codici sono tutti diversi; se le combinazioni non bastano la lista è più corta e `short` è vero', () => {
    const r = generateCodiciFiscali(cf({ count: 1000, sex: 'M', birthExact: '1990-03-05', place: { code: 'H501', name: 'Roma', sigla: 'RM' } }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new Set(r.rows.map((x) => x.code)).size).toBe(r.rows.length);
    expect(r.short).toBe(r.rows.length < 1000);
    const wide = generateCodiciFiscali(cf({ count: 1000 }), NOW);
    expect(wide.ok && !wide.short && wide.rows.length === 1000).toBe(true);
  });

  it('stesso seme, stessi risultati; seme diverso, risultati diversi', () => {
    const a = rowsOf({ count: 30 });
    expect(rowsOf({ count: 30 })).toEqual(a);
    expect(rowsOf({ count: 30, seed: 'altro' })).not.toEqual(a);
  });

  it('seme vuoto: ne sceglie uno e lo restituisce, e con quel seme si riproduce', () => {
    const r = generateCodiciFiscali({ ...DEFAULT_CF_CONFIG, seed: '' }, NOW);
    expect(r.ok && r.seed.length > 0).toBe(true);
    if (!r.ok) return;
    const again = generateCodiciFiscali({ ...DEFAULT_CF_CONFIG, seed: r.seed }, NOW);
    expect(again.ok && again.rows).toEqual(r.rows);
  });

  it('omocodia: livelli 1-7, codice valido, lettere al posto delle ultime cifre, stessi dati di base', () => {
    for (let level = 1; level <= 7; level++) {
      const rows = rowsOf({ count: 20, homocodia: level as 1 });
      for (const r of rows) {
        const a = analyzeCodiceFiscale(r.code, NOW);
        expect(a.valid, r.code).toBe(true);
        expect(a.omocodiaLevel).toBe(level);
        expect(a.omocodiaNonStandard).toBe(false);
        expect(r.homocodia).toBe(level);
        expect(a.baseCode && analyzeCodiceFiscale(a.baseCode, NOW).valid).toBe(true);
        expect(a.sex).toBe(r.sex);
        expect(a.placeCode?.length).toBe(4);
        expect(birthMatches(r)).toBe(true);
      }
    }
  });

  it('omocodia a caso: livelli diversi, tutti validi', () => {
    const rows = rowsOf({ count: 100, homocodia: 8 });
    expect(new Set(rows.map((r) => r.homocodia)).size).toBeGreaterThan(3);
    for (const r of rows) {
      const a = analyzeCodiceFiscale(r.code, NOW);
      expect(a.valid && a.omocodiaLevel === r.homocodia).toBe(true);
    }
  });

  it('configurazione non valida', () => {
    const err = (c: Partial<CfConfig>) => {
      const r = generateCodiciFiscali(cf(c), NOW);
      return r.ok ? '' : r.error;
    };
    expect(err({ count: 0 })).toBe('count');
    expect(err({ count: 1001 })).toBe('count');
    expect(err({ count: 2.5 })).toBe('count');
    expect(err({ seed: 'x'.repeat(101) })).toBe('seed');
    expect(err({ birthExact: '2020-02-30' })).toBe('birth');
    expect(err({ birthExact: '1800-01-01' })).toBe('birth');
    expect(err({ birthExact: '2027-01-01' })).toBe('birth');
    expect(err({ yearFrom: 2000, yearTo: 1990 })).toBe('birth');
    expect(err({ yearFrom: 1850 })).toBe('birth');
    expect(err({ yearTo: 2027 })).toBe('birth');
    expect(err({ place: { code: 'xx', name: 'x', sigla: '' } })).toBe('place');
    expect(err({ homocodia: 9 as 8 })).toBe('homocodia');
    expect(validateCf(cf({ yearFrom: 2026, yearTo: 2026 }), NOW)).toHaveProperty('fromDay');
  });

  it('quest\'anno: le nascite non finiscono nel futuro', () => {
    const r = generateCodiciFiscali(cf({ count: 300, yearFrom: 2026, yearTo: 2026 }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) for (const x of r.rows) expect(x.birth <= '2026-11-18').toBe(true);
  });
});

describe('generatePartiteIva', () => {
  it('cifra di controllo valida e 11 cifre', () => {
    const r = generatePartiteIva(vat({ count: 300 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(300);
    for (const x of r.rows) {
      const a = analyzeVat(x.value);
      expect(a.valid, x.value).toBe(true);
      expect(x.digits).toMatch(/^\d{11}$/);
      expect(a.office).toBe(x.office);
    }
    expect(new Set(r.rows.map((x) => x.digits)).size).toBe(300);
  });

  it('ufficio scelto: tutte le partite IVA lo contengono, con la provincia', () => {
    const r = generatePartiteIva(vat({ count: 100, office: '015' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const x of r.rows) {
      expect(x.digits.slice(7, 10)).toBe('015');
      expect(analyzeVat(x.digits).valid).toBe(true);
      expect(analyzeVat(x.digits).province?.sigla).toBe('MI');
      expect(x.province).toBe('Milano (MI)');
    }
    for (const code of Object.keys(VAT_OFFICES).slice(0, 99)) {
      const one = generatePartiteIva(vat({ count: 3, office: code }));
      expect(one.ok && one.rows.every((x) => x.office === code && analyzeVat(x.digits).valid)).toBe(true);
    }
  });

  it('ufficio a caso: codici diversi', () => {
    const r = generatePartiteIva(vat({ count: 200 }));
    expect(r.ok && new Set(r.rows.map((x) => x.office)).size > 10).toBe(true);
  });

  it('prefisso IT: facoltativo e riconosciuto dal validatore', () => {
    const r = generatePartiteIva(vat({ count: 20, prefix: true }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const x of r.rows) {
      expect(x.value).toBe('IT' + x.digits);
      const a = analyzeVat(x.value);
      expect(a.valid && a.hadPrefix).toBe(true);
    }
    const plain = generatePartiteIva(vat({ count: 20 }));
    expect(plain.ok && plain.rows.every((x) => x.value === x.digits)).toBe(true);
  });

  it('stesso seme, stesse partite IVA', () => {
    const a = generatePartiteIva(vat({ count: 20 }));
    expect(generatePartiteIva(vat({ count: 20 }))).toEqual(a);
    expect(generatePartiteIva(vat({ count: 20, seed: 'altro' }))).not.toEqual(a);
  });

  it('configurazione non valida', () => {
    const err = (c: Partial<VatConfig>) => {
      const r = generatePartiteIva(vat(c));
      return r.ok ? '' : r.error;
    };
    expect(err({ count: 0 })).toBe('count');
    expect(err({ count: 1001 })).toBe('count');
    expect(err({ seed: 'x'.repeat(101) })).toBe('seed');
    expect(err({ office: '999' })).toBe('office');
    expect(err({ office: 'abc' })).toBe('office');
  });
});

describe('esportazione', () => {
  it('CSV e JSON dei codici fiscali', () => {
    const rows = rowsOf({ count: 3 });
    const csv = cfToCsv(rows);
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv.startsWith('codice_fiscale,nome,cognome,sesso,data_nascita,luogo_nascita,codice_catastale,omocodia\r\n')).toBe(true);
    expect(csv).toContain(rows[0].code);
    const json = JSON.parse(cfToJson(rows));
    expect(json).toHaveLength(3);
    expect(json[0]).toMatchObject({ codice_fiscale: rows[0].code, nome: rows[0].first, sesso: rows[0].sex, omocodia: 0 });
  });

  it('CSV e JSON delle partite IVA; il luogo con la virgola va tra virgolette', () => {
    const r = generatePartiteIva(vat({ count: 2, office: '021', prefix: true }));
    if (!r.ok) throw new Error();
    const csv = vatToCsv(r.rows);
    expect(csv.split('\r\n')[0]).toBe('partita_iva,codice_ufficio,provincia');
    expect(csv).toContain(r.rows[0].value + ',021,Bolzano/Bozen (BZ)');
    expect(JSON.parse(vatToJson(r.rows))[1]).toEqual({ partita_iva: r.rows[1].value, codice_ufficio: '021', provincia: 'Bolzano/Bozen (BZ)' });
    const q = cfToCsv([{ code: 'X', first: 'A', last: 'B', sex: 'M', birth: '2000-01-01', place: 'Città, con virgola', placeCode: 'A001', homocodia: 0 }]);
    expect(q).toContain('"Città, con virgola"');
  });
});
