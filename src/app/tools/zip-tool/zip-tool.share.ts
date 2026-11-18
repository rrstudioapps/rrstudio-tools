// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Nel link finiscono solo la modalità e le impostazioni di compressione: mai file né nomi di file. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['create', 'extract'] },
  level: { type: 'enum', values: [0, 1, 6, 9] },
  name: { type: 'string', max: 100 },
};
