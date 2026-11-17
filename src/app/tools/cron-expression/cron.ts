// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import cronstrue from 'cronstrue';
// solo il locale italiano (l'inglese è già nel pacchetto base): 'cronstrue/i18n' includerebbe una quarantina di lingue
import 'cronstrue/locales/it';

// ---------- campi e alias ----------

export type FieldName = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

interface FieldSpec {
  name: FieldName;
  min: number;
  max: number;
  names?: readonly string[];
  /** Il primo nome corrisponde a questo valore (gennaio = 1, domenica = 0). */
  namesFrom?: number;
  /** Accetta `?` come sinonimo di `*`. */
  question?: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SPECS: Record<FieldName, FieldSpec> = {
  second: { name: 'second', min: 0, max: 59 },
  minute: { name: 'minute', min: 0, max: 59 },
  hour: { name: 'hour', min: 0, max: 23 },
  dayOfMonth: { name: 'dayOfMonth', min: 1, max: 31, question: true },
  month: { name: 'month', min: 1, max: 12, names: MONTHS, namesFrom: 1 },
  dayOfWeek: { name: 'dayOfWeek', min: 0, max: 7, names: DAYS, namesFrom: 0, question: true },
};

export const FIELD_ORDER_5: readonly FieldName[] = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
export const FIELD_ORDER_6: readonly FieldName[] = ['second', ...FIELD_ORDER_5];

/** Alias di cron (Vixie) e la loro forma a 5 campi. */
export const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface CronError {
  code:
    | 'empty'
    | 'fieldCount'
    | 'reboot'
    | 'badAlias'
    | 'emptyItem'
    | 'badValue'
    | 'outOfRange'
    | 'reversedRange'
    | 'badStep'
    | 'stepTooBig'
    | 'quartz'
    | 'badQuestion'
    | 'badName';
  field?: FieldName;
  /** Pezzo di testo che ha causato l'errore. */
  token?: string;
  value?: number;
  min?: number;
  max?: number;
  /** Per fieldCount: quanti campi sono stati trovati. */
  count?: number;
}

export interface ParsedCron {
  hasSeconds: boolean;
  /** I campi come scritti (dopo l'espansione dell'alias), nell'ordine second? minute hour dom month dow. */
  fields: string[];
  /** Espressione a 5 o 6 campi senza alias. */
  expanded: string;
  /** Valori ammessi, indicizzati per valore (il giorno della settimana va da 0 a 6: 7 è già domenica). */
  seconds: boolean[];
  minutes: boolean[];
  hours: boolean[];
  dom: boolean[];
  months: boolean[];
  dow: boolean[];
  /** Il campo comincia con * (o ?): in questo caso cron richiede che giorno del mese E della settimana corrispondano. */
  domStar: boolean;
  dowStar: boolean;
}

export type ParseResult = { ok: true; cron: ParsedCron } | { ok: false; error: CronError };

type FieldResult = { ok: true; set: boolean[]; star: boolean } | { ok: false; error: CronError };

function parseValue(text: string, spec: FieldSpec, token: string): number | CronError {
  if (/^\d+$/.test(text)) {
    const v = Number(text);
    if (v < spec.min || v > spec.max) return { code: 'outOfRange', field: spec.name, token, value: v, min: spec.min, max: spec.max };
    return v;
  }
  if (/^[LW#]$|^\d+[LW#]|[LW#]\d*$/i.test(text) && !(spec.names ?? []).includes(text.toLowerCase())) {
    return { code: 'quartz', field: spec.name, token };
  }
  if (spec.names && /^[a-z]{3}$/i.test(text)) {
    const i = spec.names.indexOf(text.toLowerCase());
    if (i !== -1) return i + (spec.namesFrom ?? 0);
    return { code: 'badName', field: spec.name, token: text };
  }
  return { code: 'badValue', field: spec.name, token };
}

function parseField(text: string, spec: FieldSpec): FieldResult {
  const size = spec.max + 1;
  const set = new Array<boolean>(size).fill(false);
  const star = text.startsWith('*') || (!!spec.question && text.startsWith('?'));
  for (const item of text.split(',')) {
    if (item === '') return { ok: false, error: { code: 'emptyItem', field: spec.name, token: text } };
    if (/[LW#]/i.test(item) && !spec.names?.some((n) => item.toLowerCase().includes(n))) {
      return { ok: false, error: { code: 'quartz', field: spec.name, token: item } };
    }
    const [base, stepText, ...extra] = item.split('/');
    if (extra.length > 0) return { ok: false, error: { code: 'badStep', field: spec.name, token: item } };
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) return { ok: false, error: { code: 'badStep', field: spec.name, token: item } };
      step = Number(stepText);
      if (step > spec.max - spec.min + 1) {
        return { ok: false, error: { code: 'stepTooBig', field: spec.name, token: item, value: step, max: spec.max - spec.min + 1 } };
      }
    }
    let from: number;
    let to: number;
    if (base === '*' || base === '?') {
      if (base === '?' && !spec.question) return { ok: false, error: { code: 'badQuestion', field: spec.name, token: item } };
      from = spec.min;
      to = spec.max;
    } else if (base.includes('-')) {
      const parts = base.split('-');
      if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return { ok: false, error: { code: 'badValue', field: spec.name, token: item } };
      const a = parseValue(parts[0], spec, item);
      if (typeof a !== 'number') return { ok: false, error: a };
      const b = parseValue(parts[1], spec, item);
      if (typeof b !== 'number') return { ok: false, error: b };
      if (a > b) return { ok: false, error: { code: 'reversedRange', field: spec.name, token: item, value: a, max: b } };
      from = a;
      to = b;
    } else {
      const v = parseValue(base, spec, item);
      if (typeof v !== 'number') return { ok: false, error: v };
      from = v;
      // "5/15" = da 5 fino alla fine, ogni 15
      to = stepText !== undefined ? spec.max : v;
    }
    for (let v = from; v <= to; v += step) set[v] = true;
  }
  if (spec.name === 'dayOfWeek') {
    if (set[7]) set[0] = true; // 7 = domenica
    set.length = 7;
  }
  return { ok: true, set, star };
}

/** Espande un alias (@daily…) nella forma a 5 campi; null se l'espressione non è un alias. */
export function expandAlias(expr: string): string | null {
  const t = expr.trim().toLowerCase();
  return t in ALIASES ? ALIASES[t] : null;
}

/** Legge e controlla un'espressione a 5 campi, a 6 campi (con i secondi in testa) o un alias. */
export function parseCron(expr: string): ParseResult {
  const text = expr.trim();
  if (text === '') return { ok: false, error: { code: 'empty' } };
  let src = text;
  if (text.startsWith('@')) {
    const lower = text.toLowerCase();
    if (lower === '@reboot') return { ok: false, error: { code: 'reboot' } };
    const expanded = ALIASES[lower];
    if (!expanded) return { ok: false, error: { code: 'badAlias', token: text } };
    src = expanded;
  }
  const parts = src.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return { ok: false, error: { code: 'fieldCount', count: parts.length } };
  const hasSeconds = parts.length === 6;
  const order = hasSeconds ? FIELD_ORDER_6 : FIELD_ORDER_5;
  const results: Partial<Record<FieldName, Extract<FieldResult, { ok: true }>>> = {};
  for (let i = 0; i < order.length; i++) {
    const r = parseField(parts[i], SPECS[order[i]]);
    if (!r.ok) return { ok: false, error: r.error };
    results[order[i]] = r;
  }
  const secondsSet = results.second?.set ?? Object.assign(new Array<boolean>(60).fill(false), { 0: true });
  return {
    ok: true,
    cron: {
      hasSeconds,
      fields: parts,
      expanded: parts.join(' '),
      seconds: secondsSet,
      minutes: results.minute!.set,
      hours: results.hour!.set,
      dom: results.dayOfMonth!.set,
      months: results.month!.set,
      dow: results.dayOfWeek!.set,
      domStar: results.dayOfMonth!.star,
      dowStar: results.dayOfWeek!.star,
    },
  };
}

/** Vero se giorno del mese e della settimana sono entrambi limitati: cron esegue quando UNO dei due corrisponde. */
export function usesOrRule(c: ParsedCron): boolean {
  return !c.domStar && !c.dowStar;
}

// ---------- fusi orari ----------

export interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export interface Zone {
  id: string;
  /** Ora "a muro" in questo fuso per un istante (millisecondi Unix). */
  parts(ms: number): Wall;
  /** Scarto dal UTC in millisecondi (positivo a est di Greenwich). */
  offset(ms: number): number;
  /** Istanti in cui l'ora a muro è quella data: nessuno (ora inesistente), uno, o due (ora ripetuta). */
  instants(w: Wall): number[];
}

const DAY_MS = 86400000;

function wallAsUtc(w: Wall): number {
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
}

function sameWall(a: Wall, b: Wall): boolean {
  return a.y === b.y && a.mo === b.mo && a.d === b.d && a.h === b.h && a.mi === b.mi && a.s === b.s;
}

export const UTC_ZONE: Zone = {
  id: 'UTC',
  parts(ms) {
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  },
  offset: () => 0,
  instants: (w) => [wallAsUtc(w)],
};

/** Fuso IANA (es. Europe/Rome) tramite Intl; lancia RangeError se il nome non esiste. */
export function makeZone(tz: string): Zone {
  if (tz === 'UTC') return UTC_ZONE;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = (ms: number): Wall => {
    const w: Wall = { y: 0, mo: 0, d: 0, h: 0, mi: 0, s: 0 };
    for (const p of fmt.formatToParts(new Date(ms))) {
      const v = Number(p.value);
      if (p.type === 'year') w.y = v;
      else if (p.type === 'month') w.mo = v;
      else if (p.type === 'day') w.d = v;
      else if (p.type === 'hour') w.h = v % 24;
      else if (p.type === 'minute') w.mi = v;
      else if (p.type === 'second') w.s = v;
    }
    return w;
  };
  const offset = (ms: number): number => wallAsUtc(parts(ms)) - Math.floor(ms / 1000) * 1000;
  return {
    id: tz,
    parts,
    offset,
    instants(w) {
      const u = wallAsUtc(w);
      const found = new Set<number>();
      for (const o of new Set([offset(u - DAY_MS), offset(u + DAY_MS)])) {
        const t = u - o;
        if (sameWall(parts(t), w)) found.add(t);
      }
      return [...found].sort((a, b) => a - b);
    },
  };
}

/** Il fuso del browser (o UTC se non si riesce a determinarlo). */
export function localZone(): Zone {
  try {
    return makeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  } catch {
    return UTC_ZONE;
  }
}

/** Primo istante dopo un'ora inesistente (il salto all'ora legale): quello in cui lo scarto cambia. */
export function gapEnd(zone: Zone, w: Wall): number {
  const u = wallAsUtc(w);
  let lo = u - 2 * DAY_MS;
  let hi = u + 2 * DAY_MS;
  const before = zone.offset(lo);
  if (zone.offset(hi) === before) return u - before; // non dovrebbe succedere
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2000) * 1000;
    if (zone.offset(mid) === before) lo = mid;
    else hi = mid;
  }
  return hi;
}

