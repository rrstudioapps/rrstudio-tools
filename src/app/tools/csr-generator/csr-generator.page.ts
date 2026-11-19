// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { safeFileName, saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import type { CsrInfo } from '../certificate-decoder/cert';
import { CsrError, CsrKeySpec, CsrResult, EMPTY_SUBJECT, Subject, buildCsr, parseSanList } from './csr';
import { CSR_DICTIONARIES } from './csr-generator.i18n';

type KeyChoice = 'rsa-2048' | 'rsa-4096' | 'p-256' | 'p-384' | 'existing';

interface SubjectField {
  key: keyof Subject;
  id: string;
  labelKey: string;
  phKey: string;
  maxLength: number;
}

@Component({
  selector: 'app-csr-generator',
  imports: [Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csr-generator.page.html',
  styleUrl: './csr-generator.page.scss',
})
export class CsrGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly fields: SubjectField[] = [
    { key: 'cn', id: 'csr-cn', labelKey: 'csr.f.cn', phKey: 'csr.f.cn.ph', maxLength: 64 },
    { key: 'o', id: 'csr-o', labelKey: 'csr.f.o', phKey: 'csr.f.o.ph', maxLength: 64 },
    { key: 'ou', id: 'csr-ou', labelKey: 'csr.f.ou', phKey: 'csr.f.ou.ph', maxLength: 64 },
    { key: 'l', id: 'csr-l', labelKey: 'csr.f.l', phKey: 'csr.f.l.ph', maxLength: 128 },
    { key: 'st', id: 'csr-st', labelKey: 'csr.f.st', phKey: 'csr.f.st.ph', maxLength: 128 },
    { key: 'c', id: 'csr-c', labelKey: 'csr.f.c', phKey: 'csr.f.c.ph', maxLength: 2 },
    { key: 'email', id: 'csr-email', labelKey: 'csr.f.email', phKey: 'csr.f.email.ph', maxLength: 128 },
  ];

  protected readonly subject = signal<Subject>({ ...EMPTY_SUBJECT });
  protected readonly sanText = signal('');
  protected readonly choice = signal<KeyChoice>('p-256');
  protected readonly existingPem = signal('');
  protected readonly busy = signal(false);
  protected readonly errorText = signal('');
  protected readonly result = signal<CsrResult | null>(null);
  protected readonly info = signal<CsrInfo | null>(null);

  protected readonly choices = computed<SegmentOption<KeyChoice>[]>(() => [
    { value: 'p-256', label: 'ECDSA P-256' },
    { value: 'p-384', label: 'ECDSA P-384' },
    { value: 'rsa-2048', label: 'RSA 2048' },
    { value: 'rsa-4096', label: 'RSA 4096' },
    { value: 'existing', label: this.i18n.t('csr.key.existing') },
  ]);
  protected readonly san = computed(() => parseSanList(this.sanText()));
  protected readonly sanInvalidText = computed(() => {
    const bad = this.san().invalid;
    return bad.length ? this.i18n.t('csr.san.invalid', { list: bad.join(', ') }) : '';
  });
  protected readonly sanCountText = computed(() => {
    const s = this.san();
    return s.dns.length + s.ip.length === 0 ? '' : this.i18n.t('csr.san.count', { dns: s.dns.length, ip: s.ip.length });
  });
  protected readonly baseName = computed(() => safeFileName(this.subject().cn.replace(/^\*\./, 'wildcard.'), 'request'));

  constructor() {
    this.i18n.register(CSR_DICTIONARIES);
  }

  protected setField(key: keyof Subject, value: string): void {
    this.subject.update((s) => ({ ...s, [key]: value }));
  }

  private keySpec(): CsrKeySpec {
    switch (this.choice()) {
      case 'rsa-2048':
        return { type: 'rsa', bits: 2048 };
      case 'rsa-4096':
        return { type: 'rsa', bits: 4096 };
      case 'p-384':
        return { type: 'ecdsa', curve: 'P-384' };
      case 'existing':
        return { type: 'existing', pem: this.existingPem() };
      default:
        return { type: 'ecdsa', curve: 'P-256' };
    }
  }

  protected async generate(): Promise<void> {
    if (!this.browser || this.busy()) return;
    this.busy.set(true);
    this.errorText.set('');
    this.result.set(null);
    this.info.set(null);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = await buildCsr({ subject: this.subject(), san: this.san(), key: this.keySpec() });
      this.result.set(r);
      // controllo: la richiesta appena creata viene riletta con lo stesso decodificatore dello strumento dei certificati
      const { decode } = await import('../certificate-decoder/cert');
      const d = await decode(r.csrPem);
      const item = d.ok ? d.items[0] : null;
      this.info.set(item && item.kind === 'csr' ? item : null);
    } catch (e) {
      this.errorText.set(e instanceof CsrError ? this.i18n.t('csr.err.' + e.code, { detail: e.detail ?? '' }) : this.i18n.t('csr.err.build', { detail: '' }));
    } finally {
      this.busy.set(false);
    }
  }

  protected clear(): void {
    this.result.set(null);
    this.info.set(null);
    this.errorText.set('');
  }

  protected sigText(v: boolean | null): string {
    return this.i18n.t(v === true ? 'csr.check.sig.ok' : v === false ? 'csr.check.sig.bad' : 'csr.check.sig.unknown');
  }

  protected keyText(i: CsrInfo): string {
    return [i.key.algorithm, i.key.size ? i.key.size + ' bit' : '', i.key.detail ?? ''].filter(Boolean).join(' · ');
  }

  protected downloadCsr(): void {
    const r = this.result();
    if (r) saveBytes(new Blob([r.csrPem], { type: 'application/pkcs10' }), this.baseName() + '.csr', 'application/pkcs10');
  }

  protected downloadKey(): void {
    const r = this.result();
    if (r?.keyPem) saveBytes(new Blob([r.keyPem], { type: 'application/x-pem-file' }), this.baseName() + '.key', 'application/x-pem-file');
  }
}
