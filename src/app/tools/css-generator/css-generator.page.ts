// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  GRADIENT_PRESETS,
  Gradient,
  GradientKind,
  MAX_SHADOWS,
  MAX_STOPS,
  MIN_STOPS,
  RadialShape,
  SHADOW_PRESETS,
  Shadow,
  addStop,
  clamp,
  defaultGradient,
  gradientCss,
  gradientValue,
  newShadow,
  normalizeHex,
  removeStop,
  shadowsCss,
  shadowsInline,
  updateShadow,
  updateStop,
} from './css-gen';
import { CSSG_DICTIONARIES } from './css-generator.i18n';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA, decodeShadows, decodeStops, encodeShadows, encodeStops } from './css-generator.share';

type Tab = 'gradient' | 'shadow';

@Component({
  selector: 'app-css-generator',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './css-generator.page.html',
  styleUrl: './css-generator.page.scss',
})
export class CssGeneratorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly gradientPresets = GRADIENT_PRESETS;
  protected readonly shadowPresets = SHADOW_PRESETS;
  protected readonly minStops = MIN_STOPS;
  protected readonly maxStops = MAX_STOPS;
  protected readonly maxShadows = MAX_SHADOWS;

  protected readonly tab = signal<Tab>('gradient');
  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    { value: 'gradient', label: this.i18n.t('cssg.tab.gradient') },
    { value: 'shadow', label: this.i18n.t('cssg.tab.shadow') },
  ]);

  // ---- gradiente ----
  protected readonly gradient = signal<Gradient>(defaultGradient());
  protected readonly selected = signal<number>(1);
  protected readonly kinds = computed<SegmentOption<GradientKind>[]>(() => [
    { value: 'linear', label: this.i18n.t('cssg.g.linear') },
    { value: 'radial', label: this.i18n.t('cssg.g.radial') },
    { value: 'conic', label: this.i18n.t('cssg.g.conic') },
  ]);
  protected readonly gradientValue = computed(() => gradientValue(this.gradient()));
  protected readonly gradientCode = computed(() => gradientCss(this.gradient()));
  /** Anteprima della barra degli stop: sempre lineare a 90°, con gli stessi colori. */
  protected readonly barValue = computed(() => gradientValue({ ...this.gradient(), kind: 'linear', angle: 90, repeating: false }));

  private dragging: { id: number; bar: HTMLElement } | null = null;

  // Link di condivisione: stato nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => {
    const g = this.gradient();
    return {
      tab: this.tab(),
      kind: g.kind,
      angle: g.angle,
      shape: g.shape,
      cx: g.cx,
      cy: g.cy,
      repeating: g.repeating,
      stops: encodeStops(g.stops),
      shadows: encodeShadows(this.shadows()),
      shadowBg: this.shadowBg(),
    };
  };

  protected restoreShared(d: ShareData): void {
    const stops = Array.isArray(d['stops']) ? decodeStops(d['stops']) : null;
    const shadows = Array.isArray(d['shadows']) ? decodeShadows(d['shadows']) : null;
    this.gradient.update((g) => ({
      ...g,
      kind: typeof d['kind'] === 'string' ? (d['kind'] as GradientKind) : g.kind,
      angle: typeof d['angle'] === 'number' ? d['angle'] : g.angle,
      shape: typeof d['shape'] === 'string' ? (d['shape'] as RadialShape) : g.shape,
      cx: typeof d['cx'] === 'number' ? d['cx'] : g.cx,
      cy: typeof d['cy'] === 'number' ? d['cy'] : g.cy,
      repeating: typeof d['repeating'] === 'boolean' ? d['repeating'] : g.repeating,
      stops: stops ?? g.stops,
    }));
    if (stops) this.selected.set(stops[Math.min(1, stops.length - 1)].id);
    if (shadows) this.shadows.set(shadows);
    if (typeof d['shadowBg'] === 'string') this.shadowBg.set(d['shadowBg'] as 'light' | 'dark');
    if (typeof d['tab'] === 'string') this.tab.set(d['tab'] as Tab);
  }

  constructor() {
    this.i18n.register(CSSG_DICTIONARIES);
  }

  protected get kind(): GradientKind {
    return this.gradient().kind;
  }

  protected setKind(k: GradientKind): void {
    this.gradient.update((g) => ({ ...g, kind: k }));
  }

  protected patch(p: Partial<Gradient>): void {
    this.gradient.update((g) => ({ ...g, ...p }));
  }

  protected setNumber(key: 'angle' | 'cx' | 'cy', value: string, min: number, max: number): void {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    this.patch({ [key]: clamp(n, min, max) });
  }

  protected setShape(s: RadialShape): void {
    this.patch({ shape: s });
  }

  protected addStop(): void {
    const before = this.gradient().stops;
    const stops = addStop(before);
    this.patch({ stops });
    this.selected.set(stops[stops.length - 1].id);
  }

  protected removeStop(id: number): void {
    const stops = removeStop(this.gradient().stops, id);
    this.patch({ stops });
    if (!stops.some((s) => s.id === this.selected())) this.selected.set(stops[0].id);
  }

  protected setStopColor(id: number, hex: string): void {
    const c = normalizeHex(hex);
    if (c) this.patch({ stops: updateStop(this.gradient().stops, id, { color: c }) });
  }

  protected setStopNumber(id: number, key: 'alpha' | 'pos', value: string): void {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    this.patch({ stops: updateStop(this.gradient().stops, id, { [key]: n }) });
  }

  protected applyGradientPreset(i: number): void {
    const g = this.gradientPresets[i].gradient();
    this.gradient.set(g);
    this.selected.set(g.stops[0].id);
  }

  // trascinamento degli stop sulla barra
  protected onHandleDown(e: PointerEvent, id: number): void {
    const bar = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    this.selected.set(id);
    this.dragging = { id, bar };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  protected onHandleMove(e: PointerEvent): void {
    const d = this.dragging;
    if (!d) return;
    const r = d.bar.getBoundingClientRect();
    if (r.width <= 0) return;
    const pos = clamp(Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, 0, 100);
    this.patch({ stops: updateStop(this.gradient().stops, d.id, { pos }) });
  }

  protected onHandleUp(): void {
    this.dragging = null;
  }

  protected onHandleKey(e: KeyboardEvent, id: number): void {
    const step = e.shiftKey ? 10 : 1;
    let delta = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'Home') delta = -100;
    else if (e.key === 'End') delta = 100;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && this.gradient().stops.length > MIN_STOPS) {
      e.preventDefault();
      this.removeStop(id);
      return;
    } else return;
    e.preventDefault();
    const s = this.gradient().stops.find((x) => x.id === id);
    if (s) this.patch({ stops: updateStop(this.gradient().stops, id, { pos: s.pos + delta }) });
  }

  protected onBarDblClick(e: MouseEvent): void {
    const bar = e.currentTarget as HTMLElement;
    if ((e.target as HTMLElement).closest('.handle')) return;
    const r = bar.getBoundingClientRect();
    if (r.width <= 0 || this.gradient().stops.length >= MAX_STOPS) return;
    const stops = addStop(this.gradient().stops, ((e.clientX - r.left) / r.width) * 100);
    this.patch({ stops });
    this.selected.set(stops[stops.length - 1].id);
  }

  // ---- box-shadow ----
  protected readonly shadows = signal<Shadow[]>([{ ...newShadow(1), y: 8, blur: 24, alpha: 0.25 }]);
  protected readonly shadowBg = signal<'light' | 'dark'>('light');
  protected readonly bgOptions = computed<SegmentOption<'light' | 'dark'>[]>(() => [
    { value: 'light', label: this.i18n.t('cssg.s.bg.light') },
    { value: 'dark', label: this.i18n.t('cssg.s.bg.dark') },
  ]);
  protected readonly shadowInline = computed(() => shadowsInline(this.shadows()));
  protected readonly shadowCode = computed(() => shadowsCss(this.shadows()));

  protected addShadow(): void {
    const list = this.shadows();
    if (list.length >= MAX_SHADOWS) return;
    this.shadows.set([...list, newShadow(list.reduce((m, s) => Math.max(m, s.id), 0) + 1)]);
  }

  protected removeShadow(id: number): void {
    this.shadows.update((l) => l.filter((s) => s.id !== id));
  }

  protected setShadowNumber(id: number, key: 'x' | 'y' | 'blur' | 'spread' | 'alpha', value: string): void {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    this.shadows.update((l) => updateShadow(l, id, { [key]: n }));
  }

  protected setShadowColor(id: number, hex: string): void {
    const c = normalizeHex(hex);
    if (c) this.shadows.update((l) => updateShadow(l, id, { color: c }));
  }

  protected setShadowInset(id: number, inset: boolean): void {
    this.shadows.update((l) => updateShadow(l, id, { inset }));
  }

  protected applyShadowPreset(i: number): void {
    this.shadows.set(this.shadowPresets[i].shadows());
  }
}
