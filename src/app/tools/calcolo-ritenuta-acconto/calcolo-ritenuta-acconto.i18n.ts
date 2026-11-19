// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
/** Guida "come si usa" e domande frequenti (It): vedi shared/tool-guide.ts. */
const guideIt = {
  'guide.calcolo-ritenuta-acconto.step.1': 'In «Tipo di prestazione» scegli «Prestazione occasionale» oppure «Professionista».',
  'guide.calcolo-ritenuta-acconto.step.2': 'In «Che cosa conosci» scegli «Dal lordo al netto» se hai il compenso lordo, «Dal netto al lordo» se parti da quanto vuoi incassare.',
  'guide.calcolo-ritenuta-acconto.step.3': 'Scrivi l\'importo (per esempio 1.000,00) e controlla la «Ritenuta d\'acconto (%)», che si può modificare.',
  'guide.calcolo-ritenuta-acconto.step.4': 'In «Dati del documento» aggiungi se serve la rivalsa INPS 4%, la cassa previdenziale, l\'aliquota IVA e il bollo da 2 €.',
  'guide.calcolo-ritenuta-acconto.step.5': 'Nel «Prospetto» trovi ogni riga, dal compenso lordo al «Netto a pagare»; in «Da sapere» ci sono le note sul calcolo.',
  'guide.calcolo-ritenuta-acconto.q.1': 'Che cos\'è la ritenuta d\'acconto?',
  'guide.calcolo-ritenuta-acconto.a.1':
    'È una quota del compenso che chi paga (il sostituto d\'imposta) trattiene e versa al fisco per conto di chi riceve. Chi incassa riceve quindi il compenso lordo meno la ritenuta; lo strumento propone il 20%, ma la percentuale si può cambiare.',
  'guide.calcolo-ritenuta-acconto.q.2': 'Come si calcola il netto di una prestazione occasionale?',
  'guide.calcolo-ritenuta-acconto.a.2':
    'Il netto è il compenso lordo meno la ritenuta. Con un compenso di 1.000 euro e ritenuta al 20% la ritenuta è di 200 euro e il netto a pagare è di 800 euro.',
  'guide.calcolo-ritenuta-acconto.q.3': 'La ritenuta si calcola anche su rivalsa INPS e cassa previdenziale?',
  'guide.calcolo-ritenuta-acconto.a.3':
    'Sulla rivalsa INPS dipende dal caso: lo strumento ti lascia scegliere con «La ritenuta si applica anche alla rivalsa INPS». Sul contributo della cassa previdenziale la ritenuta non si calcola.',
  'guide.calcolo-ritenuta-acconto.q.4': 'Quando e come si versa la ritenuta?',
  'guide.calcolo-ritenuta-acconto.a.4':
    'Con il modello F24, entro il 16 del mese successivo a quello del pagamento: codice tributo 1040 per i professionisti e 1038 per le prestazioni occasionali. Va poi certificata con la Certificazione Unica.',
  'guide.calcolo-ritenuta-acconto.q.5': 'Che cosa fa «Dal netto al lordo»?',
  'guide.calcolo-ritenuta-acconto.a.5':
    'Parte dal netto che vuoi incassare e ricava il compenso lordo da indicare. Con gli arrotondamenti al centesimo il netto esatto potrebbe non essere raggiungibile: lo strumento mostra il più vicino e la differenza.',
  'guide.calcolo-ritenuta-acconto.q.6': 'È un calcolo che posso considerare definitivo?',
  'guide.calcolo-ritenuta-acconto.a.6':
    'No, è un calcolo indicativo e non sostituisce la consulenza fiscale: se hai dubbi su ritenuta, cassa o regime, verifica con il tuo commercialista.',
  'guide.calcolo-ritenuta-acconto.privacy':
    'Gli importi restano nel tuo browser e non vengono inviati. Se usi il pulsante di condivisione, i dati inseriti finiscono nell\'indirizzo del link, dopo il simbolo #: quella parte non arriva a nessun server, ma la vede chi riceve il link.',
};

const it = {
  ...guideIt,
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

const en: Omit<typeof it, keyof typeof guideIt> = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const RITENUTA_DICTIONARIES: ToolDictionaries = { it, en };
