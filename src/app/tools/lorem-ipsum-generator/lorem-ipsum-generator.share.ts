// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  unit: { type: 'enum', values: ['paragraphs', 'sentences', 'words'] },
  count: { type: 'number', min: 1, max: 5000, int: true },
  classic: { type: 'boolean' },
  format: { type: 'enum', values: ['text', 'html'] },
  seedInput: { type: 'string', max: 100 },
};
