// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'yj.lead':
    'Converti tra YAML, JSON e TOML in tutte le direzioni, con più documenti YAML, indentazione a scelta ed errori con riga e colonna. Tutto nel tuo browser: i file di configurazione non vengono inviati da nessuna parte.',
  'yj.from': 'Formato di partenza',
  'yj.to': 'Formato di arrivo',
  'yj.indent': 'Indentazione',
  'yj.indent.2': '2 spazi',
  'yj.indent.4': '4 spazi',
  'yj.indent.tab': 'Tab',
  'yj.indentNote': 'La tabulazione vale solo per il JSON: YAML la vieta e TOML non indenta, quindi lì si usano 2 spazi.',
  'yj.sort': 'Ordina le chiavi',
  'yj.docs': 'Array radice come documenti YAML',
  'yj.swap': 'Inverti',
  'yj.sample': 'Esempio',
  'yj.drop': 'Trascina qui un file .yaml, .yml, .json o .toml, oppure scrivi sotto.',
  'yj.in': 'Testo di partenza',
  'yj.out': 'Risultato',
  'yj.ph': 'Incolla o scrivi qui…',
  'yj.empty': 'Il risultato appare qui.',
  'yj.download': 'Scarica',
  'yj.goto': 'Vai all\'errore',
  'yj.meta': '{lines} righe · {chars} caratteri',
  'yj.docsFound': '{n} documenti YAML: nel JSON diventano un array.',
  'yj.ok': 'Convertito da {from} a {to}.',
  'yj.err.at': 'Riga {line}, colonna {col}: {msg}',
  'yj.err.plain': '{msg}',
  'yj.err.parse': 'Errore nel {fmt} di partenza',
  'yj.err.write': 'Impossibile scrivere il {fmt}',
  'yj.err.tomlRoot': 'TOML richiede un oggetto alla radice: un array o un valore singolo non si può scrivere.',
  'yj.err.tomlNull': 'TOML non ha il valore null (qui: {path}). Rimuovilo o sostituiscilo con un testo.',
  'yj.err.jsonNonFinite': 'JSON non può rappresentare NaN, Infinity o -Infinity (qui: {path}). Sostituiscilo con un numero o un testo.',
  'yj.err.tooBig': 'Il file supera i 5 MB: per sicurezza il browser non lo apre qui.',
  'yj.err.read': 'Impossibile leggere il file.',
  'yj.info.yaml.title': 'YAML',
  'yj.info.yaml.desc':
    'Si leggono anche ancore, alias e chiavi di merge (<<), come in docker-compose e nelle pipeline CI. Le date restano testo, come prevede YAML 1.2. Il testo scritto non spezza le righe lunghe.',
  'yj.info.toml.title': 'TOML',
  'yj.info.toml.desc':
    'Date e orari TOML diventano stringhe ISO 8601 in JSON e YAML. Verso TOML servono un oggetto alla radice e nessun null: se manca qualcosa, l\'errore ti dice dove.',
  'yj.info.priv.title': 'Dove vanno i dati',
  'yj.info.priv.desc':
    'Tutto avviene in questa pagina: il testo non viene salvato, messo nell\'indirizzo o inviato. Sparisce quando ricarichi.',
};

const en: typeof it = {
  'yj.lead':
    'Convert between YAML, JSON and TOML in every direction, with multiple YAML documents, a choice of indentation and errors with line and column. Everything runs in your browser: your config files are not sent anywhere.',
  'yj.from': 'Source format',
  'yj.to': 'Target format',
  'yj.indent': 'Indentation',
  'yj.indent.2': '2 spaces',
  'yj.indent.4': '4 spaces',
  'yj.indent.tab': 'Tab',
  'yj.indentNote': 'Tabs apply to JSON only: YAML forbids them and TOML does not indent, so those use 2 spaces.',
  'yj.sort': 'Sort keys',
  'yj.docs': 'Root array as YAML documents',
  'yj.swap': 'Swap',
  'yj.sample': 'Example',
  'yj.drop': 'Drop a .yaml, .yml, .json or .toml file here, or type below.',
  'yj.in': 'Source text',
  'yj.out': 'Result',
  'yj.ph': 'Paste or type here…',
  'yj.empty': 'The result appears here.',
  'yj.download': 'Download',
  'yj.goto': 'Go to error',
  'yj.meta': '{lines} lines · {chars} characters',
  'yj.docsFound': '{n} YAML documents: in JSON they become an array.',
  'yj.ok': 'Converted from {from} to {to}.',
  'yj.err.at': 'Line {line}, column {col}: {msg}',
  'yj.err.plain': '{msg}',
  'yj.err.parse': 'Error in the source {fmt}',
  'yj.err.write': 'Cannot write {fmt}',
  'yj.err.tomlRoot': 'TOML needs an object at the root: an array or a single value cannot be written.',
  'yj.err.tomlNull': 'TOML has no null value (here: {path}). Remove it or replace it with text.',
  'yj.err.jsonNonFinite': 'JSON cannot represent NaN, Infinity or -Infinity (here: {path}). Replace it with a number or text.',
  'yj.err.tooBig': 'The file is over 5 MB: for safety the browser will not open it here.',
  'yj.err.read': 'The file could not be read.',
  'yj.info.yaml.title': 'YAML',
  'yj.info.yaml.desc':
    'Anchors, aliases and merge keys (<<) are understood, as used in docker-compose and CI pipelines. Dates stay text, as YAML 1.2 says. Written text does not wrap long lines.',
  'yj.info.toml.title': 'TOML',
  'yj.info.toml.desc':
    'TOML dates and times become ISO 8601 strings in JSON and YAML. Writing TOML needs an object at the root and no null: if something is missing, the error tells you where.',
  'yj.info.priv.title': 'Where your data goes',
  'yj.info.priv.desc':
    'Everything happens on this page: the text is not stored, put in the address or sent. It disappears when you reload.',
};

export const YAML_JSON_DICTIONARIES: ToolDictionaries = { it, en };
