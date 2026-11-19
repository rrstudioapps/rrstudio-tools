// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { COLOR_CONTRAST_DICTIONARIES } from './color-contrast-checker.i18n';
import {
  CheckName,
  Evaluation,
  Rgba,
  Side,
  Suggestion,
  THRESHOLDS,
  displayRatio,
  evaluate,
  parseColor,
  suggestColor,
  toHex,
  toHexOpaque,
  toHslString,
  toOklchString,
  toRgbString,
} from './color';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './color-contrast-checker.share';

interface Conversion {
  key: string;
  label: string;
  value: string;
}

interface SuggestionView {
  key: 'aa' | 'aaa';
  label: string;
  s: Suggestion;
  hex: string;
  text: string;
}

@Component({
  selector: 'app-color-contrast-checker',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-contrast-checker.page.html',
  styleUrl: './color-contrast-checker.page.scss',
})
export class ColorContrastCheckerPage {
  protected readonly i18n = inject(I18nService);

  protected readonly sides: readonly Side[] = ['fg', 'bg'];
  protected readonly checkNames: readonly CheckName[] = ['aaNormal', 'aaaNormal', 'aaLarge', 'aaaLarge', 'ui'];

  // #767676 su bianco è il grigio più chiaro che supera AA (4,54): l'esempio iniziale è accessibile anche lui
  protected readonly fgText = signal('#767676');
  protected readonly bgText = signal('#ffffff');
  protected readonly editSide = signal<Side>('fg');

  protected readonly fg = computed<Rgba | null>(() => parseColor(this.fgText()));
  protected readonly bg = computed<Rgba | null>(() => parseColor(this.bgText()));

  // ultimo valore valido, per il selettore nativo quando il testo è in corso di digitazione
  private lastFg = '#767676';
  private lastBg = '#ffffff';

  protected readonly result = computed<Evaluation | null>(() => {
    const f = this.fg();
    const b = this.bg();
    return f && b ? evaluate(f, b) : null;
  });
  protected readonly ratioText = computed(() => {
    const r = this.result();
    return r ? new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayRatio(r.ratio)) : '';
  });
  protected readonly hasAlpha = computed(() => (this.fg()?.a ?? 1) < 1 || (this.bg()?.a ?? 1) < 1);

  protected readonly sideOptions = computed<SegmentOption<Side>[]>(() => [
    { value: 'fg', label: this.i18n.t('cc.fgShort') },
    { value: 'bg', label: this.i18n.t('cc.bgShort') },
  ]);

  /** Colori effettivi dopo la composizione (opachi), per l'anteprima. */
  protected readonly previewFg = computed(() => {
    const r = this.result();
    return r ? toHexOpaque(r.fg) : '';
  });
  protected readonly previewBg = computed(() => {
    const r = this.result();
    return r ? toHexOpaque(r.bg) : '';
  });

  protected readonly suggestions = computed<SuggestionView[] | null>(() => {
    const f = this.fg();
    const b = this.bg();
    if (!f || !b) return null;
    const side = this.editSide();
    const num = new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const delta = new Intl.NumberFormat(this.i18n.locale(), { signDisplay: 'exceptZero', maximumFractionDigits: 1 });
    return ([['aa', THRESHOLDS.aaNormal], ['aaa', THRESHOLDS.aaaNormal]] as const).map(([key, target]) => {
      const s = suggestColor(side, f, b, target);
      return {
        key,
        label: this.i18n.t('cc.sugg.' + key),
        s,
        hex: s.color ? toHex(s.color) : '',
        text: s.color ? this.i18n.t('cc.sugg.result', { ratio: num.format(displayRatio(s.ratio)), delta: delta.format(s.deltaL) }) : '',
      };
    });
  });
  /** Anteprima di un suggerimento: i colori effettivi (testo sullo sfondo) con il lato modificato sostituito. */
  protected suggestionPreview(v: SuggestionView): { color: string; background: string } | null {
    const f = this.fg();
    const b = this.bg();
    if (!v.s.color || !f || !b) return null;
    const e = this.editSide() === 'fg' ? evaluate(v.s.color, b) : evaluate(f, v.s.color);
    return { color: toHexOpaque(e.fg), background: toHexOpaque(e.bg) };
  }

  protected conversions(side: Side): Conversion[] {
    const c = side === 'fg' ? this.fg() : this.bg();
    if (!c) return [];
    return [
      { key: 'hex', label: 'HEX', value: toHex(c) },
      { key: 'rgb', label: 'RGB', value: toRgbString(c) },
      { key: 'hsl', label: 'HSL', value: toHslString(c) },
      { key: 'oklch', label: 'OKLCH', value: toOklchString(c) },
    ];
  }

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    fgText: this.fgText,
    bgText: this.bgText,
    editSide: this.editSide,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(COLOR_CONTRAST_DICTIONARIES);
  }

  protected name(side: Side): string {
    return this.i18n.t(side === 'fg' ? 'cc.fg' : 'cc.bg');
  }
  protected shortName(side: Side): string {
    return this.i18n.t(side === 'fg' ? 'cc.fgShort' : 'cc.bgShort');
  }
  protected text(side: Side): string {
    return side === 'fg' ? this.fgText() : this.bgText();
  }
  protected valid(side: Side): boolean {
    return (side === 'fg' ? this.fg() : this.bg()) !== null;
  }
  protected pickerValue(side: Side): string {
    const c = side === 'fg' ? this.fg() : this.bg();
    if (c) {
      const hex = toHexOpaque(c);
      if (side === 'fg') this.lastFg = hex;
      else this.lastBg = hex;
      return hex;
    }
    return side === 'fg' ? this.lastFg : this.lastBg;
  }

  protected setText(side: Side, value: string): void {
    (side === 'fg' ? this.fgText : this.bgText).set(value);
  }
  /** Il selettore nativo non conosce l'alfa: se c'era, si mantiene. */
  protected setPicker(side: Side, hex: string): void {
    const old = side === 'fg' ? this.fg() : this.bg();
    this.setText(side, old && old.a < 1 ? toHex({ ...parseColor(hex)!, a: old.a }) : hex);
  }

  protected swap(): void {
    const f = this.fgText();
    this.fgText.set(this.bgText());
    this.bgText.set(f);
  }

  protected apply(v: SuggestionView): void {
    if (v.s.color) this.setText(this.editSide(), toHex(v.s.color));
  }

  protected checkLabel(n: CheckName): string {
    return this.i18n.t('cc.check.' + n);
  }
  protected need(n: CheckName): string {
    return this.i18n.t('cc.need', { n: new Intl.NumberFormat(this.i18n.locale()).format(THRESHOLDS[n]) });
  }
  protected copyConv(what: string, side: Side): string {
    return this.i18n.t('cc.conv.copy', { what, name: this.shortName(side) });
  }
}
