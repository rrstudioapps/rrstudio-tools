// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { atbash, caesar, caesarBruteForce, rot13, rot47, vigenere, vigenereKey } from './ciphers';
import { CIPHERS_DICTIONARIES } from './classic-ciphers.i18n';
import { SHARE_SCHEMA } from './classic-ciphers.share';

type Cipher = 'rot13' | 'rot47' | 'caesar' | 'atbash' | 'vigenere';

@Component({
  selector: 'app-classic-ciphers',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, SendTo, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classic-ciphers.page.html',
  styleUrl: './classic-ciphers.page.scss',
})
export class ClassicCiphersPage {
  protected readonly i18n = inject(I18nService);

  protected readonly cipher = signal<Cipher>('caesar');
  protected readonly decrypt = signal(false);
  protected readonly shift = signal(3);
  protected readonly key = signal('');
  protected readonly input = signal('');

  protected readonly ciphers = computed<SegmentOption<Cipher>[]>(() =>
    (['rot13', 'rot47', 'caesar', 'atbash', 'vigenere'] as const).map((c) => ({ value: c, label: this.i18n.t('cph.cipher.' + c) })),
  );
  protected readonly directions = computed<SegmentOption<'enc' | 'dec'>[]>(() => [
    { value: 'enc', label: this.i18n.t('cph.dir.enc') },
    { value: 'dec', label: this.i18n.t('cph.dir.dec') },
  ]);
  protected readonly dir = computed(() => (this.decrypt() ? 'dec' : 'enc'));
  protected readonly hasDirection = computed(() => this.cipher() === 'caesar' || this.cipher() === 'vigenere');
  protected readonly keyMissing = computed(() => this.cipher() === 'vigenere' && vigenereKey(this.key()).length === 0);

  protected readonly output = computed(() => {
    const t = this.input();
    switch (this.cipher()) {
      case 'rot13':
        return rot13(t);
      case 'rot47':
        return rot47(t);
      case 'atbash':
        return atbash(t);
      case 'caesar':
        return caesar(t, this.decrypt() ? -this.shift() : this.shift());
      case 'vigenere':
        return vigenere(t, this.key(), this.decrypt());
    }
  });

  protected readonly brute = computed(() => (this.cipher() === 'caesar' && this.input().trim() !== '' ? caesarBruteForce(this.input()) : []));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { cipher: this.cipher, decrypt: this.decrypt, shift: this.shift, key: this.key, input: this.input };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(CIPHERS_DICTIONARIES);
    const rx = inject(ToolHandoff).take('classic-ciphers');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected setShift(raw: string): void {
    const n = Math.trunc(Number(raw));
    if (Number.isFinite(n)) this.shift.set(Math.max(-25, Math.min(25, n)));
  }

  /** Dalla forza bruta: imposta lo spostamento e passa a "Decifra" con quel valore. */
  protected useShift(n: number): void {
    this.shift.set(n);
    this.decrypt.set(true);
  }
}
