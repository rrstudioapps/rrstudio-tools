// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  textA: { type: 'string', max: 100000 },
  textB: { type: 'string', max: 100000 },
  ignoreWs: { type: 'boolean' },
  ignoreCase: { type: 'boolean' },
  ignoreBlank: { type: 'boolean' },
  granularity: { type: 'enum', values: ['word', 'char'] },
  view: { type: 'enum', values: ['side', 'inline'] },
  collapse: { type: 'boolean' },
  // aggiunto dopo: i link vecchi non lo hanno e restano validi ("a capo" attivo)
  wrap: { type: 'boolean' },
};
