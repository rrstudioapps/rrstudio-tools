// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { PwaService } from '../core/pwa/pwa.service';

/**
 * Avvisi sobri in basso a sinistra, in una regione aria-live: "Sei offline" e "Nuova versione disponibile".
 * Il contenitore c'è sempre (anche nel prerender, vuoto) così gli annunci vengono letti quando compaiono.
 */
@Component({
  selector: 'app-pwa-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="status" aria-live="polite">
      @if (!pwa.online()) {
        <p class="toast">{{ i18n.t('pwa.offline') }}</p>
      }
      @if (pwa.updateAvailable()) {
        <p class="toast">
          <span>{{ i18n.t('pwa.update') }}</span>
          <button type="button" class="btn small primary" (click)="pwa.applyUpdate()">{{ i18n.t('pwa.updateAction') }}</button>
        </p>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      left: var(--space-4);
      bottom: var(--space-4);
      z-index: 40;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
      max-width: calc(100vw - 2 * var(--space-4));
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
      padding: var(--space-2) var(--space-4);
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
      box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
    }
  `,
})
export class PwaStatus {
  protected readonly i18n = inject(I18nService);
  protected readonly pwa = inject(PwaService);
}
