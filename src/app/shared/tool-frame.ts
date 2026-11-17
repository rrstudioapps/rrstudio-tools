// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { FavoriteButton } from './favorite-button';
import { ToolGuide } from './tool-guide';

/**
 * Cornice comune delle pagine strumento (route padre di ogni tool): mostra la stella dei preferiti
 * nell'angolo dell'intestazione e, sotto lo strumento, la guida "come si usa" + FAQ se lo strumento ne ha una
 * (vedi tool-guide.ts), senza toccare i template dei singoli strumenti. L'id arriva da `data.toolId`.
 */
@Component({
  selector: 'app-tool-frame',
  imports: [RouterOutlet, FavoriteButton, ToolGuide],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slot">
      <div class="container">
        <app-favorite-button class="fav" [toolId]="toolId" />
      </div>
    </div>
    <router-outlet />
    <app-tool-guide [toolId]="toolId" />
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }
    /* sopra l'intestazione dello strumento (h1), allineata a destra; lo spazio per il testo lo lascia lo stile globale */
    .slot {
      position: absolute;
      inset: var(--space-6) 0 auto 0;
      z-index: 2;
      pointer-events: none;
    }
    .fav {
      display: flex;
      justify-content: flex-end;
      pointer-events: none;
      ::ng-deep button {
        pointer-events: auto;
      }
    }
    @media print {
      .slot {
        display: none;
      }
    }
  `,
})
export class ToolFrame {
  protected readonly toolId = (inject(ActivatedRoute).snapshot.data['toolId'] as string | undefined) ?? '';
}
