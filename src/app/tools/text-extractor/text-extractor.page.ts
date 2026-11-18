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
import { EXT_DICTIONARIES } from './text-extractor.i18n';
import { SHARE_SCHEMA } from './text-extractor.share';
import {
  DEFAULT_OPTIONS, KINDS, MAX_CHARS, MAX_SHOWN, arrange, countOf, findAll, supportsIgnoreCase, toCsv, toText,
  type ExtractResult, type Kind, type Separator, type SortMode,
} from './text-extractor';

@Component({
  selector: 'app-text-extractor',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-extractor.page.html',
  styleUrl: './text-extractor.page.scss',
})
export class TextExtractorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly text = signal('');
  protected readonly kind = signal<Kind>('email');
  protected readonly unique = signal(DEFAULT_OPTIONS.unique);
  protected readonly sort = signal<SortMode>(DEFAULT_OPTIONS.sort);
  protected readonly ignoreCase = signal(DEFAULT_OPTIONS.ignoreCase);
  protected readonly showCount = signal(false);
  protected readonly sep = signal<Separator>('newline');
  protected readonly shownCount = MAX_SHOWN;

  protected readonly sortOptions = computed<SegmentOption<SortMode>[]>(() => [
    { value: 'appearance', label: this.i18n.t('ext.sort.appearance') },
    { value: 'az', label: this.i18n.t('ext.sort.az') },
    { value: 'frequency', label: this.i18n.t('ext.sort.frequency') },
  ]);
  protected readonly sepOptions = computed<SegmentOption<Separator>[]>(() => [
    { value: 'newline', label: this.i18n.t('ext.sep.newline') },
    { value: 'comma', label: this.i18n.t('ext.sep.comma') },
    { value: 'semicolon', label: this.i18n.t('ext.sep.semicolon') },
  ]);

  protected readonly supportsCase = computed(() => supportsIgnoreCase(this.kind()));

  protected num(n: number): string {
    return n.toLocaleString(this.i18n.locale());
  }

  protected readonly error = computed(() =>
    this.text().length > MAX_CHARS ? this.i18n.t('ext.tooBig', { chars: this.num(this.text().length), max: this.num(MAX_CHARS) }) : '',
  );

  /** Tutte le occorrenze di ogni tipo (si ricalcolano solo quando cambia il testo). */
  private readonly found = computed<Record<Kind, string[]> | null>(() => {
    const t = this.text();
    if (t === '' || this.error()) return null;
    return Object.fromEntries(KINDS.map((k) => [k, findAll(t, k)])) as Record<Kind, string[]>;
  });

  /** Un pulsante per tipo, col numero di voci che mostrerebbe. */
  protected readonly kindOptions = computed<SegmentOption<Kind>[]>(() => {
    const f = this.found();
    return KINDS.map((k) => {
      const n = f ? countOf(f[k], k, { unique: this.unique(), ignoreCase: this.ignoreCase() }) : 0;
      return { value: k, label: `${this.i18n.t('ext.kind.' + k)} (${this.num(n)})` };
    });
  });

  protected readonly result = computed<ExtractResult | null>(() => {
    const f = this.found();
    if (!f) return null;
    const kind = this.kind();
    return arrange(f[kind], kind, { unique: this.unique(), sort: this.sort(), ignoreCase: this.ignoreCase(), locale: this.i18n.locale() });
  });

  protected readonly truncated = computed(() => (this.result()?.items.length ?? 0) > MAX_SHOWN);

  protected readonly summary = computed(() => {
    const r = this.result();
    if (!r) return '';
    if (!this.unique()) return this.i18n.t('ext.summary.all', { n: this.num(r.total) });
    return this.i18n.t('ext.summary.unique', {
      n: this.num(r.items.length),
      items: this.i18n.t(r.items.length === 1 ? 'ext.item.one' : 'ext.item.many'),
      total: this.num(r.total),
    });
  });

  /** Testo copiato: tutte le voci, col separatore scelto. */
  protected readonly fullText = computed(() => toText(this.result()?.items ?? [], this.sep(), this.showCount()));
  /** Testo mostrato: al massimo {@link MAX_SHOWN} voci. */
  protected readonly shownText = computed(() => {
    const items = this.result()?.items ?? [];
    return items.length > MAX_SHOWN ? toText(items.slice(0, MAX_SHOWN), this.sep(), this.showCount()) : this.fullText();
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    text: this.text, kind: this.kind, unique: this.unique, sort: this.sort, ignoreCase: this.ignoreCase, showCount: this.showCount, sep: this.sep,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(EXT_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('text-extractor');
    if (rx?.text !== undefined) this.text.set(rx.text);
  }

  protected reset(): void {
    this.text.set('');
  }

  protected downloadTxt(): void {
    const body = toText(this.result()?.items ?? [], 'newline', this.showCount());
    saveBytes(new TextEncoder().encode(body), this.i18n.t('ext.file.txt'), 'text/plain;charset=utf-8');
  }

  protected downloadCsv(): void {
    saveBytes(new TextEncoder().encode(toCsv(this.result()?.items ?? [])), this.i18n.t('ext.file.csv'), 'text/csv;charset=utf-8');
  }
}
