// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  fgText: { type: 'string', max: 40 },
  bgText: { type: 'string', max: 40 },
  editSide: { type: 'enum', values: ['fg', 'bg'] },
};
