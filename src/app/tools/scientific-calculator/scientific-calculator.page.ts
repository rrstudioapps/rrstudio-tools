// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { evaluate, formatNumber, type AngleMode } from './scientific-calculator';
import { SCI_DICTIONARIES } from './scientific-calculator.i18n';
import { SHARE_SCHEMA } from './scientific-calculator.share';

interface Key {
  /** Testo del tasto. */
  label: string;
  /** Testo inserito nell'espressione. */
  text: string;
  kind?: 'fn' | 'num' | 'op' | 'eq';
}

interface HistoryItem {
  expr: string;
  value: number;
  text: string;
}

const FN_KEYS: Key[] = [
  ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['asin', 'asin('], ['acos', 'acos('], ['atan', 'atan('],
  ['ln', 'ln('], ['log', 'log('], ['√', 'sqrt('], ['x²', '^2'], ['xʸ', '^'], ['n!', '!'],
  ['π', 'pi'], ['e', 'e'], ['ans', 'ans'], ['(', '('], [')', ')'], ['%', '%'],
].map(([label, text]) => ({ label, text, kind: 'fn' as const }));

/** Tastierino numerico; il tasto «=» (testo '=') non inserisce nulla: calcola. */
const PAD_KEYS: Key[] = [
  ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−'],
  ['0', '0'], [',', ','], ['=', '='], ['+', '+'],
].map(([label, text]) => ({ label, text, kind: label === '=' ? ('eq' as const) : /\d/.test(label) ? ('num' as const) : ('op' as const) }));

@Component({
  selector: 'app-scientific-calculator',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scientific-calculator.page.html',
  styleUrl: './scientific-calculator.page.scss',
})
export class ScientificCalculatorPage {
  protected readonly i18n = inject(I18nService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('exprField');

  protected readonly expr = signal('');
  protected readonly angle = signal<AngleMode>('deg');
  protected readonly angles = computed<SegmentOption<AngleMode>[]>(() => [
    { value: 'deg', label: this.i18n.t('sci.deg') },
    { value: 'rad', label: this.i18n.t('sci.rad') },
  ]);
  protected readonly history = signal<HistoryItem[]>([]);
  /** Ultimo risultato confermato con «=»: è il valore di `ans`. */
  protected readonly ans = signal(0);
  /** Vero subito dopo «=»: il tasto successivo continua dal risultato (operatore) o ricomincia (cifra). */
  private justEvaluated = false;
  /**
   * Selezione nel campo, ricordata da noi: un campo che ha perso il focus (cliccando un tasto) non conserva la selezione
   * in tutti i browser, e i tasti scriverebbero all'inizio. `null` = in fondo all'espressione.
   */
  private sel: { start: number; end: number } | null = null;

  protected readonly fnKeys = FN_KEYS;
  protected readonly padKeys = PAD_KEYS;
  protected readonly helpRules = [1, 2, 3, 4, 5];

  protected readonly outcome = computed(() => evaluate(this.expr(), { angle: this.angle(), ans: this.ans() }));
  protected readonly resultText = computed(() => {
    const o = this.outcome();
    return o.ok ? formatNumber(o.value, this.i18n.lang()) : '';
  });
  protected readonly errorText = computed(() => {
    const o = this.outcome();
    if (o.ok || o.error === 'empty') return '';
    return this.i18n.t('sci.err.' + o.error, { d: o.detail ?? '' });
  });

  // Link di condivisione: l'espressione e l'unità degli angoli stanno nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { expr: this.expr, angle: this.angle };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    this.sel = null;
  }

  constructor() {
    this.i18n.register(SCI_DICTIONARIES);
  }

  protected onType(value: string): void {
    this.justEvaluated = false;
    this.expr.set(value);
    this.remember();
  }

  /** Ricorda dov'è il cursore (chiamata a ogni modifica, clic, tasto e uscita dal campo). */
  protected remember(): void {
    const el = this.field()?.nativeElement;
    if (el) this.sel = { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length };
  }

  /** Posizione di inserimento attuale, sempre dentro il testo. */
  private selection(): { start: number; end: number } {
    const len = this.expr().length;
    if (!this.sel) return { start: len, end: len };
    return { start: Math.min(this.sel.start, len), end: Math.min(this.sel.end, len) };
  }

  /** Inserisce il testo di un tasto dove sta il cursore (o in fondo). */
  protected insert(text: string): void {
    if (this.justEvaluated) {
      // dopo «=»: un operatore continua dal risultato, qualsiasi altro tasto ricomincia
      this.justEvaluated = false;
      const base = /^[+\-×÷^%!]/.test(text) ? 'ans' + text : text;
      this.setValue(base, base.length);
      return;
    }
    const value = this.expr();
    const { start, end } = this.selection();
    this.setValue(value.slice(0, start) + text + value.slice(end), start + text.length);
  }

  protected backspace(): void {
    this.justEvaluated = false;
    const value = this.expr();
    const sel = this.selection();
    const end = sel.end;
    let start = sel.start;
    if (start === end) start = Math.max(0, start - 1);
    this.setValue(value.slice(0, start) + value.slice(end), start);
  }

  protected clear(): void {
    this.justEvaluated = false;
    this.setValue('', 0);
  }

  private setValue(value: string, caret: number): void {
    const el = this.field()?.nativeElement;
    if (el) {
      el.value = value;
      el.setSelectionRange(caret, caret);
    }
    this.sel = { start: caret, end: caret };
    this.expr.set(value);
  }

  /** «=»: mette il calcolo in cronologia e ne fa il nuovo `ans`. */
  protected equals(): void {
    const o = this.outcome();
    if (!o.ok) return;
    const text = formatNumber(o.value, this.i18n.lang());
    this.history.update((h) => [{ expr: this.expr().trim(), value: o.value, text }, ...h].slice(0, 20));
    this.ans.set(o.value);
    this.justEvaluated = true;
  }

  protected reuse(item: HistoryItem): void {
    this.justEvaluated = false;
    this.setValue(item.expr, item.expr.length);
  }

  protected useValue(item: HistoryItem): void {
    this.insert(item.text);
  }

  protected clearHistory(): void {
    this.history.set([]);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.equals();
    }
  }
}
