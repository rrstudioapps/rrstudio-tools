// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'lorem.lead':
    'Genera testo segnaposto Lorem ipsum in paragrafi, frasi o parole, in testo semplice o in HTML con i tag <p>. Con un seme scelto da te il testo è sempre lo stesso, utile per mockup e test ripetibili.',
  'lorem.unit': 'Unità',
  'lorem.unit.paragraphs': 'Paragrafi',
  'lorem.unit.sentences': 'Frasi',
  'lorem.unit.words': 'Parole',
  'lorem.count': 'Quantità',
  'lorem.count.range': 'da {min} a {max}',
  'lorem.classic': 'Comincia con «Lorem ipsum dolor sit amet…»',
  'lorem.format': 'Formato',
  'lorem.format.text': 'Testo',
  'lorem.format.html': 'HTML <p>',
  'lorem.seed': 'Seme (facoltativo)',
  'lorem.seed.ph': 'vuoto = casuale',
  'lorem.seed.hint': 'Con lo stesso seme e le stesse opzioni ottieni sempre lo stesso testo.',
  'lorem.seed.used': 'Seme usato: {seed}',
  'lorem.seed.fixed': 'Seme fisso: «Genera» non cambia il testo.',
  'lorem.generate': 'Genera',
  'lorem.download': 'Scarica',
  'lorem.out': 'Testo generato',
  'lorem.meta': '{words} parole · {chars} caratteri',
  'lorem.shortcut': 'Scorciatoia: Ctrl + Invio (⌘ + Invio su Mac).',
  'lorem.info.what.title': 'Che testo è',
  'lorem.info.what.desc':
    'Le parole vengono dal testo latino di Cicerone (De finibus bonorum et malorum) da cui nasce il Lorem ipsum. Le frasi hanno da 5 a 15 parole, i paragrafi da 4 a 8 frasi.',
  'lorem.info.seed.title': 'Il seme',
  'lorem.info.seed.desc':
    'Il generatore è deterministico (mulberry32): lo stesso seme dà lo stesso testo su qualsiasi browser. Senza seme se ne sceglie uno casuale con la crittografia del browser e lo vedi qui sotto, così puoi rifarlo.',
  'lorem.info.priv.title': 'Dove vanno i dati',
  'lorem.info.priv.desc':
    'Tutto avviene in questa pagina: nulla viene salvato, messo nell\'indirizzo o inviato. Il testo sparisce quando ricarichi.',
};

const en: typeof it = {
  'lorem.lead':
    'Generate Lorem ipsum placeholder text as paragraphs, sentences or words, as plain text or as HTML with <p> tags. With a seed of your choice the text is always the same, handy for mockups and repeatable tests.',
  'lorem.unit': 'Unit',
  'lorem.unit.paragraphs': 'Paragraphs',
  'lorem.unit.sentences': 'Sentences',
  'lorem.unit.words': 'Words',
  'lorem.count': 'Amount',
  'lorem.count.range': '{min} to {max}',
  'lorem.classic': 'Start with "Lorem ipsum dolor sit amet…"',
  'lorem.format': 'Format',
  'lorem.format.text': 'Text',
  'lorem.format.html': 'HTML <p>',
  'lorem.seed': 'Seed (optional)',
  'lorem.seed.ph': 'empty = random',
  'lorem.seed.hint': 'With the same seed and the same options you always get the same text.',
  'lorem.seed.used': 'Seed used: {seed}',
  'lorem.seed.fixed': 'Fixed seed: "Generate" does not change the text.',
  'lorem.generate': 'Generate',
  'lorem.download': 'Download',
  'lorem.out': 'Generated text',
  'lorem.meta': '{words} words · {chars} characters',
  'lorem.shortcut': 'Shortcut: Ctrl + Enter (⌘ + Enter on Mac).',
  'lorem.info.what.title': 'What text it is',
  'lorem.info.what.desc':
    'The words come from Cicero\'s Latin text (De finibus bonorum et malorum) that Lorem ipsum derives from. Sentences have 5 to 15 words, paragraphs 4 to 8 sentences.',
  'lorem.info.seed.title': 'The seed',
  'lorem.info.seed.desc':
    'The generator is deterministic (mulberry32): the same seed gives the same text in any browser. Without a seed a random one is chosen with the browser\'s cryptography and shown below, so you can reproduce it.',
  'lorem.info.priv.title': 'Where your data goes',
  'lorem.info.priv.desc':
    'Everything happens on this page: nothing is stored, put in the address or sent. The text disappears when you reload.',
};

export const LOREM_DICTIONARIES: ToolDictionaries = { it, en };
