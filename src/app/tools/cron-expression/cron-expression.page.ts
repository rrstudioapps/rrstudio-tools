// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  CronError,
  FIELD_ORDER_5,
  FIELD_ORDER_6,
  FieldName,
  MAX_RUNS,
  UTC_ZONE,
  Zone,
  describeCron,
  expandAlias,
  localZone,
  nextRuns,
  parseCron,
  usesOrRule,
} from './cron';
import { CRON_DICTIONARIES } from './cron-expression.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './cron-expression.share';
import { ToolHandoff } from '../../shared/tool-handoff';

type Tz = 'local' | 'utc';
type Lang = 'it' | 'en';

const PRESETS: readonly { id: string; expr: string }[] = [
  { id: 'everyMinute', expr: '* * * * *' },
  { id: 'every5', expr: '*/5 * * * *' },
  { id: 'every15', expr: '*/15 * * * *' },
  { id: 'hourly', expr: '0 * * * *' },
  { id: 'every6h', expr: '0 */6 * * *' },
  { id: 'daily', expr: '0 0 * * *' },
  { id: 'daily9', expr: '0 9 * * *' },
  { id: 'weekdays', expr: '0 9 * * 1-5' },
  { id: 'weekly', expr: '0 0 * * 0' },
  { id: 'monthly', expr: '0 0 1 * *' },
  { id: 'yearly', expr: '0 0 1 1 *' },
  { id: 'every30s', expr: '*/30 * * * * *' },
];

interface RunRow {
  n: number;
  when: string;
  rel: string;
}

@Component({
  selector: 'app-cron-expression',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cron-expression.page.html',
  styleUrl: './cron-expression.page.scss',
})
export class CronExpressionPage {
  protected readonly i18n = inject(I18nService);

  protected readonly presets = PRESETS;
  protected readonly maxRuns = MAX_RUNS;
  protected readonly expression = signal('*/15 9-17 * * 1-5');
  protected readonly count = signal(10);
  protected readonly tz = signal<Tz>('local');
  protected readonly descLang = signal<Lang>(this.i18n.lang());
  /** Istante di partenza del calcolo: si imposta dopo il rendering nel browser (la pagina prerenderizzata non lo ha). */
  protected readonly now = signal<number | null>(null);
  private zone: Zone = UTC_ZONE;
  protected readonly localName = signal('');

  protected readonly parsed = computed(() => parseCron(this.expression()));
  protected readonly cron = computed(() => {
    const p = this.parsed();
    return p.ok ? p.cron : null;
  });
  protected readonly error = computed<CronError | null>(() => {
    const p = this.parsed();
    return p.ok ? null : p.error;
  });
  protected readonly errorText = computed(() => {
    const e = this.error();
    if (!e) return '';
    if (e.code === 'empty') return this.i18n.t('cron.err.empty');
    return this.i18n.t('cron.err.' + e.code, {
      field: e.field ? this.i18n.t('cron.field.' + e.field) : '',
      token: e.token ?? '',
      value: e.value ?? '',
      min: e.min ?? '',
      max: e.max ?? '',
      count: e.count ?? '',
    });
  });
  protected readonly invalidField = computed<FieldName | null>(() => this.error()?.field ?? null);

  protected readonly description = computed(() => {
    const c = this.cron();
    return c ? describeCron(c, this.descLang()) : null;
  });
  protected readonly notes = computed(() => {
    const c = this.cron();
    if (!c) return [];
    const notes: string[] = [];
    const raw = this.expression().trim();
    const exp = expandAlias(raw);
    if (exp) notes.push(this.i18n.t('cron.note.alias', { alias: raw.toLowerCase(), expr: exp }));
    if (usesOrRule(c)) notes.push(this.i18n.t('cron.note.or'));
    else {
      // un campo "*/2" è una limitazione che comincia con *: l'altro campo giorno, se limitato, deve corrispondere insieme
      const dom = c.fields[c.hasSeconds ? 3 : 2];
      const dow = c.fields[c.hasSeconds ? 5 : 4];
      const plain = (f: string): boolean => f === '*' || f === '?';
      if (!plain(dom) && !plain(dow)) notes.push(this.i18n.t('cron.note.and'));
    }
    return notes;
  });

  // ---- editor a campi ----
  private readonly tokens = computed(() => {
    const raw = this.expression().trim();
    const text = expandAlias(raw) ?? raw;
    return text === '' ? [] : text.split(/\s+/);
  });
  protected readonly withSeconds = computed(() => this.tokens().length === 6);
  protected readonly fieldList = computed(() => {
    const order = this.withSeconds() ? FIELD_ORDER_6 : FIELD_ORDER_5;
    const t = this.tokens();
    return order.map((name, i) => ({ name, label: this.i18n.t('cron.field.' + name), range: this.i18n.t('cron.range.' + name), value: t[i] ?? '' }));
  });

