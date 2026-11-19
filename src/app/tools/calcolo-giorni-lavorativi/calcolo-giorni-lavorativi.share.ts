// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['between', 'add'] },
  startText: { type: 'string', max: 30 },
  endText: { type: 'string', max: 30 },
  includeEnd: { type: 'boolean' },
  daysText: { type: 'string', max: 30 },
  dir: { type: 'enum', values: ['add', 'sub'] },
  excludeSat: { type: 'boolean' },
  excludeSun: { type: 'boolean' },
  national: { type: 'boolean' },
  patron: { type: 'string', max: 100 },
  custom: { type: 'string', max: 5000 },
};
