// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['find', 'solve'] },
  width: { type: 'string', max: 12 },
  height: { type: 'string', max: 12 },
  newWidth: { type: 'string', max: 12 },
  ratioW: { type: 'string', max: 12 },
  ratioH: { type: 'string', max: 12 },
  side: { type: 'enum', values: ['width', 'height'] },
  value: { type: 'string', max: 12 },
  rounding: { type: 'enum', values: ['none', 'integer', 'even', 'multiple8'] },
};
