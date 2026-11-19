// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { FONT_IDS, LIMITS, PLACEMENTS, MAX_TEXT } from './image-watermark';

/** Nel link finiscono solo le opzioni della filigrana di testo: mai immagini, logo o PDF. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: MAX_TEXT },
  font: { type: 'enum', values: FONT_IDS },
  bold: { type: 'boolean' },
  sizePct: { type: 'number', min: LIMITS.sizePct.min, max: LIMITS.sizePct.max },
  color: { type: 'string', max: 7, valid: (v) => /^#[0-9a-f]{6}$/i.test(v) },
  opacity: { type: 'number', min: LIMITS.opacity.min, max: LIMITS.opacity.max },
  rotation: { type: 'number', min: LIMITS.rotation.min, max: LIMITS.rotation.max },
  position: { type: 'enum', values: PLACEMENTS },
  margin: { type: 'number', min: LIMITS.margin.min, max: LIMITS.margin.max },
  gap: { type: 'number', min: LIMITS.gap.min, max: LIMITS.gap.max },
  format: { type: 'enum', values: ['original', 'png', 'jpeg', 'webp'] },
  quality: { type: 'number', min: 1, max: 100, int: true },
};
