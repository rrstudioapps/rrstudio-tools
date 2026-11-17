// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['format', 'minify', 'json'] },
  indent: { type: 'enum', values: ['2', '4', 'tab'] },
  keepComments: { type: 'boolean' },
  input: { type: 'string', max: 100000 },
};
