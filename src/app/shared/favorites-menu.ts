// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { FavoritesService } from '../core/favorites/favorites.service';
import { FAVORITES_SLUG } from '../core/i18n/lang-routing';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';

/**
 * Voce "Preferiti" dell'intestazione con pannello a comparsa (pattern disclosure: il pulsante ha
 * aria-expanded e aria-controls, il pannello contiene normali link raggiungibili con Tab).
 * Esc chiude e riporta il focus sul pulsante; si chiude anche con un clic fuori, uscendo con Tab o navigando.
 */
@Component({
  selector: 'app-favorites-menu',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocClick($event)',
    '(keydown.escape)': 'onEscape($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <button
      #btn
      type="button"
      class="trigger"
      [attr.aria-expanded]="open()"
      aria-controls="fav-menu-panel"
      (click)="toggle()"
    >
      <app-icon name="star" [stroke]="1.6" />
      <span class="txt">{{ i18n.t('fav.menu') }}</span>
    </button>
    @if (open()) {
      <div id="fav-menu-panel" class="panel" role="region" [attr.aria-label]="i18n.t('fav.menu.label')">
        @if (favs.isEmpty()) {
          <p class="empty">{{ i18n.t('fav.menu.empty') }}</p>
        } @else {
          @if (favs.favoriteTools().length) {
            <h2 class="h">{{ i18n.t('fav.menu.favs') }}</h2>
            <ul class="list">
              @for (t of favs.favoriteTools(); track t.id) {
                <li><a [routerLink]="i18n.link(t.path)" (click)="close()">{{ i18n.t(t.titleKey) }}</a></li>
              }
            </ul>
          }
          @for (g of favs.groups(); track g.id) {
            @if (g.tools.length) {
              <h2 class="h">{{ g.name }}</h2>
              <ul class="list">
                @for (t of g.tools; track t.id) {
                  <li><a [routerLink]="i18n.link(t.path)" (click)="close()">{{ i18n.t(t.titleKey) }}</a></li>
                }
              </ul>
            }
          }
        }
        <a class="manage" [routerLink]="i18n.link(manageSlug())" (click)="close()">{{ i18n.t('fav.menu.manage') }}</a>
      </div>
    }
  `,
  styleUrl: './favorites-menu.scss',
})
export class FavoritesMenu {
  protected readonly i18n = inject(I18nService);
  protected readonly favs = inject(FavoritesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly btn = viewChild.required<ElementRef<HTMLButtonElement>>('btn');
  protected readonly open = signal(false);

  constructor() {
    // chiude il pannello a ogni navigazione (anche con indietro/avanti)
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.open.set(false);
      });
  }

  protected manageSlug(): string {
    return FAVORITES_SLUG[this.i18n.lang()];
  }

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onEscape(e: Event): void {
    if (!this.open()) return;
    e.stopPropagation();
    this.open.set(false);
    this.btn().nativeElement.focus();
  }

  protected onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  /** Il focus esce dal componente (Tab oltre l'ultimo link o Maiusc+Tab prima del pulsante): chiude. */
  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) this.open.set(false);
  }
}
