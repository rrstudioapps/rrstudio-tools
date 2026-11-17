// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { MAX_SECRET_BYTES, MAX_SHARES, ShamirError, Share, ShareFormat, combineShares, formatShare, parseShares, splitSecret } from './shamir';
import { SHAMIR_DICTIONARIES } from './shamir-secret-sharing.i18n';

type Mode = 'split' | 'combine';

interface ShareView {
  index: number;
  text: string;
  fileName: string;
}

@Component({
  selector: 'app-shamir-secret-sharing',
  imports: [Icon, PrivacyNote, Segmented, IoPanel, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shamir-secret-sharing.page.html',
  styleUrl: './shamir-secret-sharing.page.scss',
})
export class ShamirSecretSharingPage {
  protected readonly i18n = inject(I18nService);
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });

  protected readonly maxShares = MAX_SHARES;
  protected readonly mode = signal<Mode>('split');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'split', label: this.i18n.t('sss.mode.split') },
    { value: 'combine', label: this.i18n.t('sss.mode.combine') },
  ]);

  // divisione
  protected readonly secret = signal('');
  protected readonly total = signal(5);
  protected readonly threshold = signal(3);
  protected readonly format = signal<ShareFormat>('hex');
  protected readonly formats: SegmentOption<ShareFormat>[] = [
    { value: 'hex', label: 'Hex' },
    { value: 'base64', label: 'Base64' },
  ];
  /** Parti create: restano finché non si cambia il segreto o le impostazioni (poi si rigenerano col pulsante). */
  private readonly raw = signal<Share[] | null>(null);
  protected readonly splitError = signal('');

  protected readonly shares = computed<ShareView[]>(() =>
    (this.raw() ?? []).map((s) => ({ index: s.index, text: formatShare(s, this.format()), fileName: `parte-${s.index}-di-${s.n}.txt` })),
  );
  protected readonly allText = computed(() => this.shares().map((s) => s.text).join('\n'));
  protected readonly secretBytes = computed(() => this.encoder.encode(this.secret()).length);
  protected readonly secretMeta = computed(() => this.i18n.t('sss.secret.meta', { n: this.secretBytes(), max: MAX_SECRET_BYTES }));
  protected readonly splitSummary = computed(() => {
    const r = this.raw();
    return r?.length ? this.i18n.t('sss.split.summary', { n: r[0].n, k: r[0].k }) : '';
  });

  // ricostruzione
  protected readonly pasted = signal('');
  protected readonly combined = computed<{ text: string } | { error: string } | null>(() => {
    const raw = this.pasted();
    if (raw.trim() === '') return null;
    try {
      const parts = parseShares(raw);
      const bytes = combineShares(parts);
      try {
        return { text: this.decoder.decode(bytes) };
      } catch {
        return { error: this.i18n.t('sss.err.utf8') };
      }
    } catch (e) {
      return { error: this.errorText(e) };
    }
  });
  protected readonly combinedText = computed(() => {
    const c = this.combined();
    return c && 'text' in c ? c.text : '';
  });
  protected readonly combineError = computed(() => {
    const c = this.combined();
    return c && 'error' in c ? c.error : '';
  });
  protected readonly pastedCount = computed(() => {
    try {
      return parseShares(this.pasted()).length;
    } catch {
      return 0;
    }
  });

  constructor() {
    this.i18n.register(SHAMIR_DICTIONARIES);
  }

  private errorText(e: unknown): string {
    if (e instanceof ShamirError) return this.i18n.t('sss.err.' + e.code, { ...e.info });
    return this.i18n.t('sss.err.crypto', {});
  }

  protected setTotal(v: string): void {
    const n = Math.round(Number(v));
    const total = Number.isFinite(n) ? Math.min(MAX_SHARES, Math.max(2, n)) : 5;
    this.total.set(total);
    if (this.threshold() > total) this.threshold.set(total);
    this.raw.set(null);
  }

  protected setThreshold(v: string): void {
    const n = Math.round(Number(v));
    this.threshold.set(Number.isFinite(n) ? Math.min(this.total(), Math.max(2, n)) : 2);
    this.raw.set(null);
  }

  protected onSecret(v: string): void {
    this.secret.set(v);
    this.raw.set(null);
    this.splitError.set('');
  }

  protected split(): void {
    this.splitError.set('');
    try {
      this.raw.set(splitSecret(this.encoder.encode(this.secret()), this.total(), this.threshold()));
    } catch (e) {
      this.raw.set(null);
      this.splitError.set(this.errorText(e));
    }
  }

  protected clearSplit(): void {
    this.secret.set('');
    this.raw.set(null);
    this.splitError.set('');
  }

  protected downloadShare(s: ShareView): void {
    saveBytes(new Blob([s.text + '\n'], { type: 'text/plain' }), s.fileName, 'text/plain');
  }

  /** Scarica tutte le parti come file separati, una dopo l'altra (i browser rifiutano molti download simultanei). */
  protected async downloadAll(): Promise<void> {
    for (const s of this.shares()) {
      this.downloadShare(s);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  protected print(): void {
    window.print();
  }
}
