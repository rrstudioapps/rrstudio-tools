// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService, LANGS } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/theme/theme.service';
import { ChainsService } from '../core/chains/chains.service';
import { PaletteService } from './command-palette';
import { FavoritesMenu } from './favorites-menu';
import { Icon } from './icon';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Icon, FavoritesMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly langs = LANGS;
  protected readonly palette = inject(PaletteService);
  protected readonly chains = inject(ChainsService);
}
