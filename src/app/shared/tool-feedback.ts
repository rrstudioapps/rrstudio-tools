// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';
import { FeedbackKind, feedbackUrl } from './tool-feedback-url';

/**
 * Riquadro "Feedback" in fondo a ogni strumento (montato da tool-frame): tre link ai moduli di issue GitHub
 * precompilati con id dello strumento, lingua e URL canonico. Non invia nulla da solo: i link si aprono
 * solo al clic e non portano né hash né dati inseriti (vedi tool-feedback-url.ts).
 */
@Component({
  selector: 'app-tool-feedback',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="container fb" [attr.aria-label]="i18n.t('feedback.title')" data-testid="tool-feedback">
      <div class="box">
        <h2>{{ i18n.t('feedback.title') }}</h2>
        <ul>
          @for (l of links(); track l.kind) {
            <li>
              <a [href]="l.href" target="_blank" rel="noopener noreferrer" [attr.data-kind]="l.kind">
                {{ i18n.t(l.key) }}<app-icon name="external" /><span class="visually-hidden">
                  {{ i18n.t('feedback.newtab') }}</span>
              </a>
            </li>
          }
        </ul>
        <p class="note">{{ i18n.t('feedback.note') }}</p>
      </div>
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }
    .fb {
      padding-block: 0 var(--space-6);
    }
    .box {
      border-top: 1px solid var(--line);
      padding-top: var(--space-4);
      font-size: var(--fs-sm);
      color: var(--muted);
    }
    h2 {
      margin: 0 0 var(--space-2);
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--ink-2);
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-5);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    a {
      color: var(--ink-2);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    a app-icon {
      margin-inline-start: 4px;
      font-size: 0.85em;
      vertical-align: -2px;
    }
    .note {
      margin: var(--space-2) 0 0;
      max-width: 72ch;
    }
    @media print {
      :host {
        display: none;
      }
    }
  `,
})
export class ToolFeedback {
  protected readonly i18n = inject(I18nService);
  readonly toolId = input.required<string>();

  protected readonly links = computed(() => {
    const o = { toolId: this.toolId(), slug: this.i18n.slug(), lang: this.i18n.lang() };
    const mk = (kind: FeedbackKind, key: string) => ({ kind, key, href: feedbackUrl(kind, o) });
    return [
      mk('bug', 'feedback.bug'),
      mk('enhancement', 'feedback.idea'),
      mk('new-tool', 'feedback.newtool'),
    ];
  });
}
