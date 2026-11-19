// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { BOLLO_CENTS, BOLLO_THRESHOLD_CENTS, RIVALSA_INPS_BP, percentOf } from '../calcolo-iva/iva';

/**
 * Ritenuta d'acconto su prestazioni occasionali e parcelle di professionisti.
 * Importi interi in CENTESIMI, percentuali in PUNTI BASE (20% = 2000): nessun errore di virgola mobile.
 * Arrotondamento al centesimo, "mezzo in su", applicato a ogni riga (come in fattura).
 *
 * Strumento indicativo, non consulenza fiscale.
 */

export interface RitenutaInput {
  /** Compenso lordo (imponibile) in centesimi. */
  compenso: number;
  /** Ritenuta d'acconto in punti base (di norma 2000; 0 = nessuna). */
  ritenutaBp: number;
  /** Rivalsa INPS 4% sul compenso. */
  rivalsa: boolean;
  /** Contributo cassa previdenziale in punti base (0 = nessuno), calcolato sul compenso. */
  cassaBp: number;
  /** Aliquota IVA in punti base (0 per forfettari e prestazioni occasionali). */
  vatBp: number;
  /** La ritenuta si applica anche alla rivalsa INPS (di default sì; la cassa ne resta sempre fuori). */
  ritenutaOnRivalsa: boolean;
  /** Il bollo da 2 € è addebitato al cliente (e sommato al totale) invece di restare a carico di chi emette. */
  bolloCharged: boolean;
}

export interface RitenutaResult {
  compenso: number;
  rivalsa: number;
  cassa: number;
  /** Compenso + rivalsa + cassa. */
  imponibile: number;
  vat: number;
  /** Bollo dovuto (anche se non addebitato): 0 se non scatta. */
  bolloDue: number;
  /** Bollo effettivamente sommato al totale. */
  bollo: number;
  /** Compenso + rivalsa + cassa + IVA + bollo addebitato. */
  totale: number;
  ritenutaBase: number;
  ritenuta: number;
  /** Quanto incassa chi emette (totale meno ritenuta). */
  netto: number;
}

export function computeRitenuta(i: RitenutaInput): RitenutaResult {
  const compenso = i.compenso;
  const rivalsa = i.rivalsa ? percentOf(compenso, RIVALSA_INPS_BP) : 0;
  const cassa = percentOf(compenso, i.cassaBp);
  const imponibile = compenso + rivalsa + cassa;
  const vat = percentOf(imponibile, i.vatBp);
  // il bollo vale per le operazioni senza IVA sopra 77,47 € (art. 13 tariffa DPR 642/1972)
  const bolloDue = i.vatBp === 0 && imponibile > BOLLO_THRESHOLD_CENTS ? BOLLO_CENTS : 0;
  const bollo = i.bolloCharged ? bolloDue : 0;
  const totale = imponibile + vat + bollo;
  const ritenutaBase = compenso + (i.ritenutaOnRivalsa ? rivalsa : 0);
  const ritenuta = percentOf(ritenutaBase, i.ritenutaBp);
  return { compenso, rivalsa, cassa, imponibile, vat, bolloDue, bollo, totale, ritenutaBase, ritenuta, netto: totale - ritenuta };
}

export interface ReverseRitenuta {
  result: RitenutaResult;
  /** Netto ottenuto meno netto desiderato, in centesimi (0 = esatto). */
  difference: number;
}

/**
 * Dal netto desiderato al compenso lordo. Stima algebrica e poi ricerca del compenso che dà il netto più vicino
 * (gli arrotondamenti al centesimo e il salto del bollo rendono a volte impossibile il netto esatto).
 * A parità di distanza vince il compenso più basso. null se il netto non è positivo.
 */
export function solveFromNet(targetNet: number, base: Omit<RitenutaInput, 'compenso'>): ReverseRitenuta | null {
  if (!(targetNet > 0)) return null;
  const probe = 10_000_000; // 100.000 €: abbastanza grande da rendere trascurabile ogni arrotondamento
  const ref = computeRitenuta({ ...base, compenso: probe, bolloCharged: false });
  const ratio = ref.netto / probe;
  if (!(ratio > 0)) return null;
  const guess = Math.round(targetNet / ratio);
  let best: ReverseRitenuta | null = null;
  const from = Math.max(1, guess - 400);
  for (let c = from; c <= guess + 400; c++) {
    const result = computeRitenuta({ ...base, compenso: c });
    const difference = result.netto - targetNet;
    if (!best || Math.abs(difference) < Math.abs(best.difference)) best = { result, difference };
    if (difference === 0) break;
  }
  return best;
}
