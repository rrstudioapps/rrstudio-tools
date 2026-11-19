// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Impostazioni che finiscono nel link di condivisione (mai il tempo trascorso). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['countdown', 'stopwatch', 'pomodoro'] },
  duration: { type: 'string', max: 20 },
  work: { type: 'number', min: 1, max: 180, int: true },
  short: { type: 'number', min: 1, max: 60, int: true },
  long: { type: 'number', min: 1, max: 120, int: true },
  cycles: { type: 'number', min: 1, max: 12, int: true },
  auto: { type: 'boolean' },
  sound: { type: 'boolean' },
};
