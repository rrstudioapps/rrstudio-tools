// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { DedupeMode, Lang, SortMode, processLines } from './sort-lines';
import { SL_DICTIONARIES } from './sort-lines.i18n';

const MODES: SortMode[] = ['alpha', 'natural', 'length', 'frequency', 'random', 'none'];
const DEDUPES: DedupeMode[] = ['none', 'exact', 'ignoreCase'];

@Component({
  selector: 'app-sort-lines',
  imports: [Icon, IoPanel, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sort-lines.page.html',
  styleUrl: './sort-lines.page.scss',
})
export class SortLinesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly modes = MODES;
  protected readonly dedupes = DEDUPES;

  protected readonly input = signal('');
  protected readonly mode = signal<SortMode>('alpha');
  protected readonly reverse = signal(false);
  protected readonly caseSensitive = signal(false);
  protected readonly lang = signal<Lang>(this.i18n.lang() === 'en' ? 'en' : 'it');
  protected readonly trim = signal(false);
  protected readonly removeEmpty = signal(false);
  protected readonly dedupe = signal<DedupeMode>('none');
  protected readonly collapseSpaces = signal(false);
  protected readonly count = signal(false);
  protected readonly prefix = signal('');
  protected readonly suffix = signal('');
  protected readonly numbering = signal(false);
  protected readonly numberStart = signal(1);
  protected readonly numberSep = signal('. ');
  /** Cambia a ogni "Rimescola": l'ordine casuale si ricalcola. */
  protected readonly shuffleTick = signal(0);

  protected readonly result = computed(() => {
    this.shuffleTick();
    return processLines(this.input(), {
      mode: this.mode(),
      reverse: this.reverse(),
      caseSensitive: this.caseSensitive(),
      lang: this.lang(),
      trim: this.trim(),
      removeEmpty: this.removeEmpty(),
      dedupe: this.dedupe(),
      collapseSpaces: this.collapseSpaces(),
      countOccurrences: this.count(),
      prefix: this.prefix(),
      suffix: this.suffix(),
      numbering: this.numbering(),
      numberStart: this.numberStart(),
      numberSeparator: this.numberSep(),
    });
  });
  protected readonly output = computed(() => this.result().text);
  protected readonly stats = computed(() => {
    const r = this.result();
    if (this.input() === '') return '';
    const parts = [this.i18n.t('sl.stats', { in: r.linesIn, out: r.linesOut })];
    if (r.duplicatesRemoved) parts.push(this.i18n.t('sl.stats.dup', { n: r.duplicatesRemoved }));
    if (r.emptyRemoved) parts.push(this.i18n.t('sl.stats.empty', { n: r.emptyRemoved }));
    return parts.join(' · ');
  });

  constructor() {
    this.i18n.register(SL_DICTIONARIES);
  }

  protected useAsInput(): void {
    this.input.set(this.output());
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output()), 'righe-ordinate.txt', 'text/plain;charset=utf-8');
  }

  protected num(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 1;
  }
}
