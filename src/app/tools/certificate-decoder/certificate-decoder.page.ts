// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { CertInfo, CsrInfo, DecodeResult, DecodedItem, MAX_INPUT_BYTES, SanEntry, Validity, decode } from './cert';
import { CERT_DICTIONARIES } from './certificate-decoder.i18n';
import { ToolHandoff } from '../../shared/tool-handoff';

@Component({
  selector: 'app-certificate-decoder',
  imports: [Icon, IoPanel, PrivacyNote, FileDrop, CopyButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './certificate-decoder.page.html',
  styleUrl: './certificate-decoder.page.scss',
})
export class CertificateDecoderPage {
  protected readonly i18n = inject(I18nService);

  protected readonly text = signal('');
  protected readonly fileName = signal('');
  protected readonly result = signal<DecodeResult | null>(null);
  protected readonly busy = signal(false);
  private token = 0;

  protected readonly items = computed<DecodedItem[]>(() => {
    const r = this.result();
    return r && r.ok ? r.items : [];
  });
  protected readonly errorText = computed(() => {
    const r = this.result();
    return r && !r.ok ? this.i18n.t('cert.err.' + r.error) : '';
  });
  protected readonly meta = computed(() => (this.items().length > 1 ? this.i18n.t('cert.count', { n: this.items().length }) : ''));
  protected readonly hasChain = computed(() => this.items().filter((i) => i.kind === 'certificate').length > 1);

  constructor() {
    this.i18n.register(CERT_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('certificate-decoder');
    if (rx?.text !== undefined) this.text.set(rx.text.trim());
  }

  protected onText(value: string): void {
    this.text.set(value);
    this.fileName.set('');
    void this.run(value);
  }

  protected async onFile(file: File): Promise<void> {
    if (file.size > MAX_INPUT_BYTES) {
      this.text.set('');
      this.fileName.set(file.name);
      this.result.set({ ok: false, error: 'too-large' });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.fileName.set(file.name);
    // un file PEM si mostra anche nella textarea; un DER binario no
    const asText = looksLikeText(bytes) ? new TextDecoder().decode(bytes) : '';
    this.text.set(asText);
    await this.run(bytes);
  }

  protected clear(): void {
    this.token++;
    this.text.set('');
    this.fileName.set('');
    this.result.set(null);
    this.busy.set(false);
  }

  private async run(input: string | Uint8Array): Promise<void> {
    const token = ++this.token;
    if (typeof input === 'string' && input.trim() === '') {
      this.result.set(null);
      this.busy.set(false);
      return;
    }
    this.busy.set(true);
    let r: DecodeResult;
    try {
      r = await decode(input);
    } catch {
      r = { ok: true, items: [{ kind: 'error', error: 'bad-der' }] };
    }
    if (token !== this.token) return;
    this.result.set(r);
    this.busy.set(false);
  }

  // ---- presentazione ----
  protected asCert(i: DecodedItem): CertInfo | null {
    return i.kind === 'certificate' ? i : null;
  }

  protected asCsr(i: DecodedItem): CsrInfo | null {
    return i.kind === 'csr' ? i : null;
  }

  protected itemTitle(i: DecodedItem, index: number): string {
    const key = i.kind === 'certificate' ? 'cert.item.cert' : i.kind === 'csr' ? 'cert.item.csr' : 'cert.item.error';
    return this.i18n.t(key, { n: index + 1 });
  }

  protected commonName(i: DecodedItem): string {
    if (i.kind === 'error') return '';
    return i.subject.entries.find((e) => e.label === 'CN')?.value ?? i.subject.text;
  }

  protected errorMessage(i: Extract<DecodedItem, { kind: 'error' }>): string {
    return this.i18n.t('cert.err.' + i.error, { label: i.label ?? '' });
  }

  protected formatDate(d: Date): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      dateStyle: 'long',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(d) + ' ' + this.i18n.t('cert.utc');
  }

  protected daysText(v: Validity): string {
    if (v.status === 'not-yet') return this.i18n.t('cert.days.start', { n: v.daysToStart });
    if (v.status === 'expired') {
      const n = -v.daysLeft;
      return n <= 1 ? this.i18n.t('cert.days.ago.one') : this.i18n.t('cert.days.ago', { n });
    }
    if (v.daysLeft === 0) return this.i18n.t('cert.days.left.zero');
    if (v.daysLeft === 1) return this.i18n.t('cert.days.left.one');
    return this.i18n.t('cert.days.left', { n: v.daysLeft });
  }

  protected keyText(k: { algorithm: string; size: number | null; detail: string | null }): string {
    const base = k.size ? this.i18n.t('cert.f.key.bits', { algo: k.algorithm, bits: k.size }) : this.i18n.t('cert.f.key.nobits', { algo: k.algorithm });
    return k.detail ? `${base} (${k.detail})` : base;
  }

  protected sanLabel(e: SanEntry): string {
    return this.i18n.t('cert.san.' + e.type);
  }

  protected bcText(i: CertInfo | CsrInfo): string {
    const bc = i.basicConstraints;
    if (!bc) return '';
    const base = this.i18n.t(bc.ca ? 'cert.bc.ca' : 'cert.bc.notCa');
    return bc.pathLen !== null ? `${base}, ${this.i18n.t('cert.bc.pathLen', { n: bc.pathLen })}` : base;
  }

  protected csrSigText(v: boolean | null): string {
    return this.i18n.t(v === true ? 'cert.csrSig.valid' : v === false ? 'cert.csrSig.invalid' : 'cert.csrSig.unknown');
  }

  protected sizeText(n: number): string {
    return this.i18n.t('cert.f.size.bytes', { n });
  }
}

/** True se i byte sono testo (niente byte di controllo fuori da tab e a capo). */
function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096);
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b < 0x20 || b === 0x7f) return false;
  }
  return true;
}
