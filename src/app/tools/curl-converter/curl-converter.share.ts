// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { TARGETS } from './curl-generate';

/** Nel link finiscono il comando e il linguaggio scelto. Attenzione: il comando può contenere token e password. */
export const SHARE_SCHEMA: Schema = {
  command: { type: 'string', max: 6000 },
  target: { type: 'enum', values: TARGETS },
};
