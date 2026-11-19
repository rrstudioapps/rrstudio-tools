// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  Conversion,
  LIMITS,
  StopChoice,
  TextCounts,
  WORDS_PER_MINUTE_READING,
  WORDS_PER_MINUTE_SPEAKING,
  convert,
  countText,
  durationSeconds,
  formatDuration,
  limitStatus,
  topWords,
  words,
} from './text-count';
import { WC_DICTIONARIES } from './word-counter.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './word-counter.share';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

const CONVERSIONS: readonly Conversion[] = ['upper', 'lower', 'title', 'sentence', 'invert', 'spaces', 'blank'];
/** Oltre questa lunghezza i conteggi si aggiornano con un breve ritardo mentre si scrive. */
const INSTANT_CHARS = 20000;

interface StatRow {
  id: string;
  label: string;
  value: string;
}
interface LimitRow {
  id: string;
  label: string;
  used: string;
  limit: string;
  fraction: number;
  over: boolean;
  text: string;
}

@Component({
  selector: 'app-word-counter',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-counter.page.html',
  styleUrl: './word-counter.page.scss',
})
export class WordCounterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly text = signal('');
  /** Testo su cui si calcola: coincide con `text`, ma con ritardo se il testo è molto lungo. */
  private readonly counted = signal('');
  private readonly previous = signal<string | null>(null);
  protected readonly stop = signal<StopChoice>('auto');
  protected readonly customLimit = signal('');
  protected readonly conversions = CONVERSIONS;

  protected readonly stopOptions = computed<SegmentOption<StopChoice>[]>(() => [
    { value: 'auto', label: this.i18n.t('wc.freq.auto') },
    { value: 'it', label: this.i18n.t('wc.freq.it') },
    { value: 'en', label: this.i18n.t('wc.freq.en') },
    { value: 'none', label: this.i18n.t('wc.freq.none') },
  ]);

  private readonly num = computed(() => new Intl.NumberFormat(this.i18n.locale()));
  private readonly pct = computed(() => new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }));

  private readonly wordList = computed(() => words(this.counted(), this.i18n.lang()));
  protected readonly counts = computed<TextCounts>(() => ({ ...countText(this.counted(), this.i18n.lang()), words: this.wordList().length }));
  protected readonly empty = computed(() => this.text() === '');
  private readonly readingSec = computed(() => durationSeconds(this.counts().words, WORDS_PER_MINUTE_READING));
  private readonly speakingSec = computed(() => durationSeconds(this.counts().words, WORDS_PER_MINUTE_SPEAKING));

  protected readonly rows = computed<StatRow[]>(() => {
    const c = this.counts();
    const n = this.num();
    const t = (k: string): string => this.i18n.t('wc.stat.' + k);
    return [
      { id: 'words', label: t('words'), value: n.format(c.words) },
      { id: 'chars', label: t('chars'), value: n.format(c.chars) },
      { id: 'charsNoSpaces', label: t('charsNoSpaces'), value: n.format(c.charsNoSpaces) },
      { id: 'sentences', label: t('sentences'), value: n.format(c.sentences) },
      { id: 'paragraphs', label: t('paragraphs'), value: n.format(c.paragraphs) },
      { id: 'lines', label: t('lines'), value: n.format(c.lines) },
      { id: 'reading', label: t('reading'), value: formatDuration(this.readingSec()) },
      { id: 'speaking', label: t('speaking'), value: formatDuration(this.speakingSec()) },
    ];
  });

  protected readonly summary = computed(() => {
    const c = this.counts();
    const n = this.num();
    return this.i18n.t('wc.summary', {
      words: n.format(c.words),
      chars: n.format(c.chars),
      noSpaces: n.format(c.charsNoSpaces),
      sentences: n.format(c.sentences),
      paragraphs: n.format(c.paragraphs),
      lines: n.format(c.lines),
      reading: formatDuration(this.readingSec()),
      speaking: formatDuration(this.speakingSec()),
    });
  });

  protected readonly limitRows = computed<LimitRow[]>(() => {
    const used = this.counts().chars;
    const n = this.num();
    const defs = LIMITS.map((l) => ({ id: l.id, label: this.i18n.t('wc.limit.' + l.id), chars: l.chars }));
    const custom = parseInt(this.customLimit(), 10);
    if (Number.isFinite(custom) && custom > 0) defs.push({ id: 'custom', label: this.i18n.t('wc.limit.custom'), chars: custom });
    return defs.map((d) => {
      const s = limitStatus(used, d.chars);
      const text = s.over
        ? this.i18n.t('wc.limit.over', { n: n.format(-s.remaining) })
        : s.remaining === 0 && used > 0
          ? this.i18n.t('wc.limit.exact')
          : this.i18n.t('wc.limit.left', { n: n.format(s.remaining) });
      return { id: d.id, label: d.label, used: n.format(used), limit: n.format(d.chars), fraction: s.fraction, over: s.over, text };
    });
  });

  protected readonly frequent = computed(() => {
    const r = topWords(this.wordList(), this.stop());
    const n = this.num();
    return {
      lang: r.lang,
      items: r.items.map((i) => ({ word: i.word, count: n.format(i.count), percent: this.pct().format(i.percent), width: Math.min(100, i.percent * 4) })),
    };
  });
  protected readonly detectedLabel = computed(() => {
    const l = this.frequent().lang;
    return this.stop() === 'auto' && l && !this.empty() ? this.i18n.t('wc.freq.detected', { lang: this.i18n.t('wc.lang.' + l) }) : '';
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    text: this.text,
    stop: this.stop,
    customLimit: this.customLimit,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(WC_DICTIONARIES);
    const rx = inject(ToolHandoff).take('word-counter');
    if (rx?.text !== undefined) this.text.set(rx.text);
    effect((onCleanup) => {
      const t = this.text();
      if (t.length <= INSTANT_CHARS) {
        this.counted.set(t);
        return;
      }
      const id = setTimeout(() => this.counted.set(t), 250);
      onCleanup(() => clearTimeout(id));
    });
  }

  protected onInput(e: Event): void {
    this.previous.set(null);
    this.text.set((e.target as HTMLTextAreaElement).value);
  }

  protected apply(how: Conversion): void {
    const next = convert(this.text(), how);
    if (next === this.text()) return;
    this.previous.set(this.text());
    this.text.set(next);
  }

  protected undo(): void {
    const p = this.previous();
    if (p === null) return;
    this.text.set(p);
    this.previous.set(null);
  }

  protected clear(): void {
    this.previous.set(this.text());
    this.text.set('');
  }

  protected loadSample(): void {
    this.previous.set(null);
    this.text.set(this.i18n.t('wc.sample.text'));
  }

  protected canUndo(): boolean {
    return this.previous() !== null;
  }

  protected onCustom(e: Event): void {
    this.customLimit.set((e.target as HTMLInputElement).value);
  }
}
