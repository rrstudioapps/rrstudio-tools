// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Intake, SmartIntake } from '../shared/smart-intake';
import { SharedData, composeShared } from '../shared/smart-targets';

type Status = 'idle' | 'waiting' | 'received' | 'empty' | 'retry';

/** Quanto si aspetta la risposta del service worker prima di invitare a riprovare. */
const CLAIM_TIMEOUT_MS = 5000;

/** Minima parte dell'API File Handling che ci serve (non è nei tipi di TypeScript). */
interface LaunchParams {
  files: { getFile(): Promise<File> }[];
}
interface LaunchQueue {
  setConsumer(cb: (params: LaunchParams) => void): void;
}

/**
 * Ricezione di ciò che arriva da fuori: condivisione dal sistema (Web Share Target, il service worker tiene il
 * contenuto solo in memoria e qui lo si reclama con un messaggio) e file aperti con l'app (File Handling,
 * `launchQueue`). Poi la stessa scelta degli strumenti dell'incolla e del trascinamento. Nulla viene salvato.
 */
@Component({
  selector: 'app-share-page',
  imports: [SmartIntake],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container share rise">
      <header class="intro">
        <p class="eyebrow">{{ i18n.t('share.eyebrow') }}</p>
        <h1>{{ i18n.t('share.title') }}</h1>
        <p class="lead">{{ i18n.t('share.lead') }}</p>
      </header>
      <p class="status" role="status" aria-live="polite">{{ statusText() }}</p>
      <app-smart-intake [incoming]="incoming()" />
    </div>
  `,
  styles: `
    .share {
      padding-top: var(--space-6);
      padding-bottom: var(--space-7);
    }
    .intro h1 {
      margin: var(--space-3) 0;
    }
    .lead {
      color: var(--ink-2);
      max-width: 60ch;
    }
    .status {
      min-height: 1.5em;
      margin: 0 0 var(--space-4);
      color: var(--muted);
    }
  `,
})
export class SharePage {
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly incoming = signal<Intake | null>(null);
  private readonly status = signal<Status>('idle');

  protected readonly statusText = computed(() => {
    switch (this.status()) {
      case 'waiting':
        return this.i18n.t('share.waiting');
      case 'received':
        return this.i18n.t('share.received');
      case 'empty':
        return this.i18n.t('share.empty');
      case 'retry':
        return this.i18n.t('share.retry');
      default:
        return '';
    }
  });

  constructor() {
    afterNextRender(() => {
      this.listenLaunchQueue();
      const params = new URLSearchParams(location.search);
      if (params.has('retry')) this.status.set('retry');
      else if (params.has('received')) void this.claimShared();
    });
  }

  /** File Handling: i file con cui l'utente ha aperto l'app arrivano da `launchQueue`. */
  private listenLaunchQueue(): void {
    const lq = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
    if (!lq) return;
    lq.setConsumer((params) => {
      if (!params.files?.length) return;
      void Promise.all(params.files.map((h) => h.getFile()))
        .then((files) => this.take({ files }))
        .catch(() => this.status.set('retry'));
    });
  }

  /** Chiede al service worker il contenuto condiviso (che lo consegna una sola volta) e lo mostra. */
  private async claimShared(): Promise<void> {
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    if (!sw) {
      this.status.set('retry');
      return;
    }
    this.status.set('waiting');
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string } & SharedData;
      if (m?.type === 'share-data') this.take(m);
      else if (m?.type === 'share-none') this.status.set('empty');
      else return;
      done();
    };
    const timer = setTimeout(() => {
      if (this.status() === 'waiting') this.status.set('retry');
      done();
    }, CLAIM_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      sw.removeEventListener('message', onMessage);
    };
    sw.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(done);
    try {
      const reg = await sw.ready;
      (sw.controller ?? reg.active)?.postMessage({ type: 'share-claim' });
    } catch {
      this.status.set('retry');
      done();
    }
  }

  private take(d: SharedData): void {
    const intake = composeShared(d);
    if (!intake) {
      this.status.set('empty');
      return;
    }
    this.incoming.set(intake);
    this.status.set('received');
    // l'indirizzo non deve restare "in attesa": un ricaricamento non cerca di nuovo un contenuto che non c'è più
    try {
      history.replaceState(history.state, '', location.pathname);
    } catch {
      /* ininfluente */
    }
  }
}
