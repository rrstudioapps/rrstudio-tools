// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, Signal, afterNextRender, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { writeClipboard } from './copy-button';
import { Icon } from './icon';
import { Schema, ShareData, ShareValue, buildShareUrl, parseHash } from './share-state';

/**
 * Pulsante "Copia link": mette lo stato dello strumento nell'hash dell'URL (`#s=…`, mai inviato al server),
 * aggiorna l'indirizzo con history.replaceState (nessuna navigazione) e copia il link negli appunti.
 * All'avvio, solo nel browser, legge l'hash e restituisce lo stato validato con `restored`.
 * L'URL non viene riscritto a ogni tasto: l'hash cambia solo alla pressione del pulsante.
 */
@Component({
  selector: 'app-share-link',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="share">
      <button type="button" class="btn small" data-testid="share-copy" [disabled]="disabled()" (click)="copy()">
        <app-icon [name]="copied() ? 'check' : 'link'" />
        {{ copied() ? i18n.t('share.copied') : i18n.t('share.copy') }}
      </button>
      <span class="note">{{ i18n.t('share.note') }}</span>
    </div>
    <div class="msg" role="status" aria-live="polite" data-testid="share-status">
      @if (message(); as m) {
        <span [class.warn]="m.warn">{{ i18n.t(m.key) }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .share {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }
    .note {
      color: var(--ink-2);
      font-size: var(--fs-sm);
    }
    .msg {
      min-height: 0;
      font-size: var(--fs-sm);
      color: var(--ink-2);
    }
    .msg .warn {
      color: var(--ink);
    }
    .msg:not(:empty) {
      margin-top: var(--space-2);
    }
  `,
})
export class ShareLink {
  protected readonly i18n = inject(I18nService);
  /** Id dello strumento (lo stesso del registry). */
  readonly toolId = input.required<string>();
  /** Tipi e valori ammessi per lo stato di questo strumento (file `<strumento>.share.ts`). */
  readonly schema = input.required<Schema>();
  /** Fornisce lo stato attuale: viene chiamata solo quando si preme il pulsante (niente lavoro a ogni tasto). */
  readonly state = input.required<() => ShareData>();
  readonly disabled = input(false);
  /** Stato letto e validato dall'hash all'avvio. */
  readonly restored = output<ShareData>();

  protected readonly copied = signal(false);
  protected readonly message = signal<{ key: 'share.invalid' | 'share.toolarge'; warn: true } | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    // afterNextRender gira solo nel browser, dopo l'idratazione: nel prerender l'hash non esiste
    afterNextRender(() => void this.readHash());
  }

  private async readHash(): Promise<void> {
    const r = await parseHash(this.toolId(), this.schema(), location.hash);
    if (r.kind === 'ok') this.restored.emit(r.state);
    else if (r.kind === 'invalid') this.message.set({ key: 'share.invalid', warn: true });
  }

  protected async copy(): Promise<void> {
    const r = await buildShareUrl(location.href, this.toolId(), this.state()());
    if (!r.ok) {
      this.message.set({ key: 'share.toolarge', warn: true });
      return;
    }
    this.message.set(null);
    // solo l'hash cambia, senza navigazione né nuove voci nella cronologia
    history.replaceState(history.state, '', r.url);
    await writeClipboard(r.url);
    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), 2000);
  }
}

/** Signal con valore condivisibile (lettura). */
export type ShareSource = Record<string, Signal<ShareValue>>;
/** Signal scrivibili (il valore arriva già validato dallo schema, quindi il tipo si fida). */
export type ShareTarget = Record<string, { set(v: never): void }>;

/** Stato attuale: i valori dei signal indicati, per chiave. */
export function snapshotShare(src: ShareSource): ShareData {
  const out: ShareData = {};
  for (const k of Object.keys(src)) out[k] = src[k]();
  return out;
}

/** Scrive nei signal i valori presenti nello stato letto dall'hash (le chiavi mancanti restano com'erano). */
export function applyShare(data: ShareData, target: ShareTarget): void {
  for (const k of Object.keys(target)) {
    if (Object.hasOwn(data, k)) target[k].set(data[k] as never);
  }
}
