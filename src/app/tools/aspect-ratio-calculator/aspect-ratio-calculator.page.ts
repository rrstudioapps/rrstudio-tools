// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { formatNumber, parseDecimal } from '../../shared/decimal';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { PRESETS, Preset, Rounding, cssAspectRatio, cssPaddingTop, nearestPreset, reduceRatio, solveSide } from './aspect-ratio';
import { ASPECT_DICTIONARIES } from './aspect-ratio-calculator.i18n';
import { SHARE_SCHEMA } from './aspect-ratio-calculator.share';

type Mode = 'find' | 'solve';

@Component({
  selector: 'app-aspect-ratio-calculator',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspect-ratio-calculator.page.html',
  styleUrl: './aspect-ratio-calculator.page.scss',
})
export class AspectRatioCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('find');
  protected readonly width = signal('1920');
  protected readonly height = signal('1080');
  protected readonly newWidth = signal('1280');
  protected readonly ratioW = signal('16');
  protected readonly ratioH = signal('9');
  protected readonly side = signal<'width' | 'height'>('width');
  protected readonly value = signal('1280');
  protected readonly rounding = signal<Rounding>('integer');
  protected readonly presets = PRESETS;

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'find', label: this.i18n.t('ar.mode.find') },
    { value: 'solve', label: this.i18n.t('ar.mode.solve') },
  ]);
  protected readonly sides = computed<SegmentOption<'width' | 'height'>[]>(() => [
    { value: 'width', label: this.i18n.t('ar.side.width') },
    { value: 'height', label: this.i18n.t('ar.side.height') },
  ]);

  private readonly lang = computed<'it' | 'en'>(() => (this.i18n.lang() === 'it' ? 'it' : 'en'));
  private num(s: string): number | null {
    return s.trim() === '' ? null : parseDecimal(s, this.lang());
  }
  private fmt(n: number, frac = 4): string {
    return formatNumber(n, this.lang(), frac);
  }

  // Modalità «Trova il rapporto»
  protected readonly found = computed(() => {
    const w = this.num(this.width());
    const h = this.num(this.height());
    if (w === null || h === null) return null;
    const r = reduceRatio(w, h);
    if (!r) return null;
    const near = nearestPreset(r.decimal);
    let nearText = '';
    if (near) {
      nearText =
        near.error < 1e-9
          ? this.i18n.t('ar.res.exact', { preset: near.preset.label })
          : this.i18n.t(near.flipped ? 'ar.res.near.flipped' : 'ar.res.near', { preset: near.preset.label, err: this.fmt(near.error * 100, 2) });
    }
    const resized = this.resize(w, h);
    return {
      ratioText: r.w !== null ? `${r.w}:${r.h}` : null,
      decimal: this.fmt(r.decimal, 4),
      nearText,
      rw: r.w ?? r.decimal,
      rh: r.h ?? 1,
      css: cssAspectRatio(r.w ?? r.decimal, r.h ?? 1),
      pad: cssPaddingTop(r.w ?? r.decimal, r.h ?? 1),
      resized,
    };
  });

  private resize(w: number, h: number): { w: number; h: number; text: string } | null {
    const nw = this.num(this.newWidth());
    if (nw === null) return null;
    const s = solveSide(w, h, 'width', nw, this.rounding());
    return s ? { w: s.width, h: s.height, text: this.i18n.t('ar.resize.result', { h: this.fmt(s.height, 2) }) } : null;
  }

  // Modalità «Calcola un lato»
  private readonly solveRatio = computed(() => {
    const w = this.num(this.ratioW());
    const h = this.num(this.ratioH());
    return w !== null && h !== null && w > 0 && h > 0 ? { w, h } : null;
  });
  protected readonly solved = computed(() => {
    const r = this.solveRatio();
    const v = this.num(this.value());
    if (!r || v === null) return null;
    const s = solveSide(r.w, r.h, this.side(), v, this.rounding());
    if (!s) return null;
    return {
      size: this.i18n.t('ar.solved.size', { w: this.fmt(s.width, 2), h: this.fmt(s.height, 2) }),
      error: this.fmt(s.errorPercent, 3),
      showError: Math.abs(s.errorPercent) > 0.0005,
      css: cssAspectRatio(r.w, r.h),
      pad: cssPaddingTop(r.w, r.h),
      rw: r.w,
      rh: r.h,
    };
  });

  /** Dati per l'anteprima del rettangolo, nella modalità corrente. */
  protected readonly preview = computed(() => {
    const src = this.mode() === 'find' ? this.found() : this.solved();
    if (!src) return null;
    const ratio = src.rw / src.rh;
    // il rettangolo sta in una scatola 240×160: si adatta mantenendo il rapporto
    const maxW = 240;
    const maxH = 160;
    const w = ratio >= maxW / maxH ? maxW : maxH * ratio;
    const h = w / ratio;
    const label = this.mode() === 'find' && this.found()?.ratioText ? this.found()!.ratioText! : this.fmt(ratio, 4);
    return { w: Math.round(w), h: Math.round(h), label };
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    width: this.width,
    height: this.height,
    newWidth: this.newWidth,
    ratioW: this.ratioW,
    ratioH: this.ratioH,
    side: this.side,
    value: this.value,
    rounding: this.rounding,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(ASPECT_DICTIONARIES);
  }

  protected applyPreset(p: Preset): void {
    this.ratioW.set(this.fmt(p.w, 6));
    this.ratioH.set(this.fmt(p.h, 6));
  }

  protected flip(): void {
    const w = this.ratioW();
    this.ratioW.set(this.ratioH());
    this.ratioH.set(w);
  }

  /** Dal rapporto trovato passa a «Calcola un lato» con quel rapporto. */
  protected useFound(): void {
    const f = this.found();
    if (!f) return;
    this.ratioW.set(this.fmt(f.rw, 6));
    this.ratioH.set(this.fmt(f.rh, 6));
    this.mode.set('solve');
  }

  protected onRounding(e: Event): void {
    this.rounding.set((e.target as HTMLSelectElement).value as Rounding);
  }
}
