// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: il testo Markdown. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 100000 },
};
