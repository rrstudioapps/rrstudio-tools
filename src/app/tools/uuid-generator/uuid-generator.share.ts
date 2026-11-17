// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  kind: { type: 'enum', values: ['v4', 'v7', 'ulid'] },
  count: { type: 'number', min: 1, max: 1000, int: true },
  upper: { type: 'boolean' },
  hyphens: { type: 'boolean' },
  braces: { type: 'boolean' },
};
