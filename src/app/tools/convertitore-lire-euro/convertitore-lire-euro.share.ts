// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['toEuro', 'toLire'] },
  amount: { type: 'string', max: 20 },
};
