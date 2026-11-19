// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['encode', 'decode'] },
  input: { type: 'string', max: 5000 },
  wpm: { type: 'number', min: 5, max: 40, int: true },
  freq: { type: 'number', min: 300, max: 1000, int: true },
  symbols: { type: 'enum', values: ['ascii', 'dots'] },
  letterSep: { type: 'enum', values: ['space', 'double'] },
  wordSep: { type: 'enum', values: ['slash', 'spaces', 'bar'] },
};
