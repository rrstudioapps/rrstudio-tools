// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  source: { type: 'enum', values: ['list', 'csv'] },
  input: { type: 'string', max: 20000 },
  column: { type: 'number', min: 1, max: 200, int: true },
  header: { type: 'boolean' },
  percentile: { type: 'number', min: 0, max: 100 },
  bins: { type: 'number', min: 0, max: 60, int: true },
};
