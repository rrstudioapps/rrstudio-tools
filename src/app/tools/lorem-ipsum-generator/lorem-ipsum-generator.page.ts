// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Format, LIMITS, Unit, clampCount, generateLorem, randomSeed, textStats } from './lorem';
import { LOREM_DICTIONARIES } from './lorem-ipsum-generator.i18n';
import { Segmented, SegmentOption } from '../../shared/segmented';

@Component({
  selector: 'app-lorem-ipsum-generator',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lorem-ipsum-generator.page.html',
  styleUrl: './lorem-ipsum-generator.page.scss',
})
export class LoremIpsumGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly unit = signal<Unit>('paragraphs');
  protected readonly count = signal(LIMITS.paragraphs.default);
  protected readonly classic = signal(true);
  protected readonly format = signal<Format>('text');
  /** Seme scritto dall'utente; se vuoto si usa quello casuale. */
  protected readonly seedInput = signal('');
  /** Ultimo seme casuale: si sceglie dopo il primo rendering nel browser (la pagina prerenderizzata non ha testo). */
  private readonly randomSeedValue = signal('');

  protected readonly range = computed(() => LIMITS[this.unit()]);
  protected readonly units = computed<SegmentOption<Unit>[]>(() =>
    (['paragraphs', 'sentences', 'words'] as const).map((v) => ({ value: v, label: this.i18n.t('lorem.unit.' + v) })),
  );
  protected readonly formats = computed<SegmentOption<Format>[]>(() => [
    { value: 'text', label: this.i18n.t('lorem.format.text') },
    { value: 'html', label: this.i18n.t('lorem.format.html') },
  ]);
  protected readonly fixedSeed = computed(() => this.seedInput().trim() !== '');
  protected readonly seed = computed(() => (this.fixedSeed() ? this.seedInput().trim() : this.randomSeedValue()));
  protected readonly text = computed(() => {
    const seed = this.seed();
    if (seed === '') return '';
    return generateLorem({ unit: this.unit(), count: this.count(), classicStart: this.classic(), format: this.format(), seed });
  });
  protected readonly meta = computed(() => {
    const t = this.text();
    if (!t) return '';
    const s = textStats(t);
    return this.i18n.t('lorem.meta', { words: s.words, chars: s.chars });
  });

  constructor() {
    this.i18n.register(LOREM_DICTIONARIES);
    afterNextRender(() => this.randomSeedValue.set(randomSeed()));
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      this.generate();
    }
  }

  protected generate(): void {
    if (this.browser && !this.fixedSeed()) this.randomSeedValue.set(randomSeed());
  }

  protected setUnit(unit: Unit): void {
    this.unit.set(unit);
    this.count.set(LIMITS[unit].default);
  }

  protected setCount(e: Event): void {
    const el = e.target as HTMLInputElement;
    this.count.set(clampCount(this.unit(), Number(el.value)));
    el.value = String(this.count());
  }

  protected onSeed(e: Event): void {
    this.seedInput.set((e.target as HTMLInputElement).value);
  }

  protected download(): void {
    const html = this.format() === 'html';
    saveBytes(new TextEncoder().encode(this.text() + '\n'), html ? 'lorem-ipsum.html' : 'lorem-ipsum.txt', html ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8');
  }
}
