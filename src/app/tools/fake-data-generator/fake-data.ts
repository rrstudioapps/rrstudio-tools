// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { checkChar as cfCheckChar, computeCodiceFiscale } from '../codice-fiscale/codice-fiscale';
import { italianCin, ibanCheckDigits } from '../iban-partita-iva/iban';
import { vatCheckDigit } from '../iban-partita-iva/vat';

/**
 * Generatore di dati di prova finti. Tutto è inventato: nomi e cognomi vengono da elenchi comuni e combinati a caso,
 * le e-mail usano solo domini riservati (RFC 2606), i telefoni sono numeri di fantasia, codice fiscale, partita IVA
 * e IBAN sono formalmente validi (cifre di controllo corrette) ma non appartengono a nessuno.
 * Logica pura: nessun DOM, nessuna richiesta di rete. Con lo stesso seme si ottengono sempre gli stessi dati.
 */

export type FieldId =
  | 'first_name' | 'last_name' | 'email' | 'phone'
  | 'street' | 'zip' | 'city' | 'province'
  | 'birth_date' | 'tax_code' | 'vat_number' | 'iban'
  | 'uuid' | 'number' | 'boolean' | 'lorem' | 'color';

/** Campi disponibili, nell'ordine in cui si propongono. L'id è anche il nome della colonna. */
export const FIELD_IDS: readonly FieldId[] = [
  'first_name', 'last_name', 'email', 'phone', 'street', 'zip', 'city', 'province',
  'birth_date', 'tax_code', 'vat_number', 'iban', 'uuid', 'number', 'boolean', 'lorem', 'color',
];

export type Cell = string | number | boolean;
export type Row = Cell[];

export const MIN_ROWS = 1;
export const MAX_ROWS = 10_000;
export const PREVIEW_ROWS = 100;

export interface FakeConfig {
  fields: FieldId[];
  count: number;
  /** Seme testuale: vuoto = ne viene scelto uno a caso (e restituito, così si può riprodurre). */
  seed: string;
  /** Intervallo delle date di nascita, `AAAA-MM-GG` (estremi inclusi). */
  birthFrom: string;
  birthTo: string;
  numberMin: number;
  numberMax: number;
  /** Cifre decimali dei numeri (0-4). */
  numberDecimals: number;
}

export const DEFAULT_CONFIG: FakeConfig = {
  fields: ['first_name', 'last_name', 'email', 'phone', 'city', 'birth_date'],
  count: 10,
  seed: '',
  birthFrom: '1950-01-01',
  birthTo: '2005-12-31',
  numberMin: 1,
  numberMax: 1000,
  numberDecimals: 0,
};

export type ConfigError = 'fields' | 'count' | 'seed' | 'birth' | 'number';

// ---------- generatore pseudocasuale con seme ----------

/** Fa un intero a 32 bit da un testo (xmur3): stesso testo, stesso intero. */
export function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: numeri in [0, 1) a partire da un seme a 32 bit. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seme leggibile a caso (8 caratteri), dalla crittografia del browser. */
export function randomSeedText(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

type Rng = () => number;
const int = (r: Rng, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));
const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const digits = (r: Rng, n: number): string => Array.from({ length: n }, () => int(r, 0, 9)).join('');

// ---------- dati di base ----------

const MALE = ['Luca', 'Marco', 'Giuseppe', 'Francesco', 'Alessandro', 'Andrea', 'Matteo', 'Lorenzo', 'Davide', 'Simone', 'Stefano', 'Paolo', 'Roberto', 'Fabio', 'Giovanni', 'Riccardo', 'Daniele', 'Emanuele', 'Gabriele', 'Federico', 'Tommaso', 'Nicola', 'Claudio', 'Massimo', 'Salvatore'];
const FEMALE = ['Giulia', 'Francesca', 'Chiara', 'Sara', 'Martina', 'Alice', 'Elena', 'Valentina', 'Federica', 'Silvia', 'Laura', 'Elisa', 'Anna', 'Paola', 'Giorgia', 'Ilaria', 'Roberta', 'Beatrice', 'Alessia', 'Monica', 'Cristina', 'Serena', 'Veronica', 'Lucia', 'Irene'];
const SURNAMES = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile', 'Martinelli', 'Vitale', 'Lombardo', 'Serra', 'Coppola', 'De Santis', "D'Angelo", 'Marchetti'];

