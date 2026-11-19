// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { BYTE_FORMATS, ENCODINGS, SEPARATORS } from './text-binary-converter';

/** Testo (limitato) e impostazioni nel link di condivisione; il file caricato non ne fa mai parte. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 20_000 },
  direction: { type: 'enum', values: ['toBytes', 'toText'] },
  format: { type: 'enum', values: BYTE_FORMATS },
  encoding: { type: 'enum', values: ENCODINGS },
  separator: { type: 'enum', values: SEPARATORS },
  uppercase: { type: 'boolean' },
  group: { type: 'enum', values: ['1', '2', '4', '8'] },
  pad: { type: 'boolean' },
  perLine: { type: 'number', min: 0, max: 4096, int: true },
  replace: { type: 'boolean' },
  bom: { type: 'boolean' },
};
