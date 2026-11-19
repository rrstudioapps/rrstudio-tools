// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Le cinque schede, ciascuna con due campi (`<scheda>A`, `<scheda>B`): testo digitato. */
export const CARD_IDS = ['of', 'is', 'change', 'apply', 'reverse'] as const;

/** Stato che finisce nel link: i dieci campi e la direzione delle due schede con "aggiungi/togli". */
export const SHARE_SCHEMA: Schema = {
  ...Object.fromEntries(CARD_IDS.flatMap((id) => [[`${id}A`, { type: 'string', max: 40 }], [`${id}B`, { type: 'string', max: 40 }]])),
  applyDir: { type: 'enum', values: ['add', 'sub'] },
  reverseDir: { type: 'enum', values: ['add', 'sub'] },
};
