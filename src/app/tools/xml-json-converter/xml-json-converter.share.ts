// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['x2j', 'j2x'] },
  attrPrefix: { type: 'enum', values: ['@', '_', '$'] },
  forceArrays: { type: 'boolean' },
  infer: { type: 'boolean' },
  indent: { type: 'enum', values: ['0', '2', '4'] },
  declaration: { type: 'boolean' },
  rootName: { type: 'string', max: 60 },
  input: { type: 'string', max: 100000 },
};
