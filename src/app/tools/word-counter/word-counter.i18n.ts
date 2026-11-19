// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Guida "come si usa" e domande frequenti (It): vedi shared/tool-guide.ts. */
const guideIt = {
  'guide.word-counter.step.1': 'Scrivi o incolla il testo nel campo «Testo», oppure premi «Carica un esempio».',
  'guide.word-counter.step.2': 'In «Conteggi» vedi Parole, Caratteri, Caratteri senza spazi, Frasi, Paragrafi e Righe, più il «Tempo di lettura» e il «Tempo di parlato»: si aggiornano mentre scrivi. Con «Copia i conteggi» li copi.',
  'guide.word-counter.step.3': 'In «Limiti di lunghezza» scegli SMS, post su X, meta description, tag title o didascalia Instagram, oppure «Limite personalizzato»: vedi quanti caratteri mancano o quanti ne hai in più.',
  'guide.word-counter.step.4': 'In «Parole più frequenti» trovi le dieci parole più usate; con «Parole da escludere» togli quelle comuni scegliendo la lingua o «Rileva la lingua».',
  'guide.word-counter.step.5': 'Con «Conversioni» cambi maiuscole e minuscole o ripulisci spazi doppi e righe vuote; «Annulla conversione» ripristina il testo.',
  'guide.word-counter.q.1': 'Come vengono contate le parole?',
  'guide.word-counter.a.1':
    'Una parola è una sequenza di lettere o cifre. Una parola con trattino, come «well-known», conta come una sola. I segni di punteggiatura da soli non contano.',
  'guide.word-counter.q.2': 'Come vengono contati i caratteri?',
  'guide.word-counter.a.2':
    'Si contano i caratteri che vedi: una lettera accentata o una emoji valgono 1, anche quando sono composte da più codici. «Caratteri senza spazi» esclude gli spazi.',
  'guide.word-counter.q.3': 'Come si calcola il tempo di lettura?',
  'guide.word-counter.a.3':
    'In base alle parole: lettura a circa 200 parole al minuto e parlato a circa 130. È una stima media: la velocità reale cambia da persona a persona e dal tipo di testo.',
  'guide.word-counter.q.4': 'I limiti di SMS, X e meta description sono precisi?',
  'guide.word-counter.a.4':
    'Sono indicativi. Lo strumento conta i caratteri visibili, ma alcune piattaforme contano diversamente link ed emoji (per esempio X) e i limiti possono cambiare: per un limite preciso usa «Limite personalizzato».',
  'guide.word-counter.q.5': 'A che cosa servono le parole più frequenti?',
  'guide.word-counter.a.5':
    'A vedere se ripeti troppo una parola, per esempio in un articolo o in una descrizione. Le parole comuni (articoli, congiunzioni) si possono escludere scegliendo la lingua.',
  'guide.word-counter.q.6': 'Il mio testo viene salvato o inviato?',
  'guide.word-counter.a.6':
    'No: il conteggio avviene nel browser mentre scrivi e il testo non viene inviato a nessun server.',
  'guide.word-counter.privacy':
    'Il testo resta nel tuo browser. Se usi il pulsante di condivisione, il contenuto finisce nell\'indirizzo del link, dopo il simbolo #: quella parte non arriva a nessun server, ma la vede chi riceve il link.',
};

