// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { EFFECTS, MAX_BLOCK, MAX_BLUR, MIN_BLOCK, MIN_BLUR, OUT_FORMATS, isHexColor } from './image-redact';

/** Nel link finiscono solo le impostazioni dell'effetto: mai l'immagine né le posizioni dei rettangoli. */
export const SHARE_SCHEMA: Schema = {
  effect: { type: 'enum', values: EFFECTS },
  color: { type: 'string', max: 7, valid: isHexColor },
  block: { type: 'number', min: MIN_BLOCK, max: MAX_BLOCK, int: true },
  blur: { type: 'number', min: MIN_BLUR, max: MAX_BLUR, int: true },
  format: { type: 'enum', values: OUT_FORMATS },
  quality: { type: 'number', min: 10, max: 100, int: true },
};
