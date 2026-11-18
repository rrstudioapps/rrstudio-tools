// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { FavoriteButton } from './favorite-button';
import { RelatedTools } from './related-tools';
import { ShortcutsHelp } from './shortcuts-help';
import { ShortcutsService } from './shortcuts.service';
import { ToolFeedback } from './tool-feedback';
import { ToolGuide } from './tool-guide';

/**
 * Cornice comune delle pagine strumento (route padre di ogni tool): mostra la stella dei preferiti
 * nell'angolo dell'intestazione e, sotto lo strumento, la guida "come si usa" + FAQ se lo strumento ne ha una
 * (vedi tool-guide.ts), i collegamenti agli strumenti affini (related-tools.ts) e il riquadro "Feedback" (tool-feedback.ts), senza toccare i template dei singoli strumenti. L'id arriva da `data.toolId`.
 * Ospita anche le scorciatoie da tastiera (shortcuts.ts): il servizio ascolta i tasti, il pulsante "Scorciatoie"
 * apre l'aiuto e il feedback ("Scaricato"…) compare in una regione aria-live in basso.
 */
@Component({
  selector: 'app-tool-frame',
  imports: [RouterOutlet, FavoriteButton, ToolGuide, ToolFeedback, ShortcutsHelp, RelatedTools],
  providers: [ShortcutsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slot">
      <div class="container">
        <app-favorite-button class="fav" [toolId]="toolId" />
      </div>
    </div>
    <router-outlet />
    <div class="container kbd-row">
      <app-shortcuts-help />
    </div>
    <app-tool-guide [toolId]="toolId" />
    <app-related-tools [toolId]="toolId" />
    <app-tool-feedback [toolId]="toolId" />
    <div class="toast-region" role="status" aria-live="polite" data-testid="shortcut-status">
      @if (sc.message(); as m) {
        <p class="toast">{{ m }}</p>
      }
    </div>
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
    .kbd-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: var(--space-5);
    }
    .toast-region {
      position: fixed;
      inset: auto 0 var(--space-5) 0;
      z-index: 50;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .toast {
      margin: 0;
      padding: 8px var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--ink);
      color: var(--bg);
      font-size: var(--fs-sm);
      box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
    }
    @media print {
      .slot,
      .kbd-row,
      .toast-region {
        display: none;
      }
    }
  `,
})
export class ToolFrame {
  protected readonly toolId = (inject(ActivatedRoute).snapshot.data['toolId'] as string | undefined) ?? '';
  protected readonly sc = inject(ShortcutsService);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => this.sc.attach(host));
  }
}
