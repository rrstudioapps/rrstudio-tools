// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { NoWorker, REGEX_TIMEOUT_MS, RegexClient, RegexTimeout, StaleRegex } from './regex-client';
import { FLAGS, MatchInfo, RegexResult, buildRegex, highlightPieces } from './regex-core';
import { EXAMPLES, RegexExample } from './regex-examples';
import { explainPattern } from './regex-explain';
import { RX_DICTIONARIES } from './regex-tester.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './regex-tester.share';

type Status = 'idle' | 'busy' | 'timeout' | 'noworker';
const DEBOUNCE_MS = 150;

@Component({
  selector: 'app-regex-tester',
  imports: [ShareLink, Icon, PrivacyNote, IoPanel, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './regex-tester.page.html',
  styleUrl: './regex-tester.page.scss',
})
export class RegexTesterPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly client = new RegexClient();

  protected readonly allFlags = FLAGS;
  protected readonly examples = EXAMPLES;
  protected readonly pattern = signal('');
  protected readonly flags = signal('g');
  protected readonly text = signal('');
  protected readonly replacement = signal('');

  protected readonly status = signal<Status>('idle');
  private readonly result = signal<RegexResult | null>(null);
  /** Dati del risultato associati al pattern/testo per cui sono stati calcolati (gli altri si scartano). */
  protected readonly timeoutSeconds = REGEX_TIMEOUT_MS / 1000;

  /** Errore di sintassi trovato subito sul thread principale (costruire una RegExp non esegue nulla). */
  protected readonly syntaxError = computed(() => {
    if (this.pattern() === '') return '';
    const r = buildRegex(this.pattern(), this.flags());
    return typeof r === 'string' ? r : '';
  });

  protected readonly ok = computed(() => {
    const r = this.result();
    return r && r.ok ? r : null;
  });
  protected readonly matches = computed<MatchInfo[]>(() => this.ok()?.matches ?? []);
  protected readonly pieces = computed(() => highlightPieces(this.text(), this.matches()));
  protected readonly replaced = computed(() => this.ok()?.replaced ?? '');
  protected readonly truncated = computed(() => this.ok()?.truncated ?? false);
  protected readonly hasGroups = computed(() => (this.ok()?.groupCount ?? 0) > 0);
  protected readonly explanation = computed(() => explainPattern(this.pattern(), this.i18n.lang()));

  protected readonly countText = computed(() => {
    const n = this.matches().length;
    const f = new Intl.NumberFormat(this.i18n.locale());
    if (this.syntaxError() || this.pattern() === '') return '';
    return n === 0 ? this.i18n.t('rx.count.none') : n === 1 ? this.i18n.t('rx.count.one') : this.i18n.t('rx.count', { n: f.format(n) });
  });
  protected readonly timeoutText = computed(() => this.i18n.t('rx.timeout', { s: this.timeoutSeconds }));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    pattern: this.pattern,
    flags: this.flags,
    text: this.text,
    replacement: this.replacement,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(RX_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.client.dispose());
    effect((onCleanup) => {
      const pattern = this.pattern();
      const flags = this.flags();
      const text = this.text();
      const replacement = this.replacement();
      if (!this.isBrowser) return;
      if (pattern === '' || this.syntaxError()) {
        this.result.set(null);
        this.status.set('idle');
        return;
      }
      let cancelled = false;
      const timer = setTimeout(() => {
        this.status.set('busy');
        this.client
          .run({ pattern, flags, text, replacement })
          .then((r) => {
            if (cancelled) return;
            this.result.set(r);
            this.status.set('idle');
          })
          .catch((e: unknown) => {
            if (cancelled || e instanceof StaleRegex) return;
            this.result.set(null);
            this.status.set(e instanceof RegexTimeout ? 'timeout' : e instanceof NoWorker ? 'noworker' : 'idle');
          });
      }, DEBOUNCE_MS);
      onCleanup(() => {
        cancelled = true;
        clearTimeout(timer);
      });
    });
  }

  protected hasFlag(f: string): boolean {
    return this.flags().includes(f);
  }

  protected toggleFlag(f: string): void {
    const cur = this.flags();
    this.flags.set(cur.includes(f) ? cur.replace(f, '') : FLAGS.filter((x) => x === f || cur.includes(x)).join(''));
  }

  protected onPattern(e: Event): void {
    this.pattern.set((e.target as HTMLInputElement).value);
  }
  protected onText(e: Event): void {
    this.text.set((e.target as HTMLTextAreaElement).value);
  }
  protected onReplacement(e: Event): void {
    this.replacement.set((e.target as HTMLInputElement).value);
  }

  protected loadExample(e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const ex: RegexExample | undefined = EXAMPLES.find((x) => x.id === sel.value);
    sel.value = '';
    if (!ex) return;
    this.pattern.set(ex.pattern);
    this.flags.set(ex.flags);
    this.text.set(ex.text);
    this.replacement.set(ex.replacement);
  }

  protected clear(): void {
    this.pattern.set('');
    this.text.set('');
    this.replacement.set('');
    this.result.set(null);
  }

  protected where(m: MatchInfo): string {
    return m.end === m.index ? `${m.index}` : `${m.index}–${m.end}`;
  }

  protected shown(s: string): string {
    return s === '' ? this.i18n.t('rx.empty.match') : s;
  }
}