  // ---- prossime esecuzioni ----
  protected readonly tzOptions = computed<SegmentOption<Tz>[]>(() => [
    { value: 'local', label: this.i18n.t('cron.runs.tz.local', { zone: this.localName() || '…' }) },
    { value: 'utc', label: this.i18n.t('cron.runs.tz.utc') },
  ]);
  protected readonly langOptions: SegmentOption<Lang>[] = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' },
  ];
  private readonly result = computed(() => {
    const c = this.cron();
    const now = this.now();
    if (!c || now === null) return null;
    const zone = this.tz() === 'utc' ? UTC_ZONE : this.zone;
    return { zone, ...nextRuns(c, zone, now, this.count()) };
  });
  protected readonly rows = computed<RunRow[]>(() => {
    const r = this.result();
    const c = this.cron();
    const now = this.now();
    if (!r || !c || now === null) return [];
    const loc = this.i18n.locale();
    const fmt = new Intl.DateTimeFormat(loc, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(c.hasSeconds ? { second: '2-digit' as const } : {}),
      hourCycle: 'h23',
      timeZone: r.zone.id,
    });
    const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
    return r.runs.map((ms, i) => ({ n: i + 1, when: fmt.format(ms), rel: this.relative(rtf, ms - now) }));
  });
  protected readonly exhausted = computed(() => !!this.result()?.exhausted && this.rows().length === 0);
  protected readonly fromText = computed(() => {
    const now = this.now();
    if (now === null) return '';
    const zone = this.tz() === 'utc' ? 'UTC' : this.zone.id;
    const when = new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23', timeZone: zone }).format(now);
    return this.i18n.t('cron.runs.from', { when });
  });
  protected readonly listText = computed(() => this.rows().map((r) => `${r.n}. ${r.when}`).join('\n'));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    expression: this.expression,
    count: this.count,
    tz: this.tz,
    descLang: this.descLang,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(CRON_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('cron-expression');
    if (rx?.text !== undefined) this.expression.set(rx.text.trim());
    afterNextRender(() => {
      this.zone = localZone();
      this.localName.set(this.zone.id);
      this.now.set(Date.now());
    });
  }

  private relative(rtf: Intl.RelativeTimeFormat, diffMs: number): string {
    const s = Math.round(diffMs / 1000);
    if (s < 60) return rtf.format(s, 'second');
    const m = Math.round(s / 60);
    if (m < 60) return rtf.format(m, 'minute');
    const h = Math.round(m / 60);
    if (h < 24) return rtf.format(h, 'hour');
    const d = Math.round(h / 24);
    if (d < 60) return rtf.format(d, 'day');
    const mo = Math.round(d / 30.44);
    if (mo < 24) return rtf.format(mo, 'month');
    return rtf.format(Math.round(d / 365.25), 'year');
  }

  protected onExpression(e: Event): void {
    this.expression.set((e.target as HTMLInputElement).value);
  }

  protected usePreset(expr: string): void {
    this.expression.set(expr);
  }

  protected presetLabel(id: string): string {
    return this.i18n.t('cron.preset.' + id);
  }

  protected onField(index: number, e: Event): void {
    const value = (e.target as HTMLInputElement).value.replace(/\s+/g, '');
    if (value === '') return; // si aspetta che l'utente scriva qualcosa (all'uscita, "change" rimette *)
    this.setToken(index, value);
  }

  protected onFieldCommit(index: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    const value = el.value.replace(/\s+/g, '');
    this.setToken(index, value === '' ? '*' : value);
    el.value = this.fieldList()[index]?.value ?? '*';
  }

  private setToken(index: number, value: string): void {
    const count = this.withSeconds() ? 6 : 5;
    const t = this.tokens().slice(0, count);
    while (t.length < count) t.push('*');
    t[index] = value;
    this.expression.set(t.join(' '));
  }

  protected toggleSeconds(on: boolean): void {
    const raw = this.expression().trim();
    const alias = expandAlias(raw);
    const t = (alias ?? raw).split(/\s+/).filter(Boolean);
    if (on && t.length === 5) this.expression.set(['0', ...t].join(' '));
    else if (!on && t.length === 6) this.expression.set(t.slice(1).join(' '));
  }

  protected setCount(e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = Math.floor(Number(el.value));
    this.count.set(Number.isFinite(n) ? Math.min(MAX_RUNS, Math.max(1, n)) : 10);
    el.value = String(this.count());
  }

  protected refresh(): void {
    this.now.set(Date.now());
  }
}
