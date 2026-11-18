// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { MAX_PEOPLE, ROUND_STEPS } from './split-bill';

/** Nel link: tutti i campi del conto (nomi e importi digitati dall'utente, limitati in lunghezza). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['equal', 'consumption'] },
  total: { type: 'string', max: 20 },
  people: { type: 'number', min: 1, max: MAX_PEOPLE, int: true },
  tipKind: { type: 'enum', values: ['percent', 'amount'] },
  tip: { type: 'string', max: 20 },
  step: { type: 'enum', values: ROUND_STEPS },
  lines: { type: 'string', max: 2000 },
  common: { type: 'string', max: 20 },
};
