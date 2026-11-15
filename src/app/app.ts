// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { SeoService } from './core/seo/seo.service';
import { ThemeService } from './core/theme/theme.service';
import { Footer } from './shared/footer';
import { Header } from './shared/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#main">{{ i18n.t('nav.skip') }}</a>
    <app-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    main {
      flex: 1;
      outline: none;
    }
    .skip {
      position: absolute;
      left: -999px;
      top: 0.5rem;
      z-index: 50;
      background: var(--primary);
      color: var(--on-primary);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      &:focus {
        left: 0.5rem;
      }
    }
  `,
})
export class App {
  protected readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  constructor() {
    inject(SeoService); // avvia l'ascolto della navigazione per title/meta
    // Preferenze (lingua, tema) lette solo nel browser, dopo l'idratazione
    afterNextRender(() => {
      this.i18n.initFromBrowser();
      this.theme.initFromBrowser();
    });
  }
}
