// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  textA: { type: 'string', max: 100000 },
  textB: { type: 'string', max: 100000 },
  arrayMode: { type: 'enum', values: ['index', 'set', 'key'] },
  key: { type: 'string', max: 100 },
  ignoreCase: { type: 'boolean' },
  epsilon: { type: 'string', max: 30 },
  ignore: { type: 'string', max: 2000 },
  view: { type: 'enum', values: ['list', 'tree'] },
  collapse: { type: 'boolean' },
};
