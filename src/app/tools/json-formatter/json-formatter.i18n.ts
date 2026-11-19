// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Guida "come si usa" e domande frequenti (It): vedi shared/tool-guide.ts. */
const guideIt = {
  'guide.json-formatter.step.1': 'Incolla il JSON in «JSON in ingresso», oppure trascina un file .json sull\'area (massimo 10 MB). Con «Prova con un esempio» vedi come funziona.',
  'guide.json-formatter.step.2': 'In «Azione» scegli «Formatta» per renderlo leggibile oppure «Minifica» per toglierne spazi e a capo.',
  'guide.json-formatter.step.3': 'Se formatti, scegli l\'«Indentazione» (2 spazi, 4 spazi o Tab) e, se serve, attiva «Ordina chiavi».',
  'guide.json-formatter.step.4': 'Se il JSON è corretto compare «JSON valido» con dimensione, numero di chiavi e profondità; altrimenti «JSON non valido» con riga e colonna dell\'errore.',
  'guide.json-formatter.step.5': 'Copia il «Risultato» oppure usa «Scarica .json».',
  'guide.json-formatter.q.1': 'Come trovo l\'errore in un JSON non valido?',
  'guide.json-formatter.a.1':
    'Lo strumento indica la riga e la colonna in cui il JSON smette di essere valido. Gli errori più comuni sono una virgola in più dopo l\'ultimo elemento, apici singoli al posto dei doppi e chiavi senza virgolette.',
  'guide.json-formatter.q.2': 'Il JSON ammette commenti o virgole finali?',
  'guide.json-formatter.a.2':
    'No: lo standard JSON non prevede commenti, apici singoli né virgole dopo l\'ultimo elemento. Un testo con queste caratteristiche può essere un oggetto JavaScript valido, ma non è JSON valido.',
  'guide.json-formatter.q.3': 'Che differenza c\'è tra formattare e minificare?',
  'guide.json-formatter.a.3':
    'Formattare aggiunge a capo e rientri per renderlo leggibile; minificare li toglie per ottenere un testo più corto, utile per ridurre il peso. Il contenuto resta lo stesso.',
  'guide.json-formatter.q.4': 'A che cosa serve «Ordina chiavi»?',
  'guide.json-formatter.a.4':
    'Ordina alfabeticamente le chiavi degli oggetti: è comodo per confrontare due JSON o per avere un risultato sempre uguale. L\'ordine degli elementi negli array non cambia.',
  'guide.json-formatter.q.5': 'Cambia i miei dati?',
  'guide.json-formatter.a.5':
    'No: i valori restano gli stessi. Cambiano solo gli spazi e, se lo chiedi, l\'ordine delle chiavi.',
  'guide.json-formatter.q.6': 'Ci sono limiti di dimensione?',
  'guide.json-formatter.a.6':
    'Il file da caricare può pesare al massimo 10 MB. Per testi molto grandi la pagina può rallentare, a seconda del tuo dispositivo.',
  'guide.json-formatter.privacy':
    'Il JSON resta nel tuo browser e non viene inviato. Se usi il pulsante di condivisione, il contenuto finisce nell\'indirizzo del link, dopo il simbolo #: quella parte non arriva a nessun server, ma la vede chi riceve il link.',
};

/** Guida "come si usa" e domande frequenti (En): vedi shared/tool-guide.ts. */
const guideEn = {
  'guide.json-formatter.step.1': 'Paste the JSON into "Input JSON", or drop a .json file on the area (up to 10 MB). "Try an example" shows how it works.',
  'guide.json-formatter.step.2': 'Under "Action" choose "Format" to make it readable or "Minify" to strip spaces and line breaks.',
  'guide.json-formatter.step.3': 'When formatting, choose the "Indentation" (2 spaces, 4 spaces or Tab) and, if needed, turn on "Sort keys".',
  'guide.json-formatter.step.4': 'If the JSON is correct you see "Valid JSON" with its size, key count and depth; otherwise "Invalid JSON" with the line and column of the error.',
  'guide.json-formatter.step.5': 'Copy the "Result" or use "Download .json".',
  'guide.json-formatter.q.1': 'How do I find the error in invalid JSON?',
  'guide.json-formatter.a.1':
    'The tool gives the line and column where the JSON stops being valid. The most common errors are an extra comma after the last item, single quotes instead of double quotes, and keys without quotes.',
  'guide.json-formatter.q.2': 'Does JSON allow comments or trailing commas?',
  'guide.json-formatter.a.2':
    'No: the JSON standard has no comments, no single quotes and no comma after the last item. Text with those features may be valid JavaScript, but it is not valid JSON.',
  'guide.json-formatter.q.3': 'What is the difference between formatting and minifying?',
  'guide.json-formatter.a.3':
    'Formatting adds line breaks and indentation to make it readable; minifying removes them to get shorter text, useful to cut the size. The content stays the same.',
  'guide.json-formatter.q.4': 'What is "Sort keys" for?',
  'guide.json-formatter.a.4':
    'It sorts object keys alphabetically: handy for comparing two JSON documents or getting a consistent result. The order of items in arrays does not change.',
  'guide.json-formatter.q.5': 'Does it change my data?',
  'guide.json-formatter.a.5':
    'No: the values stay the same. Only whitespace changes and, if you ask, the order of the keys.',
  'guide.json-formatter.q.6': 'Is there a size limit?',
  'guide.json-formatter.a.6':
    'A file you load can be at most 10 MB. With very large text the page may slow down, depending on your device.',
  'guide.json-formatter.privacy':
    'The JSON stays in your browser and is not sent anywhere. If you use the share button, the content goes into the link\'s address after the # sign: that part never reaches a server, but whoever receives the link can see it.',
};

const it = {
  ...guideIt,
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
  ...guideEn,
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
