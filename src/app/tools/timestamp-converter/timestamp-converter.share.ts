// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { isValidZone } from '../timezone-converter/timezones';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  tz: { type: 'string', max: 80, valid: isValidZone },
  unit: { type: 'enum', values: ['auto', 's', 'ms', 'us', 'ns'] },
  tsInput: { type: 'string', max: 100 },
  dateInput: { type: 'string', max: 100 },
  batchInput: { type: 'string', max: 100000 },
};
