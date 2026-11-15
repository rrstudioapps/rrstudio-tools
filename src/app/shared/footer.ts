// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { KOFI_URL, LICENSE_URL, PREMIUM_URL, REPO_URL } from '../core/links';

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
  protected readonly repo = REPO_URL;
  protected readonly license = LICENSE_URL;
}
