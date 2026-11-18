// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';
import { ShortcutsService } from './shortcuts.service';

/**
 * Pulsante "Scorciatoie" + pannello di aiuto (dialog nativo modale: focus intrappolato, Esc chiude e il focus
 * torna al pulsante). Elenca solo le azioni che lo strumento ha davvero (un pulsante marcato) e le scorciatoie globali.
 * Il pulsante non si mostra sui dispositivi touch (`pointer: coarse`), dove non servono.
 */
@Component({
  selector: 'app-shortcuts-help',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #opener
      type="button"
      class="btn small open"
      [attr.aria-label]="i18n.t('shortcuts.btn.aria')"
      aria-haspopup="dialog"
      aria-keyshortcuts="?"
      (click)="sc.openHelp()"
    >
      <app-icon name="keyboard" /> {{ i18n.t('shortcuts.btn') }}
    </button>
    <dialog #dlg aria-labelledby="shortcuts-title" (close)="onClose()" (click)="onBackdrop($event)">
      <div class="head">
        <h2 id="shortcuts-title">{{ i18n.t('shortcuts.title') }}</h2>
        <button type="button" class="close" [attr.aria-label]="i18n.t('shortcuts.close')" (click)="dlg.close()">×</button>
      </div>
      <h3>{{ i18n.t('shortcuts.tool') }}</h3>
      @if (items().length) {
        <dl>
          @for (it of items(); track it.action) {
            <div class="row">
              <dt>{{ i18n.t('shortcuts.' + it.action) }}</dt>
              <dd>@for (k of it.keys; track $index) {<kbd>{{ k }}</kbd>}@if (it.alt) { {{ i18n.t('shortcuts.or') }} @for (k of it.alt; track $index) {<kbd>{{ k }}</kbd>}}</dd>
            </div>
          }
        </dl>
      } @else {
        <p class="muted">{{ i18n.t('shortcuts.none') }}</p>
      }
      <h3>{{ i18n.t('shortcuts.global') }}</h3>
      <dl>
        <div class="row">
          <dt>{{ i18n.t('shortcuts.help') }}</dt>
          <dd><kbd>?</kbd></dd>
        </div>
        <div class="row">
          <dt>{{ i18n.t('shortcuts.esc') }}</dt>
          <dd><kbd>Esc</kbd></dd>
        </div>
        <div class="row">
          <dt>{{ i18n.t('shortcuts.search') }}</dt>
          <dd><kbd>/</kbd> {{ i18n.t('shortcuts.or') }} <kbd>{{ sc.mac() ? '⌘' : 'Ctrl' }}</kbd><kbd>K</kbd></dd>
        </div>
      </dl>
    </dialog>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    /* sui dispositivi touch (senza tastiera fisica) il pulsante non serve */
    @media (pointer: coarse) {
      .open {
        display: none;
      }
    }
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
    h3 {
      margin: var(--space-4) 0 var(--space-2);
      font-size: var(--fs-sm);
      color: var(--ink-2);
    }
    dl {
      margin: 0;
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      padding: 6px 0;
      border-top: 1px solid var(--line-soft);
    }
    dt {
      margin: 0;
    }
    dd {
      margin: 0;
      white-space: nowrap;
    }
    kbd {
      display: inline-block;
      min-width: 1.6em;
      margin-left: 4px;
      padding: 1px 6px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--bg);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      text-align: center;
    }
    .muted {
      color: var(--ink-2);
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
    @media print {
      :host {
        display: none;
      }
    }
  `,
})
export class ShortcutsHelp {
  protected readonly i18n = inject(I18nService);
  protected readonly sc = inject(ShortcutsService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');
  /** Azioni dello strumento, lette all'apertura (i pulsanti marcati possono comparire dopo). */
  protected readonly items = signal<{ action: string; keys: string[]; alt: string[] | null }[]>([]);

  constructor() {
    effect(() => {
      const open = this.sc.helpOpen();
      const d = this.dlg().nativeElement;
      if (open && !d.open) {
        this.items.set(this.sc.available());
        d.showModal();
      }
    });
  }

  protected onClose(): void {
    this.sc.helpOpen.set(false);
    this.opener().nativeElement.focus();
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}
