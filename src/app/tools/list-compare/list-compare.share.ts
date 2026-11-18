// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Elenchi (limitati) e opzioni nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  a: { type: 'string', max: 20_000 },
  b: { type: 'string', max: 20_000 },
  ignoreCase: { type: 'boolean' },
  trim: { type: 'boolean' },
  ignoreEmpty: { type: 'boolean' },
  sort: { type: 'enum', values: ['appearance', 'az', 'natural'] },
};
