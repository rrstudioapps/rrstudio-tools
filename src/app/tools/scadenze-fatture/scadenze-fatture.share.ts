// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento nel link: data, termini, modalità, opzioni, importo e riferimento. */
export const SHARE_SCHEMA: Schema = {
  date: { type: 'string', max: 10 },
  terms: { type: 'string', max: 120 },
  base: { type: 'enum', values: ['invoice', 'dffm', 'fm'] },
  extra: { type: 'string', max: 3 },
  shift: { type: 'boolean' },
  satWork: { type: 'boolean' },
  total: { type: 'string', max: 20 },
  reference: { type: 'string', max: 60 },
};
