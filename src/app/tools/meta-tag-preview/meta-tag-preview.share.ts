// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { FIELD_KEYS } from './meta-tags';

/** Nel link finiscono solo i campi (non l'HTML incollato, che può essere molto lungo). */
export const SHARE_SCHEMA: Schema = Object.fromEntries(FIELD_KEYS.map((k) => [k, { type: 'string', max: 2000 } as const]));
