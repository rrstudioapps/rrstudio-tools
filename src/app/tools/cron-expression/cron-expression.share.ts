// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  expression: { type: 'string', max: 500 },
  count: { type: 'number', min: 1, max: 100, int: true },
  tz: { type: 'enum', values: ['local', 'utc'] },
  descLang: { type: 'enum', values: ['it', 'en'] },
};
