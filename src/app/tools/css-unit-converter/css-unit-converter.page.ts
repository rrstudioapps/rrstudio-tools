// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { parseDecimal } from '../../shared/decimal';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  BlockUnit,
  CssContext,
  CssUnit,
  DEFAULT_CONTEXT,
  UNITS,
  UNIT_SUFFIX,
  convertAll,
  convertCssBlock,
  formatCssNumber,
  formatCssValue,
  quickTable,
  validContext,
} from './css-units';
import { CSSU_DICTIONARIES } from './css-unit-converter.i18n';

type Direction = 'px-rem' | 'px-em' | 'rem-px';

@Component({
  selector: 'app-css-unit-converter',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './css-unit-converter.page.html',
  styleUrl: './css-unit-converter.page.scss',
})
export class CssUnitConverterPage {
  protected readonly i18n = inject(I18nService);
  protected readonly units = UNITS;

  // contesto come testo, per accettare virgola e punto
  protected readonly rootText = signal(String(DEFAULT_CONTEXT.rootPx));
  protected readonly parentText = signal(String(DEFAULT_CONTEXT.parentPx));
  protected readonly vwText = signal(String(DEFAULT_CONTEXT.viewportW));
  protected readonly vhText = signal(String(DEFAULT_CONTEXT.viewportH));

  protected readonly ctx = computed<CssContext>(() => ({
    rootPx: this.num(this.rootText()),
    parentPx: this.num(this.parentText()),
    viewportW: this.num(this.vwText()),
    viewportH: this.num(this.vhText()),
  }));
  protected readonly ctxOk = computed(() => validContext(this.ctx()));

  protected readonly valueText = signal('24');
  protected readonly from = signal<CssUnit>('px');
  private readonly value = computed(() => this.num(this.valueText()));
  protected readonly valueOk = computed(() => Number.isFinite(this.value()));

  protected readonly rows = computed(() => {
    if (!this.ctxOk() || !this.valueOk()) return [];
    const all = convertAll(this.value(), this.from(), this.ctx());
    return UNITS.map((u) => ({
      unit: u,
      label: this.i18n.t('cssu.unit.' + u),
      number: formatCssNumber(all[u], 4) || '0',
      css: formatCssValue(all[u], u, 4),
      current: u === this.from(),
    }));
  });

  // tabella rapida
  protected readonly quickTo = signal<'rem' | 'em'>('rem');
  protected readonly quickOptions = computed<SegmentOption<'rem' | 'em'>[]>(() => [
    { value: 'rem', label: 'rem' },
    { value: 'em', label: 'em' },
  ]);
  protected readonly quick = computed(() =>
    this.ctxOk() ? quickTable(this.quickTo(), this.ctx()).map((r) => ({ px: r.px, text: formatCssNumber(r.value, 4) })) : [],
  );

  // blocco CSS
  protected readonly cssIn = signal('');
  protected readonly direction = signal<Direction>('px-rem');
  protected readonly hairline = signal(false);
  protected readonly media = signal(false);
  protected readonly decimals = signal(4);
  protected readonly directions = computed<SegmentOption<Direction>[]>(() =>
    (['px-rem', 'px-em', 'rem-px'] as const).map((d) => ({ value: d, label: this.i18n.t('cssu.block.dir.' + d) })),
  );
  protected readonly block = computed(() => {
    if (!this.ctxOk() || this.cssIn().trim() === '') return null;
    const [from, to] = this.direction().split('-') as [BlockUnit, BlockUnit];
    return convertCssBlock(this.cssIn(), this.ctx(), {
      from,
      to,
      decimals: this.decimals(),
      keepHairline: this.hairline(),
      convertMedia: this.media(),
    });
  });
  protected readonly blockMeta = computed(() => {
    const b = this.block();
    if (!b) return '';
    return b.count ? this.i18n.t('cssu.block.count', { n: b.count }) : this.i18n.t('cssu.block.none');
  });

  constructor() {
    this.i18n.register(CSSU_DICTIONARIES);
  }

  protected suffix(u: CssUnit): string {
    return UNIT_SUFFIX[u];
  }

  protected setDecimals(v: string): void {
    const n = Math.trunc(Number(v));
    this.decimals.set(Number.isFinite(n) ? Math.min(8, Math.max(0, n)) : 4);
  }

  protected download(): void {
    const b = this.block();
    if (b) saveBytes(new TextEncoder().encode(b.css), 'converted.css', 'text/css;charset=utf-8');
  }

  /** Numero da testo con virgola o punto; NaN se vuoto o non valido. */
  private num(text: string): number {
    const r = parseDecimal(text, this.i18n.lang());
    return r === null ? Number.NaN : r;
  }
}
