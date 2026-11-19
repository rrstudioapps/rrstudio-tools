// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { OUT_FORMATS, SCALES } from './svg-size';

/** Nel link finiscono il testo dell'SVG (se entra nel limite) e le opzioni di uscita. */
export const SHARE_SCHEMA: Schema = {
  svg: { type: 'string', max: 200_000 },
  mode: { type: 'enum', values: ['scale', 'width', 'height'] },
  scale: { type: 'enum', values: SCALES },
  value: { type: 'number', min: 1, max: 16384, int: true },
  format: { type: 'enum', values: OUT_FORMATS },
  quality: { type: 'number', min: 1, max: 100, int: true },
  transparent: { type: 'boolean' },
  background: { type: 'string', max: 7, valid: (v) => /^#[0-9a-f]{6}$/i.test(v) },
};
