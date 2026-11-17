// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { PWS_DICTIONARIES } from './password-strength-checker.i18n';
import { Duration, MAX_ANALYZED_LENGTH, StrengthResult, analyze, describeDuration } from './strength';

type Status = 'idle' | 'loading' | 'ready' | 'error';
const DEBOUNCE_MS = 180;

@Component({
  selector: 'app-password-strength-checker',
  imports: [Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './password-strength-checker.page.html',
  styleUrl: './password-strength-checker.page.scss',
})
export class PasswordStrengthCheckerPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly password = signal('');
  protected readonly visible = signal(false);
  protected readonly status = signal<Status>('idle');
  protected readonly result = signal<StrengthResult | null>(null);
  protected readonly maxLength = MAX_ANALYZED_LENGTH;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private run = 0;

  protected readonly scoreText = computed(() => {
    const r = this.result();
    return r ? this.i18n.t('pws.score.value', { n: r.score }) : '';
  });
  protected readonly levelText = computed(() => {
    const r = this.result();
    return r ? this.i18n.t('pws.level.' + r.score) : '';
  });
  protected readonly meterText = computed(() => (this.result() ? `${this.levelText()} (${this.scoreText()})` : ''));
  protected readonly number = computed(() => new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }));
  protected readonly bitsText = computed(() => {
    const r = this.result();
    return r ? this.i18n.t('pws.entropy.value', { bits: this.number().format(r.bits) }) : '';
  });
  protected readonly naiveText = computed(() => {
    const r = this.result();
    return r ? this.i18n.t('pws.entropy.value', { bits: this.number().format(r.naiveBits) }) : '';
  });
  protected readonly guessesText = computed(() => {
    const r = this.result();
    if (!r) return '';
    return r.guesses >= 1e6
      ? new Intl.NumberFormat(this.i18n.locale(), { notation: 'scientific', maximumFractionDigits: 2 }).format(r.guesses)
      : new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 0 }).format(r.guesses);
  });
  protected readonly lengthText = computed(() => this.i18n.t('pws.length.value', { n: this.result()?.length ?? 0 }));

  protected readonly crackRows = computed(() => {
    const r = this.result();
    if (!r) return [];
    const t = r.crackTimes;
    return (
      [
        ['throttled', t.throttled],
        ['online', t.online],
        ['offlineSlow', t.offlineSlow],
        ['offlineFast', t.offlineFast],
      ] as const
    ).map(([id, seconds]) => ({ id, label: this.i18n.t('pws.crack.' + id), value: this.durationText(describeDuration(seconds)) }));
  });

  protected readonly warningText = computed(() => {
    const w = this.result()?.warning;
    return w ? this.tr('pws.warn.', w, 'pws.warn.other') : '';
  });
  protected readonly suggestionTexts = computed(() => (this.result()?.suggestions ?? []).map((s) => this.tr('pws.sug.', s, 'pws.sug.other')));
  protected readonly patterns = computed(() =>
    (this.result()?.patterns ?? []).map((p) => ({
      label: this.tr('pws.pattern.', p.kind, 'pws.pattern.dictionary'),
      token: this.visible() ? p.token : '•'.repeat(Math.min(p.token.length, 12)),
    })),
  );

  constructor() {
    this.i18n.register(PWS_DICTIONARIES);
    // analisi con un breve ritardo dopo l'ultimo tasto; solo nel browser (la pagina prerenderizzata è vuota)
    effect((onCleanup) => {
      const pw = this.password();
      if (!this.browser) return;
      clearTimeout(this.timer);
      const id = ++this.run;
      if (pw === '') {
        this.result.set(null);
        this.status.set('idle');
        return;
      }
      this.timer = setTimeout(() => void this.analyze(pw, id), DEBOUNCE_MS);
      onCleanup(() => clearTimeout(this.timer));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.password.set('');
    });
  }

  private async analyze(pw: string, id: number): Promise<void> {
    this.status.set('loading');
    try {
      const r = await analyze(pw);
      if (id !== this.run) return;
      this.result.set(r);
      this.status.set('ready');
    } catch {
      if (id !== this.run) return;
      this.status.set('error');
    }
  }

  private tr(prefix: string, key: string, fallbackKey: string): string {
    const text = this.i18n.t(prefix + key);
    return text === prefix + key ? this.i18n.t(fallbackKey) : text;
  }

  private durationText(d: Duration): string {
    if (d.kind === 'instant') return this.i18n.t('pws.crack.instant');
    if (d.kind === 'centuries') return this.i18n.t('pws.crack.centuries');
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'unit', unit: d.unit, unitDisplay: 'long', maximumFractionDigits: 0 }).format(d.n);
  }

  protected onInput(e: Event): void {
    this.password.set((e.target as HTMLInputElement).value);
  }

  protected toggle(): void {
    this.visible.update((v) => !v);
  }
}
