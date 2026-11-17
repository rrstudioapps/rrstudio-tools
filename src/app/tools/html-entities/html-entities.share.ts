// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['html', 'js', 'json', 'url'] },
  dir: { type: 'enum', values: ['encode', 'decode'] },
  scope: { type: 'enum', values: ['basic', 'nonAscii', 'all'] },
  format: { type: 'enum', values: ['named', 'decimal', 'hex'] },
  quote: { type: 'enum', values: ['double', 'single', 'backtick', 'none'] },
  asciiOnly: { type: 'boolean' },
  jsonQuotes: { type: 'boolean' },
  plus: { type: 'boolean' },
  input: { type: 'string', max: 100000 },
};
