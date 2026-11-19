// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { PASSWORD_DICTIONARIES } from './password-generator.i18n';
import {
  Generated,
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  PassphraseOptions,
  PasswordOptions,
  SEPARATORS,
  Separator,
  clamp,
  crackSeconds,
  describeDuration,
  generatePassphrase,
  generatePassword,
  strengthOf,
} from './password';
import { loadWordlist } from './wordlist';

type Mode = 'password' | 'passphrase';
type SetName = 'lower' | 'upper' | 'digits' | 'symbols';

/** Fondo scala della barra dell'entropia. */
const METER_MAX_BITS = 128;

@Component({
  selector: 'app-password-generator',
  imports: [Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './password-generator.page.html',
  styleUrl: './password-generator.page.scss',
})
export class PasswordGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly minLength = MIN_LENGTH;
  protected readonly maxLength = MAX_LENGTH;
  protected readonly minWords = MIN_WORDS;
  protected readonly maxWords = MAX_WORDS;
  protected readonly separators = SEPARATORS;

  protected readonly mode = signal<Mode>('password');
  protected readonly length = signal(20);
  protected readonly lower = signal(true);
  protected readonly upper = signal(true);
  protected readonly digits = signal(true);
  protected readonly symbols = signal(true);
  protected readonly noAmbiguous = signal(false);
  protected readonly words = signal(5);
  protected readonly separator = signal<Separator>('-');
  protected readonly capitalize = signal(false);
  protected readonly withNumber = signal(false);

  protected readonly current = signal<Generated | null>(null);
  protected readonly list = signal<string[] | null>(null);
  private readonly wordlist = signal<string[] | null>(null);
  protected readonly wordlistError = signal(false);

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'password', label: this.i18n.t('pw.mode.password') },
    { value: 'passphrase', label: this.i18n.t('pw.mode.passphrase') },
  ]);

  protected readonly passwordOptions = computed<PasswordOptions>(() => ({
    length: this.length(),
    lower: this.lower(),
    upper: this.upper(),
    digits: this.digits(),
    symbols: this.symbols(),
    noAmbiguous: this.noAmbiguous(),
  }));
  private readonly passphraseOptions = computed<PassphraseOptions>(() => ({
    words: this.words(),
    separator: this.separator(),
    capitalize: this.capitalize(),
    withNumber: this.withNumber(),
  }));

  protected readonly activeSetCount = computed(
    () => [this.lower(), this.upper(), this.digits(), this.symbols()].filter(Boolean).length,
  );
  protected readonly wordsReady = computed(() => this.wordlist() !== null);
  protected readonly loadingWords = computed(
    () => this.mode() === 'passphrase' && this.wordlist() === null && !this.wordlistError(),
  );

  protected readonly strength = computed(() => {
    const g = this.current();
    return g ? strengthOf(g.bits) : null;
  });
  protected readonly strengthLabel = computed(() => {
    const s = this.strength();
    return s ? this.i18n.t('pw.strength.' + s) : '';
  });
  private readonly bitsNumber = computed(() => {
    const g = this.current();
    return g ? new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(g.bits) : '';
  });
  protected readonly bitsText = computed(() => (this.current() ? this.i18n.t('pw.bits', { bits: this.bitsNumber() }) : ''));
  protected readonly meterPercent = computed(() => Math.min(100, ((this.current()?.bits ?? 0) / METER_MAX_BITS) * 100));
  protected readonly meterLabel = computed(() =>
    this.i18n.t('pw.meter', { bits: this.bitsNumber(), label: this.strengthLabel() }),
  );

  /** Tempo medio per indovinare, già formattato nella lingua corrente. */
  protected readonly timeText = computed(() => {
    const g = this.current();
    if (!g) return '';
    const d = describeDuration(crackSeconds(g.bits));
    const lang = this.i18n.locale();
    const num = (n: number): string => new Intl.NumberFormat(lang, { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
    const unit = (u: string, n: number): string =>
      new Intl.NumberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'long' }).format(n);
    const plural = (key: string, n: number): string => {
      const rounded = Number(n.toFixed(n < 10 ? 1 : 0));
      const cat = new Intl.PluralRules(lang).select(rounded);
      return this.i18n.t(key + (cat === 'one' ? '.one' : '.other'), { n: num(n) });
    };
    let time: string;
    switch (d.unit) {
      case 'instant':
        time = this.i18n.t('pw.time.instant');
        break;
      case 'millionYear':
        time = plural('pw.time.myear', d.value);
        break;
      case 'billionYear':
        time = plural('pw.time.byear', d.value);
        break;
      case 'overTrillion':
        time = this.i18n.t('pw.time.over');
        break;
      default:
        time = unit(d.unit, d.value);
    }
    return this.i18n.t('pw.time', { time });
  });

  constructor() {
    this.i18n.register(PASSWORD_DICTIONARIES);
    // Rigenera quando cambia un'opzione (solo nel browser: la pagina prerenderizzata non contiene password)
    effect(() => {
      if (!this.browser) return;
      const mode = this.mode();
      const po = this.passwordOptions();
      const ph = this.passphraseOptions();
      const wl = this.wordlist();
      untracked(() => {
        this.list.set(null);
        if (mode === 'password') {
          this.current.set(this.safe(() => generatePassword(po)));
        } else if (wl) {
          this.current.set(this.safe(() => generatePassphrase(ph, wl)));
        } else {
          this.current.set(null);
          void this.ensureWordlist();
        }
      });
    });
  }

  private safe(fn: () => Generated): Generated | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }

  private async ensureWordlist(): Promise<void> {
    this.wordlistError.set(false);
    try {
      this.wordlist.set(await loadWordlist());
    } catch {
      this.wordlistError.set(true);
    }
  }

  protected retryWordlist(): void {
    void this.ensureWordlist();
  }

  protected generate(): void {
    if (this.mode() === 'password') {
      this.current.set(this.safe(() => generatePassword(this.passwordOptions())));
    } else {
      const wl = this.wordlist();
      if (wl) this.current.set(this.safe(() => generatePassphrase(this.passphraseOptions(), wl)));
    }
  }

  protected generateTen(): void {
    const out: string[] = [];
    if (this.mode() === 'password') {
      const o = this.passwordOptions();
      for (let i = 0; i < 10; i++) out.push(generatePassword(o).text);
    } else {
      const wl = this.wordlist();
      if (!wl) return;
      const o = this.passphraseOptions();
      for (let i = 0; i < 10; i++) out.push(generatePassphrase(o, wl).text);
    }
    this.list.set(out);
  }

  protected closeList(): void {
    this.list.set(null);
  }

  protected setLength(value: string): void {
    this.length.set(clamp(Number(value), MIN_LENGTH, MAX_LENGTH));
  }
  protected setWords(value: string): void {
    this.words.set(clamp(Number(value), MIN_WORDS, MAX_WORDS));
  }

  protected toggleSet(name: SetName, checked: boolean): void {
    // l'ultimo set attivo non si può spegnere
    if (!checked && this.activeSetCount() <= 1) return;
    ({ lower: this.lower, upper: this.upper, digits: this.digits, symbols: this.symbols })[name].set(checked);
  }

  protected isLastActive(on: boolean): boolean {
    return on && this.activeSetCount() === 1;
  }

  protected listText(): string {
    return (this.list() ?? []).join('\n');
  }
}
