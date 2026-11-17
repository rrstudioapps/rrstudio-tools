// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { CONVERT_FORMATS, MAX_RESIZE_PX, RESIZE_MODES, isHexColor } from './image-converter';

/** Nel link finiscono solo le opzioni di conversione: mai le immagini. */
export const SHARE_SCHEMA: Schema = {
  format: { type: 'enum', values: CONVERT_FORMATS },
  quality: { type: 'number', min: 1, max: 100, int: true },
  resizeMode: { type: 'enum', values: RESIZE_MODES },
  resizeValue: { type: 'number', min: 0, max: MAX_RESIZE_PX, int: true },
  background: { type: 'string', max: 7, valid: isHexColor },
};
