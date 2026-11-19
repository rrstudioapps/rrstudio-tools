// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Granularity } from './models';

/** Formatta un numero secondo la lingua: niente decimali sopra 1000, due altrimenti. */
export function formatNumber(value: number, locale: string): string {
  const abs = Math.abs(value);
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: abs >= 1000 || Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value)}%`;
}

/** Etichetta leggibile di una chiave periodo (yyyy-mm oppure yyyy-mm-dd). */
export function formatPeriod(key: string, g: Granularity, locale: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, g === 'day' ? d : 1));
  return new Intl.DateTimeFormat(
    locale,
    g === 'day'
      ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { month: 'short', year: '2-digit', timeZone: 'UTC' },
  ).format(date);
}

/** Escape dei caratteri HTML (i dati utente non vanno mai inseriti grezzi nell'HTML esportato). */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
