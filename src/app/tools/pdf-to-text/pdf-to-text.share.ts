// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Nel link finiscono solo le opzioni: mai i PDF, il loro testo né le password. */
export const SHARE_SCHEMA: Schema = {
  layout: { type: 'enum', values: ['keep', 'flow'] },
  dehyphenate: { type: 'boolean' },
  markers: { type: 'boolean' },
  stripRepeated: { type: 'boolean' },
  columns: { type: 'boolean' },
  pages: { type: 'string', max: 80, valid: (v) => /^[\d\s,;\-–—]*$/.test(v) },
};
