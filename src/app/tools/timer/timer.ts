// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Logica pura di timer, cronometro e pomodoro: il tempo arriva da fuori (`now`, in ms), così si testa senza orologio. */

/** Durata massima accettata: 99 ore. */
export const MAX_MS = 99 * 3_600_000;

const UNITS: Record<string, number> = {
  h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, ora: 3_600_000, ore: 3_600_000,
  m: 60_000, min: 60_000, mins: 60_000, minuto: 60_000, minuti: 60_000, minute: 60_000, minutes: 60_000,
  s: 1000, sec: 1000, secs: 1000, secondo: 1000, secondi: 1000, second: 1000, seconds: 1000,
};

/**
 * Legge una durata scritta a mano e la restituisce in millisecondi (null se non valida o fuori da 1 s..99 h).
 * Accetta `1:30` (min:sec), `1:02:03` (ore:min:sec), `1h 30m`, `90s`, `1,5h`, `2 ore 15 min`.
 * Un numero senza unità vale minuti (`25` = 25 minuti).
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/,/g, '.');
  if (s === '') return null;
  let ms: number;
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    const p = s.split(':').map(Number);
    if (p.slice(1).some((x) => x > 59)) return null;
    ms = p.length === 2 ? p[0] * 60_000 + p[1] * 1000 : p[0] * 3_600_000 + p[1] * 60_000 + p[2] * 1000;
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    ms = Number(s) * 60_000;
  } else {
    const re = /(\d+(?:\.\d+)?)\s*([a-zà-ù]+)/g;
    let used = 0;
    ms = 0;
    for (const m of s.matchAll(re)) {
      const unit = UNITS[m[2]];
      if (!unit) return null;
      ms += Number(m[1]) * unit;
      used += m[0].length;
    }
    if (used === 0 || s.replace(/\s+/g, '').length !== [...s.matchAll(re)].reduce((n, m) => n + m[0].replace(/\s+/g, '').length, 0)) return null;
  }
  ms = Math.round(ms / 1000) * 1000;
  return ms >= 1000 && ms <= MAX_MS ? ms : null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `HH:MM:SS` (le ore compaiono solo se servono, o con `alwaysHours`); con `centis` aggiunge `.cc`. Il conto alla rovescia arrotonda per eccesso. */
export function formatClock(ms: number, opts: { centis?: boolean; up?: boolean; alwaysHours?: boolean } = {}): string {
  const safe = Math.max(0, ms);
  const base = opts.centis || opts.up ? Math.floor(safe / 10) * 10 : Math.ceil(safe / 1000) * 1000;
  const total = Math.floor(base / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const head = h > 0 || opts.alwaysHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return opts.centis ? `${head}.${pad(Math.floor((base % 1000) / 10))}` : head;
}

// --- conto alla rovescia (anche per le fasi del pomodoro) ---------------------------------------------------------

export interface Down {
  /** Durata totale della fase, ms. */
  total: number;
  running: boolean;
  /** Istante di fine (solo se in corso). */
  endAt: number;
  /** Tempo residuo quando è fermo. */
  left: number;
}

export const newDown = (total: number): Down => ({ total, running: false, endAt: 0, left: total });
export const remaining = (d: Down, now: number): number => (d.running ? Math.max(0, d.endAt - now) : d.left);
export const startDown = (d: Down, now: number): Down => (d.running || d.left <= 0 ? d : { ...d, running: true, endAt: now + d.left });
export const pauseDown = (d: Down, now: number): Down => (d.running ? { ...d, running: false, endAt: 0, left: remaining(d, now) } : d);
export const resetDown = (d: Down): Down => newDown(d.total);

// --- cronometro ---------------------------------------------------------------------------------------------------

export interface Up {
  running: boolean;
  startAt: number;
  /** Tempo accumulato fino all'ultima pausa. */
  elapsed: number;
}

export const newUp = (): Up => ({ running: false, startAt: 0, elapsed: 0 });
export const elapsed = (u: Up, now: number): number => (u.running ? u.elapsed + Math.max(0, now - u.startAt) : u.elapsed);
export const startUp = (u: Up, now: number): Up => (u.running ? u : { ...u, running: true, startAt: now });
export const pauseUp = (u: Up, now: number): Up => (u.running ? { running: false, startAt: 0, elapsed: elapsed(u, now) } : u);

export interface Lap {
  /** Numero del giro, da 1. */
  n: number;
  /** Durata del giro. */
  split: number;
  /** Tempo totale al passaggio. */
  total: number;
}

/** Aggiunge un giro con il tempo totale `total`; la durata è la differenza dal giro precedente. */
export function addLap(laps: readonly Lap[], total: number): Lap[] {
  const prev = laps.length ? laps[laps.length - 1].total : 0;
  return [...laps, { n: laps.length + 1, split: Math.max(0, total - prev), total }];
}

/** Giro più veloce e più lento (indici in `laps`); servono almeno due giri. */
export function lapExtremes(laps: readonly Lap[]): { best: number; worst: number } | null {
  if (laps.length < 2) return null;
  let best = 0;
  let worst = 0;
  laps.forEach((l, i) => {
    if (l.split < laps[best].split) best = i;
    if (l.split > laps[worst].split) worst = i;
  });
  return best === worst ? null : { best, worst };
}

// --- pomodoro -----------------------------------------------------------------------------------------------------

export interface PomodoroConfig {
  /** Minuti di lavoro, pausa breve, pausa lunga; quanti pomodori prima della pausa lunga. */
  work: number;
  short: number;
  long: number;
  cycles: number;
}

export const DEFAULT_POMODORO: PomodoroConfig = { work: 25, short: 5, long: 15, cycles: 4 };

export type PomodoroKind = 'work' | 'short' | 'long';

/** Fase numero `i` (da 0): lavoro nelle posizioni pari, pausa in quelle dispari; ogni `cycles` pomodori la pausa è lunga. */
export function pomodoroPhase(i: number, cfg: PomodoroConfig): { kind: PomodoroKind; ms: number; pomodoro: number } {
  const pomodoro = Math.floor(i / 2) + 1;
  if (i % 2 === 0) return { kind: 'work', ms: cfg.work * 60_000, pomodoro };
  return pomodoro % cfg.cycles === 0
    ? { kind: 'long', ms: cfg.long * 60_000, pomodoro }
    : { kind: 'short', ms: cfg.short * 60_000, pomodoro };
}
