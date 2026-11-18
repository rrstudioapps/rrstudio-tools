// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { ZONES, parseWall } from './countdown';

/** Nel link: data e ora dell'evento (testo senza fuso), nome e fuso scelto. */
export const SHARE_SCHEMA: Schema = {
  at: { type: 'string', max: 19, valid: (v) => parseWall(v) !== null },
  name: { type: 'string', max: 80 },
  zone: { type: 'enum', values: ['local', ...ZONES] },
};
