// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Nel link finiscono il colore (testo come scritto), il nome delle variabili e il formato di esportazione. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 80 },
  name: { type: 'string', max: 30 },
  exportAs: { type: 'enum', values: ['css', 'json'] },
};
