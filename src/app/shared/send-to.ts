// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';
import { TOOLS } from '../tools/tools.registry';
import { HandoffKind, handoffTargets } from './handoff-targets';
import { Icon } from './icon';
import { ToolHandoff } from './tool-handoff';

/** Id degli strumenti nell'ordine del registry (serve a ordinare le voci del menu). */
const TOOL_ORDER = TOOLS.map((t) => t.id);

/**
 * Pulsante "Invia a…": menu con gli strumenti che accettano quel tipo di contenuto (escluso quello corrente).
 * Pattern disclosure come il menu dei preferiti: aria-expanded, voci raggiungibili con Tab e con le frecce,
 * Esc chiude e riporta il focus sul pulsante. Il contenuto passa per `ToolHandoff` (solo memoria) e si
 * naviga alla pagina dello strumento nella lingua corrente.
 */
@Component({
  selector: 'app-send-to',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocClick($event)',
    '(keydown.escape)': 'onEscape($event)',
    '(keydown.arrowdown)': 'move($event, 1)',
    '(keydown.arrowup)': 'move($event, -1)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    @if (targets().length) {
      <button
        #btn
        type="button"
        class="btn small"
        [disabled]="disabled()"
        data-shortcut="send"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        [attr.aria-label]="i18n.t('send.label')"
        (click)="toggle()"
      >
        <app-icon name="right" /> {{ i18n.t('send.btn') }}
      </button>
      @if (open()) {
        <div [id]="panelId" class="panel" role="group" [attr.aria-label]="i18n.t('send.menu')">
          @for (t of targets(); track t.id) {
            <button type="button" class="item" (click)="send(t.id, t.path)">
              <app-icon [name]="t.icon" /> {{ i18n.t(t.titleKey) }}
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      position: relative;
    }
    .panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 40;
      display: flex;
      flex-direction: column;
      min-width: 220px;
      max-width: min(320px, calc(100vw - 2 * var(--gutter)));
      max-height: min(60vh, 420px);
      overflow-y: auto;
      padding: var(--space-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
      box-shadow: 0 12px 32px rgb(0 0 0 / 14%);
    }
    .item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 7px var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: var(--fs-sm);
      text-align: left;
      cursor: pointer;
      &:hover,
      &:focus-visible {
        background: var(--surface-2, rgb(127 127 127 / 12%));
      }
    }
  `,
})
export class SendTo {
  private static nextId = 0;
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly handoff = inject(ToolHandoff);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly btn = viewChild<ElementRef<HTMLButtonElement>>('btn');
  protected readonly panelId = `send-to-panel-${SendTo.nextId++}`;
  protected readonly open = signal(false);

  /** Id dello strumento di partenza. */
  readonly from = input.required<string>();
  readonly kind = input<HandoffKind>('text');
  /** Contenuto per i tipi testuali (text, json, csv, svg). */
  readonly text = input('');
  /** Per image e files: i file da inviare, calcolati al clic (possono richiedere un'elaborazione). */
  readonly files = input<(() => File[] | Promise<File[]>) | null>(null);
  readonly disabled = input(false);

  protected readonly targets = computed(() => {
    const ids = handoffTargets(this.kind(), this.from(), TOOL_ORDER);
    return ids.map((id) => TOOLS.find((t) => t.id === id)!).filter((t) => !(this.i18n.lang() === 'en' && t.italyOnly));
  });

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected async send(to: string, path: string): Promise<void> {
    this.open.set(false);
    const kind = this.kind();
    const isText = kind === 'text' || kind === 'json' || kind === 'csv' || kind === 'svg';
    const files = isText ? undefined : await this.files()?.();
    const ok = this.handoff.offer({ kind, from: this.from(), ...(isText ? { text: this.text() } : { files }) }, to);
    if (ok) await this.router.navigateByUrl(this.i18n.link(path));
  }

  protected onEscape(e: Event): void {
    if (!this.open()) return;
    e.stopPropagation();
    this.open.set(false);
    this.btn()?.nativeElement.focus();
  }

  protected onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) this.open.set(false);
  }

  /** Frecce su/giù: sposta il focus tra pulsante e voci del menu. */
  protected move(e: Event, step: number): void {
    if (!this.open()) return;
    const items = [this.btn()!.nativeElement, ...Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.item'))];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = items[Math.min(items.length - 1, Math.max(0, i + step))];
    e.preventDefault();
    next.focus();
  }
}
