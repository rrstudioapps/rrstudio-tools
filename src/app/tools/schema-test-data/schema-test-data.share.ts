// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: lo schema, il seme, il numero di record e il formato. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 100000 },
  seed: { type: 'string', max: 60 },
  count: { type: 'string', max: 5 },
  format: { type: 'enum', values: ['json', 'xml', 'csv'] },
  attrPrefix: { type: 'enum', values: ['@', '_', '$'] },
};
