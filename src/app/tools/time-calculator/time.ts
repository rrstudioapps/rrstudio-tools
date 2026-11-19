// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Calcoli su durate e orari: somma e sottrazione di durate in formati misti, foglio ore con passaggio di mezzanotte
 * e straordinario, conversione ore decimali ↔ ore:minuti, importo con tariffa oraria. Logica pura, senza DOM.
 * Le durate sono secondi interi (number).
 */

export type BareUnit = 'h' | 'm';

const UNIT_SECONDS: Record<string, number> = {
  h: 3600, hr: 3600, hrs: 3600, ora: 3600, ore: 3600, hour: 3600, hours: 3600,
  m: 60, min: 60, mins: 60, minuto: 60, minuti: 60, minute: 60, minutes: 60,
  s: 1, sec: 1, secs: 1, secondo: 1, secondi: 1, second: 1, seconds: 1,
};

/**
 * Legge una durata senza segno: `1:30`, `01:30:15`, `1h 30m`, `1h30`, `90m`, `45 min`, `30s`, `1,5h`, `2 ore e 15 minuti`.
 * Un numero senza unità vale ore o minuti secondo `bare` (dopo un'unità `h` vale minuti, dopo `m` secondi).
 * Restituisce i secondi (arrotondati) o null.
 */
export function parseDuration(input: string, bare: BareUnit = 'h'): number | null {
  const s = input.trim().toLowerCase();
  if (s === '') return null;
  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (clock) {
    const m = Number(clock[2]);
    const sec = clock[3] === undefined ? 0 : Number(clock[3]);
    if (m > 59 || sec > 59) return null;
    return Number(clock[1]) * 3600 + m * 60 + sec;
  }
  const re = /(\d+(?:[.,]\d+)?|[.,]\d+)\s*([a-zà-ù]*)/gy;
  let pos = 0;
  let total = 0;
  let prev: number | null = null; // unità precedente in secondi
  let any = false;
  while (pos < s.length) {
    // separatori tra i termini: spazi, virgole, +, "e", "and", "&"
    const sep = /^(?:[\s,;+&]|\band\b|\be\b)+/.exec(s.slice(pos));
    if (sep && any) pos += sep[0].length;
    if (pos >= s.length) break;
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) return null;
    const value = Number(m[1].replace(',', '.'));
    let mult: number;
    if (m[2] === '') mult = prev === null ? (bare === 'h' ? 3600 : 60) : prev === 3600 ? 60 : prev === 60 ? 1 : 0;
    else mult = UNIT_SECONDS[m[2]] ?? 0;
    if (mult === 0) return null;
    total += value * mult;
    prev = m[2] === '' ? mult : mult;
    any = true;
    pos = re.lastIndex;
  }
  return any ? Math.round(total) : null;
}

export interface SumRow {
  /** Numero di riga (da 1). */
  line: number;
  /** Testo della riga senza commento. */
  text: string;
  /** Secondi con segno (le righe che iniziano con `-` sottraggono). */
  seconds: number | null;
  error: boolean;
}

export interface SumResult {
  rows: SumRow[];
  total: number;
  /** Righe valide. */
  count: number;
}

