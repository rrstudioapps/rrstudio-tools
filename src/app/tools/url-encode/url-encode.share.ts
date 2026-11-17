// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  direction: { type: 'enum', values: ['encode', 'decode'] },
  scope: { type: 'enum', values: ['component', 'full'] },
  plus: { type: 'boolean' },
  input: { type: 'string', max: 100000 },
};
