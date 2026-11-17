// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FavoritesService } from '../core/favorites/favorites.service';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';

/**
 * Stella "Aggiungi ai preferiti" (pulsante a due stati con aria-pressed). Il nome accessibile non cambia
 * con lo stato: lo annuncia aria-pressed. Nel prerender non è mai premuto (i dati si leggono nel browser).
 */
@Component({
  selector: 'app-favorite-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="star"
      [class.on]="pressed()"
      [attr.aria-pressed]="pressed()"
      [attr.aria-label]="name()"
      [attr.title]="name()"
      [disabled]="!favs.ready()"
      (click)="favs.toggle(toolId())"
    >
      <app-icon name="star" [stroke]="1.6" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .star {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      font-size: 18px;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--bg);
      color: var(--muted);
      cursor: pointer;
      transition:
        border-color var(--dur) var(--ease),
        color var(--dur) var(--ease);
      &:hover:not(:disabled) {
        border-color: var(--ink);
        color: var(--ink);
      }
      &.on {
        color: var(--ink);
        border-color: var(--ink);
      }
      &.on ::ng-deep svg {
        fill: currentColor;
      }
      &:disabled {
        cursor: default;
        opacity: 0.6;
      }
    }
  `,
})
export class FavoriteButton {
  protected readonly favs = inject(FavoritesService);
  private readonly i18n = inject(I18nService);
  /** Id dello strumento. */
  readonly toolId = input.required<string>();
  /** Titolo dello strumento, aggiunto al nome accessibile quando ci sono più stelle nella pagina (card). */
  readonly toolTitle = input('');
  protected readonly pressed = computed(() => this.favs.favoriteSet().has(this.toolId()));
  protected readonly name = computed(() => {
    const base = this.i18n.t('fav.add');
    const t = this.toolTitle();
    return t ? `${base}: ${t}` : base;
  });
}
