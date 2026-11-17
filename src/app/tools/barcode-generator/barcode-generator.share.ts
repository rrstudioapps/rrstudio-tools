// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['single', 'bulk'] },
  format: { type: 'enum', values: ['EAN13', 'EAN8', 'UPC', 'ITF14', 'ITF', 'CODE128', 'CODE39', 'codabar', 'MSI', 'pharmacode'] },
  text: { type: 'string', max: 2000 },
  barWidth: { type: 'number', min: 1, max: 6, int: true },
  height: { type: 'number', min: 20, max: 400, int: true },
  showText: { type: 'boolean' },
  fontSize: { type: 'number', min: 8, max: 48, int: true },
  margin: { type: 'number', min: 0, max: 60, int: true },
  fg: { type: 'string', max: 7, chars: '#0123456789abcdefABCDEF', valid: (s) => /^#[0-9a-f]{6}$/i.test(s) },
  bg: { type: 'string', max: 7, chars: '#0123456789abcdefABCDEF', valid: (s) => /^#[0-9a-f]{6}$/i.test(s) },
  mod43: { type: 'boolean' },
  pngScale: { type: 'number', min: 1, max: 8, int: true },
  bulkText: { type: 'string', max: 100000 },
  bulkKind: { type: 'enum', values: ['svg', 'png'] },
};
