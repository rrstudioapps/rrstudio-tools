// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Guida "come si usa" e domande frequenti (It): vedi shared/tool-guide.ts. */
const guideIt = {
  'guide.password-generator.step.1': 'In «Tipo» scegli «Password» (caratteri casuali) oppure «Passphrase» (parole casuali, più facili da ricordare).',
  'guide.password-generator.step.2': 'Per una password imposta la «Lunghezza» e i «Caratteri da usare»: minuscole, maiuscole, numeri e simboli. «Escludi caratteri ambigui» toglie quelli facili da confondere, come 0 e O.',
  'guide.password-generator.step.3': 'Per una passphrase scegli il numero di parole, il «Separatore» e, se vuoi, «Iniziale maiuscola» e «Aggiungi un numero (0-99)».',
  'guide.password-generator.step.4': 'Premi «Genera» per una nuova scelta (oppure Ctrl + Invio) e «Copia» per metterla negli appunti. Con «Genera 10» ottieni una lista da cui scegliere.',
  'guide.password-generator.step.5': 'Guarda l\'«Entropia» e la barra di robustezza: più i bit sono alti, più è difficile da indovinare.',
  'guide.password-generator.q.1': 'Le password generate sono davvero casuali?',
  'guide.password-generator.a.1':
    'Ogni scelta usa crypto.getRandomValues, il generatore casuale crittografico del browser, con un campionamento che evita distorsioni verso alcuni caratteri. Non usa Math.random.',
  'guide.password-generator.q.2': 'Che cos\'è l\'entropia e quanta ne serve?',
  'guide.password-generator.a.2':
    'L\'entropia, in bit, misura quante possibilità ci sono: ogni bit in più raddoppia i tentativi necessari per indovinare la password. Più è alta meglio è; per un account importante conviene una password lunga e unica, meglio se gestita da un gestore di password.',
  'guide.password-generator.q.3': 'Meglio una password o una passphrase?',
  'guide.password-generator.a.3':
    'Una passphrase di parole casuali è più facile da ricordare e da digitare, a parità di robustezza. Una password di caratteri casuali è più compatta ma si ricorda solo con un gestore di password.',
  'guide.password-generator.q.4': 'Da dove vengono le parole delle passphrase?',
  'guide.password-generator.a.4':
    'Dalla EFF Large Wordlist for Passphrases della Electronic Frontier Foundation: 7776 parole, circa 12,9 bit per parola, licenza CC BY 3.0 US.',
  'guide.password-generator.q.5': 'La password che genero viene salvata?',
  'guide.password-generator.a.5':
    'No: esiste solo in questa pagina. Non viene salvata nemmeno nel localStorage, non finisce nell\'indirizzo e sparisce ricaricando la pagina.',
  'guide.password-generator.q.6': 'Che tempo di cracking indica lo strumento?',
  'guide.password-generator.a.6':
    'Il tempo medio per indovinarla a 10^10 tentativi al secondo, un\'ipotesi indicativa: i tempi reali dipendono da come la password è protetta dal servizio.',
  'guide.password-generator.privacy':
    'Le password vengono generate sul tuo dispositivo: nulla viene inviato, salvato o inserito nell\'indirizzo della pagina.',
};

/** Guida "come si usa" e domande frequenti (En): vedi shared/tool-guide.ts. */
const guideEn = {
  'guide.password-generator.step.1': 'Under "Type" choose "Password" (random characters) or "Passphrase" (random words, easier to remember).',
  'guide.password-generator.step.2': 'For a password set the "Length" and the "Characters to use": lowercase, uppercase, numbers and symbols. "Exclude ambiguous characters" removes look-alikes such as 0 and O.',
  'guide.password-generator.step.3': 'For a passphrase choose the number of words, the "Separator" and, if you like, "Capitalize each word" and "Add a number (0-99)".',
  'guide.password-generator.step.4': 'Press "Generate" for a new one (or Ctrl + Enter) and "Copy" to put it on the clipboard. "Generate 10" gives you a list to choose from.',
  'guide.password-generator.step.5': 'Look at the "Entropy" and the strength bar: the more bits, the harder it is to guess.',
  'guide.password-generator.q.1': 'Are the generated passwords really random?',
  'guide.password-generator.a.1':
    'Every choice uses crypto.getRandomValues, the browser\'s cryptographic random generator, with sampling that avoids any bias towards some characters. It does not use Math.random.',
  'guide.password-generator.q.2': 'What is entropy and how much do I need?',
  'guide.password-generator.a.2':
    'Entropy, in bits, measures how many possibilities there are: each extra bit doubles the guesses needed. Higher is better; for an important account use a long, unique password, ideally kept in a password manager.',
  'guide.password-generator.q.3': 'Password or passphrase?',
  'guide.password-generator.a.3':
    'A passphrase of random words is easier to remember and type at the same strength. A password of random characters is more compact but realistically needs a password manager.',
  'guide.password-generator.q.4': 'Where do the passphrase words come from?',
  'guide.password-generator.a.4':
    'From the EFF Large Wordlist for Passphrases by the Electronic Frontier Foundation: 7776 words, about 12.9 bits per word, CC BY 3.0 US licence.',
  'guide.password-generator.q.5': 'Is the password I generate saved?',
  'guide.password-generator.a.5':
    'No: it only exists on this page. It is not saved, not even in localStorage, it does not end up in the URL and it disappears when you reload.',
  'guide.password-generator.q.6': 'What does the cracking time mean?',
  'guide.password-generator.a.6':
    'It is the average time to guess it at 10^10 attempts per second, a rough assumption: real times depend on how the service protects the password.',
  'guide.password-generator.privacy':
    'Passwords are generated on your device: nothing is sent, saved or put in the page address.',
};

