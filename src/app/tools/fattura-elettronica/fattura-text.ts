// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { TIPO_DOCUMENTO, describeCode } from './fattura-codes';
import { Fattura, Party, addressLines, formatDate, formatMoney, groupIban, partyName, totals } from './fattura-parser';

type T = (key: string, params?: Record<string, string | number>) => string;

function partyLines(label: string, p: Party): string[] {
  const ids = [
    p.partitaIva ? `${p.idPaese}${p.partitaIva}` : '',
    p.codiceFiscale && p.codiceFiscale !== p.partitaIva ? p.codiceFiscale : '',
  ].filter(Boolean);
  return [`${label}: ${[partyName(p), ...ids, ...addressLines(p.sede)].filter(Boolean).join(' · ')}`];
}

/** Testo con i dati principali del corpo `index` della fattura, da copiare negli appunti. */
export function summaryText(f: Fattura, index: number, t: T, lang: 'it' | 'en', locale: string): string {
  const b = f.bodies[index];
  const tot = totals(b);
  const money = (v: number | string) => formatMoney(v, b.divisa, locale);
  const td = describeCode(TIPO_DOCUMENTO, b.tipoDocumento, lang);
  const lines = [
    `${td || b.tipoDocumento} ${t('fe.number')} ${b.numero} · ${formatDate(b.data, locale)}`,
    ...partyLines(t('fe.supplier'), f.header.cedente),
    ...partyLines(t('fe.customer'), f.header.cessionario),
    `${t('fe.taxable')}: ${money(tot.imponibile)}`,
    `${t('fe.vat')}: ${money(tot.imposta)}`,
    `${t('fe.total')}: ${money(tot.totale)}`,
  ];
  const dueDates = b.pagamenti.flatMap((p) => p.dettagli).filter((d) => d.dataScadenza);
  for (const d of dueDates) {
    lines.push(`${t('fe.dueDate')}: ${formatDate(d.dataScadenza, locale)}${d.importo ? ' · ' + money(d.importo) : ''}`);
  }
  const iban = b.pagamenti.flatMap((p) => p.dettagli).find((d) => d.iban)?.iban;
  if (iban) lines.push(`IBAN: ${groupIban(iban)}`);
  return lines.join('\n');
}
