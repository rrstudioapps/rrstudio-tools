// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/** Nota "I tuoi dati restano sul tuo computer" da usare nei tool. */
@Component({
  selector: 'app-privacy-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="note" role="note">
      <span class="dot" aria-hidden="true"></span>
      <span><strong>{{ i18n.t('privacy.headline') }}.</strong> {{ i18n.t('privacy.short') }}</span>
    </p>
  `,
  styles: `
    .note {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
      padding-block: var(--space-3);
      border-block: 1px solid var(--line);
      color: var(--ink-2);
      font-size: var(--fs-sm);
    }
    .dot {
      flex: none;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--ink);
    }
    strong {
      color: var(--ink);
    }
  `,
})
export class PrivacyNote {
  protected readonly i18n = inject(I18nService);
}
