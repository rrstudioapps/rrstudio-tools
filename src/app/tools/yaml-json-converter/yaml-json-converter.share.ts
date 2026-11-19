// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  from: { type: 'enum', values: ['yaml', 'json', 'toml'] },
  to: { type: 'enum', values: ['yaml', 'json', 'toml'] },
  indent: { type: 'enum', values: ['2', '4', 'tab'] },
  sortKeys: { type: 'boolean' },
  arrayDocs: { type: 'boolean' },
  input: { type: 'string', max: 100000 },
};
