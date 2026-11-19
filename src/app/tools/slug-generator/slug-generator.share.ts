// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['single', 'bulk'] },
  separator: { type: 'enum', values: ['-', '_', '.'] },
  lowercase: { type: 'boolean' },
  maxLength: { type: 'number', min: 0, max: 200, int: true },
  stopWords: { type: 'enum', values: ['none', 'it', 'en', 'both'] },
  unique: { type: 'boolean' },
  input: { type: 'string', max: 100000 },
};
