// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: modo, i due testi e le opzioni. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['yaml', 'csv'] },
  a: { type: 'string', max: 100000 },
  b: { type: 'string', max: 100000 },
  arrayMode: { type: 'enum', values: ['index', 'set', 'key'] },
  key: { type: 'string', max: 100 },
  keyCols: { type: 'string', max: 200 },
  trim: { type: 'boolean' },
  ignoreCase: { type: 'boolean' },
};
