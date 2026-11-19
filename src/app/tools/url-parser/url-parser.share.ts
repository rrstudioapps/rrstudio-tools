// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Nel link finisce l'URL scritto nel campo (la tabella dei parametri si ricostruisce da lì). */
export const SHARE_SCHEMA: Schema = {
  url: { type: 'string', max: 4000 },
};
