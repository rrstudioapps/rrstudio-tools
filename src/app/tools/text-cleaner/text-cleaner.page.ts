// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { TCL_DICTIONARIES } from './text-cleaner.i18n';
import { SHARE_SCHEMA } from './text-cleaner.share';
import {
  DEFAULT_OPTIONS, MAX_CHARS, cleanStats, cleanText, countLines,
  type BlankLines, type CaseMode, type CleanOptions,
} from './text-cleaner';

/** Opzioni a casella, con la chiave del dizionario del testo e (se c'è) del suggerimento. */
interface Toggle {
  key: 'joinLines' | 'dehyphen' | 'collapseSpaces' | 'trimLines' | 'straightQuotes' | 'simpleDashes' | 'invisibles' | 'stripHtml' | 'stripBullets';
  hint: boolean;
}

@Component({
  selector: 'app-text-cleaner',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-cleaner.page.html',
  styleUrl: './text-cleaner.page.scss',
})
export class TextCleanerPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly joinLines = signal(DEFAULT_OPTIONS.joinLines);
  protected readonly dehyphen = signal(DEFAULT_OPTIONS.dehyphen);
  protected readonly collapseSpaces = signal(DEFAULT_OPTIONS.collapseSpaces);
  protected readonly trimLines = signal(DEFAULT_OPTIONS.trimLines);
  protected readonly blankLines = signal<BlankLines>(DEFAULT_OPTIONS.blankLines);
  protected readonly straightQuotes = signal(DEFAULT_OPTIONS.straightQuotes);
  protected readonly simpleDashes = signal(DEFAULT_OPTIONS.simpleDashes);
  protected readonly invisibles = signal(DEFAULT_OPTIONS.invisibles);
  protected readonly stripHtml = signal(DEFAULT_OPTIONS.stripHtml);
  protected readonly stripBullets = signal(DEFAULT_OPTIONS.stripBullets);
  protected readonly caseMode = signal<CaseMode>(DEFAULT_OPTIONS.caseMode);

  protected readonly toggles: Toggle[] = [
    { key: 'joinLines', hint: true },
    { key: 'dehyphen', hint: true },
    { key: 'collapseSpaces', hint: false },
    { key: 'trimLines', hint: false },
    { key: 'straightQuotes', hint: false },
    { key: 'simpleDashes', hint: false },
    { key: 'invisibles', hint: true },
    { key: 'stripHtml', hint: true },
    { key: 'stripBullets', hint: true },
  ];

  protected readonly blankOptions = computed<SegmentOption<BlankLines>[]>(() => [
    { value: 'keep', label: this.i18n.t('tcl.blank.keep') },
    { value: 'single', label: this.i18n.t('tcl.blank.single') },
    { value: 'none', label: this.i18n.t('tcl.blank.none') },
  ]);
  protected readonly caseOptions = computed<SegmentOption<CaseMode>[]>(() => [
    { value: 'keep', label: this.i18n.t('tcl.case.keep') },
    { value: 'sentence', label: this.i18n.t('tcl.case.sentence') },
    { value: 'lower', label: this.i18n.t('tcl.case.lower') },
  ]);

  private readonly options = computed<CleanOptions>(() => ({
    joinLines: this.joinLines(),
    dehyphen: this.dehyphen(),
    collapseSpaces: this.collapseSpaces(),
    trimLines: this.trimLines(),
    blankLines: this.blankLines(),
    straightQuotes: this.straightQuotes(),
    simpleDashes: this.simpleDashes(),
    invisibles: this.invisibles(),
    stripHtml: this.stripHtml(),
    stripBullets: this.stripBullets(),
    caseMode: this.caseMode(),
  }));

  protected readonly tooBig = computed(() => this.input().length > MAX_CHARS);
  protected readonly error = computed(() =>
    this.tooBig()
      ? this.i18n.t('tcl.tooBig', { chars: this.input().length.toLocaleString(this.i18n.locale()), max: MAX_CHARS.toLocaleString(this.i18n.locale()) })
      : '',
  );
  protected readonly output = computed(() => (this.tooBig() ? '' : cleanText(this.input(), this.options())));
  protected readonly inputLines = computed(() => countLines(this.input()));
  protected readonly removedText = computed(() => {
    const s = cleanStats(this.input(), this.output());
    if (s.charsRemoved === 0 && s.linesRemoved === 0 && this.output() === this.input()) return this.i18n.t('tcl.unchanged');
    const loc = this.i18n.locale();
    return this.i18n.t('tcl.removed', { chars: s.charsRemoved.toLocaleString(loc), lines: s.linesRemoved.toLocaleString(loc) });
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    joinLines: this.joinLines,
    dehyphen: this.dehyphen,
    collapseSpaces: this.collapseSpaces,
    trimLines: this.trimLines,
    blankLines: this.blankLines,
    straightQuotes: this.straightQuotes,
    simpleDashes: this.simpleDashes,
    invisibles: this.invisibles,
    stripHtml: this.stripHtml,
    stripBullets: this.stripBullets,
    caseMode: this.caseMode,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(TCL_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('text-cleaner');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected value(key: Toggle['key']): boolean {
    return this.shared[key]();
  }

  protected setToggle(key: Toggle['key'], on: boolean): void {
    this.shared[key].set(on);
  }

  protected reset(): void {
    this.input.set('');
  }

  protected reuse(): void {
    this.input.set(this.output());
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output()), this.i18n.t('tcl.file'), 'text/plain;charset=utf-8');
  }
}
