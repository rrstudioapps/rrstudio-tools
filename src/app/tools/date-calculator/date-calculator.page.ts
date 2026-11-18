// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { formatNumber } from '../../shared/decimal';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { DC_DICTIONARIES } from './date-calculator.i18n';
import { Ymd, addInterval, computeAge, dateDifference, formatIso, isLeapYear, parseIso, ymdToUtcMs } from './dates';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './date-calculator.share';
import { ToolHandoff } from '../../shared/tool-handoff';

type Mode = 'diff' | 'add' | 'age';
type Dir = 'plus' | 'minus';

interface Line {
  label: string;
  value: string;
  strong?: boolean;
}

/** Interi non negativi (campi vuoti = 0), con un tetto che tiene i calcoli in un intervallo sicuro. */
function parseCount(text: string): number | null {
  const v = text.trim();
  if (v === '') return 0;
  return /^\d{1,7}$/.test(v) ? Number(v) : null;
}

@Component({
  selector: 'app-date-calculator',
  imports: [ShareLink, CopyButton, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-calculator.page.html',
  styleUrl: './date-calculator.page.scss',
})
export class DateCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('diff');
  // differenza
  protected readonly diffFrom = signal('');
  protected readonly diffTo = signal('');
  protected readonly inclusive = signal(false);
  // aggiungi / togli
  protected readonly addDate = signal('');
  protected readonly dir = signal<Dir>('plus');
  protected readonly years = signal('');
  protected readonly months = signal('');
  protected readonly weeks = signal('');
  protected readonly days = signal('');
  // età
  protected readonly birth = signal('');
  protected readonly ref = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'diff', label: this.i18n.t('dc.mode.diff') },
    { value: 'add', label: this.i18n.t('dc.mode.add') },
    { value: 'age', label: this.i18n.t('dc.mode.age') },
  ]);
  protected readonly dirs = computed<SegmentOption<Dir>[]>(() => [
    { value: 'plus', label: this.i18n.t('dc.add.plus') },
    { value: 'minus', label: this.i18n.t('dc.add.minus') },
  ]);

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    diffFrom: this.diffFrom,
    diffTo: this.diffTo,
    inclusive: this.inclusive,
    addDate: this.addDate,
    dir: this.dir,
    years: this.years,
    months: this.months,
    weeks: this.weeks,
    days: this.days,
    birth: this.birth,
    ref: this.ref,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(DC_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('date-calculator');
    if (rx?.text !== undefined) {
      // la data ricevuta diventa la data di partenza della differenza (ISO oppure gg/mm/aaaa)
      const t = rx.text.trim();
      const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
      const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : t.slice(0, 10);
      if (parseIso(iso)) this.diffFrom.set(iso);
    }
  }

  protected bad(text: string): boolean {
    return text !== '' && parseIso(text) === null;
  }

  /** Imposta una data a oggi (nel fuso del browser): solo su azione dell'utente, mai nel prerender. */
  protected setToday(target: 'diffFrom' | 'diffTo' | 'addDate' | 'birth' | 'ref'): void {
    const n = new Date();
    const iso = formatIso({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
    this[target].set(iso);
  }

  protected readonly countsBad = computed(() => [this.years(), this.months(), this.weeks(), this.days()].some((t) => parseCount(t) === null));

  private dateText(d: Ymd): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'full', timeZone: 'UTC' }).format(ymdToUtcMs(d));
  }

  private num(n: number): string {
    return formatNumber(n, this.i18n.lang(), 0);
  }

  /** Righe del risultato nella modalità corrente. */
  protected readonly result = computed<{ lines: Line[]; notes: string[]; error: string } | null>(() => {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const mode = this.mode();
    if (mode === 'diff') {
      const a = parseIso(this.diffFrom());
      const b = parseIso(this.diffTo());
      if (!a || !b) return null;
      const r = dateDifference(a, b, this.inclusive());
      const ymd = t(r.years === 1 ? 'dc.diff.ymdOne' : 'dc.diff.ymd', { y: r.years, m: r.months, d: r.days });
      return {
        lines: [
          { label: t('dc.diff.from') + ' → ' + t('dc.diff.to'), value: ymd, strong: true },
          { label: t('dc.diff.totalDays'), value: this.num(r.totalDays) },
          { label: t('dc.diff.weeks'), value: t('dc.diff.weeksValue', { w: this.num(r.weeks), d: r.weekDays }) },
          { label: t('dc.diff.months'), value: this.num(r.totalMonths) },
        ],
        notes: r.swapped ? [t('dc.diff.swapped')] : [],
        error: '',
      };
    }
    if (mode === 'add') {
      const start = parseIso(this.addDate());
      if (!start) return null;
      const y = parseCount(this.years());
      const m = parseCount(this.months());
      const w = parseCount(this.weeks());
      const d = parseCount(this.days());
      if (y === null || m === null || w === null || d === null) return null;
      const out = addInterval(start, { years: y, months: m, weeks: w, days: d }, this.dir() === 'plus' ? 1 : -1);
      if (!out) return { lines: [], notes: [], error: t('dc.add.range') };
      return { lines: [{ label: t('dc.add.result'), value: this.dateText(out), strong: true }], notes: [t('dc.add.note')], error: '' };
    }
    const birth = parseIso(this.birth());
    const ref = parseIso(this.ref());
    if (!birth || !ref) return null;
    const age = computeAge(birth, ref);
    if (!age) return { lines: [], notes: [], error: t('dc.age.future') };
    const lines: Line[] = [
      { label: t('dc.age.age'), value: t(age.years === 1 ? 'dc.diff.ymdOne' : 'dc.diff.ymd', { y: age.years, m: age.months, d: age.days }), strong: true },
      { label: t('dc.age.totalDays'), value: this.num(age.totalDays) },
      { label: t('dc.age.next'), value: this.dateText(age.nextBirthday) },
      {
        label: t('dc.age.until'),
        value: age.isBirthdayToday ? t('dc.age.today', { n: age.turning }) : t(age.daysToBirthday === 1 ? 'dc.age.untilOne' : 'dc.age.untilValue', { n: this.num(age.daysToBirthday) }) + ' · ' + t('dc.age.turning', { n: age.turning }),
      },
    ];
    return { lines, notes: birth.m === 2 && birth.d === 29 && !isLeapYear(age.nextBirthday.y) ? [t('dc.age.leap')] : [], error: '' };
  });

  protected readonly copyText = computed(() => {
    const r = this.result();
    return r ? r.lines.map((l) => `${l.label}\t${l.value}`).join('\n') : '';
  });
}
