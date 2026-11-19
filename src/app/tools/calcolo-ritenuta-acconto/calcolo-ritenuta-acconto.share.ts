// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  kind: { type: 'enum', values: ['occasionale', 'professionista'] },
  dir: { type: 'enum', values: ['gross', 'net'] },
  amountText: { type: 'string', max: 60 },
  ritenutaText: { type: 'string', max: 30 },
  rivalsa: { type: 'boolean' },
  ritenutaOnRivalsa: { type: 'boolean' },
  cassaText: { type: 'string', max: 30 },
  vatText: { type: 'string', max: 30 },
  bolloCharged: { type: 'boolean' },
};
