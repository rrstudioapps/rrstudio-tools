// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';

const DISMISS_KEY = 'rrtools.hint.en';

/**
 * Suggerimento discreto (non un redirect): a chi ha il browser in una lingua diversa dall'italiano
 * e apre una pagina italiana che ha la versione inglese. Solo nel browser, mai nel prerender;
 * la chiusura è ricordata in localStorage.
 */
@Component({
  selector: 'app-lang-hint',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible(); as target) {
      <div class="hint" role="region" lang="en" aria-label="Language">
        <span>This page is also available in English →</span>
        <a [routerLink]="target" hreflang="en" (click)="dismiss()">English version</a>
        <button type="button" class="close" aria-label="Close" (click)="dismiss()">×</button>
      </div>
    }
  `,
  styles: `
    .hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: 6px var(--space-4);
      background: var(--surface, var(--bg));
      border-bottom: 1px solid var(--line);
      color: var(--ink-2);
      font-size: var(--fs-sm);
    }
    a {
      color: var(--ink);
      font-weight: var(--fw-bold);
    }
    .close {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 1.25rem;
      line-height: 1;
      padding: 0 var(--space-2);
      cursor: pointer;
      &:hover {
        color: var(--ink);
      }
    }
  `,
})
export class LangHint {
  private readonly i18n = inject(I18nService);
  /** Solo dopo il primo render nel browser: così non finisce nel prerender né nell'idratazione. */
  private readonly ready = signal(false);
  private readonly dismissed = signal(false);
  private readonly foreign = signal(false);

  /** Percorso della versione inglese, o null se la barra non va mostrata. */
  protected readonly visible = computed(() => {
    if (!this.ready() || this.dismissed() || !this.foreign() || this.i18n.lang() !== 'it') return null;
    return this.i18n.otherPath();
  });

  constructor() {
    afterNextRender(() => {
      const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
      this.foreign.set(!nav.toLowerCase().startsWith('it'));
      try {
        this.dismissed.set(localStorage.getItem(DISMISS_KEY) === '1');
      } catch {
        /* localStorage non disponibile: la barra riappare a ogni visita */
      }
      this.ready.set(true);
    });
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* chiusura non ricordata */
    }
  }
}
