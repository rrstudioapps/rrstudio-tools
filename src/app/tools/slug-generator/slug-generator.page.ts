// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { MAX_LENGTH_LIMIT, Separator, SlugOptions, StopLang, clampMaxLength, generateBulk, generateSlug } from './slug';
import { SLUG_DICTIONARIES } from './slug-generator.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './slug-generator.share';

type Mode = 'single' | 'bulk';

const SAMPLES: Record<Mode, string> = {
  single: 'Perché il caffè è più buono a Napoli? Guida all\'espresso (2026)',
  bulk: 'Il nome della rosa\nL\'isola del tesoro\nStraße nach Zürich\nIl nome della rosa\nCrème brûlée: la ricetta',
};

@Component({
  selector: 'app-slug-generator',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slug-generator.page.html',
  styleUrl: './slug-generator.page.scss',
})
export class SlugGeneratorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly maxLimit = MAX_LENGTH_LIMIT;

  protected readonly mode = signal<Mode>('single');
  protected readonly separator = signal<Separator>('-');
  protected readonly lowercase = signal(true);
  protected readonly maxLength = signal(0);
  protected readonly stopWords = signal<StopLang>('none');
  protected readonly unique = signal(true);
  protected readonly input = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'single', label: this.i18n.t('slug.mode.single') },
    { value: 'bulk', label: this.i18n.t('slug.mode.bulk') },
  ]);
  protected readonly separators = computed<SegmentOption<Separator>[]>(() =>
    (['-', '_', '.'] as const).map((v) => ({ value: v, label: this.i18n.t('slug.sep.' + v) })),
  );
  protected readonly stops = computed<SegmentOption<StopLang>[]>(() =>
    (['none', 'it', 'en', 'both'] as const).map((v) => ({ value: v, label: this.i18n.t('slug.stop.' + v) })),
  );

  private readonly options = computed<SlugOptions>(() => ({
    separator: this.separator(),
    lowercase: this.lowercase(),
    maxLength: this.maxLength(),
    stopWords: this.stopWords(),
  }));
  protected readonly output = computed(() => {
    const text = this.input();
    if (text.trim() === '') return '';
    if (this.mode() === 'bulk') return generateBulk(text, { ...this.options(), unique: this.unique() }).join('\n');
    return generateSlug(text, this.options());
  });
  protected readonly empty = computed(() => this.input().trim() !== '' && this.mode() === 'single' && this.output() === '');
  protected readonly meta = computed(() => {
    const out = this.output();
    if (out === '') return '';
    return this.mode() === 'bulk' ? this.i18n.t('slug.meta.bulk', { n: out.split('\n').length }) : this.i18n.t('slug.meta', { n: out.length });
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    separator: this.separator,
    lowercase: this.lowercase,
    maxLength: this.maxLength,
    stopWords: this.stopWords,
    unique: this.unique,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(SLUG_DICTIONARIES);
  }

  protected onInput(e: Event): void {
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected setMax(e: Event): void {
    const el = e.target as HTMLInputElement;
    this.maxLength.set(clampMaxLength(Number(el.value)));
    el.value = String(this.maxLength());
  }

  protected loadSample(): void {
    this.input.set(SAMPLES[this.mode()]);
  }

  protected clear(): void {
    this.input.set('');
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output() + '\n'), 'slugs.txt', 'text/plain;charset=utf-8');
  }
}
