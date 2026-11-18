// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  FluidInput,
  SCALE_PRESETS,
  Unit,
  accessibilityWarnings,
  fluidClamp,
  fluidScale,
  parseRatio,
  parseSize,
  scaleToCss,
  sizeAt,
  trimNumber,
} from './clamp';
import { CLAMP_DICTIONARIES } from './css-clamp-calculator.i18n';
import { SHARE_SCHEMA } from './css-clamp-calculator.share';

const num = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
};

@Component({
  selector: 'app-css-clamp-calculator',
  imports: [ShareLink, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './css-clamp-calculator.page.html',
  styleUrl: './css-clamp-calculator.page.scss',
})
export class CssClampCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly unit = signal<Unit>('px');
  protected readonly root = signal('16');
  protected readonly minSize = signal('16');
  protected readonly maxSize = signal('24');
  protected readonly minVw = signal('320');
  protected readonly maxVw = signal('1280');
  protected readonly minRatio = signal('1.2');
  protected readonly maxRatio = signal('1.25');
  protected readonly stepFrom = signal('-2');
  protected readonly stepTo = signal('5');
  protected readonly previewVw = signal(640);

  protected readonly units: SegmentOption<Unit>[] = [
    { value: 'px', label: 'px' },
    { value: 'rem', label: 'rem' },
  ];
  protected readonly presets = computed(() => SCALE_PRESETS.map((p) => ({ value: String(p.ratio), label: `${p.ratio} · ${this.i18n.t('clamp.preset.' + p.id)}` })));

  private readonly rootPx = computed(() => {
    const n = num(this.root());
    return n !== null && n >= 1 && n <= 64 ? n : null;
  });

  /** Dati numerici validi o il primo errore trovato. */
  private readonly input = computed<{ ok: FluidInput } | { error: string }>(() => {
    const root = this.rootPx();
    if (root === null) return { error: 'root' };
    const minSize = parseSize(this.minSize(), this.unit(), root);
    const maxSize = parseSize(this.maxSize(), this.unit(), root);
    if (minSize === null || maxSize === null) return { error: 'size' };
    const minVw = num(this.minVw());
    const maxVw = num(this.maxVw());
    if (minVw === null || maxVw === null || minVw < 0 || maxVw > 20000) return { error: 'viewport' };
    return { ok: { minSize, maxSize, minVw, maxVw, rootPx: root } };
  });

  private readonly result = computed(() => {
    const i = this.input();
    if (!('ok' in i)) return { error: i.error };
    return fluidClamp(i.ok);
  });

  protected readonly error = computed(() => {
    const r = this.result();
    return 'error' in r ? this.i18n.t('clamp.err.' + r.error) : '';
  });

  protected readonly fluid = computed(() => {
    const r = this.result();
    return 'error' in r ? null : r;
  });

  protected readonly declaration = computed(() => {
    const f = this.fluid();
    return f ? `font-size: ${f.css};` : '';
  });

  protected readonly details = computed(() => {
    const f = this.fluid();
    if (!f || f.constant) return [];
    return [
      { label: this.i18n.t('clamp.d.slope'), value: `${trimNumber(f.slopeVw)}vw` },
      { label: this.i18n.t('clamp.d.intercept'), value: `${trimNumber(f.interceptPx)}px (${trimNumber(f.interceptPx / (this.rootPx() ?? 16))}rem)` },
      { label: this.i18n.t('clamp.d.low'), value: `${trimNumber(f.lowPx, 2)}px` },
      { label: this.i18n.t('clamp.d.high'), value: `${trimNumber(f.highPx, 2)}px` },
    ];
  });

  protected readonly warnings = computed(() => {
    const f = this.fluid();
    if (!f) return [];
    return accessibilityWarnings(f).map((w) => this.i18n.t('clamp.warn.' + w, { ratio: trimNumber(f.ratio, 2) }));
  });
  protected readonly constantNote = computed(() => (this.fluid()?.constant ? this.i18n.t('clamp.note.constant') : ''));

  // ---------- anteprima ----------

  protected readonly previewPx = computed(() => {
    const i = this.input();
    return 'ok' in i ? sizeAt(i.ok, this.previewVw()) : null;
  });
  protected readonly previewLabel = computed(() => {
    const p = this.previewPx();
    return p === null ? '' : this.i18n.t('clamp.preview.at', { vw: this.previewVw(), px: trimNumber(p, 2) });
  });
  protected onPreview(e: Event): void {
    this.previewVw.set(Number((e.target as HTMLInputElement).value));
  }

  // ---------- scala ----------

  private readonly scaleRaw = computed(() => {
    const i = this.input();
    if (!('ok' in i)) return { error: i.error };
    const minRatio = parseRatio(this.minRatio());
    const maxRatio = parseRatio(this.maxRatio());
    if (minRatio === null || maxRatio === null) return { error: 'ratio' };
    const from = num(this.stepFrom());
    const to = num(this.stepTo());
    if (from === null || to === null) return { error: 'steps' };
    return fluidScale({ ...i.ok, minRatio, maxRatio, from, to });
  });
  protected readonly scaleError = computed(() => {
    const r = this.scaleRaw();
    return 'error' in r && r.error !== 'size' && r.error !== 'viewport' && r.error !== 'root' ? this.i18n.t('clamp.err.' + r.error) : '';
  });
  protected readonly scale = computed(() => {
    const r = this.scaleRaw();
    if ('error' in r) return [];
    const vw = this.previewVw();
    const i = this.input();
    return r.map((s) => ({
      name: s.name,
      min: trimNumber(s.minPx, 2),
      max: trimNumber(s.maxPx, 2),
      css: s.css,
      nowPx: 'ok' in i ? sizeAt({ ...i.ok, minSize: s.minPx, maxSize: s.maxPx }, vw) : s.minPx,
    }));
  });
  protected readonly scaleCss = computed(() => {
    const r = this.scaleRaw();
    return 'error' in r ? '' : scaleToCss(r);
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    unit: this.unit,
    root: this.root,
    minSize: this.minSize,
    maxSize: this.maxSize,
    minVw: this.minVw,
    maxVw: this.maxVw,
    minRatio: this.minRatio,
    maxRatio: this.maxRatio,
    stepFrom: this.stepFrom,
    stepTo: this.stepTo,
    previewVw: this.previewVw,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(CLAMP_DICTIONARIES);
  }
}
