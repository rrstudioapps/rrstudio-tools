// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { ACCEPT_ATTR } from './file-parser.service';

/** Zona drag & drop + input file. Emette il file scelto; non fa nessuna richiesta di rete. */
@Component({
  selector: 'app-upload-zone',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="drop"
      [class.over]="over()"
      role="button"
      tabindex="0"
      [attr.aria-label]="i18n.t('csv.drop.aria')"
      [attr.aria-busy]="busy()"
      (click)="picker.click()"
      (keydown.enter)="picker.click()"
      (keydown.space)="$event.preventDefault(); picker.click()"
      (dragover)="onDragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <app-icon name="upload" class="big" />
      <p class="title">{{ busy() ? i18n.t('csv.loading') : i18n.t('csv.drop.title') }}</p>
      <p class="muted">{{ i18n.t('csv.drop.or') }}</p>
      <span class="btn primary">{{ i18n.t('csv.drop.choose') }}</span>
      <p class="muted formats">{{ i18n.t('csv.drop.formats') }}</p>
    </div>
    <!-- fuori dal role="button": un controllo dentro un altro è un errore di accessibilità -->
    <input
      #picker
      class="visually-hidden"
      type="file"
      tabindex="-1"
      [attr.aria-label]="i18n.t('csv.drop.choose')"
      [accept]="accept"
      (change)="onPick($event)"
    />
  `,
  styles: `
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-7) var(--space-5);
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      text-align: center;
      cursor: pointer;
      transition:
        border-color var(--dur) var(--ease),
        background-color var(--dur) var(--ease);
    }
    .drop:hover {
      border-color: var(--muted);
    }
    .drop.over {
      border-color: var(--ink);
      background: color-mix(in srgb, var(--ink) 4%, transparent);
    }
    .big {
      font-size: 32px;
      color: var(--ink);
    }
    p {
      margin: 0;
    }
    .title {
      font-size: var(--fs-xl);
      font-weight: var(--fw-bold);
      letter-spacing: -0.03em;
    }
    .muted {
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .formats {
      font-family: var(--mono);
      font-size: var(--fs-xs);
    }
  `,
})
export class UploadZone {
  protected readonly i18n = inject(I18nService);
  readonly busy = input(false);
  readonly fileSelected = output<File>();
  protected readonly over = signal(false);
  protected readonly accept = ACCEPT_ATTR;

  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.over.set(true);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.over.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.fileSelected.emit(file);
  }

  protected onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileSelected.emit(file);
    input.value = ''; // permette di scegliere di nuovo lo stesso file
  }
}
