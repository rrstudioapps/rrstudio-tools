// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  cipher: { type: 'enum', values: ['rot13', 'rot47', 'caesar', 'atbash', 'vigenere'] },
  decrypt: { type: 'boolean' },
  shift: { type: 'number', min: -25, max: 25, int: true },
  key: { type: 'string', max: 200 },
  input: { type: 'string', max: 5000 },
};
