// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANGELOG_SLUG } from '../core/i18n/lang-routing';
import { I18nService } from '../core/i18n/i18n.service';
import { PwaService } from '../core/pwa/pwa.service';
import { OfflineDialog } from './offline-dialog';
import { APPS_URL, GITHUB_PROFILE_URL, KOFI_URL, LICENSE_URL, PREMIUM_URL, REPO_URL } from '../core/links';
import { feedbackUrl } from './tool-feedback-url';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, OfflineDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly i18n = inject(I18nService);
  protected readonly pwa = inject(PwaService);
  protected readonly kofi = KOFI_URL;
  protected readonly premium = PREMIUM_URL;
  protected readonly apps = APPS_URL;
  protected readonly github = GITHUB_PROFILE_URL;
  protected readonly license = LICENSE_URL;
  // il link al codice sorgente resta sempre visibile: la AGPL chiede di offrirlo a chi usa il sito
  protected readonly repo = REPO_URL;
  /** Modulo "nuovo strumento" (senza id né pagina dello strumento: solo lingua e URL canonico della pagina corrente). */
  protected readonly changelogSlug = computed(() => CHANGELOG_SLUG[this.i18n.lang()]);
  protected readonly suggest = computed(() =>
    feedbackUrl('new-tool', { slug: this.i18n.slug(), lang: this.i18n.lang() }),
  );
}
