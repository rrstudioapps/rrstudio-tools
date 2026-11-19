// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['diff', 'add', 'age'] },
  diffFrom: { type: 'string', max: 30 },
  diffTo: { type: 'string', max: 30 },
  inclusive: { type: 'boolean' },
  addDate: { type: 'string', max: 30 },
  dir: { type: 'enum', values: ['plus', 'minus'] },
  years: { type: 'string', max: 10 },
  months: { type: 'string', max: 10 },
  weeks: { type: 'string', max: 10 },
  days: { type: 'string', max: 10 },
  birth: { type: 'string', max: 30 },
  ref: { type: 'string', max: 30 },
};
