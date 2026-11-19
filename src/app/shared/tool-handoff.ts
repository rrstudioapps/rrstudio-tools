// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Injectable, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { HandoffPayload, accepts, isValidPayload } from './handoff-targets';

/** Dopo quanto un contenuto non preso viene scartato, a navigazione finita. */
const EXPIRY_MS = 3000;

/** Contenuto ricevuto da un altro strumento: serve per l'avviso "Ricevuto da …". */
export interface Received {
  from: string;
  /** Numero di navigazioni concluse quando il contenuto è stato preso (dopo l'attivazione dello strumento). */
  navAt: number;
}

/**
 * Tiene IN MEMORIA un solo contenuto in attesa tra uno strumento e il successivo. Niente localStorage,
 * sessionStorage, IndexedDB né URL: si perde al ricaricamento ed è voluto (privacy).
 * Viene consegnato una sola volta (take-and-clear). Lo strumento di destinazione si crea DOPO l'evento NavigationEnd,
 * quindi il contenuto non può scadere lì: scade con la navigazione successiva, se questa fallisce o dopo pochi secondi.
 */
@Injectable({ providedIn: 'root' })
export class ToolHandoff {
  private pending: { payload: HandoffPayload; to: string } | null = null;
  private navCount = 0;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  /** Ultimo contenuto consegnato: lo mostra l'avviso globale, che sparisce alla navigazione dopo. */
  readonly received = signal<Received | null>(null);

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.navCount++;
        const r = this.received();
        if (r && this.navCount > r.navAt) this.received.set(null);
        // la navigazione verso il destinatario è finita: ciò che non viene preso a breve scade
        if (this.pending) {
          this.endedWithPending = true;
          clearTimeout(this.expiry);
          this.expiry = setTimeout(() => (this.pending = null), EXPIRY_MS);
        }
      }
      if (e instanceof NavigationCancel || e instanceof NavigationError) this.clearPending();
      // una nuova navigazione dopo la fine di quella verso il destinatario: il contenuto in attesa è scaduto
      if (e instanceof NavigationStart && this.endedWithPending) this.clearPending();
    });
  }

  /** Vero se è già finita una navigazione da quando il contenuto è in attesa. */
  private endedWithPending = false;

  private clearPending(): void {
    clearTimeout(this.expiry);
    this.pending = null;
    this.endedWithPending = false;
  }

  /** Mette il contenuto in attesa per lo strumento `to` (sostituisce quello eventualmente già in attesa). */
  offer(payload: HandoffPayload, to: string): boolean {
    if (!isValidPayload(payload) || !accepts(to, payload.kind)) return false;
    clearTimeout(this.expiry);
    this.endedWithPending = false;
    this.pending = { payload, to };
    this.received.set(null);
    return true;
  }

  /** Consegna una sola volta il contenuto destinato a `toolId`, se c'è ed è compatibile; altrimenti null. */
  take(toolId: string): HandoffPayload | null {
    const p = this.pending;
    if (!p || p.to !== toolId) return null;
    this.clearPending();
    this.received.set({ from: p.payload.from, navAt: this.navCount });
    return p.payload;
  }

  /** Vero se c'è un contenuto in attesa (per i test). */
  get hasPending(): boolean {
    return this.pending !== null;
  }
}
