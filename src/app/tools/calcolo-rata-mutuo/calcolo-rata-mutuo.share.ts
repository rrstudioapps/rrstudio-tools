// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  capitalText: { type: 'string', max: 60 },
  tanText: { type: 'string', max: 30 },
  yearsText: { type: 'string', max: 30 },
  monthsText: { type: 'string', max: 30 },
  periodicity: { type: 'enum', values: ['monthly', 'quarterly', 'semiannual'] },
};
