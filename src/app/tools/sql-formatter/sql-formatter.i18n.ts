// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'sql.lead':
    'Formatta una query SQL con a capo e rientri leggibili, scegliendo il dialetto (PostgreSQL, MySQL, SQLite, SQL Server, BigQuery…), le maiuscole delle parole chiave e l\'indentazione, oppure minificala. Tutto nel tuo browser: le query non vengono inviate.',
  'sql.mode': 'Operazione',
  'sql.mode.format': 'Formatta',
  'sql.mode.minify': 'Minifica',
  'sql.dialect': 'Dialetto SQL',
  'sql.case': 'Parole chiave',
  'sql.case.upper': 'MAIUSCOLE',
  'sql.case.lower': 'minuscole',
  'sql.case.preserve': 'Invariate',
  'sql.indent': 'Indentazione',
  'sql.indent.2': '2 spazi',
  'sql.indent.4': '4 spazi',
  'sql.indent.tab': 'Tab',
  'sql.sample': 'Esempio',
  'sql.drop': 'Trascina qui un file .sql, oppure scrivi sotto.',
  'sql.in': 'Query SQL',
  'sql.out': 'Risultato',
  'sql.ph': 'SELECT … FROM …',
  'sql.empty': 'Il risultato appare qui.',
  'sql.download': 'Scarica',
  'sql.meta': '{lines} righe · {chars} caratteri',
  'sql.ok': 'Query formattata.',
  'sql.saved': 'Da {from} a {to} caratteri ({pct}% in meno).',
  'sql.err.title': 'Impossibile formattare',
  'sql.err.at': 'Riga {line}, colonna {col}: {msg}',
  'sql.err.plain': '{msg}',
  'sql.err.hint': 'Controlla virgolette e parentesi, o prova un altro dialetto.',
  'sql.err.tooBig': 'Il file supera i 2 MB: per sicurezza il browser non lo apre qui.',
  'sql.err.read': 'Impossibile leggere il file.',
  'sql.info.fmt.title': 'Cosa cambia',
  'sql.info.fmt.desc':
    'Solo a capo, spazi e (se vuoi) la maiuscola di parole chiave, tipi di dato e funzioni. Stringhe, nomi tra virgolette e commenti restano com\'erano.',
  'sql.info.min.title': 'Minificazione',
  'sql.info.min.desc':
    'Toglie commenti e spazi superflui ma non tocca stringhe, identificatori tra virgolette, hint (/*+ … */) e commenti condizionali MySQL (/*! … */). Non cambia mai il significato della query.',
  'sql.info.priv.title': 'Dove vanno i dati',
  'sql.info.priv.desc':
    'Tutto avviene in questa pagina: la query non viene salvata, messa nell\'indirizzo o inviata. Non viene mai eseguita su nessun database.',
};

const en: typeof it = {
  'sql.lead':
    'Format an SQL query with readable line breaks and indentation, choosing the dialect (PostgreSQL, MySQL, SQLite, SQL Server, BigQuery…), the keyword case and the indentation, or minify it. Everything runs in your browser: your queries are not sent anywhere.',
  'sql.mode': 'Action',
  'sql.mode.format': 'Format',
  'sql.mode.minify': 'Minify',
  'sql.dialect': 'SQL dialect',
  'sql.case': 'Keywords',
  'sql.case.upper': 'UPPERCASE',
  'sql.case.lower': 'lowercase',
  'sql.case.preserve': 'Unchanged',
  'sql.indent': 'Indentation',
  'sql.indent.2': '2 spaces',
  'sql.indent.4': '4 spaces',
  'sql.indent.tab': 'Tab',
  'sql.sample': 'Example',
  'sql.drop': 'Drop an .sql file here, or type below.',
  'sql.in': 'SQL query',
  'sql.out': 'Result',
  'sql.ph': 'SELECT … FROM …',
  'sql.empty': 'The result appears here.',
  'sql.download': 'Download',
  'sql.meta': '{lines} lines · {chars} characters',
  'sql.ok': 'Query formatted.',
  'sql.saved': 'From {from} to {to} characters ({pct}% smaller).',
  'sql.err.title': 'Cannot format',
  'sql.err.at': 'Line {line}, column {col}: {msg}',
  'sql.err.plain': '{msg}',
  'sql.err.hint': 'Check quotes and parentheses, or try another dialect.',
  'sql.err.tooBig': 'The file is over 2 MB: for safety the browser will not open it here.',
  'sql.err.read': 'The file could not be read.',
  'sql.info.fmt.title': 'What changes',
  'sql.info.fmt.desc':
    'Only line breaks, spaces and (if you want) the case of keywords, data types and functions. Strings, quoted names and comments stay as they were.',
  'sql.info.min.title': 'Minifying',
  'sql.info.min.desc':
    'It removes comments and extra whitespace but leaves strings, quoted identifiers, hints (/*+ … */) and MySQL conditional comments (/*! … */) alone. It never changes the meaning of the query.',
  'sql.info.priv.title': 'Where your data goes',
  'sql.info.priv.desc':
    'Everything happens on this page: the query is not stored, put in the address or sent. It is never run against any database.',
};

export const SQL_DICTIONARIES: ToolDictionaries = { it, en };
