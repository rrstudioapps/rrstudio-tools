// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ToolHandoff } from '../../shared/tool-handoff';
import {
  HMAC_ALGORITHMS,
  HmacAlgorithm,
  HmacError,
  KeyFormat,
  OutputFormat,
  VerifyOutcome,
  encodeOutput,
  hmac,
  parseKey,
  verify,
} from './hmac';
import { HMAC_DICTIONARIES } from './hmac-generator.i18n';

/** Oltre questa dimensione il file non viene letto in memoria. */
const MAX_FILE_BYTES = 200 * 1024 * 1024;

@Component({
  selector: 'app-hmac-generator',
  imports: [PrivacyNote, Segmented, IoPanel, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hmac-generator.page.html',
  styleUrl: './hmac-generator.page.scss',
})
export class HmacGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly source = signal<'text' | 'file'>('text');
  protected readonly message = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly keyText = signal('');
  protected readonly keyFormat = signal<KeyFormat>('text');
  protected readonly algorithm = signal<HmacAlgorithm>('SHA-256');
  protected readonly outFormat = signal<OutputFormat>('hex');
  protected readonly expected = signal('');
  protected readonly visible = signal(false);

  protected readonly sources = computed<SegmentOption<'text' | 'file'>[]>(() => [
    { value: 'text', label: this.i18n.t('hmac.source.text') },
    { value: 'file', label: this.i18n.t('hmac.source.file') },
  ]);
  protected readonly keyFormats = computed<SegmentOption<KeyFormat>[]>(() => [
    { value: 'text', label: this.i18n.t('hmac.key.text') },
    { value: 'hex', label: 'Hex' },
    { value: 'base64', label: 'Base64' },
  ]);
  protected readonly algorithms: SegmentOption<HmacAlgorithm>[] = HMAC_ALGORITHMS.map((a) => ({ value: a, label: a }));
  protected readonly outFormats: SegmentOption<OutputFormat>[] = [
    { value: 'hex', label: 'Hex' },
    { value: 'base64', label: 'Base64' },
    { value: 'base64url', label: 'Base64url' },
  ];

  /** Byte del MAC calcolato, oppure il codice dell'errore. */
  protected readonly mac = signal<Uint8Array | null>(null);
  protected readonly errorKey = signal('');
  protected readonly busy = signal(false);

  protected readonly output = computed(() => {
    const m = this.mac();
    return m ? encodeOutput(m, this.outFormat()) : '';
  });
  protected readonly fileInfo = computed(() => {
    const f = this.file();
    return f ? `${f.name} · ${new Intl.NumberFormat(this.i18n.locale()).format(f.size)} B` : '';
  });
  protected readonly outcome = computed<VerifyOutcome | null>(() => {
    const m = this.mac();
    if (!m || this.expected().trim() === '') return null;
    return verify(this.expected(), m);
  });
  protected readonly outcomeText = computed(() => {
    const o = this.outcome();
    return o ? this.i18n.t('hmac.verify.' + o) : '';
  });
  protected readonly errorText = computed(() => (this.errorKey() ? this.i18n.t(this.errorKey()) : ''));

  private seq = 0;

  constructor() {
    this.i18n.register(HMAC_DICTIONARIES);
    const rx = inject(ToolHandoff).take('hmac-generator');
    if (rx?.text !== undefined) this.message.set(rx.text);
    effect(() => {
      const src = this.source();
      const text = this.message();
      const file = this.file();
      const keyText = this.keyText();
      const keyFormat = this.keyFormat();
      const alg = this.algorithm();
      if (!this.browser) return;
      const id = ++this.seq;
      untracked(() => this.errorKey.set(''));
      if (src === 'file' && !file) {
        untracked(() => this.mac.set(null));
        return;
      }
      if (src === 'file' && file && file.size > MAX_FILE_BYTES) {
        untracked(() => {
          this.mac.set(null);
          this.errorKey.set('hmac.err.size');
        });
        return;
      }
      let key: Uint8Array;
      try {
        key = parseKey(keyText, keyFormat);
      } catch (e) {
        untracked(() => {
          this.mac.set(null);
          this.errorKey.set('hmac.err.' + (e instanceof HmacError ? e.code : 'hex'));
        });
        return;
      }
      untracked(() => this.busy.set(true));
      void (async () => {
        try {
          const data = src === 'file' && file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(text);
          const out = await hmac(key, data, alg);
          if (id === this.seq) this.mac.set(out);
        } catch (e) {
          if (id === this.seq) {
            this.mac.set(null);
            this.errorKey.set('hmac.err.' + (e instanceof HmacError ? e.code : 'crypto'));
          }
        } finally {
          if (id === this.seq) this.busy.set(false);
        }
      })();
    });
  }

  protected onFile(f: File): void {
    this.file.set(f);
  }
}
