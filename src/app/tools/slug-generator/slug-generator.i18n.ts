// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'slug.lead':
    'Trasforma un titolo in uno slug adatto a un indirizzo web: accenti e lettere latine estese traslitterati (è → e, ß → ss, ł → l), separatore a scelta, lunghezza massima senza spezzare le parole e, se vuoi, senza le parole vuote italiane e inglesi. Anche un elenco intero, una riga per slug.',
  'slug.mode': 'Modalità',
  'slug.mode.single': 'Un testo',
  'slug.mode.bulk': 'Una riga = uno slug',
  'slug.sep': 'Separatore',
  'slug.sep.-': 'Trattino -',
  'slug.sep._': 'Underscore _',
  'slug.sep..': 'Punto .',
  'slug.lower': 'Tutto minuscolo',
  'slug.max': 'Lunghezza massima',
  'slug.max.hint': '0 = nessun limite',
  'slug.stop': 'Parole vuote da togliere',
  'slug.stop.none': 'Nessuna',
  'slug.stop.it': 'Italiano',
  'slug.stop.en': 'Inglese',
  'slug.stop.both': 'Entrambe',
  'slug.unique': 'Rendi unici i duplicati (-2, -3…)',
  'slug.sample': 'Esempio',
  'slug.in': 'Testo',
  'slug.in.bulk': 'Elenco di titoli (uno per riga)',
  'slug.out': 'Slug',
  'slug.out.bulk': 'Slug (uno per riga)',
  'slug.ph': 'es. Perché il caffè è più buono a Napoli?',
  'slug.ph.bulk': 'Un titolo per riga…',
  'slug.empty': 'Lo slug appare qui.',
  'slug.download': 'Scarica .txt',
  'slug.meta': '{n} caratteri',
  'slug.meta.bulk': '{n} slug',
  'slug.noLatin': 'Nel testo non ci sono lettere latine o cifre: lo slug è vuoto. Gli alfabeti non latini (cirillico, greco, cinese…) non vengono traslitterati.',
  'slug.info.what.title': 'Cosa fa',
  'slug.info.what.desc':
    'Toglie accenti e segni, traslittera le lettere latine estese, sostituisce ogni gruppo di simboli con un solo separatore e toglie quelli ai bordi. Dopo l\'apostrofo di un\'elisione italiana (l\'amore) mette il separatore, nelle contrazioni inglesi (don\'t) lo toglie.',
  'slug.info.max.title': 'Lunghezza massima',
  'slug.info.max.desc':
    'Si tengono le parole intere che stanno nel limite. Solo se la prima parola da sola è più lunga del limite viene tagliata. Le parole vuote si tolgono prima, così il limite conta sulle parole che restano.',
  'slug.info.priv.title': 'Dove vanno i dati',
  'slug.info.priv.desc':
    'Tutto avviene in questa pagina: il testo non viene salvato, messo nell\'indirizzo o inviato. Sparisce quando ricarichi.',
};

const en: typeof it = {
  'slug.lead':
    'Turn a title into a slug fit for a web address: accents and extended Latin letters transliterated (è → e, ß → ss, ł → l), a separator of your choice, a maximum length that never splits a word and, if you like, without Italian and English stop words. A whole list too, one slug per line.',
  'slug.mode': 'Mode',
  'slug.mode.single': 'One text',
  'slug.mode.bulk': 'One line = one slug',
  'slug.sep': 'Separator',
  'slug.sep.-': 'Hyphen -',
  'slug.sep._': 'Underscore _',
  'slug.sep..': 'Dot .',
  'slug.lower': 'All lowercase',
  'slug.max': 'Maximum length',
  'slug.max.hint': '0 = no limit',
  'slug.stop': 'Stop words to remove',
  'slug.stop.none': 'None',
  'slug.stop.it': 'Italian',
  'slug.stop.en': 'English',
  'slug.stop.both': 'Both',
  'slug.unique': 'Make duplicates unique (-2, -3…)',
  'slug.sample': 'Example',
  'slug.in': 'Text',
  'slug.in.bulk': 'List of titles (one per line)',
  'slug.out': 'Slug',
  'slug.out.bulk': 'Slugs (one per line)',
  'slug.ph': 'e.g. Why coffee tastes better in Naples?',
  'slug.ph.bulk': 'One title per line…',
  'slug.empty': 'The slug appears here.',
  'slug.download': 'Download .txt',
  'slug.meta': '{n} characters',
  'slug.meta.bulk': '{n} slugs',
  'slug.noLatin': 'The text has no Latin letters or digits: the slug is empty. Non-Latin scripts (Cyrillic, Greek, Chinese…) are not transliterated.',
  'slug.info.what.title': 'What it does',
  'slug.info.what.desc':
    'It removes accents and marks, transliterates extended Latin letters, replaces every run of symbols with a single separator and trims the ends. After the apostrophe of an Italian elision (l\'amore) it puts the separator, in English contractions (don\'t) it drops it.',
  'slug.info.max.title': 'Maximum length',
  'slug.info.max.desc':
    'Whole words that fit the limit are kept. Only if the first word alone is longer than the limit is it cut. Stop words are removed first, so the limit applies to the words that remain.',
  'slug.info.priv.title': 'Where your data goes',
  'slug.info.priv.desc':
    'Everything happens on this page: the text is not stored, put in the address or sent. It disappears when you reload.',
};

export const SLUG_DICTIONARIES: ToolDictionaries = { it, en };
