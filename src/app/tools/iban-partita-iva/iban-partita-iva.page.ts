// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { MAX_BULK_LINES, ValueKind, ValueResult, analyzeBulk, analyzeValue, detectKind, toCsv } from './detect';
import { IBV_DICTIONARIES } from './iban-partita-iva.i18n';
import { ToolHandoff } from '../../shared/tool-handoff';

type Tab = 'auto' | 'iban' | 'vat' | 'bulk';
type BulkKind = 'auto' | 'iban' | 'vat';

export const EXAMPLE_IBAN = 'IT60 X054 2811 1010 0000 0123 456';
export const EXAMPLE_VAT = '12345678903';

@Component({
  selector: 'app-iban-partita-iva',
  imports: [Icon, PrivacyNote, Segmented, CopyButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iban-partita-iva.page.html',
  styleUrl: './iban-partita-iva.page.scss',
})
export class IbanPartitaIvaPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly tab = signal<Tab>('auto');
  protected readonly value = signal('');
  protected readonly bulkText = signal('');
  protected readonly bulkKind = signal<BulkKind>('auto');
  private readonly sepOverride = signal<';' | ',' | null>(null);
  protected readonly sep = computed(() => this.sepOverride() ?? (this.i18n.lang() === 'it' ? ';' : ','));
  protected readonly maxLines = MAX_BULK_LINES;

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    { value: 'auto', label: this.i18n.t('ibv.tab.auto') },
    { value: 'iban', label: this.i18n.t('ibv.tab.iban') },
    { value: 'vat', label: this.i18n.t('ibv.tab.vat') },
    { value: 'bulk', label: this.i18n.t('ibv.tab.bulk') },
  ]);

  protected readonly detected = computed<ValueKind>(() => {
    const t = this.tab();
    return t === 'iban' || t === 'vat' ? t : detectKind(this.value());
  });

  /** Risultato del valore singolo (null se il campo è vuoto). */
  protected readonly single = computed<ValueResult | null>(() => (this.value().trim() ? analyzeValue(this.value(), 1, this.detected()) : null));

  protected readonly fieldLabel = computed(() => this.i18n.t('ibv.field.' + (this.tab() === 'bulk' ? 'auto' : this.tab())));
  protected readonly placeholder = computed(() => this.i18n.t('ibv.ph.' + (this.tab() === 'bulk' ? 'auto' : this.tab())));

  protected readonly singleIssues = computed<string[]>(() => {
    const r = this.single();
    return r ? this.issueTexts(r) : [];
  });
  protected readonly mod97Failed = computed(() => this.single()?.iban?.issues.includes('mod97') ?? false);
  protected readonly countryName = computed(() => {
    const cc = this.single()?.iban?.country;
    return cc ? this.regionName(cc) : '';
  });

  protected readonly bulk = computed(() => analyzeBulk(this.bulkText(), this.bulkKind()));
  protected readonly bulkRows = computed(() =>
    this.bulk().results.map((r) => ({
      r,
      kind: this.i18n.t('ibv.kind.' + r.kind),
      reason: this.issueTexts(r).join(' '),
    })),
  );
  protected readonly bulkSummary = computed(() => {
    const rows = this.bulk().results;
    if (!rows.length) return this.i18n.t('ibv.bulk.summary.none');
    const valid = rows.filter((r) => r.valid).length;
    return this.i18n.t('ibv.bulk.summary', { total: rows.length, valid, invalid: rows.length - valid });
  });
  protected readonly kindOptions = computed<{ value: BulkKind; label: string }[]>(() => [
    { value: 'auto', label: this.i18n.t('ibv.bulk.kind.auto') },
    { value: 'iban', label: this.i18n.t('ibv.kind.iban') },
    { value: 'vat', label: this.i18n.t('ibv.kind.vat') },
  ]);

  constructor() {
    this.i18n.register(IBV_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('iban-partita-iva');
    if (rx?.text !== undefined) {
      const text = rx.text.trim();
      // più valori (per esempio dal generatore di codici di prova): si controllano in blocco
      if (text.split(/\r\n|\r|\n/).filter((l) => l.trim()).length > 1) {
        this.tab.set('bulk');
        this.bulkText.set(text);
      } else this.value.set(text);
    }
  }

  private regionName(cc: string): string {
    try {
      return new Intl.DisplayNames([this.i18n.locale()], { type: 'region' }).of(cc) ?? cc;
    } catch {
      return cc;
    }
  }

  /** Testi dei problemi di un risultato (tutti, nell'ordine). */
  protected issueTexts(r: ValueResult): string[] {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    if (r.kind === 'iban' && r.iban) {
      const a = r.iban;
      return a.issues.map((i) =>
        t('ibv.issue.' + i, {
          cc: a.country ?? '',
          len: a.length,
          expected: i === 'cin' ? (a.it?.expectedCin ?? '') : (a.expectedLength ?? ''),
          pos: a.badPosition ?? '',
        }),
      );
    }
    if (r.kind === 'vat' && r.vat) {
      const v = r.vat;
      return v.issues.map((i) => t('ibv.vissue.' + i, { len: v.digits.length, expected: v.expectedCheck ?? '' }));
    }
    return r.kind === 'taxcode' ? [t('ibv.issue.taxcode')] : [t('ibv.issue.unknown-kind')];
  }

  protected useExample(kind: 'iban' | 'vat'): void {
    this.value.set(kind === 'iban' ? EXAMPLE_IBAN : EXAMPLE_VAT);
    if (this.tab() !== 'auto') this.tab.set(kind);
  }

  protected setSep(v: string): void {
    this.sepOverride.set(v === ',' ? ',' : ';');
  }

  protected exportCsv(): void {
    if (!this.browser) return;
    const t = (k: string) => this.i18n.t(k);
    const rows: string[][] = [
      [t('ibv.bulk.col.line'), t('ibv.bulk.col.value'), t('ibv.bulk.col.type'), t('ibv.bulk.col.result'), t('ibv.bulk.col.reason'), t('ibv.bulk.col.normalized')],
      ...this.bulkRows().map(({ r, kind, reason }) => [String(r.line), r.input, kind, r.valid ? t('ibv.valid') : t('ibv.invalid'), reason, r.normalized]),
    ];
    const blob = new Blob(['﻿' + toCsv(rows, this.sep())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('ibv.bulk.file');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
