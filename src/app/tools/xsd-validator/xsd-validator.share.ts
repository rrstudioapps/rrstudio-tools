// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: lo schema e il documento. */
export const SHARE_SCHEMA: Schema = {
  xsd: { type: 'string', max: 100000 },
  xml: { type: 'string', max: 100000 },
};
