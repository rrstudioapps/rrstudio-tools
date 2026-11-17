// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'number', min: 0, max: 4095, int: true },
  path: { type: 'string', max: 300 },
  recursive: { type: 'boolean' },
  expr: { type: 'string', max: 200 },
  exprDir: { type: 'boolean' },
};
