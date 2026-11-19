// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  category: { type: 'enum', values: ['length', 'mass', 'temperature', 'area', 'volume', 'speed', 'time', 'data', 'pressure', 'energy'] },
  valueText: { type: 'string', max: 100 },
  from: { type: 'string', max: 40 },
  to: { type: 'string', max: 40 },
};
