// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['add', 'extract', 'invoice', 'reverse'] },
  amountText: { type: 'string', max: 60 },
  vatBp: { type: 'number', min: 0, max: 10000, int: true },
  nature: { type: 'enum', values: ['N1', 'N2.1', 'N2.2', 'N3.1', 'N4', 'N6.9'] },
  forfettario: { type: 'boolean' },
  rivalsa: { type: 'boolean' },
  cassa: { type: 'enum', values: ['none', '200', '400', '500', 'custom'] },
  cassaCustom: { type: 'string', max: 30 },
  cassaVat: { type: 'boolean' },
  ritenuta: { type: 'enum', values: ['none', 'compenso', 'cassa'] },
  bolloCharged: { type: 'boolean' },
};
