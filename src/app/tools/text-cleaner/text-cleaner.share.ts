// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Testo (limitato) e opzioni nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 20_000 },
  joinLines: { type: 'boolean' },
  dehyphen: { type: 'boolean' },
  collapseSpaces: { type: 'boolean' },
  trimLines: { type: 'boolean' },
  blankLines: { type: 'enum', values: ['keep', 'single', 'none'] },
  straightQuotes: { type: 'boolean' },
  simpleDashes: { type: 'boolean' },
  invisibles: { type: 'boolean' },
  stripHtml: { type: 'boolean' },
  stripBullets: { type: 'boolean' },
  caseMode: { type: 'enum', values: ['keep', 'sentence', 'lower'] },
};
