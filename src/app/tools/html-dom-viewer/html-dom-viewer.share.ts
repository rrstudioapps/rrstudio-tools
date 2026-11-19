// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 100000 },
  mode: { type: 'enum', values: ['css', 'xpath'] },
  query: { type: 'string', max: 500 },
};
