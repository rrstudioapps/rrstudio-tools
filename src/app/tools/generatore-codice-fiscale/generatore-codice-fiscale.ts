// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Sex, computeCodiceFiscale, omocodiaVariants } from '../codice-fiscale/codice-fiscale';
import { CITIES, FEMALE, MALE, SURNAMES, csvCell, dayToParts, fakeVat, hashSeed, int, makeRandom, parseIsoDay, pick, randomSeedText } from '../fake-data-generator/fake-data';
import { VAT_OFFICES } from '../iban-partita-iva/vat-offices';

/**
 * Generatore di codici fiscali e partite IVA di prova. Tutto è inventato: nomi e cognomi vengono dagli stessi elenchi
 * del generatore di dati finti, il codice fiscale è calcolato con le regole vere sui dati della riga (quindi coerente
 * con sesso, data e luogo mostrati) e la partita IVA ha la cifra di controllo corretta. Non appartengono a nessuno.
 * Logica pura: nessun DOM, nessuna richiesta di rete. Con lo stesso seme si ottengono sempre gli stessi risultati.
 */

export const MIN_COUNT = 1;
export const MAX_COUNT = 1000;
export const MIN_YEAR = 1900;

export type SexFilter = 'any' | Sex;
/** Livello di omocodia: 0 = nessuna, 1-7 = livello fisso, 8 = livello a caso. */
export type HomocodiaLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const HOMOCODIA_LEVELS: readonly HomocodiaLevel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Luogo di nascita scelto dall'utente (comune o Stato estero). */
export interface PlaceChoice {
  code: string;
  name: string;
  /** Sigla della provincia: vuota per gli Stati esteri. */
  sigla: string;
}

export type GenError = 'count' | 'seed' | 'birth' | 'place' | 'homocodia' | 'office';

export interface CfConfig {
  count: number;
  /** Seme testuale: vuoto = ne viene scelto uno a caso (e restituito, così si può riprodurre). */
  seed: string;
  sex: SexFilter;
  /** Data esatta `AAAA-MM-GG`; se non è vuota ha la precedenza sull'intervallo di anni. */
  birthExact: string;
  yearFrom: number;
  yearTo: number;
  /** Luogo fisso; null = uno a caso tra alcune grandi città. */
  place: PlaceChoice | null;
  homocodia: HomocodiaLevel;
}

export const DEFAULT_CF_CONFIG: CfConfig = {
  count: 10, seed: '', sex: 'any', birthExact: '', yearFrom: 1950, yearTo: 2005, place: null, homocodia: 0,
};

export interface CfRow {
  code: string;
  first: string;
  last: string;
  sex: Sex;
  /** `AAAA-MM-GG`. */
  birth: string;
  /** Nome del luogo, con la sigla tra parentesi per i comuni. */
  place: string;
  placeCode: string;
  /** Livello di omocodia applicato (0 = nessuno). */
  homocodia: number;
}

export type CfResult = { ok: true; seed: string; rows: CfRow[]; short: boolean } | { ok: false; error: GenError };

const pad2 = (n: number): string => String(n).padStart(2, '0');
const PLACE_RE = /^[A-Z]\d{3}$/;

/** Anno corrente e oggi in `AAAA-MM-GG` (il limite superiore delle date di nascita). */
function today(now: Date): { year: number; day: number } {
  return { year: now.getFullYear(), day: Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000) };
}

/** Controlla i filtri; restituisce l'errore o l'intervallo di giorni delle nascite. */
export function validateCf(cfg: CfConfig, now: Date = new Date()): { error: GenError } | { fromDay: number; toDay: number } {
  if (!Number.isInteger(cfg.count) || cfg.count < MIN_COUNT || cfg.count > MAX_COUNT) return { error: 'count' };
  if (cfg.seed.length > 100) return { error: 'seed' };
  if (!HOMOCODIA_LEVELS.includes(cfg.homocodia)) return { error: 'homocodia' };
  if (cfg.place && !PLACE_RE.test(cfg.place.code)) return { error: 'place' };
  const t = today(now);
  const minDay = parseIsoDay(`${MIN_YEAR}-01-01`)!;
  if (cfg.birthExact.trim() !== '') {
    const d = parseIsoDay(cfg.birthExact);
    if (d === null || d < minDay || d > t.day) return { error: 'birth' };
    return { fromDay: d, toDay: d };
  }
  if (!Number.isInteger(cfg.yearFrom) || !Number.isInteger(cfg.yearTo) || cfg.yearFrom < MIN_YEAR || cfg.yearTo > t.year || cfg.yearFrom > cfg.yearTo) {
    return { error: 'birth' };
  }
  const toDay = Math.min(parseIsoDay(`${cfg.yearTo}-12-31`)!, t.day);
  return { fromDay: parseIsoDay(`${cfg.yearFrom}-01-01`)!, toDay };
}

/**
 * Genera i codici fiscali. I duplicati vengono scartati (con filtri stretti le combinazioni possibili sono poche):
 * se non se ne trovano abbastanza di diversi, `short` è vero e le righe sono meno di quelle chieste.
 */
