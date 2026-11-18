// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';

/** Testo (limitato) e impostazioni nel link di condivisione. */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 20_000 },
  dir: { type: 'enum', values: ['toLine', 'toList'] },
  sepKind: { type: 'enum', values: ['comma', 'commaSpace', 'semicolon', 'space', 'tab', 'pipe', 'custom'] },
  customSep: { type: 'string', max: 40 },
  quote: { type: 'enum', values: ['none', 'double', 'single', 'backtick', 'minimal'] },
  escape: { type: 'enum', values: ['none', 'double', 'backslash', 'json', 'shell'] },
  prefix: { type: 'string', max: 40 },
  suffix: { type: 'string', max: 40 },
  trailing: { type: 'boolean' },
  noQuoteNumbers: { type: 'boolean' },
  encodeUri: { type: 'boolean' },
  trim: { type: 'boolean' },
  dropEmpty: { type: 'boolean' },
  unique: { type: 'boolean' },
  sort: { type: 'enum', values: ['none', 'az', 'za', 'numeric'] },
  caseMode: { type: 'enum', values: ['none', 'lower', 'upper'] },
  fromSep: { type: 'enum', values: ['auto', 'comma', 'semicolon', 'tab', 'pipe', 'space', 'custom'] },
  fromCustom: { type: 'string', max: 40 },
  stripQuotes: { type: 'boolean' },
  backslash: { type: 'boolean' },
  stripWrapper: { type: 'boolean' },
};
