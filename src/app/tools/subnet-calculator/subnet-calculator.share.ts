// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento nel link: indirizzo, tipo di suddivisione, valore e indirizzo da verificare. */
export const SHARE_SCHEMA: Schema = {
  input: { type: 'string', max: 80 },
  splitMode: { type: 'enum', values: ['count', 'hosts', 'vlsm'] },
  splitValue: { type: 'string', max: 200 },
  checkIp: { type: 'string', max: 60 },
};
