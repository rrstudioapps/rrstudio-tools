// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Unità di misura. Ogni categoria ha un'unità di base e per ogni unità il fattore che la porta alla base
 * (valore in base = valore × factor). La temperatura è l'unica conversione non proporzionale e ha formule a parte.
 * I fattori sono le definizioni esatte (SI, NIST, accordo internazionale del 1959 per yard e libbra).
 */

export type CategoryId =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'time'
  | 'data'
  | 'pressure'
  | 'energy';

export interface Unit {
  id: string;
  /** Simbolo mostrato (non tradotto). */
  symbol: string;
  /** Nome italiano e inglese (finiscono nei dizionari come `u.<id>`). */
  it: string;
  en: string;
  /** Fattore verso l'unità di base della categoria (non usato per la temperatura). */
  factor: number;
  /** Parole in più per la ricerca (sigle, nomi alternativi). */
  alias?: string;
}

export interface Category {
  id: CategoryId;
  units: readonly Unit[];
  /** Unità iniziali (da → a). */
  defaultFrom: string;
  defaultTo: string;
}

const u = (id: string, symbol: string, it: string, en: string, factor: number, alias = ''): Unit => ({ id, symbol, it, en, factor, alias });

export const CATEGORIES: readonly Category[] = [
  {
    id: 'length',
    defaultFrom: 'km',
    defaultTo: 'mi',
    units: [
      u('nm', 'nm', 'nanometro', 'nanometre', 1e-9),
      u('um', 'µm', 'micrometro', 'micrometre', 1e-6, 'micron'),
      u('mm', 'mm', 'millimetro', 'millimetre', 1e-3),
      u('cm', 'cm', 'centimetro', 'centimetre', 1e-2),
      u('m', 'm', 'metro', 'metre meter', 1),
      u('km', 'km', 'chilometro', 'kilometre kilometer', 1e3),
      u('in', 'in', 'pollice', 'inch', 0.0254, 'inch pollici "'),
      u('ft', 'ft', 'piede', 'foot', 0.3048, 'feet piedi'),
      u('yd', 'yd', 'iarda', 'yard', 0.9144, 'yards'),
      u('mi', 'mi', 'miglio', 'mile', 1609.344, 'miles miglia'),
      u('nmi', 'nmi', 'miglio nautico', 'nautical mile', 1852),
    ],
  },
  {
    id: 'mass',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: [
      u('ug', 'µg', 'microgrammo', 'microgram', 1e-9),
      u('mg', 'mg', 'milligrammo', 'milligram', 1e-6),
      u('g', 'g', 'grammo', 'gram', 1e-3),
      u('kg', 'kg', 'chilogrammo', 'kilogram', 1),
      u('t', 't', 'tonnellata', 'metric tonne', 1000, 'ton tonne'),
      u('ct', 'ct', 'carato', 'carat', 2e-4),
      u('oz', 'oz', 'oncia', 'ounce', 0.028349523125, 'ounces once'),
      u('lb', 'lb', 'libbra', 'pound', 0.45359237, 'pounds lbs libbre'),
      u('st', 'st', 'stone', 'stone', 6.35029318),
      u('ston', 'ton US', 'tonnellata corta (US)', 'short ton (US)', 907.18474, 'ton us'),
      u('lton', 'ton UK', 'tonnellata lunga (UK)', 'long ton (UK)', 1016.0469088, 'ton uk'),
    ],
  },
  { id: 'temperature', defaultFrom: 'c', defaultTo: 'f', units: [
    u('c', '°C', 'grado Celsius', 'degree Celsius', 1, 'centigradi celsius'),
    u('f', '°F', 'grado Fahrenheit', 'degree Fahrenheit', 1, 'fahrenheit'),
    u('k', 'K', 'kelvin', 'kelvin', 1),
    u('r', '°R', 'grado Rankine', 'degree Rankine', 1, 'rankine'),
  ] },
  {
    id: 'area',
    defaultFrom: 'm2',
    defaultTo: 'ft2',
    units: [
      u('mm2', 'mm²', 'millimetro quadrato', 'square millimetre', 1e-6),
      u('cm2', 'cm²', 'centimetro quadrato', 'square centimetre', 1e-4),
      u('m2', 'm²', 'metro quadrato', 'square metre', 1, 'mq metri quadri'),
      u('ha', 'ha', 'ettaro', 'hectare', 1e4, 'ettari'),
      u('km2', 'km²', 'chilometro quadrato', 'square kilometre', 1e6, 'kmq'),
      u('in2', 'in²', 'pollice quadrato', 'square inch', 0.00064516),
      u('ft2', 'ft²', 'piede quadrato', 'square foot', 0.09290304, 'sq ft square feet'),
      u('yd2', 'yd²', 'iarda quadrata', 'square yard', 0.83612736),
      u('ac', 'ac', 'acro', 'acre', 4046.8564224, 'acri acres'),
      u('mi2', 'mi²', 'miglio quadrato', 'square mile', 2589988.110336),
    ],
  },
  {
    id: 'volume',
    defaultFrom: 'l',
    defaultTo: 'galus',
    units: [
      u('ml', 'mL', 'millilitro', 'millilitre', 1e-3, 'cc cm3'),
      u('cl', 'cL', 'centilitro', 'centilitre', 1e-2),
      u('dl', 'dL', 'decilitro', 'decilitre', 0.1),
      u('l', 'L', 'litro', 'litre liter', 1),
      u('m3', 'm³', 'metro cubo', 'cubic metre', 1000, 'mc'),
      u('tsp', 'tsp', 'cucchiaino (US)', 'teaspoon (US)', 0.00492892159375, 'cucchiaini'),
      u('tbsp', 'tbsp', 'cucchiaio (US)', 'tablespoon (US)', 0.01478676478125, 'cucchiai'),
      u('floz', 'fl oz', 'oncia fluida (US)', 'fluid ounce (US)', 0.0295735295625),
      u('cup', 'cup', 'tazza (US)', 'cup (US)', 0.2365882365),
      u('pt', 'pt', 'pinta (US)', 'pint (US)', 0.473176473, 'pint'),
      u('qt', 'qt', 'quarto di gallone (US)', 'quart (US)', 0.946352946),
      u('galus', 'gal US', 'gallone (US)', 'gallon (US)', 3.785411784, 'gallon'),
      u('galuk', 'gal UK', 'gallone (UK)', 'gallon (UK)', 4.54609, 'imperial gallon'),
      u('in3', 'in³', 'pollice cubo', 'cubic inch', 0.016387064),
      u('ft3', 'ft³', 'piede cubo', 'cubic foot', 28.316846592),
    ],
  },
  {
    id: 'speed',
    defaultFrom: 'kmh',
    defaultTo: 'mph',
    units: [
      u('ms', 'm/s', 'metro al secondo', 'metre per second', 1),
      u('kmh', 'km/h', 'chilometro orario', 'kilometre per hour', 1 / 3.6, 'kmh kph'),
      u('mph', 'mph', 'miglio orario', 'mile per hour', 0.44704),
      u('kn', 'kn', 'nodo', 'knot', 1852 / 3600, 'nodi knots'),
      u('fts', 'ft/s', 'piede al secondo', 'foot per second', 0.3048),
      u('c', 'c', 'velocità della luce', 'speed of light', 299792458, 'luce light'),
    ],
  },
  {
    id: 'time',
    defaultFrom: 'h',
    defaultTo: 'min',
    units: [
      u('ns', 'ns', 'nanosecondo', 'nanosecond', 1e-9),
      u('us', 'µs', 'microsecondo', 'microsecond', 1e-6),
      u('ms', 'ms', 'millisecondo', 'millisecond', 1e-3),
      u('s', 's', 'secondo', 'second', 1, 'secondi seconds sec'),
      u('min', 'min', 'minuto', 'minute', 60, 'minuti minutes'),
      u('h', 'h', 'ora', 'hour', 3600, 'ore hours'),
      u('d', 'd', 'giorno', 'day', 86400, 'giorni days'),
      u('wk', 'sett.', 'settimana', 'week', 604800, 'settimane weeks'),
      u('mo', 'mese', 'mese (medio)', 'month (average)', 2629746, 'mesi months'),
      u('yr', 'anno', 'anno (medio)', 'year (average)', 31556952, 'anni years'),
    ],
  },
  {
    id: 'data',
    defaultFrom: 'mb',
    defaultTo: 'mib',
    units: [
      u('bit', 'bit', 'bit', 'bit', 0.125),
      u('b', 'B', 'byte', 'byte', 1, 'octet'),
      u('kb', 'kB', 'chilobyte (1000 B)', 'kilobyte (1000 B)', 1e3, 'kb'),
      u('kib', 'KiB', 'kibibyte (1024 B)', 'kibibyte (1024 B)', 1024, 'kib'),
      u('mb', 'MB', 'megabyte (10^6 B)', 'megabyte (10^6 B)', 1e6, 'mb'),
      u('mib', 'MiB', 'mebibyte (2^20 B)', 'mebibyte (2^20 B)', 1024 ** 2, 'mib'),
      u('gb', 'GB', 'gigabyte (10^9 B)', 'gigabyte (10^9 B)', 1e9, 'gb'),
      u('gib', 'GiB', 'gibibyte (2^30 B)', 'gibibyte (2^30 B)', 1024 ** 3, 'gib'),
      u('tb', 'TB', 'terabyte (10^12 B)', 'terabyte (10^12 B)', 1e12, 'tb'),
      u('tib', 'TiB', 'tebibyte (2^40 B)', 'tebibyte (2^40 B)', 1024 ** 4, 'tib'),
      u('pb', 'PB', 'petabyte (10^15 B)', 'petabyte (10^15 B)', 1e15, 'pb'),
      u('pib', 'PiB', 'pebibyte (2^50 B)', 'pebibyte (2^50 B)', 1024 ** 5, 'pib'),
      u('kbit', 'kbit', 'kilobit', 'kilobit', 125, 'kb kilobit'),
      u('mbit', 'Mbit', 'megabit', 'megabit', 125_000, 'mb megabit'),
      u('gbit', 'Gbit', 'gigabit', 'gigabit', 125_000_000, 'gb gigabit'),
    ],
  },
  {
    id: 'pressure',
    defaultFrom: 'bar',
    defaultTo: 'psi',
    units: [
      u('pa', 'Pa', 'pascal', 'pascal', 1),
      u('hpa', 'hPa', 'ettopascal', 'hectopascal', 100, 'millibar'),
      u('kpa', 'kPa', 'chilopascal', 'kilopascal', 1000),
      u('mpa', 'MPa', 'megapascal', 'megapascal', 1e6),
      u('bar', 'bar', 'bar', 'bar', 1e5),
      u('mbar', 'mbar', 'millibar', 'millibar', 100),
      u('atm', 'atm', 'atmosfera standard', 'standard atmosphere', 101325),
      u('mmhg', 'mmHg', 'millimetro di mercurio', 'millimetre of mercury', 133.322387415, 'torr'),
      u('torr', 'Torr', 'torr', 'torr', 101325 / 760),
      u('psi', 'psi', 'libbra per pollice quadrato', 'pound per square inch', 6894.757293168),
    ],
  },
  {
    id: 'energy',
    defaultFrom: 'kcal',
    defaultTo: 'kj',
    units: [
      u('j', 'J', 'joule', 'joule', 1),
      u('kj', 'kJ', 'chilojoule', 'kilojoule', 1e3),
      u('mj', 'MJ', 'megajoule', 'megajoule', 1e6),
      u('cal', 'cal', 'caloria', 'calorie', 4.184, 'piccola caloria'),
      u('kcal', 'kcal', 'chilocaloria', 'kilocalorie', 4184, 'grande caloria dieta food'),
      u('wh', 'Wh', 'wattora', 'watt-hour', 3600),
      u('kwh', 'kWh', 'chilowattora', 'kilowatt-hour', 3.6e6, 'bolletta'),
      u('btu', 'BTU', 'unità termica britannica', 'British thermal unit', 1055.05585262),
      u('ev', 'eV', 'elettronvolt', 'electronvolt', 1.602176634e-19),
      u('ftlbf', 'ft·lbf', 'piede-libbra forza', 'foot-pound force', 1.3558179483314004),
    ],
  },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

export function findUnit(category: CategoryId, unitId: string): Unit | undefined {
  return getCategory(category).units.find((x) => x.id === unitId);
}

// ---- Temperatura (via Celsius) ----

function toCelsius(v: number, unit: string): number {
  switch (unit) {
    case 'c':
      return v;
    case 'f':
      return ((v - 32) * 5) / 9;
    case 'k':
      return v - 273.15;
    default: // rankine
      return ((v - 491.67) * 5) / 9;
  }
}

function fromCelsius(c: number, unit: string): number {
  switch (unit) {
    case 'c':
      return c;
    case 'f':
      return (c * 9) / 5 + 32;
    case 'k':
      return c + 273.15;
    default:
      return ((c + 273.15) * 9) / 5;
  }
}

/** Sotto lo zero assoluto (0 K) la temperatura non esiste. */
export const ABSOLUTE_ZERO_C = -273.15;

export type ConvertResult = { ok: true; value: number } | { ok: false; error: 'belowAbsoluteZero' };

/** Converte un valore tra due unità della stessa categoria. */
export function convert(category: CategoryId, value: number, from: string, to: string): ConvertResult {
  if (category === 'temperature') {
    const c = toCelsius(value, from);
    // tolleranza per i risultati dell'aritmetica in virgola mobile (es. -459,67 °F)
    if (c < ABSOLUTE_ZERO_C - 1e-9) return { ok: false, error: 'belowAbsoluteZero' };
    return { ok: true, value: fromCelsius(c, to) };
  }
  const a = findUnit(category, from);
  const b = findUnit(category, to);
  if (!a || !b) throw new Error(`unità sconosciuta: ${from} / ${to}`);
  return { ok: true, value: (value * a.factor) / b.factor };
}

/** Normalizza per la ricerca: minuscolo, senza accenti né segni. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[µμ]/g, 'u')
    .replace(/²/g, '2')
    .replace(/³/g, '3');
}

export interface UnitHit {
  category: CategoryId;
  unit: Unit;
}

/** Cerca per simbolo, id, nome (nella lingua data) o sigle alternative. Il simbolo esatto viene per primo. */
export function searchUnits(query: string, lang: 'it' | 'en', category?: CategoryId): UnitHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const hits: { hit: UnitHit; rank: number }[] = [];
  for (const c of CATEGORIES) {
    if (category && c.id !== category) continue;
    for (const un of c.units) {
      const symbol = normalize(un.symbol);
      const hay = normalize(`${un.id} ${un.symbol} ${un.it} ${un.en} ${un.alias ?? ''}`);
      let rank = -1;
      if (symbol === q || un.id === q) rank = 0;
      else if (normalize(lang === 'it' ? un.it : un.en).startsWith(q)) rank = 1;
      else if (hay.includes(q)) rank = 2;
      if (rank >= 0) hits.push({ hit: { category: c.id, unit: un }, rank });
    }
  }
  return hits.sort((x, y) => x.rank - y.rank).map((h) => h.hit);
}
