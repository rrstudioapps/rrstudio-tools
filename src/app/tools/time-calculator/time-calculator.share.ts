// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento nel link: testi brevi e parametri. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['sum', 'sheet', 'convert'] },
  sumText: { type: 'string', max: 3000 },
  bare: { type: 'enum', values: ['h', 'm'] },
  sheetText: { type: 'string', max: 3000 },
  threshold: { type: 'string', max: 12 },
  scope: { type: 'enum', values: ['day', 'week'] },
  rate: { type: 'string', max: 12 },
  premium: { type: 'string', max: 8 },
  convertIn: { type: 'string', max: 40 },
};
