// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatNumber, parseDecimal } from '../../shared/decimal';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { PCT_DICTIONARIES } from './percentage-calculator.i18n';
import { PctResult, applyPercent, percentChange, percentOf, reversePercent, whatPercent } from './percentage';

type CardId = 'of' | 'is' | 'change' | 'apply' | 'reverse';
type Dir = 'add' | 'sub';

interface Card {
  id: CardId;
  /** Segnaposto degli esempi nei due campi. */
  ph: [string, string];
  hasMode: boolean;
}

interface CardView {
  id: CardId;
  /** Frase del risultato, oppure '' se mancano valori. */
  text: string;
  /** Messaggio d'errore (numero non valido o calcolo impossibile). */
  error: string;
  /** Campo con numero non valido: 0 = primo, 1 = secondo. */
  bad: [boolean, boolean];
}

const CARDS: readonly Card[] = [
  { id: 'of', ph: ['20', '150'], hasMode: false },
  { id: 'is', ph: ['30', '150'], hasMode: false },
  { id: 'change', ph: ['100', '120'], hasMode: false },
  { id: 'apply', ph: ['80', '20'], hasMode: true },
  { id: 'reverse', ph: ['80', '20'], hasMode: true },
];

@Component({
  selector: 'app-percentage-calculator',
  imports: [PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './percentage-calculator.page.html',
  styleUrl: './percentage-calculator.page.scss',
})
export class PercentageCalculatorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly cards = CARDS;

  /** Testo digitato nei due campi di ogni scheda. */
  protected readonly values = signal<Record<CardId, [string, string]>>({
    of: ['', ''],
    is: ['', ''],
    change: ['', ''],
    apply: ['', ''],
    reverse: ['', ''],
  });
  protected readonly modes = signal<Record<'apply' | 'reverse', Dir>>({ apply: 'sub', reverse: 'sub' });

  constructor() {
    this.i18n.register(PCT_DICTIONARIES);
  }

  protected modeOptions(id: 'apply' | 'reverse'): SegmentOption<Dir>[] {
    return [
      { value: 'sub', label: this.i18n.t(id === 'apply' ? 'pct.apply.sub' : 'pct.reverse.sub') },
      { value: 'add', label: this.i18n.t(id === 'apply' ? 'pct.apply.add' : 'pct.reverse.add') },
    ];
  }

  protected setValue(id: CardId, index: 0 | 1, text: string): void {
    this.values.update((v) => ({ ...v, [id]: index === 0 ? [text, v[id][1]] : [v[id][0], text] }));
  }

  protected modeOf(id: CardId): Dir {
    return id === 'apply' || id === 'reverse' ? this.modes()[id] : 'sub';
  }

  protected setMode(id: 'apply' | 'reverse', dir: Dir): void {
    this.modes.update((m) => ({ ...m, [id]: dir }));
  }

  private num(n: number): string {
    return formatNumber(n, this.i18n.lang(), 6);
  }

  /** Le cinque schede, ricalcolate a ogni modifica. */
  protected readonly views = computed<CardView[]>(() => {
    const lang = this.i18n.lang();
    const t = (k: string, p?: Record<string, string>) => this.i18n.t(k, p);
    return CARDS.map((c): CardView => {
      const [ta, tb] = this.values()[c.id];
      const empty = ta.trim() === '' || tb.trim() === '';
      const a = ta.trim() === '' ? null : parseDecimal(ta, lang);
      const b = tb.trim() === '' ? null : parseDecimal(tb, lang);
      const bad: [boolean, boolean] = [ta.trim() !== '' && a === null, tb.trim() !== '' && b === null];
      const view: CardView = { id: c.id, text: '', error: bad[0] || bad[1] ? t('pct.err.num') : '', bad };
      if (empty || a === null || b === null) return view;
      const fail = (r: Extract<PctResult, { ok: false }>) => {
        view.error = t(r.error === 'divZero' && c.id === 'change' ? 'pct.err.divZeroFrom' : 'pct.err.' + r.error);
        return view;
      };
      const mode = c.hasMode ? this.modes()[c.id as 'apply' | 'reverse'] : 'sub';
      switch (c.id) {
        case 'of': {
          const r = percentOf(a, b);
          if (!r.ok) return fail(r);
          view.text = t('pct.of.result', { a: this.num(a), b: this.num(b), r: this.num(r.value) });
          return view;
        }
        case 'is': {
          const r = whatPercent(a, b);
          if (!r.ok) return fail(r);
          view.text = t('pct.is.result', { a: this.num(a), b: this.num(b), r: this.num(r.value) });
          return view;
        }
        case 'change': {
          const r = percentChange(a, b);
          if (!r.ok) return fail(r);
          const shown = this.num(Math.abs(r.value));
          const d = this.num(Math.abs(b - a));
          view.text = shown === '0' ? t('pct.change.same') : r.value > 0 ? t('pct.change.up', { r: shown, d }) : t('pct.change.down', { r: shown, d });
          return view;
        }
        case 'apply': {
          const r = applyPercent(a, b, mode === 'add' ? 1 : -1);
          if (!r.ok) return fail(r);
          view.text = t(mode === 'add' ? 'pct.apply.resultAdd' : 'pct.apply.resultSub', {
            a: this.num(a),
            b: this.num(b),
            r: this.num(r.value),
            d: this.num(Math.abs(r.value - a)),
          });
          return view;
        }
        default: {
          const r = reversePercent(a, b, mode === 'add' ? 1 : -1);
          if (!r.ok) return fail(r);
          view.text = t(mode === 'add' ? 'pct.reverse.resultAdd' : 'pct.reverse.resultSub', { b: this.num(b), r: this.num(r.value) });
          return view;
        }
      }
    });
  });

  protected view(id: CardId): CardView {
    return this.views().find((v) => v.id === id)!;
  }
}
