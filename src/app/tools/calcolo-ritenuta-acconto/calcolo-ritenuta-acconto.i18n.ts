// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
const it = {
  'rit.lead':
    'Dal lordo al netto (e dal netto al lordo) di una prestazione occasionale o di una parcella: ritenuta d\'acconto, rivalsa INPS, cassa previdenziale, IVA e bollo da 2 €, con il prospetto riga per riga da copiare.',
  'rit.disclaimer':
    'Strumento di calcolo indicativo, non è consulenza fiscale: verifica sempre il caso concreto con il tuo commercialista. Arrotondamenti al centesimo, riga per riga.',
  'rit.kind': 'Tipo di prestazione',
  'rit.kind.occasionale': 'Prestazione occasionale',
  'rit.kind.professionista': 'Professionista',
  'rit.dir': 'Che cosa conosci',
  'rit.dir.gross': 'Dal lordo al netto',
  'rit.dir.net': 'Dal netto al lordo',
  'rit.amount.gross': 'Compenso lordo (€)',
  'rit.amount.net': 'Netto che vuoi incassare (€)',
  'rit.amount.ph': 'Per esempio 1.000,00',
  'rit.amount.err': 'Scrivi un importo valido, per esempio 1.250,50.',
  'rit.ritenuta': 'Ritenuta d\'acconto (%)',
  'rit.ritenuta.err': 'Scrivi una percentuale valida, per esempio 20 o 11,5.',
  'rit.rivalsa': 'Rivalsa INPS 4%',
  'rit.rivalsaBase': 'La ritenuta si applica anche alla rivalsa INPS',
  'rit.cassa': 'Cassa previdenziale (%)',
  'rit.cassa.ph': '0 = nessuna',
  'rit.cassa.err': 'Scrivi una percentuale valida, per esempio 4 o 2,5.',
  'rit.vat': 'Aliquota IVA (%)',
  'rit.vat.hint': '0 per forfettari e prestazioni occasionali',
  'rit.vat.err': 'Scrivi una percentuale valida, per esempio 22.',
  'rit.bollo': 'Addebita il bollo di 2 € al cliente',
  'rit.opts': 'Dati del documento',
  'rit.result': 'Risultato',
  'rit.summary': 'Prospetto',
  'rit.row.compenso': 'Compenso lordo',
  'rit.row.rivalsa': 'Rivalsa INPS 4%',
  'rit.row.cassa': 'Cassa previdenziale {rate}',
  'rit.row.imponibile': 'Imponibile',
  'rit.row.vat': 'IVA {rate}',
  'rit.row.bollo': 'Imposta di bollo',
  'rit.row.total': 'Totale documento',
  'rit.row.ritenuta': 'Ritenuta d\'acconto {rate} su {base}',
  'rit.row.netto': 'Netto a pagare',
  'rit.headline.gross': 'Compenso lordo da indicare',
  'rit.reverse.exact': 'Con questo compenso il netto è esattamente {net}.',
  'rit.reverse.diff': 'Con gli arrotondamenti al centesimo il netto esatto non è raggiungibile: il più vicino è {net} ({diff} rispetto a quello desiderato).',
  'rit.notes': 'Da sapere',
  'rit.note.bollo': 'Imposta di bollo di 2,00 € addebitata al cliente: l\'importo senza IVA supera 77,47 €.',
  'rit.note.bolloNot': 'Bollo di 2,00 € dovuto ma a carico di chi emette: non è sommato al totale.',
  'rit.note.cassa': 'La ritenuta non si calcola sul contributo della cassa previdenziale.',
  'rit.note.cu': 'La ritenuta va versata con F24 entro il 16 del mese successivo (codice tributo 1040 per i professionisti, 1038 per le prestazioni occasionali) e certificata con la Certificazione Unica.',
  'rit.empty': 'Scrivi un importo per vedere il prospetto.',
};

const en: typeof it = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const RITENUTA_DICTIONARIES: ToolDictionaries = { it, en };