const it = {
  ...guideIt,
  'pw.lead':
    'Password casuali e passphrase facili da ricordare, generate nel tuo browser con la crittografia del sistema. Nulla viene salvato o inviato.',
  'pw.mode': 'Tipo',
  'pw.mode.password': 'Password',
  'pw.mode.passphrase': 'Passphrase',
  'pw.length': 'Lunghezza',
  'pw.length.slider': 'Lunghezza, cursore',
  'pw.length.num': 'Lunghezza, valore',
  'pw.sets': 'Caratteri da usare',
  'pw.set.lower': 'Minuscole (a-z)',
  'pw.set.upper': 'Maiuscole (A-Z)',
  'pw.set.digits': 'Numeri (0-9)',
  'pw.set.symbols': 'Simboli (!@#…)',
  'pw.ambiguous': 'Escludi caratteri ambigui (0 O o 1 l I |)',
  'pw.atleast': 'Deve restare attivo almeno un set di caratteri.',
  'pw.words': 'Parole',
  'pw.words.slider': 'Numero di parole, cursore',
  'pw.words.num': 'Numero di parole, valore',
  'pw.separator': 'Separatore',
  'pw.sep.-': 'Trattino (-)',
  'pw.sep. ': 'Spazio',
  'pw.sep..': 'Punto (.)',
  'pw.sep._': 'Trattino basso (_)',
  'pw.sep.': 'Nessuno',
  'pw.capitalize': 'Iniziale maiuscola',
  'pw.number': 'Aggiungi un numero (0-99)',
  'pw.generate': 'Genera',
  'pw.generateTen': 'Genera 10',
  'pw.shortcut': 'Scorciatoia: Ctrl + Invio (⌘ + Invio su Mac).',
  'pw.result.password': 'Password generata',
  'pw.result.passphrase': 'Passphrase generata',
  'pw.loading': 'Caricamento della lista di parole…',
  'pw.wl.error': 'Impossibile caricare la lista di parole. Riprova più tardi.',
  'pw.entropy': 'Entropia',
  'pw.bits': '{bits} bit',
  'pw.strength.weak': 'Debole',
  'pw.strength.fair': 'Discreta',
  'pw.strength.strong': 'Forte',
  'pw.strength.veryStrong': 'Fortissima',
  'pw.meter': 'Robustezza: {bits} bit, {label}',
  'pw.time': 'Tempo medio per indovinarla a 10^10 tentativi al secondo: {time}.',
  'pw.time.instant': 'meno di un secondo',
  'pw.time.myear.one': '{n} milione di anni',
  'pw.time.myear.other': '{n} milioni di anni',
  'pw.time.byear.one': '{n} miliardo di anni',
  'pw.time.byear.other': '{n} miliardi di anni',
  'pw.time.over': 'più di mille miliardi di anni',
  'pw.list': 'Dieci password',
  'pw.list.phrase': 'Dieci passphrase',
  'pw.list.copy': 'Copia la password {n}',
  'pw.list.copyAll': 'Copia tutte',
  'pw.list.close': 'Chiudi la lista',
  'pw.stored.title': 'Nessuna password viene salvata',
  'pw.stored.desc':
    'Le password esistono solo in questa pagina: non vengono salvate (nemmeno nel localStorage), non finiscono nell\'URL e non vengono inviate a nessuno. Ricaricando la pagina spariscono.',
  'pw.how.title': 'Come vengono generate',
  'pw.how.desc':
    'Ogni scelta usa crypto.getRandomValues, il generatore casuale crittografico del browser, con campionamento per scarto (rejection sampling) per non avere alcun bias da modulo. Con più set di caratteri si riestrae finché ogni set è rappresentato, così le password valide restano equiprobabili. L\'entropia è il logaritmo in base 2 del numero di password possibili con le tue impostazioni: non una stima sulla stringa.',
  'pw.wordlist.title': 'Lista di parole',
  'pw.wordlist.desc':
    'Le passphrase usano la EFF Large Wordlist for Passphrases (7776 parole, ~12,9 bit per parola) della Electronic Frontier Foundation, licenza CC BY 3.0 US. Modifica: sono state tolte le colonne dei numeri dei dadi. La lista si scarica da questo stesso sito solo quando serve.',
  'pw.wordlist.link': 'Vai alla lista originale',
};

