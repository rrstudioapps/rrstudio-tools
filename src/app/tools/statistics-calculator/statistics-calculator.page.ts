// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatNumber } from '../../shared/decimal';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrintButton, PrintParam } from '../../shared/print-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { computeStats, csvColumns, histogram, parseCsvColumn, parseCsvRows, parseNumberList, percentileSorted, sturges } from './statistics';
import { STATS_DICTIONARIES } from './statistics-calculator.i18n';
import { SHARE_SCHEMA } from './statistics-calculator.share';

type Source = 'list' | 'csv';

interface Row {
  key: string;
  label: string;
  value: string;
}

/** Geometria dell'istogramma (viewBox 600×280). */
interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}

const W = 600;
const H = 280;
const PAD = { l: 44, r: 12, t: 12, b: 44 };

@Component({
  selector: 'app-statistics-calculator',
  imports: [ShareLink, Icon, PrintButton, PrivacyNote, Segmented, IoPanel, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics-calculator.page.html',
  styleUrl: './statistics-calculator.page.scss',
})
export class StatisticsCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly source = signal<Source>('list');
  protected readonly input = signal('');
  protected readonly column = signal(1);
  protected readonly header = signal(true);
  protected readonly percentile = signal(90);
  /** 0 = numero di classi automatico (regola di Sturges). */
  protected readonly bins = signal(0);

  protected readonly sources = computed<SegmentOption<Source>[]>(() => [
    { value: 'list', label: this.i18n.t('stat.source.list') },
    { value: 'csv', label: this.i18n.t('stat.source.csv') },
  ]);

  private readonly lang = computed<'it' | 'en'>(() => (this.i18n.lang() === 'it' ? 'it' : 'en'));

  protected readonly columnCount = computed(() => (this.source() === 'csv' ? csvColumns(this.input()) : 0));
  protected readonly columnOptions = computed(() => {
    const first = this.header() ? parseCsvRows(this.input())[0] : undefined;
    return Array.from({ length: this.columnCount() }, (_, i) => ({
      n: i + 1,
      label: first?.[i]?.trim() ? first[i].trim() : this.i18n.t('stat.column.n', { n: i + 1 }),
    }));
  });

  private readonly parsed = computed(() => {
    const text = this.input();
    if (text.trim() === '') return { values: [], invalid: [], invalidCount: 0 };
    return this.source() === 'csv' ? parseCsvColumn(text, this.column() - 1, this.header(), this.lang()) : parseNumberList(text, this.lang());
  });

  protected readonly stats = computed(() => computeStats(this.parsed().values));

  protected readonly status = computed(() => {
    const p = this.parsed();
    const parts: string[] = [];
    if (p.values.length) parts.push(this.i18n.t('stat.found', { n: p.values.length }));
    if (p.invalidCount) parts.push(this.i18n.t('stat.invalid', { n: p.invalidCount, list: p.invalid.join(', ') + (p.invalidCount > p.invalid.length ? '…' : '') }));
    return parts.join(' ');
  });

  private fmt(n: number): string {
    return formatNumber(n, this.lang(), 6);
  }

  protected readonly rows = computed<Row[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t('stat.k.' + k, p);
    const na = t('na');
    const rows: Row[] = [
      { key: 'count', label: t('count'), value: String(s.count) },
      { key: 'sum', label: t('sum'), value: this.fmt(s.sum) },
      { key: 'min', label: t('min'), value: this.fmt(s.min) },
      { key: 'max', label: t('max'), value: this.fmt(s.max) },
      { key: 'range', label: t('range'), value: this.fmt(s.range) },
      { key: 'mean', label: t('mean'), value: this.fmt(s.mean) },
      { key: 'median', label: t('median'), value: this.fmt(s.median) },
      {
        key: 'mode',
        label: t('mode'),
        value: s.mode.length ? t('mode.times', { v: s.mode.map((v) => this.fmt(v)).join(', '), n: s.modeCount }) : t('mode.none'),
      },
      { key: 'varS', label: t('varS'), value: s.varianceSample === null ? na : this.fmt(s.varianceSample) },
      { key: 'varP', label: t('varP'), value: this.fmt(s.variancePopulation) },
      { key: 'sdS', label: t('sdS'), value: s.sdSample === null ? na : this.fmt(s.sdSample) },
      { key: 'sdP', label: t('sdP'), value: this.fmt(s.sdPopulation) },
      { key: 'q1', label: t('q1'), value: this.fmt(s.quartiles.q1) },
      { key: 'q3', label: t('q3'), value: this.fmt(s.quartiles.q3) },
      { key: 'iqr', label: t('iqr'), value: this.fmt(s.quartiles.iqr) },
      { key: 'pct', label: t('pct', { p: this.fmt(this.percentile()) }), value: this.fmt(percentileSorted(s.sorted, this.percentile())) },
      { key: 'fences', label: t('fences'), value: t('fences.v', { low: this.fmt(s.fences.low), high: this.fmt(s.fences.high) }) },
      { key: 'outliers', label: t('outliers'), value: s.outliers.length ? s.outliers.map((v) => this.fmt(v)).join(', ') : t('outliers.none') },
    ];
    return rows;
  });

  /** Le statistiche come testo (una riga per voce, etichetta e valore separati da tab). */
  protected readonly summary = computed(() => this.rows().map((r) => r.label + '\t' + r.value).join('\n'));

  protected readonly hist = computed(() => {
    const s = this.stats();
    if (!s) return null;
    const k = this.bins() > 0 ? this.bins() : sturges(s.count);
    const bins = histogram(s.sorted, k);
    const maxCount = Math.max(...bins.map((b) => b.count));
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const bw = innerW / bins.length;
    const bars: Bar[] = bins.map((b, i) => {
      const h = (b.count / maxCount) * innerH;
      return {
        x: PAD.l + i * bw + 1,
        y: PAD.t + innerH - h,
        w: Math.max(1, bw - 2),
        h,
        title: this.i18n.t('stat.hist.bin', { from: this.fmt(b.from), to: this.fmt(b.to), n: b.count }),
      };
    });
    // etichette dell'asse x: inizio di alcune classi e il massimo
    const step = Math.ceil(bins.length / 6);
    const xTicks = bins
      .map((b, i) => ({ x: PAD.l + i * bw, label: this.fmt(b.from), i, anchor: i === 0 ? 'start' : 'middle' }))
      .filter((t) => t.i % step === 0);
    xTicks.push({ x: PAD.l + innerW, label: this.fmt(bins[bins.length - 1].to), i: -1, anchor: 'end' });
    const yTicks = [0, Math.ceil(maxCount / 2), maxCount].filter((v, i, a) => a.indexOf(v) === i).map((v) => ({ y: PAD.t + innerH - (v / maxCount) * innerH, label: String(v) }));
    return {
      bars,
      xTicks,
      yTicks,
      base: PAD.t + innerH,
      desc: this.i18n.t('stat.hist.desc', { n: s.count, k: bins.length, min: this.fmt(s.min), max: this.fmt(s.max) }),
    };
  });

  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;

  /** Parametri per il riepilogo di stampa (al posto dei campi). */
  protected readonly printParams = computed<PrintParam[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const p = (label: string, value: string): PrintParam => ({ label, value: value.trim() || '-' });
    const out = [p(t('stat.source'), t('stat.source.' + this.source()))];
    if (this.source() === 'csv') out.push(p(t('stat.column'), this.columnOptions().find((c) => c.n === this.column())?.label ?? String(this.column())));
    out.push(p(t('stat.percentile'), String(this.percentile())));
    if (this.bins() > 0) out.push(p(t('stat.bins'), String(this.bins())));
    return out;
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    source: this.source,
    input: this.input,
    column: this.column,
    header: this.header,
    percentile: this.percentile,
    bins: this.bins,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(STATS_DICTIONARIES);
    const rx = inject(ToolHandoff).take('statistics-calculator');
    if (rx?.text !== undefined) {
      this.source.set(rx.kind === 'csv' ? 'csv' : 'list');
      this.input.set(rx.text);
    }
  }

  protected loadSample(): void {
    this.source.set('list');
    this.input.set('2 4 4 4 5 5 7 9 12 30');
  }

  protected setPercentile(raw: string): void {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) this.percentile.set(Math.max(0, Math.min(100, n)));
  }

  protected setBins(raw: string): void {
    const n = Math.trunc(Number(raw));
    this.bins.set(Number.isFinite(n) ? Math.max(0, Math.min(60, n)) : 0);
  }
}
