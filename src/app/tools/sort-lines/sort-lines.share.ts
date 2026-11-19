// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 100000 },
  mode: { type: 'enum', values: ['none', 'alpha', 'natural', 'length', 'frequency', 'random'] },
  reverse: { type: 'boolean' },
  caseSensitive: { type: 'boolean' },
  lang: { type: 'enum', values: ['it', 'en'] },
  trim: { type: 'boolean' },
  removeEmpty: { type: 'boolean' },
  dedupe: { type: 'enum', values: ['none', 'exact', 'ignoreCase'] },
  collapseSpaces: { type: 'boolean' },
  count: { type: 'boolean' },
  prefix: { type: 'string', max: 200 },
  suffix: { type: 'string', max: 200 },
  numbering: { type: 'boolean' },
  numberStart: { type: 'number', min: -1000000000, max: 1000000000, int: true },
  numberSep: { type: 'string', max: 50 },
};
