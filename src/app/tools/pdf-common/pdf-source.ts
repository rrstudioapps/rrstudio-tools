// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FileDrop } from '../../shared/file-drop';
import { formatBytes } from '../../shared/text-stats';
import { ToolHandoff } from '../../shared/tool-handoff';
import { LoadedPdf, PdfLoadError, loadPdfFile } from './pdf-file';
import { PDF_COMMON_DICTIONARIES } from './pdf-common.i18n';

/** Zona di caricamento di un PDF: legge il file, mostra nome, pagine e dimensione e avvisa lo strumento che lo contiene. */
@Component({
  selector: 'app-pdf-source',
  imports: [FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-file-drop [hint]="i18n.t('pc.drop')" accept="application/pdf,.pdf" (fileSelected)="pick($event)">
      <div class="tool-status" role="status" aria-live="polite">
        @if (loading()) {
          <p class="tool-ok">{{ i18n.t('pc.loading') }}</p>
        } @else if (error(); as e) {
          <p class="tool-error" role="alert" data-testid="pdf-error">{{ i18n.t('pc.err.' + e) }}</p>
        } @else if (info(); as i) {
          <p class="tool-ok" data-testid="pdf-info">{{ i }}</p>
        }
      </div>
      <ng-content />
    </app-file-drop>
  `,
})
export class PdfSource implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly handoff = inject(ToolHandoff);
  /** Id dello strumento che contiene la zona: serve a ricevere un PDF inviato da un altro strumento («Invia a…»). */
  readonly toolId = input.required<string>();
  readonly loaded = output<LoadedPdf>();
  readonly cleared = output<void>();
  protected readonly loading = signal(false);
  protected readonly error = signal<PdfLoadError | null>(null);
  private readonly current = signal<LoadedPdf | null>(null);
  protected readonly info = computed(() => {
    const p = this.current();
    return p ? this.i18n.t('pc.info', { name: p.name, pages: p.pages, size: formatBytes(p.bytes.length, this.i18n.locale()) }) : '';
  });

  constructor() {
    this.i18n.register(PDF_COMMON_DICTIONARIES);
  }

  ngOnInit(): void {
    const f = this.handoff.take(this.toolId())?.files?.find((x) => /\.pdf$/i.test(x.name) || x.type === 'application/pdf');
    if (f) void this.pick(f);
  }

  protected async pick(file: File): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const r = await loadPdfFile(file);
      if (r.ok) {
        this.current.set(r.pdf);
        this.loaded.emit(r.pdf);
      } else {
        this.current.set(null);
        this.error.set(r.error);
        this.cleared.emit();
      }
    } catch {
      this.current.set(null);
      this.error.set('invalid');
      this.cleared.emit();
    } finally {
      this.loading.set(false);
    }
  }
}
