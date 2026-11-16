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
export type ToolCategoryId = 'data' | 'dev' | 'security' | 'italy';

/** Categoria mostrata in home. L'ordine dell'array CATEGORIES è quello delle sezioni. */
export interface ToolCategory {
  id: ToolCategoryId;
  /** Parte dell'URL (?categoria=slug o #slug) e id dell'ancora della sezione. */
  slug: string;
  titleKey: DictKey;
  descriptionKey: DictKey;
}

export const CATEGORIES: readonly ToolCategory[] = [
  { id: 'data', slug: 'dati', titleKey: 'cat.data.title', descriptionKey: 'cat.data.desc' },
  { id: 'dev', slug: 'sviluppatori', titleKey: 'cat.dev.title', descriptionKey: 'cat.dev.desc' },
  { id: 'security', slug: 'sicurezza', titleKey: 'cat.security.title', descriptionKey: 'cat.security.desc' },
  { id: 'italy', slug: 'italia', titleKey: 'cat.italy.title', descriptionKey: 'cat.italy.desc' },
];

export interface ToolDefinition {
  id: string;
  /** Percorso della route (senza slash iniziale). */
  path: string;
  icon: IconName;
  /** Un tool sta in una sola categoria. */
  category: ToolCategoryId;
  /** Parole chiave extra per la ricerca in home (non mostrate). */
  keywords?: { it: string; en: string };
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
    category: 'data',
    keywords: { it: 'csv dashboard excel xlsx grafici kpi tabella charts spreadsheet', en: 'csv dashboard excel xlsx charts kpi table spreadsheet' },
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
    category: 'dev',
    keywords: { it: 'base64 codifica decodifica data url immagine utf-8', en: 'base64 encode decode data url image utf-8' },
    titleKey: 'tool.base64.title',
    descriptionKey: 'tool.base64.desc',
    seo: { titleKey: 'seo.base64.title', descriptionKey: 'seo.base64.desc' },
    loadComponent: () => import('./base64/base64.page').then((m) => m.Base64Page),
  },
  {
    id: 'url-encode',
    path: 'url-encode',
    icon: 'link',
    category: 'dev',
    keywords: { it: 'url percent encoding querystring parametri codifica decodifica', en: 'url percent encoding query string parameters encode decode' },
    titleKey: 'tool.url.title',
    descriptionKey: 'tool.url.desc',
    seo: { titleKey: 'seo.url.title', descriptionKey: 'seo.url.desc' },
    loadComponent: () => import('./url-encode/url-encode.page').then((m) => m.UrlEncodePage),
  },
  {
    id: 'json-formatter',
    path: 'json-formatter',
    icon: 'braces',
    category: 'data',
    keywords: { it: 'json formatta minifica valida indenta ordina chiavi errori riga colonna', en: 'json format minify validate indent sort keys lint beautify' },
    titleKey: 'tool.json.title',
    descriptionKey: 'tool.json.desc',
    seo: { titleKey: 'seo.json.title', descriptionKey: 'seo.json.desc' },
    loadComponent: () => import('./json-formatter/json-formatter.page').then((m) => m.JsonFormatterPage),
  },
  {
    id: 'json-viewer',
    path: 'json-viewer',
    icon: 'tree',
    category: 'data',
    keywords: {
      it: 'json viewer editor albero visualizza modifica percorso jsonpath pointer cerca nodi',
      en: 'json viewer editor tree view edit path jsonpath pointer search nodes',
    },
    titleKey: 'tool.jv.title',
    descriptionKey: 'tool.jv.desc',
    seo: { titleKey: 'seo.jv.title', descriptionKey: 'seo.jv.desc' },
    loadComponent: () => import('./json-viewer/json-viewer.page').then((m) => m.JsonViewerPage),
  },
  {
    id: 'image-compressor',
    path: 'image-compressor',
    icon: 'image',
    category: 'data',
    keywords: { it: 'immagini foto comprimi converti webp avif jpeg png ridimensiona zip', en: 'images photos compress convert webp avif jpeg png resize zip' },
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
    category: 'data',
    keywords: { it: 'pdf unisci dividi ruota pagine estrai riordina merge split', en: 'pdf merge split rotate pages extract reorder' },
    titleKey: 'tool.pdf.title',
    descriptionKey: 'tool.pdf.desc',
    seo: { titleKey: 'seo.pdf.title', descriptionKey: 'seo.pdf.desc' },
    loadComponent: () => import('./pdf-tools/pdf-tools.page').then((m) => m.PdfToolsPage),
  },
  {
    id: 'password-generator',
    path: 'password-generator',
    icon: 'lock',
    category: 'security',
    keywords: { it: 'password passphrase generatore casuale entropia sicura', en: 'password passphrase generator random entropy secure' },
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
    category: 'dev',
    keywords: { it: 'hash checksum sha256 sha1 sha512 md5 file integrita', en: 'hash checksum sha256 sha1 sha512 md5 file integrity' },
    titleKey: 'tool.hash.title',
    descriptionKey: 'tool.hash.desc',
    seo: { titleKey: 'seo.hash.title', descriptionKey: 'seo.hash.desc' },
    loadComponent: () => import('./hash-generator/hash-generator.page').then((m) => m.HashGeneratorPage),
  },
  {
    id: 'codice-fiscale',
    path: 'codice-fiscale',
    icon: 'idcard',
    category: 'italy',
    keywords: { it: 'codice fiscale cf omocodia calcolo verifica comune nascita', en: 'italian tax code codice fiscale cf calculate check birth place' },
    titleKey: 'tool.cf.title',
    descriptionKey: 'tool.cf.desc',
    seo: { titleKey: 'seo.cf.title', descriptionKey: 'seo.cf.desc' },
    loadComponent: () => import('./codice-fiscale/codice-fiscale.page').then((m) => m.CodiceFiscalePage),
  },
  {
    id: 'iban-partita-iva',
    path: 'iban-partita-iva',
    icon: 'bank',
    category: 'italy',
    keywords: { it: 'iban partita iva piva banca conto verifica cin abi cab', en: 'iban vat number italian partita iva bank account validate' },
    titleKey: 'tool.iban.title',
    descriptionKey: 'tool.iban.desc',
    seo: { titleKey: 'seo.iban.title', descriptionKey: 'seo.iban.desc' },
    loadComponent: () => import('./iban-partita-iva/iban-partita-iva.page').then((m) => m.IbanPartitaIvaPage),
  },
];
