// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'case.lead':
    'Scrivi o incolla un testo e vedi subito tutte le forme: camelCase, snake_case, kebab-case, Title Case (regole italiane e inglesi), maiuscolo, minuscolo e altre. Riconosce da solo il punto in cui dividere le parole, anche da un nome già in camelCase.',
  'case.in': 'Testo',
  'case.ph': 'es. getHTTPResponse, il nome della rosa, user_profile_id…',
  'case.sample': 'Esempio',
  'case.perLine': 'Riga per riga',
  'case.acronyms': 'Mantieni le sigle (HTTP, XML)',
  'case.accents': 'Togli gli accenti (è → e)',
  'case.hint.perLine': 'Con «Riga per riga» ogni riga è convertita da sola; senza, il testo diventa un solo identificatore.',
  'case.results': 'Risultati',
  'case.empty': 'Scrivi un testo per vedere le conversioni.',
  'case.copy': 'Copia {name}',
  'case.meta': '{lines} righe · {chars} caratteri',
  'case.camel': 'camelCase',
  'case.pascal': 'PascalCase',
  'case.snake': 'snake_case',
  'case.screaming': 'SCREAMING_SNAKE_CASE',
  'case.kebab': 'kebab-case',
  'case.train': 'Train-Case',
  'case.dot': 'dot.case',
  'case.path': 'path/case',
  'case.titleEn': 'Title Case (inglese)',
  'case.titleIt': 'Title Case (italiano)',
  'case.sentence': 'Sentence case',
  'case.upper': 'MAIUSCOLO',
  'case.lower': 'minuscolo',
  'case.alternating': 'aLtErNaTo',
  'case.info.split.title': 'Come divide le parole',
  'case.info.split.desc':
    'Spazi, trattini, underscore, punti e barre separano le parole, e così i cambi da minuscola a maiuscola (userId → user, Id) e le sigle seguite da una parola (XMLHttp → XML, Http). Gli apostrofi tra lettere restano nella parola e negli identificatori si tolgono.',
  'case.info.title.title': 'Title Case',
  'case.info.title.desc':
    'In inglese restano minuscoli articoli, congiunzioni e preposizioni brevi (the, of, and, in…); in italiano articoli, congiunzioni e preposizioni semplici e articolate (il, di, del, sul…), con le elisioni come dell\'Arte. La prima e l\'ultima parola, e quella dopo i due punti, sono sempre maiuscole.',
  'case.info.priv.title': 'Dove vanno i dati',
  'case.info.priv.desc':
    'Tutto avviene in questa pagina: il testo non viene salvato, messo nell\'indirizzo o inviato. Sparisce quando ricarichi.',
};

const en: typeof it = {
  'case.lead':
    'Type or paste some text and see every form at once: camelCase, snake_case, kebab-case, Title Case (English and Italian rules), uppercase, lowercase and more. It works out where to split words by itself, even from a name already in camelCase.',
  'case.in': 'Text',
  'case.ph': 'e.g. getHTTPResponse, the lord of the rings, user_profile_id…',
  'case.sample': 'Example',
  'case.perLine': 'Line by line',
  'case.acronyms': 'Keep acronyms (HTTP, XML)',
  'case.accents': 'Remove accents (è → e)',
  'case.hint.perLine': 'With "Line by line" each line is converted on its own; without it, the text becomes a single identifier.',
  'case.results': 'Results',
  'case.empty': 'Type some text to see the conversions.',
  'case.copy': 'Copy {name}',
  'case.meta': '{lines} lines · {chars} characters',
  'case.camel': 'camelCase',
  'case.pascal': 'PascalCase',
  'case.snake': 'snake_case',
  'case.screaming': 'SCREAMING_SNAKE_CASE',
  'case.kebab': 'kebab-case',
  'case.train': 'Train-Case',
  'case.dot': 'dot.case',
  'case.path': 'path/case',
  'case.titleEn': 'Title Case (English)',
  'case.titleIt': 'Title Case (Italian)',
  'case.sentence': 'Sentence case',
  'case.upper': 'UPPERCASE',
  'case.lower': 'lowercase',
  'case.alternating': 'aLtErNaTiNg',
  'case.info.split.title': 'How words are split',
  'case.info.split.desc':
    'Spaces, hyphens, underscores, dots and slashes separate words, and so do changes from lowercase to uppercase (userId → user, Id) and acronyms followed by a word (XMLHttp → XML, Http). Apostrophes between letters stay in the word and are dropped in identifiers.',
  'case.info.title.title': 'Title Case',
  'case.info.title.desc':
    'In English, articles, conjunctions and short prepositions stay lowercase (the, of, and, in…); in Italian articles, conjunctions and simple and articulated prepositions (il, di, del, sul…), with elisions such as dell\'Arte. The first and last words, and the one after a colon, are always capitalised.',
  'case.info.priv.title': 'Where your data goes',
  'case.info.priv.desc':
    'Everything happens on this page: the text is not stored, put in the address or sent. It disappears when you reload.',
};

export const CASE_DICTIONARIES: ToolDictionaries = { it, en };
