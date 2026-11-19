// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';
import { CATEGORIES } from './units';

/** Nomi delle unità: vengono dalla tabella delle unità (units.ts), chiave `u.<categoria>.<id>`. */
const unitNames = (lang: 'it' | 'en') =>
  Object.fromEntries(CATEGORIES.flatMap((c) => c.units.map((x) => [`u.${c.id}.${x.id}`, x[lang]])));

const it = {
  'uc.lead': 'Converti lunghezza, massa, temperatura, area, volume, velocità, tempo, dati digitali, pressione ed energia. Cerca l\'unità per nome o simbolo e vedi il valore in tutte le unità della categoria.',
  'uc.category': 'Categoria',
  'uc.cat.length': 'Lunghezza',
  'uc.cat.mass': 'Massa',
  'uc.cat.temperature': 'Temperatura',
  'uc.cat.area': 'Area',
  'uc.cat.volume': 'Volume',
  'uc.cat.speed': 'Velocità',
  'uc.cat.time': 'Tempo',
  'uc.cat.data': 'Dati digitali',
  'uc.cat.pressure': 'Pressione',
  'uc.cat.energy': 'Energia',
  'uc.value': 'Valore',
  'uc.value.ph': 'Per esempio 12,5',
  'uc.value.err': 'Scrivi un numero valido, per esempio 12,5 o 1e6.',
  'uc.from': 'Da',
  'uc.to': 'A',
  'uc.swap': 'Inverti le unità',
  'uc.result': 'Risultato',
  'uc.empty': 'Scrivi un valore per convertirlo.',
  'uc.err.belowAbsoluteZero': 'Sotto lo zero assoluto (−273,15 °C, 0 K) la temperatura non esiste.',
  'uc.search': 'Cerca un\'unità',
  'uc.search.ph': 'Per esempio miglia, kib, psi, kWh',
  'uc.search.hits': 'Unità trovate',
  'uc.search.none': 'Nessuna unità trovata.',
  'uc.search.use': 'Usa {unit}',
  'uc.table': 'Tutte le conversioni di {value} {unit}',
  'uc.table.unit': 'Unità',
  'uc.table.value': 'Valore',
  'uc.copy': 'Copia {unit}',
  'uc.note.data': 'KB, MB, GB sono potenze di 1000 (SI); KiB, MiB, GiB sono potenze di 1024 (binari).',
  'uc.note.time': 'Mese e anno sono medi (anno gregoriano di 365,2425 giorni).',
  'uc.note.volume': 'Cucchiaini, tazze, pinte e galloni US sono le misure statunitensi; il gallone UK è quello imperiale.',
  ...unitNames('it'),
};

const en: typeof it = {
  'uc.lead': 'Convert length, mass, temperature, area, volume, speed, time, digital data, pressure and energy. Search for a unit by name or symbol and see the value in every unit of the category.',
  'uc.category': 'Category',
  'uc.cat.length': 'Length',
  'uc.cat.mass': 'Mass',
  'uc.cat.temperature': 'Temperature',
  'uc.cat.area': 'Area',
  'uc.cat.volume': 'Volume',
  'uc.cat.speed': 'Speed',
  'uc.cat.time': 'Time',
  'uc.cat.data': 'Digital data',
  'uc.cat.pressure': 'Pressure',
  'uc.cat.energy': 'Energy',
  'uc.value': 'Value',
  'uc.value.ph': 'For example 12.5',
  'uc.value.err': 'Enter a valid number, for example 12.5 or 1e6.',
  'uc.from': 'From',
  'uc.to': 'To',
  'uc.swap': 'Swap units',
  'uc.result': 'Result',
  'uc.empty': 'Enter a value to convert it.',
  'uc.err.belowAbsoluteZero': 'Below absolute zero (−273.15 °C, 0 K) temperature does not exist.',
  'uc.search': 'Search for a unit',
  'uc.search.ph': 'For example miles, kib, psi, kWh',
  'uc.search.hits': 'Units found',
  'uc.search.none': 'No unit found.',
  'uc.search.use': 'Use {unit}',
  'uc.table': 'All conversions of {value} {unit}',
  'uc.table.unit': 'Unit',
  'uc.table.value': 'Value',
  'uc.copy': 'Copy {unit}',
  'uc.note.data': 'KB, MB, GB are powers of 1000 (SI); KiB, MiB, GiB are powers of 1024 (binary).',
  'uc.note.time': 'Month and year are averages (Gregorian year of 365.2425 days).',
  'uc.note.volume': 'Teaspoons, cups, pints and gallons marked US are US customary measures; the UK gallon is the imperial one.',
  ...unitNames('en'),
};

export const UC_DICTIONARIES: ToolDictionaries = { it, en };
