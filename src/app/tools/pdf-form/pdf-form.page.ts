// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { FillProblem, FormField, FormInfo, Values, fillForm, readForm } from './pdf-form';
import { PDF_FORM_DICTIONARIES } from './pdf-form.i18n';

@Component({
  selector: 'app-pdf-form',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-form.page.html',
  styleUrl: './pdf-form.page.scss',
})
export class PdfFormPage {
  protected readonly i18n = inject(I18nService);
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly info = signal<FormInfo | null>(null);
  private readonly values = signal<Values>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');
  protected readonly problems = signal<FillProblem[]>([]);

  constructor() {
    this.i18n.register(PDF_FORM_DICTIONARIES);
  }

  protected async onLoaded(p: LoadedPdf): Promise<void> {
    this.pdf.set(p);
    this.error.set('');
    this.done.set('');
    this.problems.set([]);
    this.values.set({});
    try {
      this.info.set(await readForm(p.bytes));
    } catch {
      this.info.set(null);
      this.error.set(this.i18n.t('pc.err.invalid'));
    }
  }

  protected onCleared(): void {
    this.pdf.set(null);
    this.info.set(null);
  }

  /** Valore mostrato: quello scritto dall'utente, altrimenti quello del file. */
  private current(f: FormField): FormField['value'] {
    const v = this.values();
    return f.name in v ? v[f.name] : f.value;
  }
  protected str(f: FormField): string {
    const v = this.current(f);
    return typeof v === 'string' ? v : '';
  }
  protected bool(f: FormField): boolean {
    return this.current(f) === true;
  }
  protected list(f: FormField): string[] {
    const v = this.current(f);
    return Array.isArray(v) ? v : [];
  }

  protected set(name: string, v: string | boolean): void {
    this.done.set('');
    this.values.update((m) => ({ ...m, [name]: v }));
  }

  protected setList(name: string, select: HTMLSelectElement): void {
    this.done.set('');
    const v = Array.from(select.selectedOptions).map((o) => o.value);
    this.values.update((m) => ({ ...m, [name]: v }));
  }

  protected async save(flatten: boolean): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.busy.set(true);
    this.error.set('');
    this.done.set('');
    this.problems.set([]);
    try {
      const r = await fillForm(p.bytes, this.values(), flatten);
      if (!r.ok) {
        this.error.set(this.i18n.t(r.error === 'noForm' ? 'pfm.none' : 'pc.err.build'));
        return;
      }
      this.problems.set(r.problems);
      const suffix = flatten ? 'appiattito' : 'compilato';
      downloadPdf(r.bytes, p.base, suffix);
      this.done.set(this.i18n.t('pc.done', { name: `${p.base}-${suffix}.pdf`, size: formatBytes(r.bytes.length, this.i18n.locale()) }));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
