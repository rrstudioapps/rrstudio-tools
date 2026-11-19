// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

export const MODES = ['single', 'bulk'] as const;
export const SPACES = ['percent', 'dash'] as const;

/** Nel link: indirizzo (max 500 caratteri), parametri e opzioni; niente altro. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: MODES },
  url: { type: 'string', max: 500 },
  source: { type: 'string', max: 200 },
  medium: { type: 'string', max: 200 },
  campaign: { type: 'string', max: 200 },
  term: { type: 'string', max: 200 },
  content: { type: 'string', max: 200 },
  id: { type: 'string', max: 200 },
  lowercase: { type: 'boolean' },
  spaces: { type: 'enum', values: SPACES },
  bulk: { type: 'string', max: 3000 },
};