const STREET_KINDS = ['Via', 'Via', 'Via', 'Viale', 'Piazza', 'Corso', 'Largo', 'Vicolo'];
const STREET_NAMES = ['Roma', 'Garibaldi', 'Mazzini', 'Verdi', 'Dante Alighieri', 'Cavour', 'Marconi', 'Gramsci', 'Matteotti', 'della Repubblica', 'XX Settembre', 'dei Mille', 'Manzoni', 'Leopardi', 'Vittorio Veneto', 'San Francesco', 'Kennedy', 'della Libertà', 'Piave', 'Carducci', 'Puccini', 'Colombo', 'Fratelli Bandiera', 'Trieste', 'Montenero'];

/** [città, sigla provincia, codice catastale, CAP di fantasia coerente con la zona]. */
export const CITIES: readonly (readonly [string, string, string, string])[] = [
  ['Roma', 'RM', 'H501', '00100'], ['Milano', 'MI', 'F205', '20100'], ['Napoli', 'NA', 'F839', '80100'],
  ['Torino', 'TO', 'L219', '10100'], ['Palermo', 'PA', 'G273', '90100'], ['Genova', 'GE', 'D969', '16100'],
  ['Bologna', 'BO', 'A944', '40100'], ['Firenze', 'FI', 'D612', '50100'], ['Bari', 'BA', 'A662', '70100'],
  ['Catania', 'CT', 'C351', '95100'], ['Venezia', 'VE', 'L736', '30100'], ['Verona', 'VR', 'L781', '37100'],
  ['Padova', 'PD', 'G224', '35100'], ['Trieste', 'TS', 'L424', '34100'], ['Brescia', 'BS', 'B157', '25100'],
  ['Parma', 'PR', 'G337', '43100'], ['Modena', 'MO', 'F257', '41100'], ['Perugia', 'PG', 'G478', '06100'],
  ['Cagliari', 'CA', 'B354', '09100'], ['Trento', 'TN', 'L378', '38100'],
];

const MOBILE_PREFIXES = ['320', '327', '328', '333', '338', '339', '340', '347', '348', '349', '366', '380', '388', '389', '392'];
const LANDLINE_PREFIXES = ['02', '06', '011', '010', '051', '055', '081', '091', '045', '049'];
/** Domini riservati dalla RFC 2606: non esistono e non possono essere registrati. */
export const EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net', 'mail.test', 'azienda.test', 'posta.test'];

const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit ' +
  'voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');

// ---------- valori formalmente validi ----------

/** Partita IVA di 11 cifre con cifra di controllo corretta (ufficio 001-100, progressivo mai tutto zero). */
export function fakeVat(r: Rng): string {
  const progressive = String(int(r, 1, 9_999_999)).padStart(7, '0');
  const office = String(int(r, 1, 100)).padStart(3, '0');
  const first10 = progressive + office;
  return first10 + vatCheckDigit(first10);
}

/** IBAN italiano di 27 caratteri: CIN e cifre di controllo corretti; ABI e CAB sono inventati (ABI da 9xxxx). */
export function fakeIban(r: Rng): string {
  const abi = '9' + digits(r, 4);
  const cab = digits(r, 5);
  const account = digits(r, 12);
  const cin = italianCin(abi + cab + account);
  const bban = cin + abi + cab + account;
  return 'IT' + ibanCheckDigits('IT', bban) + bban;
}

