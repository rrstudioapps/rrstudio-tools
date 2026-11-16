// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import type { IconName } from '../shared/icon';
import type { DictKey } from '../core/i18n/it';

/**
 * Descrizione di un tool. Per aggiungerne uno: nuova cartella in tools/ + una voce qui.
 * Titolo/descrizione e dati SEO sono chiavi del dizionario principale (core/i18n).
 */
export interface ToolDefinition {
  id: string;
  /** Percorso della route (senza slash iniziale). */
  path: string;
  icon: IconName;
  titleKey: DictKey;
  descriptionKey: DictKey;
  seo: { titleKey: DictKey; descriptionKey: DictKey };
  /** Caricamento lazy: o un singolo componente o un file di route. */
  loadComponent?: () => Promise<Type<unknown>>;
  loadChildren?: () => Promise<Routes>;
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'csv-dashboard',
    path: 'csv-dashboard',
    icon: 'chart',
    titleKey: 'tool.csv.title',
    descriptionKey: 'tool.csv.desc',
    seo: { titleKey: 'seo.csv.title', descriptionKey: 'seo.csv.desc' },
    loadChildren: () =>
      import('./csv-dashboard/csv-dashboard.routes').then((m) => m.CSV_DASHBOARD_ROUTES),
  },
  {
    id: 'base64',
    path: 'base64',
    icon: 'code',
    titleKey: 'tool.base64.title',
    descriptionKey: 'tool.base64.desc',
    seo: { titleKey: 'seo.base64.title', descriptionKey: 'seo.base64.desc' },
    loadComponent: () => import('./base64/base64.page').then((m) => m.Base64Page),
  },
  {
    id: 'url-encode',
    path: 'url-encode',
    icon: 'link',
    titleKey: 'tool.url.title',
    descriptionKey: 'tool.url.desc',
    seo: { titleKey: 'seo.url.title', descriptionKey: 'seo.url.desc' },
    loadComponent: () => import('./url-encode/url-encode.page').then((m) => m.UrlEncodePage),
  },
  {
    id: 'json-formatter',
    path: 'json-formatter',
    icon: 'braces',
    titleKey: 'tool.json.title',
    descriptionKey: 'tool.json.desc',
    seo: { titleKey: 'seo.json.title', descriptionKey: 'seo.json.desc' },
    loadComponent: () => import('./json-formatter/json-formatter.page').then((m) => m.JsonFormatterPage),
  },
  {
    id: 'image-compressor',
    path: 'image-compressor',
    icon: 'image',
    titleKey: 'tool.ic.title',
    descriptionKey: 'tool.ic.desc',
    seo: { titleKey: 'seo.ic.title', descriptionKey: 'seo.ic.desc' },
    loadComponent: () =>
      import('./image-compressor/image-compressor.page').then((m) => m.ImageCompressorPage),
  },
  {
    id: 'pdf-tools',
    path: 'pdf-tools',
    icon: 'layers',
    titleKey: 'tool.pdf.title',
    descriptionKey: 'tool.pdf.desc',
    seo: { titleKey: 'seo.pdf.title', descriptionKey: 'seo.pdf.desc' },
    loadComponent: () => import('./pdf-tools/pdf-tools.page').then((m) => m.PdfToolsPage),
  },
  {
    id: 'password-generator',
    path: 'password-generator',
    icon: 'lock',
    titleKey: 'tool.pw.title',
    descriptionKey: 'tool.pw.desc',
    seo: { titleKey: 'seo.pw.title', descriptionKey: 'seo.pw.desc' },
    loadComponent: () =>
      import('./password-generator/password-generator.page').then((m) => m.PasswordGeneratorPage),
  },
  {
    id: 'hash-generator',
    path: 'hash-generator',
    icon: 'hash',
    titleKey: 'tool.hash.title',
    descriptionKey: 'tool.hash.desc',
    seo: { titleKey: 'seo.hash.title', descriptionKey: 'seo.hash.desc' },
    loadComponent: () => import('./hash-generator/hash-generator.page').then((m) => m.HashGeneratorPage),
  },
  {
    id: 'codice-fiscale',
    path: 'codice-fiscale',
    icon: 'idcard',
    titleKey: 'tool.cf.title',
    descriptionKey: 'tool.cf.desc',
    seo: { titleKey: 'seo.cf.title', descriptionKey: 'seo.cf.desc' },
    loadComponent: () => import('./codice-fiscale/codice-fiscale.page').then((m) => m.CodiceFiscalePage),
  },
  {
    id: 'iban-partita-iva',
    path: 'iban-partita-iva',
    icon: 'bank',
    titleKey: 'tool.iban.title',
    descriptionKey: 'tool.iban.desc',
    seo: { titleKey: 'seo.iban.title', descriptionKey: 'seo.iban.desc' },
    loadComponent: () => import('./iban-partita-iva/iban-partita-iva.page').then((m) => m.IbanPartitaIvaPage),
  },
];
