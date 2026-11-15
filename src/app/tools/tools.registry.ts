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
];
