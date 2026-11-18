// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { CONS_UNITS, DIST_UNITS, FUELS, MAX_PEOPLE, VOL_UNITS } from './trip-cost-calculator';

export const MODES = ['cost', 'avg', 'range'] as const;
export const RANGE_BY = ['budget', 'tank'] as const;

/** Nel link: tutti i campi digitati (numeri come testo, al massimo 20 caratteri) e le scelte; nessun dato personale. */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: MODES },
  distUnit: { type: 'enum', values: DIST_UNITS },
  distance: { type: 'string', max: 20 },
  roundTrip: { type: 'boolean' },
  fuel: { type: 'enum', values: FUELS },
  consUnit: { type: 'enum', values: CONS_UNITS },
  consumption: { type: 'string', max: 20 },
  price: { type: 'string', max: 20 },
  evCons: { type: 'string', max: 20 },
  evPrice: { type: 'string', max: 20 },
  fixed: { type: 'string', max: 20 },
  people: { type: 'number', min: 1, max: MAX_PEOPLE, int: true },
  co2: { type: 'boolean' },
  liters: { type: 'string', max: 20 },
  volUnit: { type: 'enum', values: VOL_UNITS },
  spend: { type: 'string', max: 20 },
  rangeBy: { type: 'enum', values: RANGE_BY },
  budget: { type: 'string', max: 20 },
  tank: { type: 'string', max: 20 },
};
