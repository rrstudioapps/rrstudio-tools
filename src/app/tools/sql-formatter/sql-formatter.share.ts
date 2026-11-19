// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';

/** Stato dello strumento che finisce nel link di condivisione: tipi e valori ammessi (il resto si ignora). */
export const SHARE_SCHEMA: Schema = {
  mode: { type: 'enum', values: ['format', 'minify'] },
  dialect: { type: 'enum', values: ['sql', 'postgresql', 'mysql', 'mariadb', 'sqlite', 'transactsql', 'bigquery', 'plsql', 'db2', 'redshift', 'snowflake', 'spark', 'hive', 'trino'] },
  keywordCase: { type: 'enum', values: ['upper', 'lower', 'preserve'] },
  indent: { type: 'enum', values: ['2', '4', 'tab'] },
  input: { type: 'string', max: 100000 },
};