/** Guida "come si usa" e domande frequenti (En): vedi shared/tool-guide.ts. */
const guideEn = {
  'guide.word-counter.step.1': 'Type or paste your text into the "Text" field, or press "Load an example".',
  'guide.word-counter.step.2': 'Under "Counts" you see Words, Characters, Characters without spaces, Sentences, Paragraphs and Lines, plus "Reading time" and "Speaking time": they update as you type. "Copy the counts" copies them.',
  'guide.word-counter.step.3': 'Under "Length limits" choose SMS, X post, meta description, title tag or Instagram caption, or a "Custom limit": you see how many characters are left or how many you are over.',
  'guide.word-counter.step.4': '"Most frequent words" lists the ten most used words; with "Words to exclude" you drop common ones by choosing a language or "Detect language".',
  'guide.word-counter.step.5': '"Conversions" changes upper and lower case or cleans up double spaces and blank lines; "Undo conversion" restores the text.',
  'guide.word-counter.q.1': 'How are words counted?',
  'guide.word-counter.a.1':
    'A word is a run of letters or digits. A hyphenated word such as "well-known" counts as one. Punctuation on its own does not count.',
  'guide.word-counter.q.2': 'How are characters counted?',
  'guide.word-counter.a.2':
    'You get the characters you see: an accented letter or an emoji counts as 1, even when it is made of several code points. "Characters without spaces" leaves out spaces.',
  'guide.word-counter.q.3': 'How is reading time worked out?',
  'guide.word-counter.a.3':
    'From the word count: reading at about 200 words per minute and speaking at about 130. It is an average estimate: real speed varies from person to person and by type of text.',
  'guide.word-counter.q.4': 'Are the SMS, X and meta description limits exact?',
  'guide.word-counter.a.4':
    'They are indicative. The tool counts visible characters, but some platforms count links and emoji differently (X, for example) and limits can change: for an exact limit use "Custom limit".',
  'guide.word-counter.q.5': 'What are the most frequent words for?',
  'guide.word-counter.a.5':
    'To see whether you repeat a word too often, for instance in an article or a description. Common words (articles, conjunctions) can be excluded by choosing the language.',
  'guide.word-counter.q.6': 'Is my text saved or sent anywhere?',
  'guide.word-counter.a.6':
    'No: counting happens in the browser as you type and the text is not sent to any server.',
  'guide.word-counter.privacy':
    'The text stays in your browser. If you use the share button, the content goes into the link\'s address after the # sign: that part never reaches a server, but whoever receives the link can see it.',
};

const it = {
  ...guideIt,
  'wc.lead':
    'Incolla o scrivi un testo: parole, caratteri, frasi e paragrafi si aggiornano mentre scrivi, con i tempi di lettura e di parlato, le parole più usate e i limiti di lunghezza più comuni.',
  'wc.input': 'Testo',
  'wc.input.ph': 'Scrivi o incolla qui il tuo testo…',
  'wc.clear': 'Cancella',
  'wc.undo': 'Annulla conversione',
  'wc.sample': 'Carica un esempio',
  'wc.convert': 'Conversioni',
  'wc.conv.upper': 'MAIUSCOLO',
  'wc.conv.lower': 'minuscolo',
  'wc.conv.title': 'Iniziali Maiuscole',
  'wc.conv.sentence': 'Frase',
  'wc.conv.invert': 'iNVERTI',
  'wc.conv.spaces': 'Rimuovi spazi doppi',
  'wc.conv.blank': 'Rimuovi righe vuote',
  'wc.stats': 'Conteggi',
  'wc.stat.words': 'Parole',
  'wc.stat.chars': 'Caratteri',
  'wc.stat.charsNoSpaces': 'Caratteri senza spazi',
  'wc.stat.sentences': 'Frasi',
  'wc.stat.paragraphs': 'Paragrafi',
  'wc.stat.lines': 'Righe',
  'wc.stat.reading': 'Tempo di lettura',
  'wc.stat.speaking': 'Tempo di parlato',
  'wc.stat.note': 'Lettura a circa 200 parole al minuto, parlato a circa 130. I caratteri sono quelli che vedi: una emoji o una lettera accentata contano 1.',
  'wc.copyStats': 'Copia i conteggi',
  'wc.summary': '{words} parole, {chars} caratteri ({noSpaces} senza spazi), {sentences} frasi, {paragraphs} paragrafi, {lines} righe, lettura {reading}, parlato {speaking}',
  'wc.limits': 'Limiti di lunghezza',
  'wc.limit.sms': 'SMS (1 messaggio)',
  'wc.limit.x': 'Post su X',
  'wc.limit.meta': 'Meta description',
  'wc.limit.title': 'Tag title (SEO)',
  'wc.limit.ig': 'Didascalia Instagram',
  'wc.limit.custom': 'Limite personalizzato',
  'wc.limit.custom.ph': 'Es. 500',
  'wc.limit.left': 'mancano {n}',
  'wc.limit.over': 'sforati di {n}',
  'wc.limit.exact': 'limite raggiunto',
  'wc.limit.note': 'Conteggio in caratteri visibili: alcune piattaforme contano diversamente link ed emoji (per esempio X), quindi è indicativo.',
  'wc.freq': 'Parole più frequenti',
  'wc.freq.lang': 'Parole da escludere',
  'wc.freq.auto': 'Rileva la lingua',
  'wc.freq.it': 'Italiano',
  'wc.freq.en': 'Inglese',
  'wc.freq.none': 'Nessuna',
  'wc.freq.detected': 'Lingua rilevata: {lang}.',
  'wc.freq.word': 'Parola',
  'wc.freq.count': 'Volte',
  'wc.freq.percent': '% sulle parole',
  'wc.freq.empty': 'Nessuna parola da mostrare.',
  'wc.freq.caption': 'Dieci parole più frequenti',
  'wc.lang.it': 'italiano',
  'wc.lang.en': 'inglese',
  'wc.sample.text':
    'La città è già sveglia. Il mercato apre alle sette: le bancarelle colorate riempiono la piazza e il profumo del caffè arriva fino al ponte.\n\nMaria compra pane, frutta e fiori. Il fruttivendolo la saluta con un sorriso 😀 e le consiglia le pesche, dolci e mature.\n\nNel pomeriggio la piazza si svuota, ma il mercato tornerà domani, come ogni giorno.',
} as const;

