// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: il documento (in forma compatta) e la vista. L'albero si ricostruisce dal testo. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 200000 },
  view: { type: 'enum', values: ['tree', 'text'] },
};
