// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato che finisce nel link: direzione, testo di partenza e opzioni. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['j2x', 'x2j'] },
  input: { type: 'string', max: 100000 },
  attrPrefix: { type: 'enum', values: ['@', '_', '$'] },
  rootName: { type: 'string', max: 60 },
  indent: { type: 'enum', values: ['2', '4'] },
};
