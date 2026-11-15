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
];
