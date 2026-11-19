// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { parseDecimal } from '../../shared/decimal';

type Lang = 'it' | 'en';

export const KM_PER_MILE = 1.609344;
export const L_PER_GAL_UK = 4.54609;
export const L_PER_GAL_US = 3.785411784;
/** Emissioni di CO2 per litro di carburante bruciato (kg/l): stime medie, non misure. */
export const CO2_KG_PER_L = { petrol: 2.31, diesel: 2.68, lpg: 1.51 } as const;

export type DistUnit = 'km' | 'mi';
/** Unità del consumo di un veicolo a combustibile. */
export type ConsUnit = 'l100' | 'kml' | 'mpgUk' | 'mpgUs';
/** Unità di volume (prezzo al litro o al gallone). */
export type VolUnit = 'l' | 'galUk' | 'galUs';
export type Fuel = 'petrol' | 'diesel' | 'lpg' | 'electric';

export const CONS_UNITS: readonly ConsUnit[] = ['l100', 'kml', 'mpgUk', 'mpgUs'];
export const DIST_UNITS: readonly DistUnit[] = ['km', 'mi'];
export const VOL_UNITS: readonly VolUnit[] = ['l', 'galUk', 'galUs'];
export const FUELS: readonly Fuel[] = ['petrol', 'diesel', 'lpg', 'electric'];

/** Limiti per non produrre numeri senza senso (e mai Infinity). */
export const MAX_DISTANCE = 1_000_000;
export const MAX_CONSUMPTION = 1_000_000;
export const MAX_PRICE = 10_000;
export const MAX_PEOPLE = 100;
export const MAX_FIXED_CENTS = 100_000_000_000;
const MAX_RESULT_CENTS = 1e13;

// --- conversioni ---

export function kmFrom(value: number, unit: DistUnit): number {
  return unit === 'km' ? value : value * KM_PER_MILE;
}
export function kmTo(km: number, unit: DistUnit): number {
  return unit === 'km' ? km : km / KM_PER_MILE;
}
export function litersPer(vol: VolUnit): number {
  return vol === 'l' ? 1 : vol === 'galUk' ? L_PER_GAL_UK : L_PER_GAL_US;
}
/** Unità di volume in cui è espresso il prezzo per una data unità di consumo. */
export function volumeOf(unit: ConsUnit): VolUnit {
  return unit === 'mpgUk' ? 'galUk' : unit === 'mpgUs' ? 'galUs' : 'l';
}

/** Costante K tale che consumo in unità = K / (l/100 km); null per l/100 km (identità). */
function constant(unit: ConsUnit): number | null {
  switch (unit) {
    case 'l100': return null;
    case 'kml': return 100;
    case 'mpgUk': return (100 * L_PER_GAL_UK) / KM_PER_MILE;
    case 'mpgUs': return (100 * L_PER_GAL_US) / KM_PER_MILE;
  }
}
/** Consumo nell'unità data → litri per 100 km (Infinity se il valore è 0 in km/l o mpg: va escluso a monte). */
export function toL100(value: number, unit: ConsUnit): number {
  const k = constant(unit);
  return k === null ? value : k / value;
}
export function fromL100(l100: number, unit: ConsUnit): number {
  const k = constant(unit);
  return k === null ? l100 : k / l100;
}
export function convertConsumption(value: number, from: ConsUnit, to: ConsUnit): number {
  return from === to ? value : fromL100(toL100(value, from), to);
}
/** Prezzo per unità di volume → prezzo al litro. */
export function pricePerLiter(price: number, vol: VolUnit): number {
  return price / litersPer(vol);
}
export function convertPrice(price: number, from: VolUnit, to: VolUnit): number {
  return from === to ? price : (price / litersPer(from)) * litersPer(to);
}

// --- lettura dei numeri digitati ---

export type FieldError = 'empty' | 'nan' | 'negative' | 'zero' | 'big';
export type Parsed = { ok: true; value: number } | { ok: false; error: FieldError };

/** Numero digitato → valore, con il motivo dell'errore. `allowZero` per i campi dove 0 ha senso; `max` limite incluso. */
export function parseField(text: string, lang: Lang, opts: { allowZero: boolean; max: number }): Parsed {
  if (text.trim() === '') return { ok: false, error: 'empty' };
  const n = parseDecimal(text, lang);
  if (n === null) return { ok: false, error: 'nan' };
  if (n < 0) return { ok: false, error: 'negative' };
  if (n === 0 && !opts.allowZero) return { ok: false, error: 'zero' };
  if (n > opts.max) return { ok: false, error: 'big' };
  return { ok: true, value: n };
}

