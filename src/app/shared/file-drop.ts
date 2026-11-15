// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';

/**
 * Zona di caricamento file: una barra con testo e pulsante "Scegli un file" che avvolge il contenuto
 * del tool. Si può trascinare un file su tutta l'area (anche sulle textarea). Nessuna richiesta di rete.
 */
@Component({
  selector: 'app-file-drop',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="zone"
      [class.over]="over()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <div class="bar">
        <app-icon name="upload" />
        <span class="hint">{{ hint() }}</span>
        <label class="btn small">
          {{ i18n.t('common.chooseFile') }}
          <input class="visually-hidden" type="file" [attr.accept]="accept() || null" [multiple]="multiple()" (change)="onPick($event)" />
        </label>
      </div>
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .zone {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-3);
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      transition: border-color var(--dur) var(--ease), background-color var(--dur) var(--ease);
    }
    .zone.over {
      border-color: var(--ink);
      background: var(--drop-over);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--muted);
      font-size: var(--fs-sm);
      flex-wrap: wrap;
    }
    .hint {
      flex: 1;
      min-width: 0;
    }
    label:focus-within {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
  `,
})
export class FileDrop {
  protected readonly i18n = inject(I18nService);
  readonly hint = input.required<string>();
  readonly accept = input('');
  /** Con true si possono scegliere/trascinare più file. */
  readonly multiple = input(false);
  /** Primo file scelto (uso a file singolo). */
  readonly fileSelected = output<File>();
  /** Tutti i file scelti (uso con `multiple`). */
  readonly filesSelected = output<File[]>();
  protected readonly over = signal(false);

  protected onDragOver(e: DragEvent): void {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    this.over.set(true);
  }

  protected onDragLeave(e: DragEvent): void {
    const zone = e.currentTarget as HTMLElement;
    if (!zone.contains(e.relatedTarget as Node | null)) this.over.set(false);
  }

  protected onDrop(e: DragEvent): void {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    this.over.set(false);
    this.emitFiles(Array.from(e.dataTransfer.files));
  }

  protected onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.emitFiles(Array.from(input.files ?? []));
    input.value = ''; // permette di scegliere di nuovo lo stesso file
  }

  private emitFiles(files: File[]): void {
    if (files.length === 0) return;
    this.fileSelected.emit(files[0]);
    this.filesSelected.emit(files);
  }
}
