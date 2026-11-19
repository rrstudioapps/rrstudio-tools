// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { NL_DICTIONARIES } from './numeri-in-lettere.i18n';
import { LetterCase, NumberMode, convertNumber } from './numeri';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './numeri-in-lettere.share';

@Component({
  selector: 'app-numeri-in-lettere',
  imports: [ShareLink, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './numeri-in-lettere.page.html',
  styleUrl: './numeri-in-lettere.page.scss',
})
export class NumeriInLetterePage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<NumberMode>('text');
  protected readonly input = signal('');
  protected readonly euro = signal(false);
  protected readonly joined = signal(false);
  protected readonly letterCase = signal<LetterCase>('lower');

  protected readonly modes = computed<SegmentOption<NumberMode>[]>(() => [
    { value: 'text', label: this.i18n.t('nl.mode.text') },
    { value: 'cheque', label: this.i18n.t('nl.mode.cheque') },
  ]);

  private readonly outcome = computed(() => {
    if (this.input().trim() === '') return null;
    return convertNumber(this.input(), { mode: this.mode(), euro: this.euro(), joined: this.joined(), letterCase: this.letterCase() });
  });
  protected readonly text = computed(() => {
    const o = this.outcome();
    return o && o.ok ? o.text : '';
  });
  protected readonly error = computed(() => {
    const o = this.outcome();
    return o && !o.ok && o.error !== 'empty' ? this.i18n.t('nl.err.' + o.error) : '';
  });
  protected readonly rules = ['1', '2', '3', '4'];

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    input: this.input,
    euro: this.euro,
    joined: this.joined,
    letterCase: this.letterCase,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(NL_DICTIONARIES);
  }

  protected onCase(e: Event): void {
    this.letterCase.set((e.target as HTMLSelectElement).value as LetterCase);
  }
}
