// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { format } from 'sql-formatter';

export type Dialect =
  | 'sql'
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'transactsql'
  | 'bigquery'
  | 'plsql'
  | 'db2'
  | 'redshift'
  | 'snowflake'
  | 'spark'
  | 'hive'
  | 'trino';

/** Dialetti offerti, con il nome mostrato (non si traduce: sono nomi di prodotto). */
export const DIALECTS: readonly { id: Dialect; label: string }[] = [
  { id: 'sql', label: 'SQL (standard)' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'mariadb', label: 'MariaDB' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'transactsql', label: 'T-SQL (SQL Server)' },
  { id: 'bigquery', label: 'BigQuery' },
  { id: 'plsql', label: 'PL/SQL (Oracle)' },
  { id: 'db2', label: 'IBM Db2' },
  { id: 'redshift', label: 'Amazon Redshift' },
  { id: 'snowflake', label: 'Snowflake' },
  { id: 'spark', label: 'Spark SQL' },
  { id: 'hive', label: 'Hive' },
  { id: 'trino', label: 'Trino / Presto' },
];

export type KeywordCase = 'upper' | 'lower' | 'preserve';

export interface SqlError {
  message: string;
  line?: number;
  column?: number;
}

export interface SqlFormatOptions {
  dialect: Dialect;
  keywordCase: KeywordCase;
  /** Spazi per livello (2, 4) o 'tab'. */
  indent: 2 | 4 | 'tab';
  /** Righe vuote tra un'istruzione e l'altra. */
  linesBetweenQueries: number;
}

export type SqlResult = { ok: true; text: string } | { ok: false; error: SqlError };

export function formatSql(sql: string, o: SqlFormatOptions): SqlResult {
  try {
    const text = format(sql, {
      language: o.dialect,
      tabWidth: o.indent === 'tab' ? 2 : o.indent,
      useTabs: o.indent === 'tab',
      keywordCase: o.keywordCase,
      dataTypeCase: o.keywordCase,
      functionCase: o.keywordCase,
      linesBetweenQueries: o.linesBetweenQueries,
    });
    return { ok: true, text: text + '\n' };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const lc = /line (\d+) column (\d+)/i.exec(raw);
    const first = raw.split('\n')[0].replace(/^Parse error:\s*/i, '');
    const message = first.replace(/\s*at line \d+ column \d+\.?/i, '').trim();
    return { ok: false, error: { message: message || raw, line: lc ? Number(lc[1]) : undefined, column: lc ? Number(lc[2]) : undefined } };
  }
}

// ---------- minificazione ----------

type TokKind = 'ws' | 'comment' | 'hint' | 'str' | 'word' | 'other';
interface Tok {
  k: TokKind;
  v: string;
}

const BACKSLASH_ESCAPES: ReadonlySet<Dialect> = new Set(['mysql', 'mariadb', 'bigquery', 'spark', 'hive']);

function scanQuoted(sql: string, start: number, quote: string, backslash: boolean): number {
  let i = start + 1;
  while (i < sql.length) {
    const c = sql[i];
    if (backslash && c === '\\') i += 2;
    else if (c === quote) {
      if (sql[i + 1] === quote) i += 2; // virgolette raddoppiate = carattere letterale
      else return i + 1;
    } else i++;
  }
  return sql.length; // non chiusa: fino a fine testo
}

export function tokenizeSql(sql: string, dialect: Dialect): Tok[] {
  const out: Tok[] = [];
  const backslash = BACKSLASH_ESCAPES.has(dialect);
  const hashComments = dialect === 'mysql' || dialect === 'mariadb';
  let i = 0;
  const push = (k: TokKind, end: number): void => {
    out.push({ k, v: sql.slice(i, end) });
    i = end;
  };
  while (i < sql.length) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      push('ws', j);
    } else if (two === '--' || (c === '#' && hashComments)) {
      const nl = sql.indexOf('\n', i);
      push('comment', nl === -1 ? sql.length : nl);
    } else if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      // /*! … */ (MySQL) e /*+ … */ (hint) hanno effetto: non si tolgono
      push(sql[i + 2] === '!' || sql[i + 2] === '+' ? 'hint' : 'comment', stop);
    } else if (c === "'") {
      const prev = out[out.length - 1];
      const escapeString = dialect === 'postgresql' && prev?.k === 'word' && /^[eE]$/.test(prev.v);
      push('str', scanQuoted(sql, i, "'", backslash || escapeString));
    } else if (c === '"') push('str', scanQuoted(sql, i, '"', backslash));
    else if (c === '`') push('str', scanQuoted(sql, i, '`', false));
    else if (c === '[' && dialect === 'transactsql') push('str', scanQuoted(sql, i, ']', false) );
    else if (c === '$' && (dialect === 'postgresql' || dialect === 'redshift')) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m) {
        const end = sql.indexOf(m[0], i + m[0].length);
        push('str', end === -1 ? sql.length : end + m[0].length);
      } else push('word', i + 1 + (/^\d+/.exec(sql.slice(i + 1))?.[0].length ?? 0));
    } else if (/[\p{L}\p{N}_$@]/u.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[\p{L}\p{N}_$@]/u.test(sql[j])) j++;
      push('word', j);
    } else push('other', i + 1);
  }
  return out;
}

const PUNCT = ',;()';
const OPERATORS = '=<>!+';

/** Vero se tra i due frammenti si può togliere lo spazio senza cambiare il significato. */
function spaceOptional(left: string, right: string): boolean {
  const a = left[left.length - 1];
  const b = right[0];
  if (PUNCT.includes(a) || PUNCT.includes(b)) return true;
  const opA = OPERATORS.includes(a);
  const opB = OPERATORS.includes(b);
  return opA !== opB;
}

/** Toglie commenti e spazi inutili, lasciando intatti stringhe, identificatori tra virgolette e hint. */
export function minifySql(sql: string, dialect: Dialect = 'sql'): string {
  let out = '';
  let pending = false;
  for (const t of tokenizeSql(sql, dialect)) {
    if (t.k === 'ws' || t.k === 'comment') {
      pending = true;
      continue;
    }
    if (pending && out !== '' && !spaceOptional(out, t.v)) out += ' ';
    pending = false;
    out += t.v;
  }
  return out;
}
