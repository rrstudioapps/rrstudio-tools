// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { TOOLS } from '../tools/tools.registry';
import { ToolHandoff } from './tool-handoff';

/** Avviso discreto "Ricevuto da <strumento>" mostrato in cima alla pagina di destinazione (sparisce alla navigazione successiva). */
@Component({
  selector: 'app-handoff-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" role="status" aria-live="polite">
      @if (text(); as t) {
        <p class="notice">{{ t }}</p>
      }
    </div>
  `,
  styles: `
    .wrap {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: 0 var(--gutter);
    }
    .notice {
      display: inline-block;
      margin: var(--space-3) 0 0;
      padding: 4px var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      color: var(--muted);
      font-size: var(--fs-sm);
    }
  `,
})
export class HandoffNotice {
  private readonly i18n = inject(I18nService);
  private readonly handoff = inject(ToolHandoff);
  protected readonly text = computed(() => {
    const r = this.handoff.received();
    const tool = r && TOOLS.find((t) => t.id === r.from);
    return tool ? this.i18n.t('send.received', { tool: this.i18n.t(tool.titleKey) }) : '';
  });
}
