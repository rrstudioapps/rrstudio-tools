// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { isValidZone } from './timezones';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  zones: { type: 'strings', maxItems: 30, maxLength: 80, valid: isValidZone },
  source: { type: 'string', max: 80, valid: isValidZone },
  dateText: { type: 'string', max: 30 },
  timeText: { type: 'string', max: 30 },
};
