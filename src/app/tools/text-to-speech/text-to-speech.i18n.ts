// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'tts.lead':
    'Fai leggere ad alta voce un testo con le voci del tuo dispositivo: scegli voce e lingua, velocità, tono e volume, metti in pausa o ferma la lettura e segui la frase che viene letta. La sintesi usa la Web Speech API del browser.',
  'tts.privacy.title': 'Solo voci locali, per la tua privacy',
  'tts.privacy':
    'Alcune voci (per esempio quelle "Google" di Chrome) sono voci di rete: per leggere inviano il testo a server esterni. Qui vengono nascoste e non si usano mai: compaiono solo le voci installate sul tuo dispositivo, che lavorano senza rete.',
  'tts.unsupported': 'Questo browser non supporta la sintesi vocale (Web Speech API). Prova con un altro browser.',
  'tts.loading': 'Ricerca delle voci installate…',
  'tts.novoices.title': 'Nessuna voce locale disponibile',
  'tts.novoices':
    'Questo dispositivo non ha voci installate che funzionano senza rete (o il browser le mostra solo come voci di rete). Per sicurezza non uso le voci di rete. Puoi installare voci nelle impostazioni di sistema (accessibilità o lingua) e ricaricare la pagina.',
  'tts.text': 'Testo da leggere',
  'tts.text.ph': 'Scrivi o incolla qui il testo…',
  'tts.example': 'Testo di esempio',
  'tts.example.text': 'Ciao! Questo è un esempio di lettura. Ogni frase viene evidenziata mentre la voce la legge. Puoi cambiare velocità, tono e volume.',
  'tts.truncated': 'Testo molto lungo: si leggono i primi {max} caratteri.',
  'tts.lang': 'Lingua',
  'tts.lang.all': 'Tutte',
  'tts.voice': 'Voce',
  'tts.rate': 'Velocità',
  'tts.pitch': 'Tono',
  'tts.volume': 'Volume',
  'tts.reset': 'Ripristina',
  'tts.settingsNote': 'Le modifiche valgono dalla frase successiva (o subito, se riavvii la frase).',
  'tts.play': 'Leggi',
  'tts.pause': 'Pausa',
  'tts.resume': 'Riprendi',
  'tts.stop': 'Ferma',
  'tts.state.speaking': 'In lettura: frase {n} di {total}.',
  'tts.state.paused': 'In pausa alla frase {n} di {total}.',
  'tts.state.done': 'Lettura terminata.',
  'tts.state.error': 'La voce ha avuto un problema e la lettura si è fermata.',
  'tts.reading': 'Lettura',
  'tts.empty': 'Scrivi un testo da leggere.',
  'tts.novoice': 'Scegli una voce locale.',
  'tts.info.how.title': 'Come funziona',
  'tts.info.how.desc':
    'Il browser sintetizza il testo con le voci di sistema. Il testo viene letto una frase alla volta: così si evidenzia la frase corrente e si evitano i blocchi che alcune voci hanno sui testi lunghi.',
  'tts.info.local.title': 'Perché solo voci locali',
  'tts.info.local.desc':
    'Una voce con localService attivo gira sul tuo dispositivo. Le voci di rete mandano il testo a un servizio esterno: lo strumento le esclude, anche se il browser le propone come predefinite.',
  'tts.info.voices.title': 'Poche voci?',
  'tts.info.voices.desc':
    'Le voci disponibili dipendono dal sistema operativo e dal browser: su Windows, macOS, Android e iOS se ne aggiungono dalle impostazioni di lingua o accessibilità. Su Linux serve speech-dispatcher.',
};

const en: typeof it = {
  'tts.lead':
    'Have a text read aloud with your device\'s voices: choose voice and language, speed, pitch and volume, pause or stop the reading and follow the sentence being read. The speech uses the browser\'s Web Speech API.',
  'tts.privacy.title': 'Local voices only, for your privacy',
  'tts.privacy':
    'Some voices (for example Chrome\'s "Google" ones) are network voices: to read they send the text to external servers. Here they are hidden and never used: only the voices installed on your device appear, and they work without a network.',
  'tts.unsupported': 'This browser does not support speech synthesis (Web Speech API). Try another browser.',
  'tts.loading': 'Looking for installed voices…',
  'tts.novoices.title': 'No local voice available',
  'tts.novoices':
    'This device has no installed voices that work without a network (or the browser lists them only as network voices). For safety I do not use network voices. You can install voices in the system settings (accessibility or language) and reload the page.',
  'tts.text': 'Text to read',
  'tts.text.ph': 'Type or paste the text here…',
  'tts.example': 'Sample text',
  'tts.example.text': 'Hello! This is a reading example. Each sentence is highlighted while the voice reads it. You can change speed, pitch and volume.',
  'tts.truncated': 'Very long text: the first {max} characters are read.',
  'tts.lang': 'Language',
  'tts.lang.all': 'All',
  'tts.voice': 'Voice',
  'tts.rate': 'Speed',
  'tts.pitch': 'Pitch',
  'tts.volume': 'Volume',
  'tts.reset': 'Reset',
  'tts.settingsNote': 'Changes apply from the next sentence (or right away if you restart the sentence).',
  'tts.play': 'Read',
  'tts.pause': 'Pause',
  'tts.resume': 'Resume',
  'tts.stop': 'Stop',
  'tts.state.speaking': 'Reading: sentence {n} of {total}.',
  'tts.state.paused': 'Paused at sentence {n} of {total}.',
  'tts.state.done': 'Reading finished.',
  'tts.state.error': 'The voice had a problem and the reading stopped.',
  'tts.reading': 'Reading',
  'tts.empty': 'Type a text to read.',
  'tts.novoice': 'Choose a local voice.',
  'tts.info.how.title': 'How it works',
  'tts.info.how.desc':
    'The browser synthesises the text with the system voices. The text is read one sentence at a time: this highlights the current sentence and avoids the freezes some voices have on long texts.',
  'tts.info.local.title': 'Why local voices only',
  'tts.info.local.desc':
    'A voice with localService set runs on your device. Network voices send the text to an external service: the tool excludes them, even if the browser offers them as default.',
  'tts.info.voices.title': 'Few voices?',
  'tts.info.voices.desc':
    'Available voices depend on the operating system and browser: on Windows, macOS, Android and iOS more can be added from the language or accessibility settings. On Linux speech-dispatcher is needed.',
};

export const TTS_DICTIONARIES: ToolDictionaries = { it, en };
