// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['text', 'cheque'] },
  input: { type: 'string', max: 2000 },
  euro: { type: 'boolean' },
  joined: { type: 'boolean' },
  letterCase: { type: 'enum', values: ['lower', 'upper', 'capitalize'] },
};
