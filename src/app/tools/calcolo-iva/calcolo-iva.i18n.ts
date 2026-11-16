// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
const it = {
  'iva.lead':
    'Aggiungi l\'IVA a un imponibile, scorporala da un importo lordo o prepara una notula da professionista con rivalsa INPS, cassa previdenziale, ritenuta d\'acconto e bollo. Arrotondamenti al centesimo.',
  'iva.disclaimer':
    'Strumento di calcolo indicativo, non è consulenza fiscale: verifica sempre il caso concreto con il tuo commercialista. Aliquote e regole aggiornate al 2026.',
  'iva.mode': 'Che cosa vuoi calcolare',
  'iva.mode.add': 'Aggiungi IVA',
  'iva.mode.extract': 'Scorpora IVA',
  'iva.mode.invoice': 'Notula / fattura',
  'iva.mode.reverse': 'Dal netto al compenso',
  'iva.amount.add': 'Imponibile (€)',
  'iva.amount.extract': 'Importo lordo, IVA inclusa (€)',
  'iva.amount.invoice': 'Compenso, imponibile (€)',
  'iva.amount.reverse': 'Netto da incassare desiderato (€)',
  'iva.amount.ph': 'Per esempio 1.000,00',
  'iva.amount.err': 'Scrivi un importo valido, per esempio 1.250,50.',
  'iva.vat': 'Aliquota IVA',
  'iva.vat.rate': '{rate}%',
  'iva.vat.zero': '0% (senza IVA)',
  'iva.nature': 'Natura dell\'operazione senza IVA',
  'iva.nat.N2.2': 'N2.2 · non soggetta, altri casi',
  'iva.nat.N4': 'N4 · esente',
  'iva.nat.N2.1': 'N2.1 · non soggetta (artt. 7-7 septies)',
  'iva.nat.N1': 'N1 · esclusa (art. 15)',
  'iva.nat.N3.1': 'N3.1 · non imponibile, esportazioni',
  'iva.nat.N6.9': 'N6.9 · inversione contabile',
  'iva.opts': 'Dati della notula',
  'iva.forfettario': 'Regime forfettario (niente IVA, niente ritenuta)',
  'iva.rivalsa': 'Rivalsa INPS 4%',
  'iva.cassa': 'Cassa previdenziale',
  'iva.cassa.none': 'Nessuna',
  'iva.cassa.custom': 'Altra percentuale',
  'iva.cassa.pct': 'Percentuale della cassa (%)',
  'iva.cassa.err': 'Scrivi una percentuale valida, per esempio 4 o 2,5.',
  'iva.cassa.vat': 'La cassa è soggetta a IVA',
  'iva.ritenuta': 'Ritenuta d\'acconto 20%',
  'iva.ritenuta.none': 'Nessuna ritenuta',
  'iva.ritenuta.compenso': 'Su compenso e rivalsa INPS',
  'iva.ritenuta.cassa': 'Su compenso, rivalsa INPS e cassa',
  'iva.bollo': 'Addebita il bollo di 2 € al cliente',
  'iva.result': 'Risultato',
  'iva.row.net': 'Imponibile',
  'iva.row.vat': 'IVA {rate}',
  'iva.row.gross': 'Totale (IVA inclusa)',
  'iva.row.compenso': 'Compenso',
  'iva.row.rivalsa': 'Rivalsa INPS 4%',
  'iva.row.cassa': 'Cassa previdenziale {rate}',
  'iva.row.vatBase': 'Imponibile IVA',
  'iva.row.bollo': 'Imposta di bollo',
  'iva.row.total': 'Totale documento',
  'iva.row.ritenuta': 'Ritenuta d\'acconto {rate}',
  'iva.row.netToPay': 'Netto a pagare',
  'iva.row.neededCompenso': 'Compenso da fatturare',
  'iva.reverse.diff': 'Con gli arrotondamenti al centesimo il netto esatto non è raggiungibile: il più vicino è {net} ({diff} rispetto a quello desiderato).',
  'iva.reverse.exact': 'Con questo compenso il netto a pagare è esattamente {net}.',
  'iva.notes': 'Da riportare in fattura',
  'iva.note.forfettario':
    'Operazione effettuata ai sensi dell\'articolo 1, commi da 54 a 89, della legge n. 190/2014 (regime forfettario).',
  'iva.note.ritenutaForfettario':
    'Compenso non soggetto a ritenuta d\'acconto ai sensi dell\'articolo 1, comma 67, della legge n. 190/2014.',
  'iva.note.bollo':
    'Imposta di bollo di 2,00 € assolta ai sensi del DPR n. 642/1972 (operazione senza IVA di importo superiore a 77,47 €).',
  'iva.note.bolloNotCharged': 'Bollo di 2,00 € dovuto ma a carico del professionista: non è sommato al totale.',
  'iva.note.natura': 'Operazione senza IVA, natura {code}: {text}.',
  'iva.natdesc.N2.2': 'non soggetta, altri casi',
  'iva.natdesc.N4': 'esente (art. 10 DPR 633/1972)',
  'iva.natdesc.N2.1': 'non soggetta ad IVA (artt. da 7 a 7-septies DPR 633/1972)',
  'iva.natdesc.N1': 'esclusa (art. 15 DPR 633/1972)',
  'iva.natdesc.N3.1': 'non imponibile, esportazioni',
  'iva.natdesc.N6.9': 'inversione contabile, altri casi',
  'iva.note.cassaFuoriIva': 'Il contributo cassa è esposto fuori campo IVA e non concorre alla base imponibile.',
  'iva.summary': 'Riepilogo',
  'iva.empty': 'Scrivi un importo per vedere il calcolo.',
};

const en: typeof it = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const IVA_DICTIONARIES: ToolDictionaries = { it, en };