/** Una durata per riga: `+` o `-` iniziale per sommare o sottrarre; `#` e `//` iniziano un commento. */
export function sumLines(text: string, bare: BareUnit = 'h'): SumResult {
  const rows: SumRow[] = [];
  let total = 0;
  let count = 0;
  text.split(/\r?\n/).forEach((raw, idx) => {
    const t = raw.replace(/(#|\/\/).*$/, '').trim();
    if (t === '') return;
    let sign = 1;
    let body = t;
    if (/^[+\-−–]/.test(body)) {
      sign = body[0] === '+' ? 1 : -1;
      body = body.slice(1).trim();
    }
    const d = parseDuration(body, bare);
    if (d === null) {
      rows.push({ line: idx + 1, text: t, seconds: null, error: true });
      return;
    }
    total += sign * d;
    count++;
    rows.push({ line: idx + 1, text: t, seconds: sign * d, error: false });
  });
  return { rows, total, count };
}

/** `1:30` o `1:30:15` (con `-` se negativo): i secondi si mostrano solo se non sono zero. */
export function formatHms(seconds: number): string {
  const neg = seconds < 0;
  const a = Math.abs(Math.round(seconds));
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a % 60;
  return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`;
}

/** Ore decimali con al massimo `maxFrac` decimali (senza zeri finali). */
export function decimalHours(seconds: number, maxFrac = 4): number {
  return Number((seconds / 3600).toFixed(maxFrac));
}

/** Ore decimali (`1,75`) → secondi; null se non è un numero. */
export function decimalToSeconds(input: string): number | null {
  const m = /^\s*([+-]?)(\d+(?:[.,]\d+)?|[.,]\d+)\s*$/.exec(input);
  if (!m) return null;
  const n = Number(m[2].replace(',', '.'));
  return Math.round(n * 3600) * (m[1] === '-' ? -1 : 1);
}

export type Converted = { from: 'decimal'; seconds: number } | { from: 'duration'; seconds: number };

/** Riconosce da solo il verso: un numero decimale è in ore, il resto (con `:` o unità) è una durata. */
export function convertAuto(input: string): Converted | null {
  const t = input.trim();
  const neg = /^[-−–]/.test(t);
  const body = neg ? t.slice(1).trim() : t.replace(/^\+/, '');
  if (/^(\d+(?:[.,]\d+)?|[.,]\d+)$/.test(body)) {
    const s = decimalToSeconds(body);
    return s === null ? null : { from: 'decimal', seconds: neg ? -s : s };
  }
  const d = parseDuration(body);
  return d === null ? null : { from: 'duration', seconds: neg ? -d : d };
}

// ---------- foglio ore ----------

const DAY_NAMES = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const DAY_NAMES_EN = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Giorno della settimana da una parola ("lun", "Lunedì", "mon", "Tuesday"): 0 = lunedì … 6 = domenica. */
export function dayIndex(word: string): number | null {
  const w = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (w.length < 3) return null;
  const k = w.slice(0, 3);
  const full = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  let idx = DAY_NAMES.indexOf(k);
  if (idx < 0) idx = DAY_NAMES_EN.indexOf(k);
  if (idx < 0) return null;
  // la parola deve essere l'abbreviazione o il nome intero, non una parola qualsiasi che inizia così
  if (w.length === 3 || full[idx] === w || full[idx + 7] === w) return idx;
  return null;
}

/** Orario del giorno "8:30", "08.30", "8h30" → minuti dalla mezzanotte (0-1439), o null. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2})[:.h](\d{2})$/.exec(s.trim().toLowerCase());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

export type SheetError = 'times' | 'break' | 'breakTooLong';

export interface SheetRow {
  line: number;
  text: string;
  /** Giorno (0 = lunedì) se indicato nella riga. */
  day: number | null;
  /** Minuti dalla mezzanotte. */
  start: number;
  end: number;
  /** Vero se l'uscita è il giorno dopo (passaggio della mezzanotte). */
  crossesMidnight: boolean;
  breakSeconds: number;
  /** Secondi lavorati, già senza pausa. */
  worked: number;
}
export interface SheetBad {
  line: number;
  text: string;
  error: SheetError;
}

/**
 * Una riga del foglio: `[giorno] entrata uscita [pausa]`. Esempi: `lun 8:30 17:30 60`, `ven 22:00-06:00 pausa 0:30`,
 * `9:00 13:00`. La pausa è una durata (senza unità: minuti) oppure un terzo orario `0:45`.
 */
export function parseSheetLine(text: string, line: number): SheetRow | SheetBad | null {
  const t = text.replace(/(#|\/\/).*$/, '').trim();
  if (t === '') return null;
  let rest = t;
  let day: number | null = null;
  const dm = /^([a-zà-ù]{3,})\b[\s:,.-]*/i.exec(rest);
  if (dm) {
    const d = dayIndex(dm[1]);
    if (d !== null) {
      day = d;
      rest = rest.slice(dm[0].length);
    }
  }
  const times: { h: number; m: number }[] = [];
  rest = rest.replace(/(?<!\d)(\d{1,2})[:.h](\d{2})(?!\d)/g, (_all, h: string, m: string) => {
    times.push({ h: Number(h), m: Number(m) });
    return ' ';
  });
  if (times.length < 2 || times.length > 3) return { line, text: t, error: 'times' };
  const start = times[0].h * 60 + times[0].m;
  const end = times[1].h * 60 + times[1].m;
  if (times.some((x) => x.h > 23 || x.m > 59)) return { line, text: t, error: 'times' };
  let breakSeconds = 0;
  if (times.length === 3) breakSeconds = times[2].h * 3600 + times[2].m * 60;
  const extra = rest
    .replace(/[-–—→>]|\b(?:to|a|alle|dalle|fino|pausa|break|pranzo|lunch|p)\b/gi, ' ')
    .replace(/[:]/g, ' ')
    .trim();
  if (extra !== '') {
    if (times.length === 3) return { line, text: t, error: 'break' };
    const b = parseDuration(extra, 'm');
    if (b === null) return { line, text: t, error: 'break' };
    breakSeconds = b;
  }
  const crossesMidnight = end < start;
  const span = ((crossesMidnight ? end + 1440 : end) - start) * 60;
  if (breakSeconds > span) return { line, text: t, error: 'breakTooLong' };
  return { line, text: t, day, start, end, crossesMidnight, breakSeconds, worked: span - breakSeconds };
}

export type OvertimeScope = 'day' | 'week';

export interface SheetResult {
  rows: SheetRow[];
  errors: SheetBad[];
  /** Totale per giorno (solo righe con il giorno indicato), nell'ordine della settimana. */
  days: { day: number; seconds: number }[];
  total: number;
  overtime: number;
  regular: number;
}

/** Foglio ore completo. La soglia dello straordinario è per giorno o per settimana; `threshold` null = nessuno. */
export function computeSheet(text: string, threshold: number | null, scope: OvertimeScope): SheetResult {
  const rows: SheetRow[] = [];
  const errors: SheetBad[] = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const r = parseSheetLine(l, i + 1);
    if (!r) return;
    if ('error' in r) errors.push(r);
    else rows.push(r);
  });
  const byDay = new Map<number, number>();
  for (const r of rows) if (r.day !== null) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.worked);
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, seconds]) => ({ day, seconds }));
  const total = rows.reduce((a, r) => a + r.worked, 0);
  let overtime = 0;
  if (threshold !== null) {
    if (scope === 'week') overtime = Math.max(0, total - threshold);
    else {
      // ogni giorno indicato è un gruppo; le righe senza giorno contano ognuna per sé
      const groups = [...byDay.values(), ...rows.filter((r) => r.day === null).map((r) => r.worked)];
      overtime = groups.reduce((a, g) => a + Math.max(0, g - threshold), 0);
    }
  }
  return { rows, errors, days, total, overtime, regular: total - overtime };
}

// ---------- importo ----------

/** Tariffa "12,50" (fino a 4 decimali) → 1/10000 di euro; null se non valida o negativa. */
export function parseRate(input: string): bigint | null {
  const m = /^\s*(\d+)(?:[.,](\d{1,4}))?\s*$/.exec(input);
  if (!m) return null;
  return BigInt(m[1]) * 10000n + BigInt((m[2] ?? '').padEnd(4, '0') || '0');
}

/** Percentuale "25" o "12,5" (fino a 2 decimali) → centesimi di punto percentuale; null se non valida. */
export function parsePercent(input: string): bigint | null {
  const m = /^\s*(\d+)(?:[.,](\d{1,2}))?\s*%?\s*$/.exec(input);
  if (!m) return null;
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0') || '0');
}

function divRound(num: bigint, den: bigint): bigint {
  return (num * 2n + den) / (den * 2n);
}

/**
 * Importo in centesimi di euro: ore ordinarie alla tariffa e ore di straordinario con la maggiorazione
 * (`premium` in centesimi di punto percentuale). Arrotondamento al centesimo, la metà per eccesso.
 */
export function amountCents(regularSeconds: number, overtimeSeconds: number, rate: bigint, premium: bigint = 0n): bigint {
  // secondi × tariffa(1/10000 €) / 3600 / 100 = centesimi
  const reg = BigInt(Math.max(0, Math.round(regularSeconds))) * rate * 10000n;
  const ot = BigInt(Math.max(0, Math.round(overtimeSeconds))) * rate * (10000n + premium);
  return divRound(reg + ot, 3600n * 100n * 10000n);
}

/** Centesimi → "1.234,56" senza simbolo (il separatore lo sceglie chi chiama). */
export function formatCents(cents: bigint, decimal: string, group: string): string {
  const neg = cents < 0n;
  const a = neg ? -cents : cents;
  const int = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${neg ? '-' : ''}${int}${decimal}${(a % 100n).toString().padStart(2, '0')}`;
}
