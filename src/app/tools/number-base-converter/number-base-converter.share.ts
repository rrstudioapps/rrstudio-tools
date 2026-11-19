// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 5000 },
  inBase: { type: 'enum', values: ['2', '8', '10', '16', 'custom'] },
  customIn: { type: 'string', max: 3 },
  customOut: { type: 'string', max: 3 },
  upper: { type: 'boolean' },
  group: { type: 'boolean' },
  width: { type: 'enum', values: [8, 16, 32, 64] },
  floatKind: { type: 'enum', values: ['f32', 'f64'] },
  floatText: { type: 'string', max: 200 },
};
