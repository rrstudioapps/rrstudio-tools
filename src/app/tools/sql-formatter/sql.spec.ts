// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { DIALECTS, Dialect, SqlFormatOptions, formatSql, minifySql, tokenizeSql } from './sql';

const base: SqlFormatOptions = { dialect: 'sql', keywordCase: 'upper', indent: 2, linesBetweenQueries: 1 };
const fmt = (sql: string, o: Partial<SqlFormatOptions> = {}) => {
  const r = formatSql(sql, { ...base, ...o });
  if (!r.ok) throw new Error(r.error.message);
  return r.text;
};

describe('formatSql', () => {
  it('mette a capo le clausole e rientra', () => {
    const out = fmt('select a,b from t where x=1 and y=2 order by a');
    expect(out).toBe('SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n  AND y = 2\nORDER BY\n  a\n');
  });
  it('maiuscole, minuscole, invariato', () => {
    expect(fmt('Select Count(*) From t', { keywordCase: 'upper' })).toContain('SELECT\n  COUNT(*)\nFROM');
    expect(fmt('SELECT COUNT(*) FROM t', { keywordCase: 'lower' })).toContain('select\n  count(*)\nfrom');
    expect(fmt('Select a From T', { keywordCase: 'preserve' })).toContain('Select\n  a\nFrom');
  });
  it('indentazione a 4 spazi e a tab', () => {
    expect(fmt('select a from t', { indent: 4 })).toContain('\n    a\n');
    expect(fmt('select a from t', { indent: 'tab' })).toContain('\n\ta\n');
  });
  it('righe vuote tra le istruzioni', () => {
    const one = fmt('select 1; select 2;', { linesBetweenQueries: 1 });
    const two = fmt('select 1; select 2;', { linesBetweenQueries: 2 });
    expect(two.length).toBeGreaterThan(one.length);
  });
  it('non tocca stringhe e commenti', () => {
    const out = fmt("select 'from  where' -- nota\n, \"Colonna x\" from t /* blocco */");
    expect(out).toContain("'from  where'");
    expect(out).toContain('-- nota');
    expect(out).toContain('"Colonna x"');
    expect(out).toContain('/* blocco */');
  });
  it('funziona in ogni dialetto offerto', () => {
    for (const d of DIALECTS) {
      const r = formatSql('select a, b from t where a > 1 order by b', { ...base, dialect: d.id });
      expect(r.ok, d.id).toBe(true);
    }
  });
  it('sintassi specifiche dei dialetti', () => {
    expect(fmt('select id::int, data->>\'k\' from t', { dialect: 'postgresql' })).toContain('::');
    expect(fmt('select `a` from `t` limit 5', { dialect: 'mysql' })).toContain('`a`');
    expect(fmt('select top 5 [a] from [dbo].[t]', { dialect: 'transactsql' })).toContain('[dbo]');
  });
  it('è idempotente', () => {
    const once = fmt('select a,b from t join u on t.id=u.id where x in (1,2,3)');
    expect(fmt(once)).toBe(once);
  });
  it('segnala un errore di sintassi con posizione', () => {
    const r = formatSql("select 'abc from t", base);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message.length).toBeGreaterThan(0);
      expect(r.error.message).not.toMatch(/\n/);
    }
  });
});

describe('minifySql', () => {
  it('toglie a capo, rientri e commenti', () => {
    const sql = 'SELECT\n  a,\n  b -- commento\nFROM\n  t /* altro */\nWHERE\n  x = 1\n  AND y = 2;';
    expect(minifySql(sql)).toBe('SELECT a,b FROM t WHERE x=1 AND y=2;');
  });
  it('non tocca stringhe, identificatori tra virgolette e spazi al loro interno', () => {
    expect(minifySql("select 'a  ,  b', \"My  Col\", `x  y` from t")).toBe("select 'a  ,  b',\"My  Col\",`x  y` from t");
  });
  it('gestisce le virgolette raddoppiate e i backslash (MySQL)', () => {
    expect(minifySql("select 'it''s  ok'  from t")).toBe("select 'it''s  ok' from t");
    expect(minifySql("select 'a\\'  b'  ,  c from t", 'mysql')).toBe("select 'a\\'  b',c from t");
  });
  it('commenti # solo in MySQL', () => {
    expect(minifySql('select 1 # nota\n, 2', 'mysql')).toBe('select 1,2');
    expect(minifySql('select a # b', 'sql')).toBe('select a # b');
  });
  it('conserva hint e commenti condizionali', () => {
    expect(minifySql('select /*+ INDEX(t i) */ a from t')).toBe('select /*+ INDEX(t i) */ a from t');
    expect(minifySql('/*!40101 SET x=1 */;\n select 1')).toBe('/*!40101 SET x=1 */;select 1');
  });
  it('dollar-quoting di PostgreSQL e E\'…\'', () => {
    expect(minifySql('select $$ a  --  b $$ , 1', 'postgresql')).toBe('select $$ a  --  b $$,1');
    expect(minifySql("select E'a\\'  b'  from t", 'postgresql')).toBe("select E'a\\'  b' from t");
  });
  it('identificatori [..] di T-SQL', () => {
    expect(minifySql('select [My  Col]  from  [dbo] . [t]', 'transactsql')).toBe('select [My  Col] from [dbo] . [t]');
  });
  it('non unisce operatori né parole', () => {
    expect(minifySql('select 1 - -1, a + +b, x > = y')).toBe('select 1 - -1,a+ +b,x> =y');
    expect(minifySql('select a  from  t')).toBe('select a from t');
    expect(minifySql("select 'a'  'b'")).toBe("select 'a' 'b'");
  });
  it('un commento tra due parole le tiene separate', () => {
    expect(minifySql('select/**/a')).toBe('select a');
  });
  it('commento di riga a fine testo e testo vuoto', () => {
    expect(minifySql('select 1 -- fine')).toBe('select 1');
    expect(minifySql('   \n ')).toBe('');
  });
  it('stringa non chiusa: arriva a fine testo senza errori', () => {
    expect(minifySql("select 'abc  d")).toBe("select 'abc  d");
  });
  it('il risultato minificato si riformatta come l\'originale', () => {
    const sql = 'select a, b from t where x = 1 and y in (1, 2) order by a';
    const dialect: Dialect = 'sql';
    expect(fmt(minifySql(sql, dialect))).toBe(fmt(sql));
  });
});

describe('tokenizeSql', () => {
  it('riconosce i tipi di frammento', () => {
    const kinds = tokenizeSql("select 'x' /* c */ -- d", 'sql').map((t) => t.k);
    expect(kinds).toEqual(['word', 'ws', 'str', 'ws', 'comment', 'ws', 'comment']);
  });
});
