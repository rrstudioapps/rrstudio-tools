// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Nel link finisce solo il testo dei comandi. Attenzione: può contenere password nelle variabili d'ambiente. */
export const SHARE_SCHEMA: Schema = {
  command: { type: 'string', max: 6000 },
};
