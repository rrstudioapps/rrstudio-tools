// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { ALL_ALLOWED, Permissions, protectPdf } from './pdf-protect';
import { PDF_PROTECT_DICTIONARIES } from './pdf-protect.i18n';

@Component({
  selector: 'app-pdf-protect',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-protect.page.html',
  styleUrl: './pdf-protect.page.scss',
})
export class PdfProtectPage {
  protected readonly i18n = inject(I18nService);
  protected readonly permKeys: readonly (keyof Permissions)[] = ['print', 'copy', 'modify', 'annotate'];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly user = signal('');
  protected readonly user2 = signal('');
  protected readonly owner = signal('');
  protected readonly show = signal(false);
  protected readonly allow = signal<Permissions>({ ...ALL_ALLOWED });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');

  constructor() {
    this.i18n.register(PDF_PROTECT_DICTIONARIES);
  }

  protected onLoaded(p: LoadedPdf): void {
    this.pdf.set(p);
    this.error.set('');
    this.done.set('');
  }

  protected onCleared(): void {
    this.pdf.set(null);
  }

  protected setAllow(k: keyof Permissions, on: boolean): void {
    this.allow.update((a) => ({ ...a, [k]: on }));
  }

  protected async run(): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.error.set('');
    this.done.set('');
    if (this.user() !== this.user2()) {
      this.error.set(this.i18n.t('ppw.err.mismatch'));
      return;
    }
    this.busy.set(true);
    try {
      const r = await protectPdf(p.bytes, { userPassword: this.user(), ownerPassword: this.owner(), allow: this.allow() });
      if (!r.ok) {
        this.error.set(this.i18n.t(r.error === 'noPassword' ? 'ppw.err.nothing' : 'pc.err.build'));
        return;
      }
      downloadPdf(r.bytes, p.base, 'protetto');
      this.done.set(this.i18n.t('ppw.done', { name: `${p.base}-protetto.pdf`, size: formatBytes(r.bytes.length, this.i18n.locale()) }));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
