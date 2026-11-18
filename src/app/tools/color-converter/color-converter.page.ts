// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton, writeClipboard } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import { ShareData, buildShareUrl } from '../../shared/share-state';
import {
  HarmonyKey,
  Swatch,
  harmony,
  parseColor,
  representations,
  rgbToOklch,
  shadeScale,
  shadesToCss,
  shadesToJson,
  toHexOpaque,
} from './color-convert';
import { COLOR_CONVERTER_DICTIONARIES } from './color-converter.i18n';
import { SHARE_SCHEMA } from './color-converter.share';
import { ToolHandoff } from '../../shared/tool-handoff';

type ExportAs = 'css' | 'json';

interface HarmonyView {
  key: HarmonyKey;
  label: string;
  swatches: Swatch[];
}

const HARMONIES: readonly HarmonyKey[] = ['complementary', 'analogous', 'triadic'];

@Component({
  selector: 'app-color-converter',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-converter.page.html',
  styleUrl: './color-converter.page.scss',
})
export class ColorConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly text = signal('#3b82f6');
  protected readonly name = signal('color');
  protected readonly exportAs = signal<ExportAs>('css');
  protected readonly copiedHex = signal('');

  protected readonly parsed = computed(() => parseColor(this.text()));
  protected readonly rgb = computed(() => this.parsed()?.rgb ?? null);
  protected readonly valid = computed(() => this.parsed() !== null);
  protected readonly outOfGamut = computed(() => this.parsed()?.outOfGamut ?? false);
  // ultimo valore valido, per il selettore nativo mentre si sta digitando
  private lastHex = '#3b82f6';

  protected readonly reps = computed(() => {
    const c = this.rgb();
    return c ? representations(c) : [];
  });
  /** Colore effettivo (opaco) per l'anteprima e per le palette. */
  protected readonly previewHex = computed(() => {
    const c = this.rgb();
    return c ? toHexOpaque(c) : '';
  });
  protected readonly shades = computed(() => {
    const c = this.rgb();
    return c ? shadeScale(c) : [];
  });
  protected readonly harmonies = computed<HarmonyView[]>(() => {
    const c = this.rgb();
    if (!c) return [];
    return HARMONIES.map((key) => ({ key, label: this.i18n.t('colc.h.' + key), swatches: harmony(c, key) }));
  });
  protected readonly exportText = computed(() =>
    this.exportAs() === 'css' ? shadesToCss(this.shades(), this.name()) : shadesToJson(this.shades(), this.name()),
  );
  protected readonly exportOptions = computed<SegmentOption<ExportAs>[]>(() => [
    { value: 'css', label: this.i18n.t('colc.export.css') },
    { value: 'json', label: this.i18n.t('colc.export.json') },
  ]);

  /** Colore da mostrare nel testo di avviso del gamut: l'OKLCH scritto dall'utente dopo la mappatura. */
  protected readonly mappedOklch = computed(() => {
    const c = this.rgb();
    if (!c) return '';
    const o = rgbToOklch(c);
    return `${Math.round(o.l * 1000) / 10}% ${Math.round(o.c * 10000) / 10000} ${Math.round(o.h * 10) / 10}`;
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { text: this.text, name: this.name, exportAs: this.exportAs };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(COLOR_CONVERTER_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('color-converter');
    if (rx?.text !== undefined) this.text.set(rx.text.trim());
  }

  protected pickerValue(): string {
    const c = this.rgb();
    if (c) this.lastHex = toHexOpaque(c);
    return this.lastHex;
  }
  protected setText(v: string): void {
    this.text.set(v);
  }
  /** Il selettore nativo non conosce l'alfa: se c'era, si perde (si ricomincia da un colore opaco). */
  protected setPicker(hex: string): void {
    this.text.set(hex);
  }
  protected setName(v: string): void {
    this.name.set(v.slice(0, 30));
  }

  protected copyLabel(what: string): string {
    return this.i18n.t('colc.copy', { what });
  }
  protected swatchLabel(s: Swatch): string {
    return this.i18n.t('colc.swatch.copy', { name: s.name, hex: s.hex });
  }

  protected async copySwatch(s: Swatch): Promise<void> {
    if (await writeClipboard(s.hex)) this.copiedHex.set(s.hex);
  }

  /** Apre il verificatore di contrasto con questo colore come colore del testo (stato nell'hash, mai inviato). */
  protected async openContrast(): Promise<void> {
    const hex = this.previewHex();
    if (!hex) return;
    const path = this.i18n.link('color-contrast-checker');
    const r = await buildShareUrl(path, 'color-contrast-checker', { fgText: hex });
    if (r.ok) await this.router.navigateByUrl(r.url);
  }

  /** Per il fondo dei campioni: testo chiaro o scuro in base alla luminosità OKLCH. */
  protected inkOn(hex: string): string {
    const p = parseColor(hex);
    return p && rgbToOklch(p.rgb).l > 0.62 ? '#111111' : '#ffffff';
  }
}
