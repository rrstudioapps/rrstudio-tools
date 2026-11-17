// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { GeneratedSshKey, SshKeyKind, ed25519Supported, generateSshKey } from './ssh';
import { SSH_DICTIONARIES } from './ssh-key-generator.i18n';

@Component({
  selector: 'app-ssh-key-generator',
  imports: [Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ssh-key-generator.page.html',
  styleUrl: './ssh-key-generator.page.scss',
})
export class SshKeyGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly kind = signal<SshKeyKind>('ed25519');
  protected readonly comment = signal('');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal('');
  protected readonly result = signal<GeneratedSshKey | null>(null);
  /** Null finché non si è provato: il rilevamento genera una chiave di prova. */
  protected readonly edSupported = signal<boolean | null>(null);

  protected readonly kinds = computed<SegmentOption<SshKeyKind>[]>(() => {
    const rsa: SegmentOption<SshKeyKind>[] = [
      { value: 'rsa-2048', label: 'RSA 2048' },
      { value: 'rsa-3072', label: 'RSA 3072' },
      { value: 'rsa-4096', label: 'RSA 4096' },
    ];
    return this.edSupported() === false ? rsa : [{ value: 'ed25519', label: 'Ed25519' }, ...rsa];
  });
  protected readonly baseName = computed(() => {
    const r = this.result();
    return r?.type === 'ssh-rsa' ? 'id_rsa' : 'id_ed25519';
  });
  protected readonly errorText = computed(() => (this.errorKey() ? this.i18n.t(this.errorKey()) : ''));
  protected readonly bitsText = computed(() => {
    const r = this.result();
    return r ? this.i18n.t(r.type === 'ssh-rsa' ? 'ssh.bits.rsa' : 'ssh.bits.ed', { bits: r.bits }) : '';
  });

  constructor() {
    this.i18n.register(SSH_DICTIONARIES);
    if (this.browser) {
      void ed25519Supported().then((ok) => {
        this.edSupported.set(ok);
        if (!ok && this.kind() === 'ed25519') this.kind.set('rsa-3072');
      });
    }
  }

  protected async generate(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set('');
    this.result.set(null);
    // lascia dipingere lo stato "in corso" prima del lavoro pesante (RSA 4096 può richiedere alcuni secondi)
    await new Promise((r) => setTimeout(r, 30));
    try {
      this.result.set(await generateSshKey(this.kind(), this.comment()));
    } catch {
      this.errorKey.set('ssh.err.generate');
    } finally {
      this.busy.set(false);
    }
  }

  protected clear(): void {
    this.result.set(null);
    this.errorKey.set('');
  }

  protected download(which: 'pub' | 'openssh' | 'pkcs8'): void {
    const r = this.result();
    if (!r) return;
    const base = this.baseName();
    if (which === 'pub') saveBytes(new Blob([r.publicKey + '\n'], { type: 'text/plain' }), base + '.pub', 'text/plain');
    else if (which === 'openssh') saveBytes(new Blob([r.privateOpenSsh], { type: 'text/plain' }), base, 'text/plain');
    else saveBytes(new Blob([r.privatePkcs8], { type: 'text/plain' }), base + '.pem', 'text/plain');
  }
}
