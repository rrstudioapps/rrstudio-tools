// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Aggregation, CategoryPoint, Granularity, PeriodPoint } from './models';

const DAY_MS = 86400000;

/** Giorno se l'intervallo è < 60 giorni, altrimenti mese. */
export function chooseGranularity(min: Date, max: Date): Granularity {
  return (max.getTime() - min.getTime()) / DAY_MS < 60 ? 'day' : 'month';
}

const pad = (n: number) => String(n).padStart(2, '0');

export function periodKey(d: Date, g: Granularity): string {
  const base = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  return g === 'month' ? base : `${base}-${pad(d.getUTCDate())}`;
}

/** Chiave successiva (serve a riempire i periodi senza dati). */
function nextKey(key: string, g: Granularity): string {
  const [y, m, d] = key.split('-').map(Number);
  const next =
    g === 'month' ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, (d ?? 1) + 1));
  return periodKey(next, g);
}

function finalize(sum: number, count: number, agg: Aggregation): number {
  if (agg === 'count') return count;
  if (agg === 'avg') return count ? sum / count : 0;
  return sum;
}

/**
 * Aggrega per periodo (giorno o mese). `values[i]` può essere null: per somma/media la riga
 * viene ignorata, per il conteggio conta comunque. I periodi senza righe valgono 0.
 */
export function aggregateByPeriod(
  dates: readonly (Date | null)[],
  values: readonly (number | null)[],
  agg: Aggregation,
  forced?: Granularity,
): { granularity: Granularity; points: PeriodPoint[] } {
  let min = Infinity;
  let max = -Infinity;
  for (const d of dates) {
    if (!d) continue;
    const t = d.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!Number.isFinite(min)) return { granularity: forced ?? 'month', points: [] };
  const g = forced ?? chooseGranularity(new Date(min), new Date(max));
  const acc = new Map<string, { sum: number; count: number }>();
  dates.forEach((d, i) => {
    if (!d) return;
    const v = values[i];
    if (agg !== 'count' && v == null) return;
    const k = periodKey(d, g);
    const e = acc.get(k) ?? { sum: 0, count: 0 };
    e.sum += v ?? 0;
    e.count += 1;
    acc.set(k, e);
  });
  const first = periodKey(new Date(min), g);
  const last = periodKey(new Date(max), g);
  const points: PeriodPoint[] = [];
  let key = first;
  for (let i = 0; i < 20000; i++) {
    const e = acc.get(key);
    points.push({ key, value: e ? finalize(e.sum, e.count, agg) : 0 });
    if (key >= last) break;
    key = nextKey(key, g);
  }
  return { granularity: g, points };
}

/** Aggrega per categoria: prime `topN` (per valore) e il resto in `otherLabel`. */
export function aggregateByCategory(
  cats: readonly string[],
  values: readonly (number | null)[],
  agg: Aggregation,
  otherLabel: string,
  topN = 12,
): CategoryPoint[] {
  const acc = new Map<string, { sum: number; count: number }>();
  cats.forEach((c, i) => {
    const name = (c ?? '').trim();
    if (!name) return;
    const v = values[i];
    if (agg !== 'count' && v == null) return;
    const e = acc.get(name) ?? { sum: 0, count: 0 };
    e.sum += v ?? 0;
    e.count += 1;
    acc.set(name, e);
  });
  const sorted = [...acc.entries()]
    .map(([name, e]) => ({ name, e, value: finalize(e.sum, e.count, agg) }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= topN) return sorted.map(({ name, value }) => ({ name, value }));
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const sum = rest.reduce((s, r) => s + r.e.sum, 0);
  const count = rest.reduce((s, r) => s + r.e.count, 0);
  return [
    ...top.map(({ name, value }) => ({ name, value })),
    { name: otherLabel, value: finalize(sum, count, agg) },
  ];
}

export interface Kpis {
  total: number;
  average: number;
  count: number;
}

export function computeKpis(values: readonly (number | null)[], rowCount: number): Kpis {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v == null) continue;
    sum += v;
    n++;
  }
  return { total: sum, average: n ? sum / n : 0, count: rowCount };
}

/** Variazione % dell'ultimo periodo rispetto al precedente (null se non calcolabile). */
export function periodChange(points: readonly PeriodPoint[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  if (prev === 0) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
}
