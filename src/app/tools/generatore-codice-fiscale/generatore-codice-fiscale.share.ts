// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { MAX_COUNT } from './generatore-codice-fiscale';

/**
 * Stato dello strumento nel link: solo le opzioni (quantità, filtri, seme), mai i codici generati.
 * Il luogo è il solo codice catastale: il nome si ricava dall'elenco dei luoghi quando la pagina si apre.
 */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['cf', 'vat'] },
  count: { type: 'number', min: 1, max: MAX_COUNT, int: true },
  seed: { type: 'string', max: 100 },
  sex: { type: 'enum', values: ['any', 'M', 'F'] },
  birthExact: { type: 'string', max: 10, chars: '0123456789-' },
  yearFrom: { type: 'number', min: 1900, max: 2999, int: true },
  yearTo: { type: 'number', min: 1900, max: 2999, int: true },
  placeCode: { type: 'string', max: 4, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
  homocodia: { type: 'enum', values: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  office: { type: 'string', max: 3, chars: '0123456789' },
  prefix: { type: 'boolean' },
};
