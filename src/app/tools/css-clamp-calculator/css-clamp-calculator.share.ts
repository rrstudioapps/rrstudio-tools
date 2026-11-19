// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento nel link: solo piccoli parametri numerici (testi brevi). */
export const SHARE_SCHEMA: Schema = {
  unit: { type: 'enum', values: ['px', 'rem'] },
  root: { type: 'string', max: 8 },
  minSize: { type: 'string', max: 12 },
  maxSize: { type: 'string', max: 12 },
  minVw: { type: 'string', max: 8 },
  maxVw: { type: 'string', max: 8 },
  minRatio: { type: 'string', max: 8 },
  maxRatio: { type: 'string', max: 8 },
  stepFrom: { type: 'string', max: 4 },
  stepTo: { type: 'string', max: 4 },
  previewVw: { type: 'number', min: 240, max: 1920, int: true },
};
