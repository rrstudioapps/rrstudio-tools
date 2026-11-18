// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { useNow } from '../../shared/clock';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { TIMESTAMP_DICTIONARIES } from './timestamp-converter.i18n';
import {
  MAX_BATCH,
  ParsedDate,
  ParsedTimestamp,
  Unit,
  UnitChoice,
  UNITS,
  formatIso,
  formatLocale,
  formatRelative,
  formatRfc2822,
  isValidTimeZone,
  msToTimestamp,
  parseBatch,
  parseDate,
  parseTimestamp,
  timeZoneList,
} from './timestamp';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './timestamp-converter.share';
import { ToolHandoff } from '../../shared/tool-handoff';

interface OutRow {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-timestamp-converter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timestamp-converter.page.html',
  styleUrl: './timestamp-converter.page.scss',
})
export class TimestampConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly now = useNow(1000);

  protected readonly units = UNITS;
  protected readonly zones = timeZoneList();
  protected readonly maxBatch = MAX_BATCH;
  /** Vero solo nel browser dopo l'idratazione: il prerender non contiene l'ora di compilazione né il fuso del server. */
  protected readonly ready = signal(false);

  protected readonly tz = signal('UTC');
  protected readonly unit = signal<UnitChoice>('auto');
  protected readonly tsInput = signal('');
  protected readonly dateInput = signal('');
  protected readonly batchInput = signal('');

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    tz: this.tz,
    unit: this.unit,
    tsInput: this.tsInput,
    dateInput: this.dateInput,
    batchInput: this.batchInput,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(TIMESTAMP_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('timestamp-converter');
    if (rx?.text !== undefined) {
      const t = rx.text.trim();
      // un numero è un timestamp, il resto una data da convertire
      if (/^\d{9,}(\.\d+)?$/.test(t)) this.tsInput.set(t);
      else this.dateInput.set(t);
    }
    afterNextRender(() => {
      try {
        const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (own && isValidTimeZone(own) && this.zones.includes(own)) this.tz.set(own);
      } catch {
        /* resta UTC */
      }
      this.ready.set(true);
    });
  }

  // ---- adesso ----
  protected readonly nowSeconds = computed(() => String(Math.floor(this.now() / 1000)));
  protected readonly nowMillis = computed(() => String(this.now()));
  protected readonly nowIso = computed(() => formatIso(this.now(), this.tz()));

  // ---- timestamp → data ----
  protected readonly parsed = computed<ParsedTimestamp | null>(() =>
    this.tsInput().trim() === '' ? null : parseTimestamp(this.tsInput(), this.unit()),
  );
  protected readonly tsError = computed(() => {
    const p = this.parsed();
    return p && !p.ok ? this.i18n.t('ts.err.' + p.error) : '';
  });
  protected readonly unitNote = computed(() => {
    const p = this.parsed();
    if (!p?.ok) return '';
    return this.i18n.t(p.auto ? 'ts.detected' : 'ts.chosen', { unit: this.i18n.t('ts.unit.short.' + p.unit) });
  });
  protected readonly dateRows = computed<OutRow[]>(() => {
    const p = this.parsed();
    if (!p?.ok) return [];
    const tz = this.tz();
    const rows: OutRow[] = [
      { key: 'iso', label: this.i18n.t('ts.fmt.iso'), value: formatIso(p.ms, tz) },
      { key: 'rfc', label: this.i18n.t('ts.fmt.rfc'), value: formatRfc2822(p.ms, tz) },
      { key: 'locale', label: this.i18n.t('ts.fmt.locale'), value: formatLocale(p.ms, tz, this.i18n.locale()) },
    ];
    if (tz !== 'UTC') rows.push({ key: 'utc', label: this.i18n.t('ts.fmt.utc'), value: formatIso(p.ms, 'UTC') });
    rows.push({ key: 'rel', label: this.i18n.t('ts.fmt.rel'), value: formatRelative(p.ms, this.now(), this.i18n.locale()) });
    return rows;
  });

  // ---- data → timestamp ----
  protected readonly parsedDate = computed<ParsedDate | null>(() =>
    this.dateInput().trim() === '' ? null : parseDate(this.dateInput(), this.tz()),
  );
  protected readonly dateError = computed(() => {
    const p = this.parsedDate();
    if (!p || p.ok) return '';
    return this.i18n.t(p.error === 'range' ? 'ts.err.daterange' : 'ts.err.dateformat');
  });
  protected readonly tsRows = computed<OutRow[]>(() => {
    const p = this.parsedDate();
    if (!p?.ok) return [];
    return UNITS.map((u) => ({ key: u, label: this.i18n.t('ts.out.' + u), value: msToTimestamp(p.ms, u) }));
  });
  protected readonly dateIso = computed(() => {
    const p = this.parsedDate();
    return p?.ok ? formatIso(p.ms, this.tz()) : '';
  });
  protected readonly dateWarning = computed(() => {
    const p = this.parsedDate();
    if (!p?.ok) return '';
    const tz = this.tz();
    if (p.explicitOffset) return this.i18n.t('ts.toTs.explicit');
    if (p.status === 'gap') return this.i18n.t('ts.toTs.gap', { tz });
    if (p.status === 'ambiguous') return this.i18n.t('ts.toTs.ambiguous', { tz, other: formatIso(p.candidates[1], tz) });
    return '';
  });

  // ---- più timestamp ----
  private readonly batch = computed(() => parseBatch(this.batchInput(), this.unit()));
  protected readonly batchRows = computed(() => {
    const tz = this.tz();
    return this.batch().rows.map((r) => ({
      line: r.line,
      input: r.input,
      unit: r.result.ok ? this.i18n.t('ts.unit.short.' + r.result.unit) : '',
      date: r.result.ok ? formatIso(r.result.ms, tz) : '',
      error: r.result.ok ? '' : this.i18n.t('ts.err.' + r.result.error),
    }));
  });
  protected readonly batchTruncated = computed(() => this.batch().truncated);
  protected readonly batchCount = computed(() => {
    const rows = this.batchRows();
    return rows.length ? this.i18n.t('ts.batch.count', { n: rows.length, bad: rows.filter((r) => r.error).length }) : '';
  });
  protected readonly batchText = computed(() =>
    this.batchRows()
      .map((r) => `${r.input}\t${r.error ? r.error : r.date}`)
      .join('\n'),
  );

  protected copyLabel(what: string): string {
    return this.i18n.t('ts.copy', { what });
  }

  protected setTz(value: string): void {
    if (isValidTimeZone(value)) this.tz.set(value);
  }

  protected setUnit(value: string): void {
    this.unit.set(value as UnitChoice);
  }

  protected unitLabel(u: Unit): string {
    return this.i18n.t('ts.unit.' + u);
  }

  protected useNowAsTimestamp(): void {
    this.tsInput.set(String(Math.floor(Date.now() / 1000)));
    this.unit.set('s');
  }

  protected useNowAsDate(): void {
    // ora attuale nel fuso scelto, nel formato accettato dal campo
    this.dateInput.set(formatIso(Date.now(), this.tz()).slice(0, 19).replace('T', ' '));
  }

  protected loadBatchSample(): void {
    this.batchInput.set('1700000000\n1700000000123\n1893456000\n1767225600000\n0\n-86400');
  }

  protected onInput(target: { set(v: string): void }, e: Event): void {
    target.set((e.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
