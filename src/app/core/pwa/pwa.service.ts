// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ApplicationRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Stato della cache offline, come lo riporta il service worker. */
export interface OfflineStatus {
  version: string;
  /** Peso stimato del download completo, in byte (compresso). */
  size: number;
  total: number;
  cached: number;
  ready: boolean;
}

export interface DownloadProgress {
  done: number;
  total: number;
}

/** Avviso mostrato nel pannello dopo un'azione (annullato, errore, svuotata). */
export type OfflineNotice = 'cancelled' | 'error' | 'cleared' | null;

/**
 * Registra /sw.js e racconta alla UI cosa sta succedendo: supporto, attivazione, aggiornamento in attesa,
 * stato e avanzamento del download offline. Vive solo nel browser: nel prerender non fa nulla.
 * Il service worker conserva solo i file del sito (mai i dati degli strumenti).
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly appRef = inject(ApplicationRef);
  private registration?: ServiceWorkerRegistration;
  private started = false;
  private reloading = false;
  private sentLoaded = false;

  /** Il browser può usare un service worker (contesto sicuro) e la registrazione è partita. */
  readonly supported = signal(false);
  /** Il service worker è attivo. */
  readonly active = signal(false);
  /** Una nuova versione è installata e aspetta che l'utente la chieda. */
  readonly updateAvailable = signal(false);
  readonly online = signal(true);
  readonly status = signal<OfflineStatus | null>(null);
  /** Avanzamento del download completo; null quando non è in corso. */
  readonly progress = signal<DownloadProgress | null>(null);
  readonly notice = signal<OfflineNotice>(null);
  /** Tutto il sito è salvato nel browser. */
  readonly offlineReady = computed(() => this.status()?.ready === true);
  readonly downloading = computed(() => this.progress() !== null);

  /** Da chiamare una volta, solo nel browser (dopo il primo render). */
  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    this.online.set(navigator.onLine);
    addEventListener('online', () => this.online.set(true));
    addEventListener('offline', () => this.online.set(false));
    if (!('serviceWorker' in navigator) || !isSecureContext) return;
    // la registrazione aspetta che l'app sia stabile e la pagina caricata, per non competere con il caricamento
    // (se qualche attività resta in sospeso, dopo 5 s si registra comunque)
    const stable = Promise.race([this.appRef.whenStable(), new Promise<void>((r) => setTimeout(r, 5000))]);
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise<void>((r) => addEventListener('load', () => r(), { once: true }));
    void Promise.all([stable, loaded]).then(() => this.register());
  }

  private async register(): Promise<void> {
    try {
      const sw = navigator.serviceWorker;
      sw.addEventListener('message', (e) => this.onMessage(e.data));
      sw.startMessages();
      sw.addEventListener('controllerchange', () => {
        // ricarica solo se l'aggiornamento l'ha chiesto l'utente (la prima installazione non ricarica nulla)
        if (this.reloading) location.reload();
        else this.askStatus();
      });
      const reg = await sw.register('/sw.js', { scope: '/' });
      this.registration = reg;
      this.supported.set(true);
      this.watch(reg);
      void sw.ready.then(() => {
        this.active.set(true);
        this.askStatus();
        this.sendLoadedResources();
      });
    } catch {
      this.supported.set(false); // es. sviluppo con ng serve: nessun /sw.js
    }
  }

  private watch(reg: ServiceWorkerRegistration): void {
    const check = (): void => {
      // al primo avvio non c'è un controller: niente "aggiornamento", è la prima installazione
      if (reg.waiting && navigator.serviceWorker.controller) this.updateAvailable.set(true);
    };
    check();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed') check();
      });
    });
    // chi tiene la scheda aperta a lungo controlla ogni tanto se c'è una versione nuova
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
  }

  private target(): ServiceWorker | null {
    return navigator.serviceWorker.controller ?? this.registration?.active ?? null;
  }

  private post(msg: { type: string; [k: string]: unknown }): void {
    this.target()?.postMessage(msg);
  }

  private askStatus(): void {
    this.post({ type: 'status' });
  }

  /** Passa al service worker i file che la pagina ha già caricato (anche i chunk lazy della prima visita). */
  private sendLoadedResources(): void {
    if (this.sentLoaded) return;
    this.sentLoaded = true;
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin));
    this.post({ type: 'cache-urls', urls });
  }

  private onMessage(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const m = data as { type?: string } & Record<string, unknown>;
    switch (m['type']) {
      case 'status':
        this.status.set(m as unknown as OfflineStatus);
        if (!(m['downloading'] as boolean)) this.progress.set(null);
        break;
      case 'progress':
        this.progress.set({ done: m['done'] as number, total: m['total'] as number });
        break;
      case 'download-done':
        this.progress.set(null);
        this.notice.set(null);
        this.askStatus();
        break;
      case 'download-cancelled':
        this.progress.set(null);
        this.notice.set('cancelled');
        this.askStatus();
        break;
      case 'download-error':
        this.progress.set(null);
        this.notice.set('error');
        this.askStatus();
        break;
    }
  }

  /** Aggiorna lo stato (quando si apre il pannello). */
  refresh(): void {
    this.askStatus();
  }

  /** Scarica tutto il sito per l'uso offline. */
  download(): void {
    this.notice.set(null);
    const total = this.status()?.total ?? 0;
    this.progress.set({ done: this.status()?.cached ?? 0, total });
    this.post({ type: 'download' });
  }

  cancelDownload(): void {
    this.post({ type: 'cancel' });
  }

  /** Svuota la cache offline (pagine e file salvati). */
  clear(): void {
    this.progress.set(null);
    this.notice.set('cleared');
    this.post({ type: 'clear' });
  }

  /** Attiva la versione in attesa; alla comparsa del nuovo controller la pagina si ricarica. */
  applyUpdate(): void {
    const waiting = this.registration?.waiting;
    if (!waiting) return;
    this.reloading = true;
    waiting.postMessage({ type: 'skipWaiting' });
  }
}
