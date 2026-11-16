// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { IVA_DICTIONARIES } from './calcolo-iva.i18n';
import {
  BOLLO_CENTS,
  InvoiceInput,
  InvoiceResult,
  VAT_NATURES,
  VAT_RATES_BP,
  VatNature,
  addVat,
  computeInvoice,
  extractVat,
  formatMoney,
  formatPercent,
  parseMoney,
  parsePercent,
  solveCompenso,
} from './iva';

type Mode = 'add' | 'extract' | 'invoice' | 'reverse';
type CassaChoice = 'none' | '200' | '400' | '500' | 'custom';
type RitenutaChoice = 'none' | 'compenso' | 'cassa';

interface Row {
  label: string;
  value: string;
  strong?: boolean;
}

@Component({
  selector: 'app-calcolo-iva',
  imports: [PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calcolo-iva.page.html',
  styleUrl: './calcolo-iva.page.scss',
})
export class CalcoloIvaPage {
  protected readonly i18n = inject(I18nService);
  protected readonly rates = VAT_RATES_BP;
  protected readonly natures = VAT_NATURES;

  protected readonly mode = signal<Mode>('add');
  protected readonly amountText = signal('');
  protected readonly vatBp = signal<number>(2200);
  protected readonly nature = signal<VatNature>('N2.2');
  protected readonly forfettario = signal(false);
  protected readonly rivalsa = signal(false);
  protected readonly cassa = signal<CassaChoice>('none');
  protected readonly cassaCustom = signal('');
  protected readonly cassaVat = signal(true);
  protected readonly ritenuta = signal<RitenutaChoice>('compenso');
  protected readonly bolloCharged = signal(true);

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'add', label: this.i18n.t('iva.mode.add') },
    { value: 'extract', label: this.i18n.t('iva.mode.extract') },
    { value: 'invoice', label: this.i18n.t('iva.mode.invoice') },
    { value: 'reverse', label: this.i18n.t('iva.mode.reverse') },
  ]);
  protected readonly isInvoiceLike = computed(() => this.mode() === 'invoice' || this.mode() === 'reverse');
  protected readonly vatRateOptions = computed<SegmentOption<string>[]>(() =>
    VAT_RATES_BP.map((bp) => ({ value: String(bp), label: bp === 0 ? '0%' : formatPercent(bp, this.i18n.locale()) })),
  );
  /** Con forfettario l'aliquota e la ritenuta non si scelgono. */
  protected readonly effectiveVatBp = computed(() => (this.isInvoiceLike() && this.forfettario() ? 0 : this.vatBp()));
  protected readonly showNature = computed(() => this.isInvoiceLike() && this.effectiveVatBp() === 0 && !this.forfettario());

  protected readonly amount = computed(() => parseMoney(this.amountText()));
  protected readonly amountError = computed(() => this.amountText().trim() !== '' && this.amount() === null);
  private readonly cassaBp = computed<number | null>(() => {
    const c = this.cassa();
    if (c === 'none') return 0;
    if (c === 'custom') return parsePercent(this.cassaCustom());
    return Number(c);
  });
  protected readonly cassaError = computed(() => this.cassa() === 'custom' && this.cassaCustom().trim() !== '' && this.cassaBp() === null);

  private readonly baseInput = computed<Omit<InvoiceInput, 'compenso'>>(() => ({
    rivalsa: this.rivalsa(),
    cassaBp: this.cassaBp() ?? 0,
    cassaVat: this.cassaVat(),
    vatBp: this.vatBp(),
    nature: this.nature(),
    ritenutaBp: this.ritenuta() === 'none' ? 0 : 2000,
    ritenutaOnCassa: this.ritenuta() === 'cassa',
    bolloCharged: this.bolloCharged(),
    forfettario: this.forfettario(),
  }));

  /** Calcolo corrente per modalità. */
  private readonly calc = computed(() => {
    const amount = this.amount();
    const mode = this.mode();
    if (amount === null || amount <= 0) return null;
    if (mode === 'add') return { kind: 'vat' as const, r: addVat(amount, this.vatBp()) };
    if (mode === 'extract') return { kind: 'vat' as const, r: extractVat(amount, this.vatBp()) };
    if (mode === 'invoice') return { kind: 'invoice' as const, r: computeInvoice({ ...this.baseInput(), compenso: amount }) };
    const rev = solveCompenso(amount, this.baseInput());
    return rev ? { kind: 'reverse' as const, r: rev.invoice, difference: rev.difference } : null;
  });

  protected readonly hasResult = computed(() => this.calc() !== null);
  protected readonly invoice = computed<InvoiceResult | null>(() => {
    const c = this.calc();
    return c && c.kind !== 'vat' ? c.r : null;
  });

  private money(cents: number): string {
    return formatMoney(cents, this.i18n.locale()) + ' €';
  }

  private ratePct(bp: number): string {
    return formatPercent(bp, this.i18n.locale());
  }

  protected readonly rows = computed<Row[]>(() => {
    const c = this.calc();
    if (!c) return [];
    const t = this.i18n;
    if (c.kind === 'vat') {
      return [
        { label: t.t('iva.row.net'), value: this.money(c.r.net) },
        { label: t.t('iva.row.vat', { rate: this.ratePct(this.vatBp()) }), value: this.money(c.r.vat) },
        { label: t.t('iva.row.gross'), value: this.money(c.r.gross), strong: true },
      ];
    }
    const r = c.r;
    const rows: Row[] = [{ label: t.t('iva.row.compenso'), value: this.money(r.compenso) }];
    if (r.rivalsa) rows.push({ label: t.t('iva.row.rivalsa'), value: this.money(r.rivalsa) });
    if (r.cassa) rows.push({ label: t.t('iva.row.cassa', { rate: this.ratePct(this.cassaBp() ?? 0) }), value: this.money(r.cassa) });
    rows.push({ label: t.t('iva.row.vatBase'), value: this.money(r.vatBase) });
    rows.push({ label: t.t('iva.row.vat', { rate: this.ratePct(r.vatBp) }), value: this.money(r.vat) });
    if (r.bollo) rows.push({ label: t.t('iva.row.bollo'), value: this.money(r.bollo) });
    rows.push({ label: t.t('iva.row.total'), value: this.money(r.totalDocument), strong: true });
    if (r.ritenuta) rows.push({ label: t.t('iva.row.ritenuta', { rate: this.ratePct(2000) }), value: '-' + this.money(r.ritenuta) });
    rows.push({ label: t.t('iva.row.netToPay'), value: this.money(r.netToPay), strong: true });
    return rows;
  });

  /** Nel calcolo inverso: il compenso trovato, in evidenza, e l'esito dell'arrotondamento. */
  protected readonly reverseHeadline = computed(() => {
    const c = this.calc();
    if (!c || c.kind !== 'reverse') return null;
    const t = this.i18n;
    const exact = c.difference === 0;
    return {
      label: t.t('iva.row.neededCompenso'),
      value: this.money(c.r.compenso),
      note: exact
        ? t.t('iva.reverse.exact', { net: this.money(c.r.netToPay) })
        : t.t('iva.reverse.diff', { net: this.money(c.r.netToPay), diff: (c.difference > 0 ? '+' : '') + formatMoney(c.difference, this.i18n.locale()) + ' €' }),
    };
  });

  /** Testi da riportare in fattura (forfettario, bollo, natura…). */
  protected readonly notes = computed<string[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const t = this.i18n;
    const out: string[] = [];
    for (const n of inv.notes) {
      if (n === 'natura' && inv.nature) out.push(t.t('iva.note.natura', { code: inv.nature, text: t.t('iva.natdesc.' + inv.nature) }));
      else if (n === 'bollo') out.push(t.t(inv.bollo ? 'iva.note.bollo' : 'iva.note.bolloNotCharged'));
      else if (n !== 'natura') out.push(t.t('iva.note.' + n));
    }
    return out;
  });

  /** Riepilogo in testo semplice (colonne allineate con tabulazioni). */
  protected readonly summaryText = computed(() => {
    const lines = this.rows().map((r) => `${r.label}\t${r.value}`);
    const head = this.reverseHeadline();
    if (head) lines.unshift(`${head.label}\t${head.value}`);
    const notes = this.notes();
    if (notes.length) lines.push('', ...notes);
    return lines.join('\n');
  });

  protected readonly bolloCents = BOLLO_CENTS;

  constructor() {
    this.i18n.register(IVA_DICTIONARIES);
  }

  protected onAmount(e: Event): void {
    this.amountText.set((e.target as HTMLInputElement).value);
  }
  protected onCassa(e: Event): void {
    this.cassa.set((e.target as HTMLSelectElement).value as CassaChoice);
  }
  protected onRitenuta(e: Event): void {
    this.ritenuta.set((e.target as HTMLSelectElement).value as RitenutaChoice);
  }
  protected onNature(e: Event): void {
    this.nature.set((e.target as HTMLSelectElement).value as VatNature);
  }
}
