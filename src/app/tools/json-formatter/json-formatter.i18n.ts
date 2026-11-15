// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'json.lead':
    'Incolla un JSON per formattarlo, minificarlo e validarlo. Se c\'è un errore ti indichiamo riga e colonna.',
  'json.action': 'Azione',
  'json.action.format': 'Formatta',
  'json.action.minify': 'Minifica',
  'json.indent': 'Indentazione',
  'json.indent.2': '2 spazi',
  'json.indent.4': '4 spazi',
  'json.indent.tab': 'Tab',
  'json.sort': 'Ordina chiavi',
  'json.sample': 'Prova con un esempio',
  'json.download': 'Scarica .json',
  'json.in': 'JSON in ingresso',
  'json.out': 'Risultato',
  'json.ph': 'Incolla qui il tuo JSON oppure trascina un file .json…',
  'json.out.empty': 'Il risultato appare qui quando il JSON è valido.',
  'json.drop': 'Trascina un file .json su questa area (massimo 10 MB), oppure',
  'json.valid': 'JSON valido',
  'json.size': 'Dimensione {size}',
  'json.keys': '{n} chiavi',
  'json.depth': 'profondità {n}',
  'json.error': 'JSON non valido',
  'json.error.at': 'riga {line}, colonna {column}',
  'json.err.toolarge': 'Il file è troppo grande (massimo 10 MB).',
  'json.err.read': 'Impossibile leggere il file.',
};

const en: typeof it = {
  'json.lead':
    'Paste JSON to format, minify and validate it. If something is wrong we point to the line and column.',
  'json.action': 'Action',
  'json.action.format': 'Format',
  'json.action.minify': 'Minify',
  'json.indent': 'Indentation',
  'json.indent.2': '2 spaces',
  'json.indent.4': '4 spaces',
  'json.indent.tab': 'Tab',
  'json.sort': 'Sort keys',
  'json.sample': 'Try an example',
  'json.download': 'Download .json',
  'json.in': 'Input JSON',
  'json.out': 'Result',
  'json.ph': 'Paste your JSON here or drop a .json file…',
  'json.out.empty': 'The result appears here when the JSON is valid.',
  'json.drop': 'Drop a .json file on this area (10 MB max), or',
  'json.valid': 'Valid JSON',
  'json.size': 'Size {size}',
  'json.keys': '{n} keys',
  'json.depth': 'depth {n}',
  'json.error': 'Invalid JSON',
  'json.error.at': 'line {line}, column {column}',
  'json.err.toolarge': 'The file is too large (10 MB max).',
  'json.err.read': 'Could not read the file.',
};

export const JSON_FORMATTER_DICTIONARIES: ToolDictionaries = { it, en };
