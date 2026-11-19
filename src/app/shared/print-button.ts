// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Lang, publicUrl } from '../core/i18n/lang-routing';
import { Icon } from './icon';

/** Parametro mostrato nel riepilogo di stampa (etichetta e valore già formattati e tradotti). */
export interface PrintParam {
  label: string;
  value: string;
}

/** Data di oggi, solo la data, nella lingua della pagina. */
export function printDate(now: Date, lang: Lang): string {
  return now.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Indirizzo canonico della pagina da stampare: sempre ricostruito da slug e lingua, quindi mai con hash o query
 * (l'hash `#s=` dei link condivisi può contenere i dati dell'utente). Se `slug` contiene ? o #, quella parte è scartata.
 */
export function printAddress(slug: string, lang: Lang): string {
  return publicUrl(slug.split(/[?#]/)[0].replace(/^\/+|\/+$/g, ''), lang);
}

/**
 * Pulsante "Stampa o salva PDF" degli strumenti di calcolo: apre il dialogo di stampa del browser (che permette
 * anche di salvare in PDF), nessuna libreria. Va messo subito dopo l'intestazione dello strumento. Contiene anche
 * l'intestazione solo-stampa (nome dello strumento, data, indirizzo senza hash, nota) e il riepilogo dei parametri
 * (`params`); lo stile di stampa globale sta in styles.scss (`@media print`). Data e indirizzo si aggiornano
 * a `beforeprint`, quindi anche Ctrl+P del browser dà lo stesso risultato. Il pulsante è marcato `data-shortcut="print"`
 * (Alt+Maiusc+P): Ctrl+P resta al browser.
 */
@Component({
  selector: 'app-print-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn small"
      data-shortcut="print"
      aria-keyshortcuts="Alt+Shift+P"
      [attr.aria-label]="i18n.t('print.btn.aria')"
      (click)="print()"
    >
      <app-icon name="printer" /> {{ i18n.t('print.btn') }}
    </button>
    <aside class="print-head" data-testid="print-head">
      <p class="ph-title">{{ title() }}</p>
      <p class="ph-meta"><span #date data-testid="print-date"></span> · <span #addr data-testid="print-url"></span></p>
      <p class="ph-note">{{ i18n.t('print.note') }}</p>
      @if (params().length) {
        <dl class="print-summary" data-testid="print-summary">
          @for (p of params(); track $index) {
            <div>
              <dt>{{ p.label }}</dt>
              <dd>{{ p.value }}</dd>
            </div>
          }
        </dl>
      }
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }
    .print-head {
      display: none;
    }
    @media print {
      button {
        display: none;
      }
      .print-head {
        display: block;
        padding-bottom: 8pt;
        border-bottom: 1.5pt solid #000;
        color: #000;
      }
      .ph-title {
        margin: 0;
        font-size: 16pt;
        font-weight: 700;
      }
      .ph-meta,
      .ph-note {
        margin: 2pt 0 0;
        font-size: 9pt;
        color: #333;
        overflow-wrap: anywhere;
      }
      .print-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 2pt 16pt;
        margin: 8pt 0 0;
        font-size: 10pt;
        > div {
          display: flex;
          justify-content: space-between;
          gap: 8pt;
          break-inside: avoid;
          border-bottom: 0.5pt solid #bbb;
        }
        dt {
          color: #333;
        }
        dd {
          margin: 0;
          font-weight: 600;
          text-align: right;
        }
      }
    }
  `,
})
export class PrintButton {
  protected readonly i18n = inject(I18nService);
  /** Nome dello strumento, già tradotto. */
  readonly title = input.required<string>();
  /** Parametri usati, mostrati al posto dei campi di input (che in stampa si nascondono con `.no-print`). */
  readonly params = input<readonly PrintParam[]>([]);
  private readonly dateEl = viewChild.required<ElementRef<HTMLElement>>('date');
  private readonly addrEl = viewChild.required<ElementRef<HTMLElement>>('addr');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.refresh();
      const on = () => this.refresh();
      window.addEventListener('beforeprint', on);
      destroyRef.onDestroy(() => window.removeEventListener('beforeprint', on));
    });
  }

  /** Aggiorna data e indirizzo in modo sincrono (a `beforeprint` il rendering di Angular sarebbe in ritardo). */
  private refresh(): void {
    this.dateEl().nativeElement.textContent = printDate(new Date(), this.i18n.lang());
    this.addrEl().nativeElement.textContent = printAddress(this.i18n.slug(), this.i18n.lang());
  }

  protected print(): void {
    this.refresh();
    window.print();
  }
}
