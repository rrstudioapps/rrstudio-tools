// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pannello etichettato per input/output dei tool: etichetta mono + azioni in alto,
 * contenuto (di solito una textarea) al centro, riga di metadati (contatori) in basso.
 * La textarea proiettata deve avere `id` uguale a `inputId` (un elemento non form può usare
 * `aria-labelledby="<inputId>-label"`).
 */
@Component({
  selector: 'app-io-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <label class="eyebrow" [attr.id]="inputId() + '-label'" [attr.for]="inputId()">{{ label() }}</label>
      <span class="actions"><ng-content select="[panel-actions]" /></span>
    </div>
    <ng-content />
    @if (meta()) {
      <p class="meta">{{ meta() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 32px;
    }
    .actions {
      display: inline-flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .meta {
      margin: 0;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--muted);
    }
  `,
})
export class IoPanel {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly meta = input('');
}
