// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { MODES, SHARE_SCHEMA, SPACES } from './utm-link-builder.share';
import { UTM_DICTIONARIES } from './utm-link-builder.i18n';
import {
  PRESETS, buildBulk, buildUtmLink, bulkToCsv, parseBulkLines,
  type UtmOptions, type UtmParams, type UtmPreset, type UtmWarning,
} from './utm-link-builder';

type Mode = (typeof MODES)[number];
type Spaces = (typeof SPACES)[number];
type TextField = 'source' | 'medium' | 'campaign' | 'term' | 'content' | 'id';

/** Errori che riguardano l'indirizzo (mostrati sul campo); gli altri riguardano i valori. */
const URL_ERRORS = ['empty', 'invalid', 'scheme', 'tooLong'];

@Component({
  selector: 'app-utm-link-builder',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './utm-link-builder.page.html',
  styleUrl: './utm-link-builder.page.scss',
})
export class UtmLinkBuilderPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('single');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => MODES.map((m) => ({ value: m, label: this.i18n.t('utm.mode.' + m) })));
  protected readonly url = signal('');
  protected readonly source = signal('');
  protected readonly medium = signal('');
  protected readonly campaign = signal('');
  protected readonly term = signal('');
  protected readonly content = signal('');
  protected readonly id = signal('');
  protected readonly lowercase = signal(true);
  protected readonly spaces = signal<Spaces>('percent');
  protected readonly bulk = signal('');
  protected readonly presets = PRESETS;
  protected readonly spacesOptions = SPACES;

  private readonly options = computed<UtmOptions>(() => ({ lowercase: this.lowercase(), spaces: this.spaces() }));
  private readonly params = computed<UtmParams>(() => ({
    source: this.source(), medium: this.medium(), campaign: this.campaign(), term: this.term(), content: this.content(), id: this.id(),
  }));

  // --- indirizzo ---
  private readonly urlCheck = computed(() => (this.url().trim() === '' ? null : buildUtmLink(this.url(), {}, this.options())));
  protected readonly urlError = computed(() => {
    const r = this.urlCheck();
    return r && !r.ok && URL_ERRORS.includes(r.error) ? 'utm.err.' + r.error : '';
  });

  // --- un link ---
  private readonly singleRaw = computed(() => (this.urlCheck()?.ok ? buildUtmLink(this.url(), this.params(), this.options()) : null));
  protected readonly single = computed(() => {
    const r = this.singleRaw();
    return r && r.ok ? r : null;
  });
  protected readonly singleError = computed(() => {
    const r = this.singleRaw();
    return r && !r.ok ? 'utm.err.' + r.error : '';
  });

  // --- più sorgenti ---
  private readonly parsed = computed(() => parseBulkLines(this.bulk()));
  protected readonly bulkErrors = computed(() => this.parsed().errors);
  protected readonly bulkLinks = computed(() => (this.urlCheck()?.ok ? buildBulk(this.url(), this.params(), this.parsed().rows, this.options()) : []));
  protected readonly bulkOk = computed(() => this.bulkLinks().filter((l) => l.result.ok).length);
  protected readonly bulkText = computed(() =>
    this.bulkLinks().map((l) => (l.result.ok ? l.result.url : '')).filter((u) => u !== '').join('\n'),
  );

  /** Avvisi della modalità corrente, senza ripetizioni (nella tabella sono quelli di tutte le righe). */
  protected readonly warnings = computed<string[]>(() => {
    const all: UtmWarning[] =
      this.mode() === 'single'
        ? (this.single()?.warnings ?? [])
        : this.bulkLinks().flatMap((l) => (l.result.ok ? l.result.warnings : []));
    return [...new Set(all.map((w) => this.warnText(w)))];
  });

  protected warnText(w: UtmWarning): string {
    const key = 'utm.w.' + w.code + (w.applied === undefined ? '' : w.applied ? '.on' : '.off');
    return this.i18n.t(key, { field: w.field ? 'utm_' + w.field : '', names: (w.names ?? []).join(', ') });
  }
  protected errorLine(e: { line: number; text: string; reason: string }): string {
    const reason = this.i18n.t(e.reason === 'empty' ? 'utm.err.rowEmpty' : 'utm.err.' + e.reason);
    return this.i18n.t('utm.err.line', { n: e.line, text: e.text, reason });
  }
  protected rowError(r: { ok: boolean; error?: string }): string {
    return r.ok ? '' : this.i18n.t('utm.err.' + r.error);
  }

  protected setText(field: TextField, value: string): void {
    this[field].set(value);
  }

  /** Un clic su un canale: compila sorgente e mezzo, oppure aggiunge una riga all'elenco. */
  protected applyPreset(p: UtmPreset): void {
    if (this.mode() === 'single') {
      this.source.set(p.source);
      this.medium.set(p.medium);
    } else {
      const cur = this.bulk();
      const sep = cur === '' || cur.endsWith('\n') ? '' : '\n';
      this.bulk.set(`${cur}${sep}${p.source},${p.medium}\n`.slice(0, 3000));
    }
  }

  protected setSpaces(value: string): void {
    const s = SPACES.find((x) => x === value);
    if (s) this.spaces.set(s);
  }

  protected downloadCsv(): void {
    // BOM iniziale: Excel apre così il file come UTF-8
    const csv = '﻿' + bulkToCsv(this.bulkLinks(), this.params());
    saveBytes(new TextEncoder().encode(csv), this.i18n.t('utm.file'), 'text/csv;charset=utf-8');
  }

  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({
    mode: this.mode(), url: this.url().slice(0, 500), source: this.source().slice(0, 200), medium: this.medium().slice(0, 200),
    campaign: this.campaign().slice(0, 200), term: this.term().slice(0, 200), content: this.content().slice(0, 200), id: this.id().slice(0, 200),
    lowercase: this.lowercase(), spaces: this.spaces(), bulk: this.bulk().slice(0, 3000),
  });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    const m = MODES.find((x) => x === s['mode']);
    if (m) this.mode.set(m);
    const sp = SPACES.find((x) => x === s['spaces']);
    if (sp) this.spaces.set(sp);
    if (typeof s['lowercase'] === 'boolean') this.lowercase.set(s['lowercase']);
    const text = (key: string, sig: { set(v: string): void }) => {
      const v = s[key];
      if (typeof v === 'string') sig.set(v);
    };
    text('url', this.url); text('source', this.source); text('medium', this.medium); text('campaign', this.campaign);
    text('term', this.term); text('content', this.content); text('id', this.id); text('bulk', this.bulk);
  }

  constructor() {
    this.i18n.register(UTM_DICTIONARIES);
  }

  protected clear(): void {
    this.url.set('');
    this.source.set('');
    this.medium.set('');
    this.campaign.set('');
    this.term.set('');
    this.content.set('');
    this.id.set('');
    this.bulk.set('');
    this.lowercase.set(true);
    this.spaces.set('percent');
  }
}
