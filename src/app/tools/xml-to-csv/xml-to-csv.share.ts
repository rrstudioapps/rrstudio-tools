// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: il documento e le scelte di conversione. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 100000 },
  record: { type: 'string', max: 300 },
  attrs: { type: 'boolean' },
  depth: { type: 'enum', values: ['1', '2', '3', '4', '5'] },
  typed: { type: 'boolean' },
  delimiter: { type: 'enum', values: [',', ';', '\t', '|'] },
};
