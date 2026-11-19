// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { CASE_IDS, CaseId, convertCase } from './case';
import { CASE_DICTIONARIES } from './case-converter.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './case-converter.share';
import { ToolHandoff } from '../../shared/tool-handoff';

const SAMPLE = 'getHTTPResponse per il nome della rosa\nuser_profile_id: perché è così';

@Component({
  selector: 'app-case-converter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-converter.page.html',
  styleUrl: './case-converter.page.scss',
})
export class CaseConverterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly perLine = signal(true);
  protected readonly keepAcronyms = signal(true);
  protected readonly stripAccents = signal(false);

  protected readonly results = computed(() => {
    const text = this.input();
    if (text === '') return [];
    const opts = { perLine: this.perLine(), keepAcronyms: this.keepAcronyms(), stripAccents: this.stripAccents() };
    return CASE_IDS.map((id: CaseId) => ({
      id,
      name: this.i18n.t('case.' + id),
      value: convertCase(text, id, opts),
    }));
  });
  protected readonly meta = computed(() =>
    this.input() ? this.i18n.t('case.meta', { lines: this.input().split('\n').length, chars: [...this.input()].length }) : '',
  );

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    perLine: this.perLine,
    keepAcronyms: this.keepAcronyms,
    stripAccents: this.stripAccents,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(CASE_DICTIONARIES);
    const rx = inject(ToolHandoff).take('case-converter');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected onInput(e: Event): void {
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.input.set(SAMPLE);
  }

  protected clear(): void {
    this.input.set('');
  }
}
