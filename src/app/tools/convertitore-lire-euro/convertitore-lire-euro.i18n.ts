// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
const it = {
  'lire.lead': 'Converti lire in euro e euro in lire con il cambio irrevocabile fissato nel 1998: 1 euro = 1936,27 lire. Arrotonda al centesimo o alla lira come previsto dai regolamenti europei e mostra i tagli storici di banconote e monete.',
  'lire.mode': 'Direzione',
  'lire.mode.toEuro': 'Lire → euro',
  'lire.mode.toLire': 'Euro → lire',
  'lire.amount.lire': 'Importo in lire',
  'lire.amount.euro': 'Importo in euro',
  'lire.amount.ph.lire': 'Per esempio 100.000',
  'lire.amount.ph.euro': 'Per esempio 51,65',
  'lire.result': 'Risultato',
  'lire.empty': 'Scrivi un importo per vedere la conversione.',
  'lire.err.invalid': 'Non è un importo valido. Usa cifre e la virgola per i decimali, per esempio 1.936,27.',
  'lire.err.range': 'Importo troppo grande: lo strumento arriva a 1.000 miliardi.',
  'lire.err.negative': 'Inserisci un importo positivo.',
  'lire.res.euro': '{v} euro',
  'lire.res.lire': '{v} lire',
  'lire.res.exactEuro': 'Valore esatto, senza arrotondare: {v} euro',
  'lire.res.exactLire': 'Valore esatto, senza arrotondare: {v} lire',
  'lire.note.euro': 'Arrotondato al centesimo di euro (la metà del centesimo va per eccesso).',
  'lire.note.lire': 'Arrotondato alla lira intera (la metà va per eccesso).',
  'lire.rate': 'Cambio fisso: 1 euro = 1.936,27 lire, Regolamento (CE) n. 2866/98 del Consiglio, 31 dicembre 1998. Per convertire si divide per il cambio e si arrotonda; i risultati intermedi non si arrotondano.',
  'lire.status': 'La lira ha avuto corso legale fino al 28 febbraio 2002. Il cambio delle lire alla Banca d\'Italia è stato chiuso il 6 dicembre 2011 dal D.L. 201/2011, in anticipo sulla scadenza del 28 febbraio 2012; con la sentenza 216/2015 la Corte costituzionale lo ha riconosciuto solo a chi l\'aveva chiesto entro quella data. Oggi non si possono più convertire.',
  'lire.table.title': 'Tagli storici in lire',
  'lire.table.notes': 'Banconote',
  'lire.table.coins': 'Monete',
  'lire.col.value': 'Taglio',
  'lire.col.subject': 'Soggetto',
  'lire.col.year': 'Serie',
  'lire.col.euro': 'In euro',
  'lire.table.note': 'Sono le banconote dell\'ultima serie in circolazione e le monete degli ultimi anni della lira; il valore in euro è arrotondato al centesimo. Le monete da 1 e 2 lire erano ormai poco usate.',
  'lire.lire': '{v} lire',
  'lire.euro': '{v} €',
  'guide.convertitore-lire-euro.step.1': 'Scegli la direzione: «Lire → euro» o «Euro → lire».',
  'guide.convertitore-lire-euro.step.2': 'Scrivi l\'importo, con la virgola per i decimali (per esempio 1.936,27).',
  'guide.convertitore-lire-euro.step.3': 'Leggi il risultato arrotondato (al centesimo per gli euro, alla lira per le lire) e il valore esatto.',
  'guide.convertitore-lire-euro.step.4': 'Sotto trovi la tabella dei tagli storici di banconote e monete con il loro valore in euro.',
  'guide.convertitore-lire-euro.q.1': 'Qual è il cambio lire euro?',
  'guide.convertitore-lire-euro.a.1': '1 euro = 1936,27 lire, fissato in modo irrevocabile dal Regolamento (CE) n. 2866/98 del 31 dicembre 1998. Non è cambiato nel tempo.',
  'guide.convertitore-lire-euro.q.2': 'Come si arrotonda?',
  'guide.convertitore-lire-euro.a.2': 'Dalle lire agli euro si divide per 1936,27 e si arrotonda al centesimo più vicino; dagli euro alle lire si moltiplica e si arrotonda alla lira intera. La metà va per eccesso.',
  'guide.convertitore-lire-euro.q.3': 'Posso ancora cambiare le vecchie lire?',
  'guide.convertitore-lire-euro.a.3': 'No: il cambio presso la Banca d\'Italia è stato chiuso il 6 dicembre 2011 (D.L. 201/2011) e, dopo la sentenza 216/2015 della Corte costituzionale, è stato concesso solo a chi l\'aveva chiesto entro il 28 febbraio 2012. Per verificare la situazione attuale consulta il sito della Banca d\'Italia.',
  'guide.convertitore-lire-euro.q.4': 'Lo strumento tiene conto dell\'inflazione?',
  'guide.convertitore-lire-euro.a.4': 'No: converte solo con il cambio fisso. Il potere d\'acquisto di una somma di un certo anno si calcola con gli indici ISTAT, che cambiano ogni mese e non sono inclusi.',
  'guide.convertitore-lire-euro.q.5': 'I dati vengono inviati a un server?',
  'guide.convertitore-lire-euro.a.5': 'No: il calcolo avviene nel tuo browser.',
};

const en: typeof it = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const LIRE_DICTIONARIES: ToolDictionaries = { it, en };
