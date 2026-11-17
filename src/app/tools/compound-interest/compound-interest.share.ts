// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { COMPOUNDINGS } from './compound';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  principalText: { type: 'string', max: 30 },
  contributionText: { type: 'string', max: 30 },
  rateText: { type: 'string', max: 30 },
  yearsText: { type: 'string', max: 30 },
  inflationText: { type: 'string', max: 30 },
  taxText: { type: 'string', max: 30 },
  frequency: { type: 'enum', values: ['monthly', 'yearly'] },
  timing: { type: 'enum', values: ['start', 'end'] },
  compounding: { type: 'enum', values: COMPOUNDINGS },
};
