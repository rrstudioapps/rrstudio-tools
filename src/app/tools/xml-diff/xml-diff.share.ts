// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: i due documenti e l'opzione sugli spazi. */
export const SHARE_SCHEMA: Schema = {
  a: { type: 'string', max: 100000 },
  b: { type: 'string', max: 100000 },
  ignoreWs: { type: 'boolean' },
};
