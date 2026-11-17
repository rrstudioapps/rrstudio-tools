// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { textStats } from '../../shared/text-stats';
import { UrlCodecError, UrlMode, decodeUrl, encodeUrl, parseUrlParts } from './url-codec';
import { URL_ENCODE_DICTIONARIES } from './url-encode.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './url-encode.share';

type Direction = 'encode' | 'decode';

@Component({
  selector: 'app-url-encode',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './url-encode.page.html',
  styleUrl: './url-encode.page.scss',
})
export class UrlEncodePage {
  protected readonly i18n = inject(I18nService);

  protected readonly direction = signal<Direction>('encode');
  protected readonly scope = signal<UrlMode>('component');
  protected readonly plus = signal(false);
  protected readonly input = signal('');

  protected readonly directions = computed<SegmentOption<Direction>[]>(() => [
    { value: 'encode', label: this.i18n.t('url.mode.encode') },
    { value: 'decode', label: this.i18n.t('url.mode.decode') },
  ]);
  protected readonly scopes = computed<SegmentOption<UrlMode>[]>(() => [
    { value: 'component', label: this.i18n.t('url.scope.component') },
    { value: 'full', label: this.i18n.t('url.scope.full') },
  ]);

  private readonly result = computed(() => {
    const src = this.input();
    if (!src) return { output: '', error: null as UrlCodecError | null };
    try {
      const output =
        this.direction() === 'encode'
          ? encodeUrl(src, this.scope(), this.plus())
          : decodeUrl(src.replace(/[\r\n]+$/, ''), this.scope(), this.plus());
      return { output, error: null };
    } catch (e) {
      return { output: '', error: e instanceof UrlCodecError ? e : new UrlCodecError('badSequence') };
    }
  });

  protected readonly output = computed(() => this.result().output);
  protected readonly errorMessage = computed(() => {
    const e = this.result().error;
    return e ? this.i18n.t(`url.err.${e.code}`, { detail: e.detail }) : '';
  });

  /** Parti dell'URL: dall'input se è un URL, altrimenti dall'output (per esempio dopo una decodifica). */
  protected readonly parts = computed(() => parseUrlParts(this.input()) ?? parseUrlParts(this.output()));

  protected readonly rows = computed(() => {
    const p = this.parts();
    if (!p) return [];
    const empty = this.i18n.t('url.parts.empty');
    return [
      { name: this.i18n.t('url.parts.protocol'), value: p.protocol },
      { name: this.i18n.t('url.parts.host'), value: p.host },
      { name: this.i18n.t('url.parts.path'), value: p.pathname },
      { name: this.i18n.t('url.parts.hash'), value: p.hash },
    ].map((r) => ({ ...r, shown: r.value || empty, empty: !r.value }));
  });

  protected readonly inputMeta = computed(() => this.counter(this.input()));
  protected readonly outputMeta = computed(() => this.counter(this.output()));

  protected readonly canSwap = computed(() => !this.errorMessage() && this.output() !== '');

  private counter(text: string): string {
    const s = textStats(text);
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('common.counter', { chars: nf.format(s.chars), bytes: nf.format(s.bytes) });
  }

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    direction: this.direction,
    scope: this.scope,
    plus: this.plus,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(URL_ENCODE_DICTIONARIES);
  }

  protected onInput(e: Event): void {
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected swap(): void {
    if (!this.canSwap()) return;
    const out = this.output();
    this.direction.update((d) => (d === 'encode' ? 'decode' : 'encode'));
    this.input.set(out);
  }

  protected clear(): void {
    this.input.set('');
  }

  protected t(key: string, params: Record<string, string>): string {
    return this.i18n.t(key, params);
  }
}
