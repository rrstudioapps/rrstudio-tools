// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { fromRoman, toRoman } from './roman';
import { ROMAN_DICTIONARIES } from './roman-numerals.i18n';
import { SHARE_SCHEMA } from './roman-numerals.share';
import { ToolHandoff } from '../../shared/tool-handoff';

type Outcome = { kind: 'empty' } | { kind: 'roman'; text: string; value: number } | { kind: 'value'; value: number; text: string } | { kind: 'error'; message: string };

@Component({
  selector: 'app-roman-numerals',
  imports: [ShareLink, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roman-numerals.page.html',
  styleUrl: './roman-numerals.page.scss',
})
export class RomanNumeralsPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly extended = signal(false);
  protected readonly rules = [1, 2, 3, 4, 5, 6];
  /** Anni di esempio: quello in corso e alcuni noti. */
  protected readonly years = [new Date().getFullYear(), 2000, 1999, 1984, 1969, 1492];
  protected readonly letters = [['I', 1], ['V', 5], ['X', 10], ['L', 50], ['C', 100], ['D', 500], ['M', 1000]] as const;

  protected readonly outcome = computed<Outcome>(() => {
    const raw = this.input().trim();
    if (raw === '') return { kind: 'empty' };
    const ext = this.extended();
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      const r = toRoman(n, ext);
      if (r === null) return { kind: 'error', message: this.i18n.t(ext ? 'rom.err.rangeExt' : 'rom.err.range') };
      return { kind: 'roman', text: r, value: n };
    }
    const p = fromRoman(raw, ext);
    if (p.ok) return { kind: 'value', value: p.value, text: toRoman(p.value, ext) ?? raw };
    const key = 'rom.err.' + p.error;
    const s = p.suggestion ? this.i18n.t('rom.err.suggest', { s: p.suggestion }) : '';
    return {
      kind: 'error',
      message: this.i18n.t(key, { d: p.detail ?? '', s, ch: p.detail ? ` «${p.detail}»` : '' }),
    };
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { input: this.input, extended: this.extended };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(ROMAN_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('roman-numerals');
    if (rx?.text !== undefined) this.input.set(rx.text.trim());
  }

  protected setYear(y: number): void {
    this.input.set(String(y));
  }
}