export function generateCodiciFiscali(cfg: CfConfig, now: Date = new Date()): CfResult {
  const v = validateCf(cfg, now);
  if ('error' in v) return { ok: false, error: v.error };
  const seed = cfg.seed.trim() === '' ? randomSeedText() : cfg.seed;
  const r = makeRandom(hashSeed(seed));
  const rows: CfRow[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = cfg.count * 30 + 200;
  while (rows.length < cfg.count && attempts++ < maxAttempts) {
    const sex: Sex = cfg.sex === 'any' ? (r() < 0.5 ? 'M' : 'F') : cfg.sex;
    const first = pick(r, sex === 'M' ? MALE : FEMALE);
    const last = pick(r, SURNAMES);
    const birth = dayToParts(int(r, v.fromDay, v.toDay));
    const place: PlaceChoice = cfg.place ?? ((c) => ({ code: c[2], name: c[0], sigla: c[1] }))(pick(r, CITIES));
    const res = computeCodiceFiscale({ surname: last, name: first, sex, year: birth.y, month: birth.m, day: birth.d, placeCode: place.code });
    if (!res.ok) continue; // gli elenchi hanno sempre lettere: non dovrebbe succedere
    const level = cfg.homocodia === 8 ? int(r, 1, 7) : cfg.homocodia;
    const code = level ? omocodiaVariants(res.code)[level - 1] : res.code;
    if (seen.has(code)) continue;
    seen.add(code);
    rows.push({
      code, first, last, sex,
      birth: `${birth.y}-${pad2(birth.m)}-${pad2(birth.d)}`,
      place: place.sigla ? `${place.name} (${place.sigla})` : place.name,
      placeCode: place.code,
      homocodia: level,
    });
  }
  return { ok: true, seed, rows, short: rows.length < cfg.count };
}

// ---------- partita IVA ----------

export interface VatConfig {
  count: number;
  seed: string;
  /** Codice dell'ufficio provinciale a tre cifre (da `VAT_OFFICES`); vuoto = a caso. */
  office: string;
  /** Con il prefisso `IT` davanti alle undici cifre. */
  prefix: boolean;
}

export const DEFAULT_VAT_CONFIG: VatConfig = { count: 10, seed: '', office: '', prefix: false };

export interface VatRow {
  /** Il valore come si mostra e si copia (con o senza `IT`). */
  value: string;
  /** Le undici cifre. */
  digits: string;
  office: string;
  /** Sigla e nome della provincia dell'ufficio (vuoti per i codici che non sono nell'elenco). */
  province: string;
}

export type VatResult = { ok: true; seed: string; rows: VatRow[] } | { ok: false; error: GenError };

export function generatePartiteIva(cfg: VatConfig): VatResult {
  if (!Number.isInteger(cfg.count) || cfg.count < MIN_COUNT || cfg.count > MAX_COUNT) return { ok: false, error: 'count' };
  if (cfg.seed.length > 100) return { ok: false, error: 'seed' };
  if (cfg.office !== '' && !(cfg.office in VAT_OFFICES)) return { ok: false, error: 'office' };
  const seed = cfg.seed.trim() === '' ? randomSeedText() : cfg.seed;
  const r = makeRandom(hashSeed(seed));
  const rows: VatRow[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (rows.length < cfg.count && attempts++ < cfg.count * 30 + 200) {
    const digits = fakeVat(r, cfg.office || undefined);
    if (seen.has(digits)) continue;
    seen.add(digits);
    const office = digits.slice(7, 10);
    const o = VAT_OFFICES[office];
    rows.push({ value: (cfg.prefix ? 'IT' : '') + digits, digits, office, province: o ? `${o[1]} (${o[0]})` : '' });
  }
  return { ok: true, seed, rows };
}

// ---------- esportazione ----------

export function cfToCsv(rows: readonly CfRow[]): string {
  const head = ['codice_fiscale', 'nome', 'cognome', 'sesso', 'data_nascita', 'luogo_nascita', 'codice_catastale', 'omocodia'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([r.code, r.first, r.last, r.sex, r.birth, r.place, r.placeCode, r.homocodia].map((c) => csvCell(c, ',')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function cfToJson(rows: readonly CfRow[]): string {
  const objs = rows.map((r) => ({
    codice_fiscale: r.code, nome: r.first, cognome: r.last, sesso: r.sex, data_nascita: r.birth,
    luogo_nascita: r.place, codice_catastale: r.placeCode, omocodia: r.homocodia,
  }));
  return JSON.stringify(objs, null, 2) + '\n';
}

export function vatToCsv(rows: readonly VatRow[]): string {
  const lines = ['partita_iva,codice_ufficio,provincia'];
  for (const r of rows) lines.push([r.value, r.office, r.province].map((c) => csvCell(c, ',')).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function vatToJson(rows: readonly VatRow[]): string {
  return JSON.stringify(rows.map((r) => ({ partita_iva: r.value, codice_ufficio: r.office, provincia: r.province })), null, 2) + '\n';
}
