// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { FIND_REPLACE_TIMEOUT_MS, FindReplaceClient, NoWorker, RunTimeout, StaleRun } from './find-replace-client';
import { DEFAULT_RULE, MAX_RULES, Rule, RuleMode, RunResult, buildRuleRegex, highlightPieces, isActive } from './find-replace-core';
import { FR_DICTIONARIES } from './find-replace.i18n';

interface Row extends Rule {
  id: number;
}
type Status = 'idle' | 'busy' | 'timeout' | 'noworker' | 'failed';

const DEBOUNCE_MS = 200;
/** Oltre questa lunghezza l'anteprima evidenziata non si disegna (migliaia di nodi nel DOM). */
const PREVIEW_MAX_CHARS = 200_000;

@Component({
  selector: 'app-find-replace',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './find-replace.page.html',
  styleUrl: './find-replace.page.scss',
})
export class FindReplacePage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly client = new FindReplaceClient();

  protected readonly maxRules = MAX_RULES;
  protected readonly timeoutSeconds = FIND_REPLACE_TIMEOUT_MS / 1000;
  protected readonly previewMax = PREVIEW_MAX_CHARS;
  private nextId = 1;

  protected readonly text = signal('');
  protected readonly rules = signal<Row[]>([this.newRow()]);
  protected readonly previewRule = signal(0);
  protected readonly status = signal<Status>('idle');
  private readonly run = signal<Extract<RunResult, { ok: true }> | null>(null);

  protected readonly modes = computed<SegmentOption<RuleMode>[]>(() => [
    { value: 'text', label: this.i18n.t('fr.mode.text') },
    { value: 'regex', label: this.i18n.t('fr.mode.regex') },
  ]);

  /** Errore di sintassi trovato subito sul thread principale (costruire una RegExp non esegue nulla). */
  protected readonly syntaxErrors = computed(() =>
    this.rules().map((r) => {
      if (!isActive(r) || r.mode !== 'regex') return '';
      const re = buildRuleRegex(r);
      return typeof re === 'string' ? re : '';
    }),
  );

  protected readonly output = computed(() => this.run()?.output ?? '');
  protected readonly outcomes = computed(() => this.run()?.outcomes ?? []);
  protected readonly counts = computed(() =>
    this.rules().map((r, i) => {
      const o = this.outcomes()[i];
      const err = this.syntaxErrors()[i];
      if (err) return this.i18n.t('fr.err.regex', { msg: err });
      if (!isActive(r)) return this.i18n.t('fr.count.skipped');
      if (!o) return '';
      if (o.error) return this.i18n.t('fr.err.regex', { msg: o.error });
      if (o.countCapped) return this.i18n.t('fr.count.capped', { n: new Intl.NumberFormat(this.i18n.locale()).format(o.count) });
      if (o.count === 0) return this.i18n.t('fr.count.none');
      if (o.count === 1) return this.i18n.t('fr.count.one');
      return this.i18n.t('fr.count.n', { n: new Intl.NumberFormat(this.i18n.locale()).format(o.count) });
    }),
  );
  protected readonly total = computed(() => {
    const sum = this.outcomes().reduce((s, o) => s + (o.applied ? o.count : 0), 0);
    return sum > 0 ? this.i18n.t('fr.total', { n: new Intl.NumberFormat(this.i18n.locale()).format(sum) }) : '';
  });
  protected readonly preview = computed(() => {
    const r = this.run();
    if (!r) return null;
    if (r.previewText.length > PREVIEW_MAX_CHARS) return { big: true, pieces: [], truncated: false, any: false };
    const matches = r.previewMatches.filter((m) => m.end > m.index);
    return { big: false, pieces: highlightPieces(r.previewText, matches), truncated: r.previewTruncated, any: matches.length > 0 };
  });
  protected readonly statusText = computed(() => {
    switch (this.status()) {
      case 'busy':
        return this.i18n.t('fr.busy');
      case 'timeout':
        return this.i18n.t('fr.timeout', { s: this.timeoutSeconds });
      case 'noworker':
        return this.i18n.t('fr.noworker');
      case 'failed':
        return this.i18n.t('fr.failed');
      default:
        return '';
    }
  });

  constructor() {
    this.i18n.register(FR_DICTIONARIES);
    let timer: ReturnType<typeof setTimeout> | undefined;
    // il calcolo parte poco dopo l'ultima modifica; solo nel browser (nessun worker nel prerender)
    effect((onCleanup) => {
      const text = this.text();
      const rules = this.rules();
      const previewRule = Math.min(this.previewRule(), rules.length - 1);
      if (!this.browser) return;
      clearTimeout(timer);
      timer = setTimeout(() => void this.execute(text, rules, previewRule), DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      this.client.dispose();
    });
  }

  private async execute(text: string, rules: Row[], previewRule: number): Promise<void> {
    this.status.set('busy');
    try {
      const r = await this.client.run({ text, rules, previewRule });
      if (!r.ok) return void this.status.set('failed');
      this.run.set(r);
      this.status.set('idle');
    } catch (e) {
      if (e instanceof StaleRun) return;
      this.run.set(null);
      this.status.set(e instanceof RunTimeout ? 'timeout' : e instanceof NoWorker ? 'noworker' : 'failed');
    }
  }

  private newRow(): Row {
    return { ...DEFAULT_RULE, flags: { ...DEFAULT_RULE.flags }, id: this.nextId++ };
  }

  protected update(index: number, patch: Partial<Rule>): void {
    this.rules.update((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  protected setFlag(index: number, flag: 'g' | 'm' | 's' | 'u', value: boolean): void {
    this.rules.update((list) => list.map((r, i) => (i === index ? { ...r, flags: { ...r.flags, [flag]: value } } : r)));
  }

  protected add(): void {
    if (this.rules().length >= MAX_RULES) return;
    this.rules.update((list) => [...list, this.newRow()]);
  }

  protected remove(index: number): void {
    this.rules.update((list) => (list.length <= 1 ? [this.newRow()] : list.filter((_, i) => i !== index)));
    if (this.previewRule() >= this.rules().length) this.previewRule.set(this.rules().length - 1);
  }

  protected move(index: number, delta: -1 | 1): void {
    const to = index + delta;
    const list = this.rules();
    if (to < 0 || to >= list.length) return;
    const copy = list.slice();
    [copy[index], copy[to]] = [copy[to], copy[index]];
    this.rules.set(copy);
    if (this.previewRule() === index) this.previewRule.set(to);
    else if (this.previewRule() === to) this.previewRule.set(index);
  }

  protected loadExample(): void {
    this.text.set('Mario Rossi <mario.rossi@example.com>\nLuisa Bianchi <luisa.bianchi@example.org>\nPaolo Verdi <paolo.verdi@example.net>\nTelefono: 333 123 4567');
    this.rules.set([
      { ...this.newRow(), mode: 'regex', find: '(\\w+) (\\w+) <([^>]+)>', replace: '$3 ($2, $1)', flags: { g: true, m: false, s: false, u: false } },
      { ...this.newRow(), mode: 'text', find: 'example.', replace: 'esempio.' },
    ]);
    this.previewRule.set(0);
  }

  protected useAsInput(): void {
    this.text.set(this.output());
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output()), 'testo-modificato.txt', 'text/plain;charset=utf-8');
  }
}
