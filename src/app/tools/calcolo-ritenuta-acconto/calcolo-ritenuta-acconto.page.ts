// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney, formatPercent, parseMoney, parsePercent } from '../calcolo-iva/iva';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { RITENUTA_DICTIONARIES } from './calcolo-ritenuta-acconto.i18n';
import { RitenutaInput, RitenutaResult, computeRitenuta, solveFromNet } from './ritenuta';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './calcolo-ritenuta-acconto.share';

type Kind = 'occasionale' | 'professionista';
type Dir = 'gross' | 'net';

interface Row {
  label: string;
  value: string;
  strong?: boolean;
}

@Component({
  selector: 'app-calcolo-ritenuta-acconto',
  imports: [ShareLink, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calcolo-ritenuta-acconto.page.html',
  styleUrl: './calcolo-ritenuta-acconto.page.scss',
})
export class CalcoloRitenutaAccontoPage {
  protected readonly i18n = inject(I18nService);

  protected readonly kind = signal<Kind>('occasionale');
  protected readonly dir = signal<Dir>('gross');
  protected readonly amountText = signal('');
  protected readonly ritenutaText = signal('20');
  protected readonly rivalsa = signal(false);
  protected readonly ritenutaOnRivalsa = signal(true);
  protected readonly cassaText = signal('');
  protected readonly vatText = signal('0');
  protected readonly bolloCharged = signal(true);

  protected readonly kinds = computed<SegmentOption<Kind>[]>(() => [
    { value: 'occasionale', label: this.i18n.t('rit.kind.occasionale') },
    { value: 'professionista', label: this.i18n.t('rit.kind.professionista') },
  ]);
  protected readonly dirs = computed<SegmentOption<Dir>[]>(() => [
    { value: 'gross', label: this.i18n.t('rit.dir.gross') },
    { value: 'net', label: this.i18n.t('rit.dir.net') },
  ]);

  protected readonly amount = computed(() => parseMoney(this.amountText()));
  protected readonly amountError = computed(() => this.amountText().trim() !== '' && this.amount() === null);
  private readonly ritenutaBp = computed(() => parsePercent(this.ritenutaText()));
  protected readonly ritenutaError = computed(() => this.ritenutaBp() === null);
  private readonly cassaBp = computed(() => (this.cassaText().trim() === '' ? 0 : parsePercent(this.cassaText())));
  protected readonly cassaError = computed(() => this.cassaBp() === null);
  private readonly vatBp = computed(() => (this.vatText().trim() === '' ? 0 : parsePercent(this.vatText())));
  protected readonly vatError = computed(() => this.vatBp() === null);

  private readonly base = computed<Omit<RitenutaInput, 'compenso'> | null>(() => {
    const r = this.ritenutaBp();
    const c = this.cassaBp();
    const v = this.vatBp();
    if (r === null || c === null || v === null) return null;
    return {
      ritenutaBp: r,
      rivalsa: this.rivalsa(),
      cassaBp: c,
      vatBp: v,
      ritenutaOnRivalsa: this.ritenutaOnRivalsa(),
      bolloCharged: this.bolloCharged(),
    };
  });

  private readonly calc = computed<{ r: RitenutaResult; difference: number } | null>(() => {
    const a = this.amount();
    const b = this.base();
    if (a === null || a <= 0 || !b) return null;
    if (this.dir() === 'gross') return { r: computeRitenuta({ ...b, compenso: a }), difference: 0 };
    const s = solveFromNet(a, b);
    return s ? { r: s.result, difference: s.difference } : null;
  });

  protected readonly hasResult = computed(() => this.calc() !== null);

  private money(cents: number): string {
    return formatMoney(cents, this.i18n.locale()) + ' €';
  }

  protected readonly rows = computed<Row[]>(() => {
    const c = this.calc();
    const b = this.base();
    if (!c || !b) return [];
    const r = c.r;
    const t = this.i18n;
    const pct = (bp: number) => formatPercent(bp, this.i18n.locale());
    const rows: Row[] = [{ label: t.t('rit.row.compenso'), value: this.money(r.compenso) }];
    if (r.rivalsa) rows.push({ label: t.t('rit.row.rivalsa'), value: this.money(r.rivalsa) });
    if (r.cassa) rows.push({ label: t.t('rit.row.cassa', { rate: pct(b.cassaBp) }), value: this.money(r.cassa) });
    if (r.rivalsa || r.cassa) rows.push({ label: t.t('rit.row.imponibile'), value: this.money(r.imponibile) });
    if (b.vatBp) rows.push({ label: t.t('rit.row.vat', { rate: pct(b.vatBp) }), value: this.money(r.vat) });
    if (r.bollo) rows.push({ label: t.t('rit.row.bollo'), value: this.money(r.bollo) });
    rows.push({ label: t.t('rit.row.total'), value: this.money(r.totale), strong: true });
    if (b.ritenutaBp) {
      rows.push({
        label: t.t('rit.row.ritenuta', { rate: pct(b.ritenutaBp), base: this.money(r.ritenutaBase) }),
        value: '-' + this.money(r.ritenuta),
      });
    }
    rows.push({ label: t.t('rit.row.netto'), value: this.money(r.netto), strong: true });
    return rows;
  });

  /** Dal netto al lordo: il compenso trovato, in evidenza. */
  protected readonly headline = computed(() => {
    const c = this.calc();
    if (!c || this.dir() !== 'net') return null;
    const t = this.i18n;
    const sign = c.difference > 0 ? '+' : '';
    return {
      label: t.t('rit.headline.gross'),
      value: this.money(c.r.compenso),
      note:
        c.difference === 0
          ? t.t('rit.reverse.exact', { net: this.money(c.r.netto) })
          : t.t('rit.reverse.diff', { net: this.money(c.r.netto), diff: sign + formatMoney(c.difference, this.i18n.locale()) + ' €' }),
    };
  });

  protected readonly notes = computed<string[]>(() => {
    const c = this.calc();
    const b = this.base();
    if (!c || !b) return [];
    const t = this.i18n;
    const out: string[] = [];
    if (c.r.bolloDue) out.push(t.t(c.r.bollo ? 'rit.note.bollo' : 'rit.note.bolloNot'));
    if (c.r.cassa && b.ritenutaBp) out.push(t.t('rit.note.cassa'));
    if (b.ritenutaBp) out.push(t.t('rit.note.cu'));
    return out;
  });

  protected readonly summaryText = computed(() => {
    const lines = this.rows().map((r) => `${r.label}\t${r.value}`);
    const h = this.headline();
    if (h) lines.unshift(`${h.label}\t${h.value}`);
    const n = this.notes();
    if (n.length) lines.push('', ...n);
    return lines.join('\n');
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    kind: this.kind,
    dir: this.dir,
    amountText: this.amountText,
    ritenutaText: this.ritenutaText,
    rivalsa: this.rivalsa,
    ritenutaOnRivalsa: this.ritenutaOnRivalsa,
    cassaText: this.cassaText,
    vatText: this.vatText,
    bolloCharged: this.bolloCharged,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(RITENUTA_DICTIONARIES);
  }

  /** I due tipi precompilano i campi tipici; si possono sempre cambiare dopo. */
  protected setKind(k: Kind): void {
    this.kind.set(k);
    if (k === 'occasionale') {
      this.rivalsa.set(false);
      this.cassaText.set('');
      this.vatText.set('0');
    } else {
      this.rivalsa.set(true);
      this.vatText.set('22');
    }
  }
}