function fakeUuid(r: Rng): string {
  const hex = Array.from({ length: 32 }, () => int(r, 0, 15).toString(16)).join('');
  const variant = '89ab'[int(r, 0, 3)];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fakePhone(r: Rng): string {
  if (r() < 0.7) return `+39 ${pick(r, MOBILE_PREFIXES)} ${digits(r, 7)}`;
  return `+39 ${pick(r, LANDLINE_PREFIXES)} ${digits(r, 7)}`;
}

function fakeSentence(r: Rng): string {
  const n = int(r, 5, 12);
  const s = Array.from({ length: n }, () => pick(r, LOREM)).join(' ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}

function fakeColor(r: Rng): string {
  return '#' + int(r, 0, 0xffffff).toString(16).padStart(6, '0');
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Giorni dal 1970 a una data `AAAA-MM-GG`; null se non è una data vera. */
export function parseIsoDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86_400_000);
}

function dayToParts(day: number): { y: number; m: number; d: number } {
  const dt = new Date(day * 86_400_000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const ascii = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// ---------- una persona coerente ----------

interface Person {
  sex: 'M' | 'F';
  first: string;
  last: string;
  birth: { y: number; m: number; d: number };
  birthCity: (typeof CITIES)[number];
  city: (typeof CITIES)[number];
}

function makePerson(r: Rng, cfg: ResolvedConfig): Person {
  const sex = r() < 0.5 ? 'M' : 'F';
  return {
    sex,
    first: pick(r, sex === 'M' ? MALE : FEMALE),
    last: pick(r, SURNAMES),
    birth: dayToParts(int(r, cfg.fromDay, cfg.toDay)),
    birthCity: pick(r, CITIES),
    city: pick(r, CITIES),
  };
}

interface ResolvedConfig {
  fromDay: number;
  toDay: number;
  min: number;
  max: number;
  decimals: number;
}

/** Il codice fiscale è calcolato con le regole vere sui dati finti della riga. */
export function fakeTaxCode(p: Pick<Person, 'sex' | 'first' | 'last' | 'birth' | 'birthCity'>): string {
  const res = computeCodiceFiscale({
    surname: p.last, name: p.first, sex: p.sex,
    year: p.birth.y, month: p.birth.m, day: p.birth.d, placeCode: p.birthCity[2],
  });
  // i cognomi dell'elenco hanno sempre lettere: il ramo d'errore non dovrebbe mai scattare
  return res.ok ? res.code : 'XXXXXX00A01H501' + cfCheckChar('XXXXXX00A01H501');
}

function fakeNumber(r: Rng, cfg: ResolvedConfig): number {
  const v = cfg.min + r() * (cfg.max - cfg.min);
  if (cfg.decimals === 0) return Math.min(cfg.max, Math.max(cfg.min, Math.round(v)));
  const f = 10 ** cfg.decimals;
  return Math.min(cfg.max, Math.max(cfg.min, Math.round(v * f) / f));
}

function cell(id: FieldId, p: Person, r: Rng, cfg: ResolvedConfig): Cell {
  switch (id) {
    case 'first_name': return p.first;
    case 'last_name': return p.last;
    case 'email': {
      const sep = pick(r, ['.', '_', '']);
      const num = r() < 0.3 ? String(int(r, 1, 99)) : '';
      return `${ascii(p.first)}${sep}${ascii(p.last)}${num}@${pick(r, EMAIL_DOMAINS)}`;
    }
    case 'phone': return fakePhone(r);
    case 'street': return `${pick(r, STREET_KINDS)} ${pick(r, STREET_NAMES)} ${int(r, 1, 150)}`;
    case 'zip': return zipFor(p.city[3], r);
    case 'city': return p.city[0];
    case 'province': return p.city[1];
    case 'birth_date': return `${p.birth.y}-${pad2(p.birth.m)}-${pad2(p.birth.d)}`;
    case 'tax_code': return fakeTaxCode(p);
    case 'vat_number': return fakeVat(r);
    case 'iban': return fakeIban(r);
    case 'uuid': return fakeUuid(r);
    case 'number': return fakeNumber(r, cfg);
    case 'boolean': return r() < 0.5;
    case 'lorem': return fakeSentence(r);
    case 'color': return fakeColor(r);
  }
}

/** CAP di fantasia: i grandi comuni hanno CAP a zone; qui si tengono le prime tre cifre del CAP generico della città. */
function zipFor(base: string, r: Rng): string {
  return base.slice(0, 3) + pad2(int(r, 1, 99));
}

/** Controlla la configurazione; restituisce l'errore o la configurazione risolta (date in giorni). */
export function validateConfig(cfg: FakeConfig): { error: ConfigError } | { resolved: ResolvedConfig } {
  if (!cfg.fields.length || cfg.fields.some((f) => !FIELD_IDS.includes(f))) return { error: 'fields' };
  if (!Number.isInteger(cfg.count) || cfg.count < MIN_ROWS || cfg.count > MAX_ROWS) return { error: 'count' };
  if (cfg.seed.length > 100) return { error: 'seed' };
  const fromDay = parseIsoDay(cfg.birthFrom);
  const toDay = parseIsoDay(cfg.birthTo);
  if (fromDay === null || toDay === null || fromDay > toDay) return { error: 'birth' };
  if (!Number.isFinite(cfg.numberMin) || !Number.isFinite(cfg.numberMax) || cfg.numberMin > cfg.numberMax ||
    !Number.isInteger(cfg.numberDecimals) || cfg.numberDecimals < 0 || cfg.numberDecimals > 4 ||
    Math.abs(cfg.numberMin) > 1e12 || Math.abs(cfg.numberMax) > 1e12) return { error: 'number' };
  return { resolved: { fromDay, toDay, min: cfg.numberMin, max: cfg.numberMax, decimals: cfg.numberDecimals } };
}

export type GenerateResult = { ok: true; seed: string; rows: Row[] } | { ok: false; error: ConfigError };

/** Cede il controllo al browser (così la pagina resta reattiva durante la generazione a blocchi). */
const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Genera le righe a blocchi da 500, cedendo il controllo tra un blocco e l'altro.
 * `isCancelled` permette di interrompere se nel frattempo la richiesta è cambiata.
 * Il risultato non dipende dalla dimensione dei blocchi: dipende solo dal seme.
 */
export async function generateRows(
  cfg: FakeConfig,
  opts: { chunk?: number; isCancelled?: () => boolean; onProgress?: (done: number) => void } = {},
): Promise<GenerateResult | null> {
  const v = validateConfig(cfg);
  if ('error' in v) return { ok: false, error: v.error };
  const seed = cfg.seed.trim() === '' ? randomSeedText() : cfg.seed;
  const r = makeRandom(hashSeed(seed));
  const chunk = opts.chunk ?? 500;
  const rows: Row[] = [];
  while (rows.length < cfg.count) {
    const end = Math.min(cfg.count, rows.length + chunk);
    while (rows.length < end) {
      const p = makePerson(r, v.resolved);
      rows.push(cfg.fields.map((f) => cell(f, p, r, v.resolved)));
    }
    opts.onProgress?.(rows.length);
    if (rows.length < cfg.count) {
      await yieldToBrowser();
      if (opts.isCancelled?.()) return null;
    }
  }
  return { ok: true, seed, rows };
}

// ---------- esportazione ----------

export type ExportFormat = 'csv' | 'json' | 'sql';
export type Separator = ',' | ';' | '\t';

/** CSV (RFC 4180): le celle con separatore, virgolette o a capo vanno tra virgolette, con le virgolette raddoppiate. */
export function csvCell(value: Cell, sep: Separator): string {
  const s = String(value);
  return s.includes(sep) || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(fields: readonly FieldId[], rows: readonly Row[], sep: Separator): string {
  const lines = [fields.map((f) => csvCell(f, sep)).join(sep)];
  for (const row of rows) lines.push(row.map((c) => csvCell(c, sep)).join(sep));
  return lines.join('\r\n') + '\r\n';
}

/** Array di oggetti con le chiavi nell'ordine scelto; numeri e booleani restano tali. */
export function toJson(fields: readonly FieldId[], rows: readonly Row[]): string {
  const objs = rows.map((row) => Object.fromEntries(fields.map((f, i) => [f, row[i]])));
  return JSON.stringify(objs, null, 2) + '\n';
}

/** Nome di tabella ammesso: lettere, cifre e trattino basso, non inizia per cifra, con al massimo un "schema." davanti. */
export function validTableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,62}(\.[A-Za-z_][A-Za-z0-9_]{0,62})?$/.test(name);
}

/** Letterale SQL standard: le stringhe tra apici con l'apice raddoppiato, i booleani TRUE/FALSE. */
export function sqlLiteral(value: Cell): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return "'" + value.replace(/'/g, "''") + "'";
}

/** Un INSERT per riga. Restituisce null se il nome della tabella non è ammesso. */
export function toSql(fields: readonly FieldId[], rows: readonly Row[], table: string): string | null {
  if (!validTableName(table)) return null;
  const head = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (`;
  return rows.map((row) => head + row.map(sqlLiteral).join(', ') + ');').join('\n') + '\n';
}
