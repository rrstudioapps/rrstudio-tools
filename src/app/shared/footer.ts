// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { APPS_URL, GITHUB_PROFILE_URL, KOFI_URL, LICENSE_URL, PREMIUM_URL, REPO_URL } from '../core/links';

@Component({
  selector: 'app-footer',
  
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly i18n = inject(I18nService);
  protected readonly kofi = KOFI_URL;
  protected readonly premium = PREMIUM_URL;
  protected readonly apps = APPS_URL;
  protected readonly github = GITHUB_PROFILE_URL;
  protected readonly license = LICENSE_URL;
  // il link al codice sorgente resta sempre visibile: la AGPL chiede di offrirlo a chi usa il sito
  protected readonly repo = REPO_URL;
}
