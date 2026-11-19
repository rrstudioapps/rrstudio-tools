// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Impostazioni nel link di condivisione (mai i risultati: sono casuali, chi apre il link ne genera di nuovi). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['number', 'dice', 'list', 'coin'] },
  min: { type: 'string', max: 20 },
  max: { type: 'string', max: 20 },
  count: { type: 'string', max: 5 },
  decimals: { type: 'number', min: 0, max: 6, int: true },
  unique: { type: 'boolean' },
  sorted: { type: 'boolean' },
  dice: { type: 'string', max: 20 },
  list: { type: 'string', max: 4000 },
  action: { type: 'enum', values: ['pick', 'teams'] },
  pick: { type: 'string', max: 5 },
  pickUnique: { type: 'boolean' },
  teams: { type: 'string', max: 3 },
  flips: { type: 'string', max: 5 },
};
