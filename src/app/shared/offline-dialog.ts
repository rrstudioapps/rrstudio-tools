// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { PwaService } from '../core/pwa/pwa.service';

/**
 * Pannello "Usa offline" (dialog nativo modale: focus intrappolato, Esc per chiudere).
 * Spiega cosa viene salvato, permette di scaricare tutto il sito, mostra l'avanzamento e svuota la cache.
 */
@Component({
  selector: 'app-offline-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg aria-labelledby="offline-title" (click)="onBackdrop($event)">
      <div class="head">
        <h2 id="offline-title">{{ i18n.t('pwa.title') }}</h2>
        <button type="button" class="close" [attr.aria-label]="i18n.t('pwa.close')" (click)="close()">×</button>
      </div>
      <p>{{ i18n.t('pwa.intro') }}</p>

      @if (!pwa.supported()) {
        <p class="muted">{{ i18n.t('pwa.unsupported') }}</p>
      } @else if (!pwa.status()) {
        <p class="muted">{{ i18n.t('pwa.starting') }}</p>
      } @else {
        @if (pwa.progress(); as p) {
          <p>{{ i18n.t('pwa.downloading', { done: p.done, total: p.total }) }}</p>
          <progress [attr.aria-label]="i18n.t('pwa.progress')" [max]="p.total" [value]="p.done"></progress>
          <div class="actions">
            <button type="button" class="btn small" (click)="pwa.cancelDownload()">{{ i18n.t('pwa.cancel') }}</button>
          </div>
        } @else if (pwa.offlineReady()) {
          <p class="ready"><strong>✓ {{ i18n.t('pwa.ready') }}</strong> {{ i18n.t('pwa.readyText') }}</p>
          <p class="muted">{{ i18n.t('pwa.auto') }}</p>
        } @else {
          @if (pwa.status(); as s) {
            @if (s.cached > 0) {
              <p class="muted">{{ i18n.t('pwa.partial', { cached: s.cached, total: s.total }) }}</p>
            }
            <p class="muted">{{ i18n.t('pwa.size', { size: sizeLabel() }) }}</p>
          }
          <div class="actions">
            <button type="button" class="btn small primary" [disabled]="!pwa.online()" (click)="pwa.download()">
              {{ i18n.t('pwa.download') }}
            </button>
          </div>
        }
        @if (!pwa.progress() && (pwa.status()?.cached ?? 0) > 0) {
          <div class="actions">
            <button type="button" class="btn small" (click)="pwa.clear()">{{ i18n.t('pwa.clear') }}</button>
          </div>
        }
        <p class="notice" role="status" aria-live="polite">
          @switch (pwa.notice()) {
            @case ('cancelled') {
              {{ i18n.t('pwa.cancelled') }}
            }
            @case ('error') {
              {{ i18n.t('pwa.error') }}
            }
            @case ('cleared') {
              {{ i18n.t('pwa.cleared') }}
            }
          }
        </p>
      }
    </dialog>
  `,
  styles: `
    dialog {
      width: min(32rem, calc(100vw - 2 * var(--space-4)));
      padding: var(--space-5);
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 45%);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    p {
      margin: var(--space-3) 0 0;
      line-height: 1.5;
    }
    .muted {
      color: var(--ink-2);
    }
    .ready strong {
      color: var(--ink);
    }
    .close {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 1.5rem;
      line-height: 1;
      padding: 0 var(--space-2);
      cursor: pointer;
      &:hover {
        color: var(--ink);
      }
    }
    progress {
      display: block;
      width: 100%;
      height: 10px;
      margin-top: var(--space-3);
      accent-color: var(--ink);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
    .notice:empty {
      display: none;
    }
  `,
})
export class OfflineDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly pwa = inject(PwaService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** Peso stimato del download, in MB nel formato della lingua. */
  protected readonly sizeLabel = computed(() => {
    const bytes = this.pwa.status()?.size ?? 0;
    const mb = bytes / 1048576;
    return `${mb.toLocaleString(this.i18n.locale(), { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  });

  open(): void {
    this.pwa.refresh();
    const d = this.dlg().nativeElement;
    if (!d.open) d.showModal();
  }

  close(): void {
    this.dlg().nativeElement.close();
  }

  /** Un clic sullo sfondo (il dialog stesso, non il contenuto) chiude il pannello. */
  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.close();
  }
}
