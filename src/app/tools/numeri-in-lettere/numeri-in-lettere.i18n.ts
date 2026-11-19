// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
const it = {
  'nl.lead':
    'Scrivi un numero (anche con decimali o negativo, fino a 999 miliardi) e ottieni la scrittura in lettere in italiano corretto: ventuno, centottanta, ventitré, milleuno. Con la modalità assegno ottieni l\'importo con i centesimi in cifre, per esempio «milleduecentotrentaquattro/56».',
  'nl.mode': 'Modalità',
  'nl.mode.text': 'Testo normale',
  'nl.mode.cheque': 'Assegno / importo',
  'nl.input': 'Numero',
  'nl.input.ph': 'Per esempio 1.234,56',
  'nl.euro': 'Aggiungi «euro» davanti',
  'nl.joined': 'Milioni e miliardi attaccati (unmilione)',
  'nl.case': 'Maiuscole e minuscole',
  'nl.case.lower': 'minuscolo',
  'nl.case.capitalize': 'Iniziale maiuscola',
  'nl.case.upper': 'MAIUSCOLO',
  'nl.result': 'In lettere',
  'nl.empty': 'Scrivi un numero per vedere come si scrive in lettere.',
  'nl.err.invalid': 'Non è un numero valido. Usa cifre, la virgola per i decimali e il meno per i negativi, per esempio -1.234,56.',
  'nl.err.range': 'Numero troppo grande: lo strumento arriva fino a 999.999.999.999 (novecentonovantanove miliardi…).',
  'nl.err.negativeCheque': 'Un importo da assegno non può essere negativo: usa la modalità «Testo normale».',
  'nl.note.cheque': 'Oltre i due decimali l\'importo è arrotondato al centesimo.',
  'nl.rules.title': 'Regole applicate',
  'nl.rules.1': 'Le decine perdono la vocale davanti a «uno» e «otto»: ventuno, trentotto.',
  'nl.rules.2': '«Cento» perde la «o» davanti a «otto» e «ottanta»: centotto, centottanta.',
  'nl.rules.3': 'L\'accento su «tré» solo in fondo al numero: ventitré, ma ventitremila.',
  'nl.rules.4': 'Mille diventa «mila» (duemila) e milione e miliardo sono parole separate: un milione, due miliardi.',
};

const en: typeof it = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const NL_DICTIONARIES: ToolDictionaries = { it, en };
