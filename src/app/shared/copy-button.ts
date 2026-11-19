// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';

/** Pulsante "Copia" con conferma "Copiato" per 1,5 secondi (annunciata ai lettori di schermo). */
@Component({
  selector: 'app-copy-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn small"
      [class.compact]="compact()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.data-shortcut]="shortcut() || null"
      [attr.title]="compact() ? (ariaLabel() || i18n.t('common.copy')) : null"
      (click)="copy()"
    >
      <app-icon [name]="copied() ? 'check' : 'copy'" />
      @if (!compact()) {
        {{ copied() ? i18n.t('common.copied') : (label() || i18n.t('common.copy')) }}
      }
    </button>
    <span class="visually-hidden" role="status" aria-live="polite">{{ copied() ? i18n.t('common.copied') : '' }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .btn.compact {
      width: 32px;
      padding: 0;
    }
  `,
})
export class CopyButton {
  protected readonly i18n = inject(I18nService);
  /** Testo da copiare (può essere più lungo di quello mostrato a schermo). */
  readonly text = input.required<string>();
  readonly label = input('');
  /** Solo icona (per le tabelle): serve `ariaLabel` per distinguere i pulsanti. */
  readonly compact = input(false);
  readonly ariaLabel = input('');
  readonly disabled = input(false);
  /** Azione di scorciatoia da tastiera (di solito "copy"): marca il pulsante principale dello strumento. */
  readonly shortcut = input('');
  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(): Promise<void> {
    if (!(await writeClipboard(this.text()))) return;
    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), 1500);
  }
}

/** Clipboard API, con ripiego su execCommand dove non è disponibile (contesti non sicuri). */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* copia non riuscita */
    }
    ta.remove();
    return ok;
  }
}
