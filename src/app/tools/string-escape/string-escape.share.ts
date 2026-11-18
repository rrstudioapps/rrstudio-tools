// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { FORMATS, SEPARATORS } from './string-escape';

/** Testo (limitato) e impostazioni nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 20_000 },
  format: { type: 'enum', values: FORMATS },
  direction: { type: 'enum', values: ['escape', 'unescape'] },
  quote: { type: 'enum', values: ['single', 'double', 'backtick'] },
  wrap: { type: 'boolean' },
  ascii: { type: 'boolean' },
  separator: { type: 'enum', values: SEPARATORS },
};
