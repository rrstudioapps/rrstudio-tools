// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { KINDS } from './text-extractor';

/** Testo (limitato) e impostazioni nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 20_000 },
  kind: { type: 'enum', values: KINDS },
  unique: { type: 'boolean' },
  sort: { type: 'enum', values: ['appearance', 'az', 'frequency'] },
  ignoreCase: { type: 'boolean' },
  showCount: { type: 'boolean' },
  sep: { type: 'enum', values: ['newline', 'comma', 'semicolon'] },
};
