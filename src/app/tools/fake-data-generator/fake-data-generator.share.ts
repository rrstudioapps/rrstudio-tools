// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { FIELD_IDS, MAX_ROWS } from './fake-data';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  fields: { type: 'strings', maxItems: FIELD_IDS.length, maxLength: 20, valid: (v) => (FIELD_IDS as readonly string[]).includes(v) },
  count: { type: 'number', min: 1, max: MAX_ROWS, int: true },
  seed: { type: 'string', max: 100 },
  birthFrom: { type: 'string', max: 10, chars: '0123456789-' },
  birthTo: { type: 'string', max: 10, chars: '0123456789-' },
  numberMin: { type: 'number', min: -1e12, max: 1e12 },
  numberMax: { type: 'number', min: -1e12, max: 1e12 },
  numberDecimals: { type: 'number', min: 0, max: 4, int: true },
  format: { type: 'enum', values: ['csv', 'json', 'sql'] },
  sep: { type: 'enum', values: [',', ';', '\t'] },
  table: { type: 'string', max: 127 },
};