const en: typeof it = {
  ...guideEn,
  'pw.lead':
    'Random passwords and memorable passphrases, generated in your browser with the system\'s cryptography. Nothing is stored or sent.',
  'pw.mode': 'Type',
  'pw.mode.password': 'Password',
  'pw.mode.passphrase': 'Passphrase',
  'pw.length': 'Length',
  'pw.length.slider': 'Length, slider',
  'pw.length.num': 'Length, value',
  'pw.sets': 'Characters to use',
  'pw.set.lower': 'Lowercase (a-z)',
  'pw.set.upper': 'Uppercase (A-Z)',
  'pw.set.digits': 'Numbers (0-9)',
  'pw.set.symbols': 'Symbols (!@#…)',
  'pw.ambiguous': 'Exclude ambiguous characters (0 O o 1 l I |)',
  'pw.atleast': 'At least one character set must stay on.',
  'pw.words': 'Words',
  'pw.words.slider': 'Number of words, slider',
  'pw.words.num': 'Number of words, value',
  'pw.separator': 'Separator',
  'pw.sep.-': 'Hyphen (-)',
  'pw.sep. ': 'Space',
  'pw.sep..': 'Dot (.)',
  'pw.sep._': 'Underscore (_)',
  'pw.sep.': 'None',
  'pw.capitalize': 'Capitalize each word',
  'pw.number': 'Add a number (0-99)',
  'pw.generate': 'Generate',
  'pw.generateTen': 'Generate 10',
  'pw.shortcut': 'Shortcut: Ctrl + Enter (⌘ + Enter on Mac).',
  'pw.result.password': 'Generated password',
  'pw.result.passphrase': 'Generated passphrase',
  'pw.loading': 'Loading the word list…',
  'pw.wl.error': 'Could not load the word list. Try again later.',
  'pw.entropy': 'Entropy',
  'pw.bits': '{bits} bits',
  'pw.strength.weak': 'Weak',
  'pw.strength.fair': 'Fair',
  'pw.strength.strong': 'Strong',
  'pw.strength.veryStrong': 'Very strong',
  'pw.meter': 'Strength: {bits} bits, {label}',
  'pw.time': 'Average time to guess it at 10^10 guesses per second: {time}.',
  'pw.time.instant': 'less than a second',
  'pw.time.myear.one': '{n} million years',
  'pw.time.myear.other': '{n} million years',
  'pw.time.byear.one': '{n} billion years',
  'pw.time.byear.other': '{n} billion years',
  'pw.time.over': 'more than a trillion years',
  'pw.list': 'Ten passwords',
  'pw.list.phrase': 'Ten passphrases',
  'pw.list.copy': 'Copy password {n}',
  'pw.list.copyAll': 'Copy all',
  'pw.list.close': 'Close the list',
  'pw.stored.title': 'No password is stored',
  'pw.stored.desc':
    'Passwords exist only on this page: they are not saved (not even in localStorage), they do not end up in the URL and they are not sent to anyone. They disappear when you reload.',
  'pw.how.title': 'How they are generated',
  'pw.how.desc':
    'Every choice uses crypto.getRandomValues, the browser\'s cryptographic random generator, with rejection sampling so there is no modulo bias. With several character sets it draws again until each set is represented, so the valid passwords stay equally likely. Entropy is the base-2 logarithm of the number of possible passwords for your settings: not a guess based on the string.',
  'pw.wordlist.title': 'Word list',
  'pw.wordlist.desc':
    'Passphrases use the EFF Large Wordlist for Passphrases (7776 words, ~12.9 bits per word) by the Electronic Frontier Foundation, licensed CC BY 3.0 US. Change: the dice-number columns were removed. The list is downloaded from this same site only when needed.',
  'pw.wordlist.link': 'See the original list',
};

export const PASSWORD_DICTIONARIES: ToolDictionaries = { it, en };
