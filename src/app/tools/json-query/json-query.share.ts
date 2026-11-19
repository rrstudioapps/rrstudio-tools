// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  json: { type: 'string', max: 100000 },
  expr: { type: 'string', max: 2000 },
  tab: { type: 'enum', values: ['query', 'ts', 'schema'] },
  rootName: { type: 'string', max: 60 },
  tsStyle: { type: 'enum', values: ['interface', 'type'] },
  tsExport: { type: 'boolean' },
};