const en: Record<keyof typeof it, string> = {
  ...guideEn,
  'wc.lead':
    'Paste or type a text: words, characters, sentences and paragraphs update as you write, with reading and speaking time, the most used words and the most common length limits.',
  'wc.input': 'Text',
  'wc.input.ph': 'Type or paste your text here…',
  'wc.clear': 'Clear',
  'wc.undo': 'Undo conversion',
  'wc.sample': 'Load an example',
  'wc.convert': 'Conversions',
  'wc.conv.upper': 'UPPERCASE',
  'wc.conv.lower': 'lowercase',
  'wc.conv.title': 'Title Case',
  'wc.conv.sentence': 'Sentence case',
  'wc.conv.invert': 'iNVERT',
  'wc.conv.spaces': 'Remove double spaces',
  'wc.conv.blank': 'Remove blank lines',
  'wc.stats': 'Counts',
  'wc.stat.words': 'Words',
  'wc.stat.chars': 'Characters',
  'wc.stat.charsNoSpaces': 'Characters without spaces',
  'wc.stat.sentences': 'Sentences',
  'wc.stat.paragraphs': 'Paragraphs',
  'wc.stat.lines': 'Lines',
  'wc.stat.reading': 'Reading time',
  'wc.stat.speaking': 'Speaking time',
  'wc.stat.note': 'Reading at about 200 words per minute, speaking at about 130. Characters are what you see: an emoji or an accented letter counts as 1.',
  'wc.copyStats': 'Copy the counts',
  'wc.summary': '{words} words, {chars} characters ({noSpaces} without spaces), {sentences} sentences, {paragraphs} paragraphs, {lines} lines, reading {reading}, speaking {speaking}',
  'wc.limits': 'Length limits',
  'wc.limit.sms': 'SMS (1 message)',
  'wc.limit.x': 'X post',
  'wc.limit.meta': 'Meta description',
  'wc.limit.title': 'Title tag (SEO)',
  'wc.limit.ig': 'Instagram caption',
  'wc.limit.custom': 'Custom limit',
  'wc.limit.custom.ph': 'E.g. 500',
  'wc.limit.left': '{n} left',
  'wc.limit.over': 'over by {n}',
  'wc.limit.exact': 'limit reached',
  'wc.limit.note': 'Counted in visible characters: some platforms count links and emoji differently (X, for example), so this is a guide.',
  'wc.freq': 'Most frequent words',
  'wc.freq.lang': 'Words to exclude',
  'wc.freq.auto': 'Detect language',
  'wc.freq.it': 'Italian',
  'wc.freq.en': 'English',
  'wc.freq.none': 'None',
  'wc.freq.detected': 'Detected language: {lang}.',
  'wc.freq.word': 'Word',
  'wc.freq.count': 'Times',
  'wc.freq.percent': '% of words',
  'wc.freq.empty': 'No words to show.',
  'wc.freq.caption': 'Ten most frequent words',
  'wc.lang.it': 'Italian',
  'wc.lang.en': 'English',
  'wc.sample.text':
    'The town is already awake. The market opens at seven: colourful stalls fill the square and the smell of coffee reaches the bridge.\n\nMaria buys bread, fruit and flowers. The fruit seller greets her with a smile 😀 and recommends the peaches, sweet and ripe.\n\nIn the afternoon the square empties, but the market will be back tomorrow, as every day.',
};

export const WC_DICTIONARIES: ToolDictionaries = { it, en };
