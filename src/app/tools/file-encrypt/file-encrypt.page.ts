// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { safeFileName, saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  CryptError,
  MAX_FILE_BYTES,
  decrypt,
  decryptText,
  decryptedName,
  encryptParts,
  encryptText,
  encryptedName,
} from './crypt';
import { FE_DICTIONARIES } from './file-encrypt.i18n';

type Direction = 'encrypt' | 'decrypt';
type Source = 'file' | 'text';

@Component({
  selector: 'app-file-encrypt',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-encrypt.page.html',
  styleUrl: './file-encrypt.page.scss',
})
export class FileEncryptPage {
  protected readonly i18n = inject(I18nService);

  protected readonly direction = signal<Direction>('encrypt');
  protected readonly source = signal<Source>('file');
  protected readonly pass = signal('');
  protected readonly pass2 = signal('');
  protected readonly visible = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly text = signal('');
  protected readonly output = signal('');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly done = signal('');

  protected readonly directions = computed<SegmentOption<Direction>[]>(() => [
    { value: 'encrypt', label: this.i18n.t('fenc.encrypt') },
    { value: 'decrypt', label: this.i18n.t('fenc.decrypt') },
  ]);
  protected readonly sources = computed<SegmentOption<Source>[]>(() => [
    { value: 'file', label: this.i18n.t('fenc.source.file') },
    { value: 'text', label: this.i18n.t('fenc.source.text') },
  ]);

  protected readonly maxText = computed(() => this.formatSize(MAX_FILE_BYTES));
  protected readonly isEncrypt = computed(() => this.direction() === 'encrypt');
  protected readonly mismatch = computed(() => this.isEncrypt() && this.pass2() !== '' && this.pass() !== this.pass2());
  protected readonly short = computed(() => this.isEncrypt() && this.pass() !== '' && [...this.pass()].length < 12);
  protected readonly fileHint = computed(() =>
    this.isEncrypt() ? this.i18n.t('fenc.file.hint.encrypt', { max: this.maxText() }) : this.i18n.t('fenc.file.hint.decrypt'),
  );
  protected readonly fileInfo = computed(() => {
    const f = this.file();
    return f ? `${f.name} · ${this.formatSize(f.size)}` : '';
  });
  protected readonly errorText = computed(() => {
    const k = this.errorKey();
    return k ? this.i18n.t(k, { max: this.maxText() }) : '';
  });
  protected readonly runLabel = computed(() => {
    const e = this.isEncrypt();
    if (this.source() === 'file') return this.i18n.t(e ? 'fenc.run.encrypt' : 'fenc.run.decrypt');
    return this.i18n.t(e ? 'fenc.run.encryptText' : 'fenc.run.decryptText');
  });
  protected readonly infoLimit = computed(() => this.maxText());

  constructor() {
    this.i18n.register(FE_DICTIONARIES);
  }

  protected reset(): void {
    this.errorKey.set(null);
    this.done.set('');
    this.output.set('');
  }

  protected setDirection(d: Direction): void {
    this.direction.set(d);
    this.reset();
  }

  protected setSource(s: Source): void {
    this.source.set(s);
    this.reset();
  }

  protected onFile(f: File): void {
    this.file.set(f);
    this.reset();
  }

  protected formatSize(bytes: number): string {
    const nf = new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 });
    if (bytes >= 1024 * 1024) return `${nf.format(bytes / 1024 / 1024)} MB`;
    if (bytes >= 1024) return `${nf.format(bytes / 1024)} kB`;
    return `${nf.format(bytes)} B`;
  }

  protected async run(): Promise<void> {
    if (this.busy()) return;
    this.reset();
    const pass = this.pass();
    if (pass === '') return void this.errorKey.set('fenc.err.empty-password');
    if (this.isEncrypt() && pass !== this.pass2()) return void this.errorKey.set('fenc.pass.mismatch');
    this.busy.set(true);
    try {
      if (this.source() === 'file') await this.runFile(pass);
      else await this.runText(pass);
    } catch (e) {
      this.errorKey.set(e instanceof CryptError ? 'fenc.err.' + e.code : 'fenc.err.generic');
    } finally {
      this.busy.set(false);
    }
  }

  private async runFile(pass: string): Promise<void> {
    const file = this.file();
    if (!file) return void this.errorKey.set('fenc.err.nofile');
    if (file.size > MAX_FILE_BYTES + (this.isEncrypt() ? 0 : 64)) throw new CryptError('too-big');
    const data = new Uint8Array(await file.arrayBuffer());
    if (this.isEncrypt()) {
      const { header, body } = await encryptParts(data, pass);
      const blob = new Blob([header as BlobPart, body as BlobPart], { type: 'application/octet-stream' });
      const name = safeFileName(encryptedName(file.name), 'file.rrenc');
      saveBytes(blob, name, 'application/octet-stream');
      this.done.set(this.i18n.t('fenc.done.encrypt', { name, size: this.formatSize(blob.size) }));
    } else {
      const plain = await decrypt(data, pass);
      const name = safeFileName(decryptedName(file.name), 'file.dec');
      saveBytes(plain, name, 'application/octet-stream');
      this.done.set(this.i18n.t('fenc.done.decrypt', { name, size: this.formatSize(plain.length) }));
    }
  }

  private async runText(pass: string): Promise<void> {
    const text = this.text();
    if (text.trim() === '') return void this.errorKey.set('fenc.err.notext');
    this.output.set(this.isEncrypt() ? await encryptText(text, pass) : await decryptText(text, pass));
  }
}
