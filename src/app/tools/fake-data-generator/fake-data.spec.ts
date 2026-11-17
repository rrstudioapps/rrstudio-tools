// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { analyzeCodiceFiscale } from '../codice-fiscale/codice-fiscale';
import { analyzeIban } from '../iban-partita-iva/iban';
import { analyzeVat } from '../iban-partita-iva/vat';
import {
  CITIES, DEFAULT_CONFIG, EMAIL_DOMAINS, FIELD_IDS, FakeConfig, MAX_ROWS, csvCell, generateRows, hashSeed, makeRandom,
  parseIsoDay, sqlLiteral, toCsv, toJson, toSql, validTableName, validateConfig,
} from './fake-data';

const all: FakeConfig = { ...DEFAULT_CONFIG, fields: [...FIELD_IDS], count: 300, seed: 'prova' };

async function gen(cfg: FakeConfig) {
  const r = await generateRows(cfg);
  if (!r || !r.ok) throw new Error('generazione fallita');
  return r;
}
const col = (rows: (string | number | boolean)[][], id: (typeof FIELD_IDS)[number]) => rows.map((r) => r[FIELD_IDS.indexOf(id)]);

describe('seme e riproducibilità', () => {
  it('stesso seme, stessi dati; seme diverso, dati diversi', async () => {
    const a = await gen(all);
    const b = await gen(all);
    const c = await gen({ ...all, seed: 'altro' });
    expect(b.rows).toEqual(a.rows);
    expect(c.rows).not.toEqual(a.rows);
  });
  it('la dimensione dei blocchi non cambia il risultato', async () => {
    const a = await generateRows({ ...all, count: 123 }, { chunk: 7 });
    const b = await generateRows({ ...all, count: 123 }, { chunk: 1000 });
    expect(a && a.ok && b && b.ok && a.rows).toEqual(b && b.ok ? b.rows : null);
  });
  it('senza seme ne sceglie uno a caso e lo restituisce, e con quello si riproduce', async () => {
    const a = await gen({ ...all, seed: '' });
    expect(a.seed).toMatch(/^[a-z0-9]{5}$/);
    const b = await gen({ ...all, seed: a.seed });
    expect(b.rows).toEqual(a.rows);
  });
  it('hashSeed e makeRandom sono deterministici e in [0, 1)', () => {
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
    const r = makeRandom(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('si può interrompere', async () => {
    expect(await generateRows({ ...all, count: 2000 }, { chunk: 100, isCancelled: () => true })).toBeNull();
  });
  it('segnala i progressi a blocchi', async () => {
    const seen: number[] = [];
    await generateRows({ ...all, count: 1250 }, { chunk: 500, onProgress: (n) => seen.push(n) });
    expect(seen).toEqual([500, 1000, 1250]);
  });
});

describe('validità formale dei dati generati', () => {
  it('codici fiscali validi per le funzioni esistenti e coerenti con nome e data', async () => {
    const { rows } = await gen(all);
    const cfs = col(rows, 'tax_code') as string[];
    cfs.forEach((cf, i) => {
      const a = analyzeCodiceFiscale(cf);
      expect(a.valid, cf).toBe(true);
      expect(a.birth?.year).toBe(Number((col(rows, 'birth_date')[i] as string).slice(0, 4)));
    });
  });
  it('partite IVA valide', async () => {
    const { rows } = await gen(all);
    for (const v of col(rows, 'vat_number') as string[]) {
      expect(v).toMatch(/^\d{11}$/);
      expect(analyzeVat(v).valid, v).toBe(true);
    }
  });
  it('IBAN italiani validi (mod 97 e CIN)', async () => {
    const { rows } = await gen(all);
    for (const v of col(rows, 'iban') as string[]) {
      expect(v).toMatch(/^IT\d{2}[A-Z]\d{22}$/);
      const a = analyzeIban(v);
      expect(a.valid, v).toBe(true);
      expect(a.it?.abi.startsWith('9')).toBe(true);
    }
  });
  it('e-mail solo su domini riservati', async () => {
    const { rows } = await gen(all);
    for (const e of col(rows, 'email') as string[]) {
      expect(e).toMatch(/^[a-z]+[._]?[a-z]+\d{0,2}@[a-z.]+$/);
      expect(EMAIL_DOMAINS).toContain(e.split('@')[1]);
    }
  });
  it('telefono, CAP, città e provincia coerenti', async () => {
    const { rows } = await gen(all);
    for (const t of col(rows, 'phone') as string[]) expect(t).toMatch(/^\+39 \d{2,3} \d{7}$/);
    rows.forEach((r) => {
      const city = r[FIELD_IDS.indexOf('city')] as string;
      const prov = r[FIELD_IDS.indexOf('province')] as string;
      const zip = r[FIELD_IDS.indexOf('zip')] as string;
      const c = CITIES.find((x) => x[0] === city)!;
      expect(c[1]).toBe(prov);
      expect(zip).toMatch(/^\d{5}$/);
      expect(zip.slice(0, 3)).toBe(c[3].slice(0, 3));
    });
  });
  it('uuid v4, colori, booleani, lorem', async () => {
    const { rows } = await gen(all);
    for (const u of col(rows, 'uuid') as string[]) expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    for (const c of col(rows, 'color') as string[]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    const bools = col(rows, 'boolean');
    expect(bools.every((b) => typeof b === 'boolean')).toBe(true);
    expect(new Set(bools).size).toBe(2);
    for (const l of col(rows, 'lorem') as string[]) expect(l).toMatch(/^[A-Z][a-z ]+\.$/);
  });
  it('le date di nascita restano nell\'intervallo, estremi inclusi', async () => {
    const { rows } = await gen({ ...all, fields: ['birth_date'], birthFrom: '2000-02-28', birthTo: '2000-03-01', count: 200 });
    const set = new Set(rows.map((r) => r[0]));
    expect([...set].sort()).toEqual(['2000-02-28', '2000-02-29', '2000-03-01']);
  });
  it('i numeri restano nell\'intervallo, con i decimali richiesti', async () => {
    const ints = await gen({ ...all, fields: ['number'], numberMin: -5, numberMax: 5, count: 500 });
    const vals = ints.rows.map((r) => r[0] as number);
    expect(vals.every((v) => Number.isInteger(v) && v >= -5 && v <= 5)).toBe(true);
    expect(new Set(vals).size).toBe(11);
    const dec = await gen({ ...all, fields: ['number'], numberMin: 0, numberMax: 1, numberDecimals: 2, count: 200 });
    expect(dec.rows.every((r) => Math.abs((r[0] as number) * 100 - Math.round((r[0] as number) * 100)) < 1e-9)).toBe(true);
    const same = await gen({ ...all, fields: ['number'], numberMin: 7, numberMax: 7, count: 3 });
    expect(same.rows).toEqual([[7], [7], [7]]);
  });
  it('rispetta ordine dei campi e quantità', async () => {
    const r = await gen({ ...all, fields: ['city', 'first_name'], count: 3 });
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toHaveLength(2);
    expect(CITIES.map((c) => c[0])).toContain(r.rows[0][0]);
  });
  it('genera 10.000 righe complete', async () => {
    const r = await gen({ ...all, count: MAX_ROWS });
    expect(r.rows).toHaveLength(MAX_ROWS);
  });
});

describe('validazione della configurazione', () => {
  it('segnala gli errori', () => {
    expect(validateConfig({ ...all, fields: [] })).toEqual({ error: 'fields' });
    expect(validateConfig({ ...all, count: 0 })).toEqual({ error: 'count' });
    expect(validateConfig({ ...all, count: MAX_ROWS + 1 })).toEqual({ error: 'count' });
    expect(validateConfig({ ...all, count: 1.5 })).toEqual({ error: 'count' });
    expect(validateConfig({ ...all, birthFrom: '2020-01-01', birthTo: '2010-01-01' })).toEqual({ error: 'birth' });
    expect(validateConfig({ ...all, birthTo: '2010-02-30' })).toEqual({ error: 'birth' });
    expect(validateConfig({ ...all, numberMin: 5, numberMax: 1 })).toEqual({ error: 'number' });
    expect(validateConfig({ ...all, numberDecimals: 9 })).toEqual({ error: 'number' });
    expect(validateConfig({ ...all, seed: 'x'.repeat(101) })).toEqual({ error: 'seed' });
    expect('resolved' in validateConfig(all)).toBe(true);
  });
  it('generateRows restituisce l\'errore', async () => {
    expect(await generateRows({ ...all, count: 0 })).toEqual({ ok: false, error: 'count' });
  });
  it('parseIsoDay', () => {
    expect(parseIsoDay('1970-01-02')).toBe(1);
    expect(parseIsoDay('2024-02-29')).not.toBeNull();
    expect(parseIsoDay('2023-02-29')).toBeNull();
    expect(parseIsoDay('abc')).toBeNull();
  });
});

describe('esportazione', () => {
  it('csvCell: separatore, virgolette e a capo', () => {
    expect(csvCell('ciao', ',')).toBe('ciao');
    expect(csvCell('a,b', ',')).toBe('"a,b"');
    expect(csvCell('a,b', ';')).toBe('a,b');
    expect(csvCell('a;b', ';')).toBe('"a;b"');
    expect(csvCell('dice "sì"', ',')).toBe('"dice ""sì"""');
    expect(csvCell('riga1\nriga2', ',')).toBe('"riga1\nriga2"');
    expect(csvCell('a\tb', '\t')).toBe('"a\tb"');
    expect(csvCell(true, ',')).toBe('true');
    expect(csvCell(1.5, ',')).toBe('1.5');
  });
  it('toCsv: intestazione, righe e separatore scelto', () => {
    expect(toCsv(['city', 'number'], [["Reggio, Emilia", 3], ["L'Aquila", 4]], ';')).toBe('city;number\r\nReggio, Emilia;3\r\nL\'Aquila;4\r\n');
    expect(toCsv(['city', 'number'], [['Reggio, Emilia', 3]], ',')).toBe('city,number\r\n"Reggio, Emilia",3\r\n');
  });
  it('toJson: tipi nativi e chiavi nell\'ordine', () => {
    const j = JSON.parse(toJson(['number', 'boolean', 'city'], [[1.5, false, 'Roma']]));
    expect(j).toEqual([{ number: 1.5, boolean: false, city: 'Roma' }]);
    expect(Object.keys(j[0])).toEqual(['number', 'boolean', 'city']);
  });
  it('sqlLiteral: apici raddoppiati, booleani e numeri', () => {
    expect(sqlLiteral("L'Aquila")).toBe("'L''Aquila'");
    expect(sqlLiteral("'; DROP TABLE x;--")).toBe("'''; DROP TABLE x;--'");
    expect(sqlLiteral('a\\b')).toBe("'a\\b'");
    expect(sqlLiteral(true)).toBe('TRUE');
    expect(sqlLiteral(false)).toBe('FALSE');
    expect(sqlLiteral(-2.5)).toBe('-2.5');
  });
  it('toSql: un INSERT per riga e nome tabella validato', () => {
    const sql = toSql(['city', 'number', 'boolean'], [["L'Aquila", 3, true], ['Roma', 4, false]], 'public.utenti');
    expect(sql).toBe("INSERT INTO public.utenti (city, number, boolean) VALUES ('L''Aquila', 3, TRUE);\nINSERT INTO public.utenti (city, number, boolean) VALUES ('Roma', 4, FALSE);\n");
    expect(toSql(['city'], [['x']], 'utenti; DROP TABLE x')).toBeNull();
    expect(toSql(['city'], [['x']], '')).toBeNull();
    expect(toSql(['city'], [['x']], '1tab')).toBeNull();
    expect(validTableName('my_table2')).toBe(true);
    expect(validTableName('a.b.c')).toBe(false);
    expect(validTableName('"quoted"')).toBe(false);
  });
});