// ---------- prossime esecuzioni ----------

function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function weekday(y: number, mo: number, d: number): number {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function dayMatches(c: ParsedCron, y: number, mo: number, d: number): boolean {
  const byDom = c.dom[d];
  const byDow = c.dow[weekday(y, mo, d)];
  return c.domStar || c.dowStar ? byDom && byDow : byDom || byDow;
}

/** Quanti anni in avanti si cerca prima di dichiarare che l'espressione non scatta mai (es. 31 febbraio). */
const HORIZON_YEARS = 40;

/** Prima ora "a muro" uguale o successiva a `start` che soddisfa l'espressione, o null. */
export function nextWall(c: ParsedCron, start: Wall): Wall | null {
  let { y, mo, d, h, mi, s } = start;
  const lastYear = start.y + HORIZON_YEARS;
  for (let guard = 0; guard < 2_000_000; guard++) {
    if (s > 59) {
      s = 0;
      mi++;
    }
    if (mi > 59) {
      mi = 0;
      h++;
    }
    if (h > 23) {
      h = 0;
      d++;
    }
    if (y > lastYear) return null;
    if (!c.months[mo]) {
      mo++;
      if (mo > 12) {
        mo = 1;
        y++;
      }
      d = 1;
      h = mi = s = 0;
      continue;
    }
    if (d > daysInMonth(y, mo)) {
      mo++;
      if (mo > 12) {
        mo = 1;
        y++;
      }
      d = 1;
      h = mi = s = 0;
      continue;
    }
    if (!dayMatches(c, y, mo, d)) {
      d++;
      h = mi = s = 0;
      continue;
    }
    if (!c.hours[h]) {
      h++;
      mi = s = 0;
      continue;
    }
    if (!c.minutes[mi]) {
      mi++;
      s = 0;
      continue;
    }
    if (!c.seconds[s]) {
      s++;
      continue;
    }
    return { y, mo, d, h, mi, s };
  }
  return null;
}

export interface NextRuns {
  /** Istanti (millisecondi Unix) in ordine crescente. */
  runs: number[];
  /** Vero se l'espressione non scatta più (o mai) prima dell'orizzonte di ricerca. */
  exhausted: boolean;
}

export const MAX_RUNS = 100;

/**
 * Prossime `count` esecuzioni strettamente dopo `from`.
 * Ora inesistente (salto all'ora legale): l'esecuzione slitta al primo istante valido dopo il salto.
 * Ora ripetuta (ritorno all'ora solare): una sola esecuzione, la prima.
 */
export function nextRuns(c: ParsedCron, zone: Zone, from: number, count: number): NextRuns {
  const n = Math.max(0, Math.min(MAX_RUNS, Math.floor(count)));
  const runs: number[] = [];
  let last = Math.floor(from / 1000) * 1000;
  const cursor = zone.parts(last);
  cursor.s += 1; // strettamente dopo
  let candidate: Wall | null = cursor;
  let guard = 0;
  while (runs.length < n && guard++ < 200_000) {
    const wall = nextWall(c, candidate);
    if (!wall) return { runs, exhausted: true };
    const inst = zone.instants(wall);
    const at = inst.length > 0 ? inst[0] : gapEnd(zone, wall);
    if (at > last) {
      runs.push(at);
      last = at;
    }
    candidate = { ...wall, s: wall.s + 1 };
  }
  return { runs, exhausted: false };
}

// ---------- descrizione in linguaggio naturale ----------

/** Descrizione dell'espressione in italiano o inglese (cronstrue), o null se la libreria non la capisce. */
export function describeCron(c: ParsedCron, locale: 'it' | 'en'): string | null {
  try {
    const text = cronstrue.toString(c.expanded, {
      locale,
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true,
    });
    return text;
  } catch {
    return null;
  }
}
