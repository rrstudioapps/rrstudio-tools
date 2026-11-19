// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  pattern: { type: 'string', max: 5000 },
  flags: { type: 'string', max: 7, chars: 'gimsuyd' },
  text: { type: 'string', max: 100000 },
  replacement: { type: 'string', max: 5000 },
};
