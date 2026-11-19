// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  rootText: { type: 'string', max: 20 },
  parentText: { type: 'string', max: 20 },
  vwText: { type: 'string', max: 20 },
  vhText: { type: 'string', max: 20 },
  valueText: { type: 'string', max: 40 },
  from: { type: 'enum', values: ['px', 'rem', 'em', 'pt', 'pc', 'percent', 'vw', 'vh', 'cm', 'mm', 'in'] },
  quickTo: { type: 'enum', values: ['rem', 'em'] },
  cssIn: { type: 'string', max: 100000 },
  direction: { type: 'enum', values: ['px-rem', 'px-em', 'rem-px'] },
  hairline: { type: 'boolean' },
  media: { type: 'boolean' },
  decimals: { type: 'number', min: 0, max: 8, int: true },
};
