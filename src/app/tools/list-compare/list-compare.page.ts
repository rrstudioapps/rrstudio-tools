// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
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
import { LCMP_DICTIONARIES } from './list-compare.i18n';
import { SHARE_SCHEMA } from './list-compare.share';
import { DEFAULT_OPTIONS, MAX_LINES, compareLists, duplicatesToText, splitLines, type CompareResult, type SortMode } from './list-compare';

type Tab = 'union' | 'common' | 'onlyA' | 'onlyB' | 'dups';

@Component({
  selector: 'app-list-compare',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-compare.page.html',
  styleUrl: './list-compare.page.scss',
})
export class ListComparePage {
  protected readonly i18n = inject(I18nService);

  protected readonly a = signal('');
  protected readonly b = signal('');
  protected readonly ignoreCase = signal(DEFAULT_OPTIONS.ignoreCase);
  protected readonly trim = signal(DEFAULT_OPTIONS.trim);
  protected readonly ignoreEmpty = signal(DEFAULT_OPTIONS.ignoreEmpty);
  protected readonly sort = signal<SortMode>(DEFAULT_OPTIONS.sort);
  protected readonly tab = signal<Tab>('common');

  protected readonly sortOptions = computed<SegmentOption<SortMode>[]>(() => [
    { value: 'appearance', label: this.i18n.t('lcmp.sort.appearance') },
    { value: 'az', label: this.i18n.t('lcmp.sort.az') },
    { value: 'natural', label: this.i18n.t('lcmp.sort.natural') },
  ]);

  protected readonly linesA = computed(() => splitLines(this.a()).length);
  protected readonly linesB = computed(() => splitLines(this.b()).length);

  /** Messaggio se un elenco supera il limite di righe. */
  protected readonly error = computed(() => {
    const loc = this.i18n.locale();
    const over = (n: number, which: string): string =>
      this.i18n.t('lcmp.tooMany', { which, n: n.toLocaleString(loc), max: MAX_LINES.toLocaleString(loc) });
    if (this.linesA() > MAX_LINES) return over(this.linesA(), 'A');
    if (this.linesB() > MAX_LINES) return over(this.linesB(), 'B');
    return '';
  });

  protected readonly result = computed<CompareResult | null>(() => {
    if (this.error() || (this.a() === '' && this.b() === '')) return null;
    return compareLists(this.a(), this.b(), {
      ignoreCase: this.ignoreCase(),
      trim: this.trim(),
      ignoreEmpty: this.ignoreEmpty(),
      sort: this.sort(),
      locale: this.i18n.locale(),
    });
  });

  private items(n: number): string {
    return this.i18n.t(n === 1 ? 'lcmp.item.one' : 'lcmp.item.many', { n: n.toLocaleString(this.i18n.locale()) });
  }
  protected num(n: number): string {
    return n.toLocaleString(this.i18n.locale());
  }

  protected readonly summary = computed(() => {
    const r = this.result();
    if (!r) return '';
    return this.i18n.t('lcmp.summary', {
      a: this.items(r.countA),
      b: this.items(r.countB),
      c: this.num(r.common.length),
      oa: this.num(r.onlyA.length),
      ob: this.num(r.onlyB.length),
    });
  });

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => {
    const r = this.result();
    const n = (x: number | undefined): string => (x === undefined ? '' : ` (${this.num(x)})`);
    return [
      { value: 'union', label: this.i18n.t('lcmp.tab.union') + n(r?.union.length) },
      { value: 'common', label: this.i18n.t('lcmp.tab.common') + n(r?.common.length) },
      { value: 'onlyA', label: this.i18n.t('lcmp.tab.onlyA') + n(r?.onlyA.length) },
      { value: 'onlyB', label: this.i18n.t('lcmp.tab.onlyB') + n(r?.onlyB.length) },
      { value: 'dups', label: this.i18n.t('lcmp.tab.dups') + n(r ? r.dupA.length + r.dupB.length : undefined) },
    ];
  });

  /** Testo della scheda scelta (per elenco, copia e download). */
  protected readonly tabText = computed(() => {
    const r = this.result();
    return r ? this.textOf(r, this.tab()) : '';
  });
  protected readonly dupAText = computed(() => duplicatesToText(this.result()?.dupA ?? []));
  protected readonly dupBText = computed(() => duplicatesToText(this.result()?.dupB ?? []));
  protected readonly dupsCount = computed(() => (this.result()?.dupA.length ?? 0) + (this.result()?.dupB.length ?? 0));

  private textOf(r: CompareResult, tab: Tab): string {
    switch (tab) {
      case 'union': return r.union.join('\n');
      case 'common': return r.common.join('\n');
      case 'onlyA': return r.onlyA.join('\n');
      case 'onlyB': return r.onlyB.join('\n');
      case 'dups': return [this.dupBlock(r.dupA, 'A'), this.dupBlock(r.dupB, 'B')].filter((x) => x !== '').join('\n\n');
    }
  }

  private dupBlock(d: CompareResult['dupA'], which: string): string {
    return d.length === 0 ? '' : `[${which}]\n${duplicatesToText(d)}`;
  }

  /** Tutte le sezioni, ciascuna con il titolo. */
  protected readonly allText = computed(() => {
    const r = this.result();
    if (!r) return '';
    const tabs: Tab[] = ['union', 'common', 'onlyA', 'onlyB', 'dups'];
    return tabs
      .map((t) => {
        const count = t === 'dups' ? r.dupA.length + r.dupB.length : r[t].length;
        return `== ${this.i18n.t('lcmp.tab.' + t)} (${count}) ==\n${this.textOf(r, t)}`.trimEnd();
      })
      .join('\n\n');
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { a: this.a, b: this.b, ignoreCase: this.ignoreCase, trim: this.trim, ignoreEmpty: this.ignoreEmpty, sort: this.sort };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(LCMP_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('list-compare');
    if (rx?.text !== undefined) this.a.set(rx.text);
  }

  protected swap(): void {
    const x = this.a();
    this.a.set(this.b());
    this.b.set(x);
  }

  protected reset(): void {
    this.a.set('');
    this.b.set('');
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.tabText()), this.i18n.t('lcmp.file.' + this.tab()), 'text/plain;charset=utf-8');
  }
}
