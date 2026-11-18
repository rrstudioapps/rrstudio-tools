// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { MAX_LENGTH } from './scientific-calculator';

/** Stato dello strumento che finisce nel link di condivisione: l'espressione e l'unità degli angoli. */
export const SHARE_SCHEMA: Schema = {
  expr: { type: 'string', max: MAX_LENGTH },
  angle: { type: 'enum', values: ['deg', 'rad'] },
};