/** Euro digitati → centesimi interi (arrotondati); i decimali oltre il secondo non producono errori di virgola mobile. */
export function toCents(euro: number): number {
  return Math.round(Number((euro * 100).toPrecision(12)));
}

// --- costo del viaggio ---

export interface TripInput {
  distanceKm: number;
  roundTrip: boolean;
  fuel: Fuel;
  /** Consumo in l/100 km (o kWh/100 km per l'elettrico). */
  per100: number;
  /** Prezzo al litro (o al kWh). */
  unitPrice: number;
  fixedCents: number;
  people: number;
}
export interface TripResult {
  distanceKm: number;
  /** Litri (o kWh) necessari. */
  energy: number;
  fuelCents: number;
  fixedCents: number;
  totalCents: number;
  perPersonCents: number;
  /** Euro per km sul totale (non arrotondato). */
  perKm: number;
  /** kg di CO2 stimati; null per i veicoli elettrici. */
  co2Kg: number | null;
}
export type CalcError = 'invalid' | 'overflow';

function pos(n: number, allowZero = false): boolean {
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
}

export function tripCost(i: TripInput): ({ ok: true } & TripResult) | { ok: false; error: CalcError } {
  if (!pos(i.distanceKm) || !pos(i.per100) || !pos(i.unitPrice, true) || !pos(i.fixedCents, true)) return { ok: false, error: 'invalid' };
  if (!Number.isInteger(i.people) || i.people < 1) return { ok: false, error: 'invalid' };
  const distanceKm = i.roundTrip ? i.distanceKm * 2 : i.distanceKm;
  const energy = (distanceKm * i.per100) / 100;
  const fuelCents = toCents(energy * i.unitPrice);
  const totalCents = fuelCents + i.fixedCents;
  if (!Number.isFinite(totalCents) || totalCents > MAX_RESULT_CENTS) return { ok: false, error: 'overflow' };
  return {
    ok: true,
    distanceKm,
    energy,
    fuelCents,
    fixedCents: i.fixedCents,
    totalCents,
    perPersonCents: Math.round(totalCents / i.people),
    perKm: totalCents / 100 / distanceKm,
    co2Kg: i.fuel === 'electric' ? null : energy * CO2_KG_PER_L[i.fuel],
  };
}

// --- consumo medio ---

export interface AverageResult {
  l100: number;
  kml: number;
  mpgUk: number;
  mpgUs: number;
  /** Euro per km; null senza la spesa. */
  costPerKm: number | null;
  costPer100Km: number | null;
}

export function averageConsumption(km: number, liters: number, spendCents: number | null): ({ ok: true } & AverageResult) | { ok: false; error: CalcError } {
  if (!pos(km) || !pos(liters) || (spendCents !== null && !pos(spendCents, true))) return { ok: false, error: 'invalid' };
  const l100 = (liters / km) * 100;
  if (!Number.isFinite(l100) || l100 <= 0) return { ok: false, error: 'overflow' };
  const costPerKm = spendCents === null ? null : spendCents / 100 / km;
  return {
    ok: true,
    l100,
    kml: fromL100(l100, 'kml'),
    mpgUk: fromL100(l100, 'mpgUk'),
    mpgUs: fromL100(l100, 'mpgUs'),
    costPerKm,
    costPer100Km: costPerKm === null ? null : costPerKm * 100,
  };
}

// --- quanto posso fare ---

export interface RangeResult {
  km: number;
  /** Litri (o kWh) usati. */
  energy: number;
  costCents: number | null;
}

/** Con un budget (centesimi) serve il prezzo > 0; con il serbatoio (litri o kWh) il prezzo è facoltativo (null). */
export function rangeFor(by: 'budget' | 'tank', amount: number, per100: number, unitPrice: number | null): ({ ok: true } & RangeResult) | { ok: false; error: CalcError } {
  if (!pos(amount) || !pos(per100)) return { ok: false, error: 'invalid' };
  let energy: number;
  if (by === 'budget') {
    if (unitPrice === null || !pos(unitPrice)) return { ok: false, error: 'invalid' };
    energy = amount / 100 / unitPrice;
  } else {
    energy = amount;
  }
  const km = (energy / per100) * 100;
  if (!Number.isFinite(km) || km > 1e12) return { ok: false, error: 'overflow' };
  const costCents = by === 'budget' ? Math.round(amount) : unitPrice !== null && pos(unitPrice, true) ? toCents(energy * unitPrice) : null;
  return { ok: true, km, energy, costCents };
}
