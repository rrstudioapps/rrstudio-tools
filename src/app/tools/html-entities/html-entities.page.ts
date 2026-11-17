// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  HtmlFormat,
  HtmlScope,
  JsQuote,
  UnescapeError,
  decodeHtml,
  decodeUrl,
  encodeHtml,
  encodeUrl,
  escapeJs,
  lineColumn,
  unescapeJs,
} from './entities';
import { ENTITIES_DICTIONARIES } from './html-entities.i18n';

type Mode = 'html' | 'js' | 'json' | 'url';
type Dir = 'encode' | 'decode';

const SAMPLES: Record<Mode, Record<Dir, string>> = {
  html: { encode: '<p class="nota">Caffè & cornetto: 3,50 € — «ottimo» ☕</p>', decode: '&lt;p class=&quot;nota&quot;&gt;Caff&egrave; &amp; cornetto: 3,50 &euro; &mdash; &laquo;ottimo&raquo; &#9749;&lt;/p&gt;' },
  js: { encode: 'Ha detto: "ciao"\nPrezzo: 3€ — è l\'ultimo', decode: 'Ha detto: \\"ciao\\"\\nPrezzo: 3\\u20ac \\u2014 \\xE8 l\'ultimo' },
  json: { encode: '{"nome": "Zoë", "nota": "riga1\nriga2"}', decode: '{\\"nome\\": \\"Zo\\u00eb\\", \\"nota\\": \\"riga1\\nriga2\\"}' },
  url: { encode: 'caffè & latte/€ 3,50?', decode: 'caff%C3%A8%20%26%20latte%2F%E2%82%AC%203%2C50%3F' },
};

interface Outcome {
  text: string;
  notes: string[];
  error: string;
}

@Component({
  selector: 'app-html-entities',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './html-entities.page.html',
  styleUrl: './html-entities.page.scss',
})
export class HtmlEntitiesPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('html');
  protected readonly dir = signal<Dir>('encode');
  protected readonly scope = signal<HtmlScope>('nonAscii');
  protected readonly format = signal<HtmlFormat>('named');
  protected readonly quote = signal<JsQuote>('double');
  protected readonly asciiOnly = signal(false);
  protected readonly jsonQuotes = signal(true);
  protected readonly plus = signal(false);
  protected readonly input = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'html', label: this.i18n.t('ent.mode.html') },
    { value: 'js', label: this.i18n.t('ent.mode.js') },
    { value: 'json', label: this.i18n.t('ent.mode.json') },
    { value: 'url', label: this.i18n.t('ent.mode.url') },
  ]);
  protected readonly dirs = computed<SegmentOption<Dir>[]>(() => [
    { value: 'encode', label: this.i18n.t('ent.dir.encode') },
    { value: 'decode', label: this.i18n.t('ent.dir.decode') },
  ]);
  protected readonly scopes = computed<SegmentOption<HtmlScope>[]>(() => [
    { value: 'basic', label: this.i18n.t('ent.scope.basic') },
    { value: 'nonAscii', label: this.i18n.t('ent.scope.nonAscii') },
    { value: 'all', label: this.i18n.t('ent.scope.all') },
  ]);
  protected readonly formats = computed<SegmentOption<HtmlFormat>[]>(() => [
    { value: 'named', label: this.i18n.t('ent.format.named') },
    { value: 'decimal', label: this.i18n.t('ent.format.decimal') },
    { value: 'hex', label: this.i18n.t('ent.format.hex') },
  ]);
  protected readonly quotes = computed<SegmentOption<JsQuote>[]>(() => [
    { value: 'double', label: this.i18n.t('ent.quote.double') },
    { value: 'single', label: this.i18n.t('ent.quote.single') },
    { value: 'backtick', label: this.i18n.t('ent.quote.backtick') },
    { value: 'none', label: this.i18n.t('ent.quote.none') },
  ]);

  protected readonly outcome = computed<Outcome | null>(() => {
    const text = this.input();
    if (text === '') return null;
    const mode = this.mode();
    const encode = this.dir() === 'encode';
    if (mode === 'html') {
      if (encode) return { text: encodeHtml(text, { scope: this.scope(), format: this.format() }), notes: [], error: '' };
      const r = decodeHtml(text);
      const notes = [r.replaced > 0 ? this.i18n.t('ent.replaced', { n: r.replaced }) : this.i18n.t('ent.replaced.none')];
      if (r.unknown.length > 0) notes.push(this.i18n.t('ent.unknown', { list: r.unknown.slice(0, 8).join(' ') + (r.unknown.length > 8 ? ' …' : '') }));
      return { text: r.text, notes, error: '' };
    }
    if (mode === 'url') {
      if (encode) return { text: encodeUrl(text, { plus: this.plus() }), notes: [], error: '' };
      const r = decodeUrl(text, { plus: this.plus() });
      return r.ok ? { text: r.text, notes: [], error: '' } : { text: '', notes: [], error: this.describe(r.error, text) };
    }
    const json = mode === 'json';
    if (encode) {
      const quote: JsQuote = json ? (this.jsonQuotes() ? 'double' : 'none') : this.quote();
      return { text: escapeJs(text, { quote, asciiOnly: this.asciiOnly() }, json), notes: [], error: '' };
    }
    const r = unescapeJs(text, json);
    return r.ok ? { text: r.text, notes: [], error: '' } : { text: '', notes: [], error: this.describe(r.error, text) };
  });
  protected readonly output = computed(() => this.outcome()?.text ?? '');
  protected readonly notes = computed(() => this.outcome()?.notes ?? []);
  protected readonly error = computed(() => this.outcome()?.error ?? '');
  protected readonly inputMeta = computed(() => (this.input() ? this.i18n.t('ent.meta', { chars: [...this.input()].length }) : ''));
  protected readonly outputMeta = computed(() => (this.output() ? this.i18n.t('ent.meta', { chars: [...this.output()].length }) : ''));
  protected readonly hint = computed(() => {
    const parts: string[] = [];
    const mode = this.mode();
    if (this.dir() === 'encode' && mode === 'html') parts.push(this.i18n.t('ent.hint.newlines'));
    if (this.dir() === 'decode' && mode === 'html') parts.push(this.i18n.t('ent.hint.noSemi'));
    if (this.dir() === 'decode' && (mode === 'js' || mode === 'json')) parts.push(this.i18n.t('ent.hint.unquote'));
    return parts.join(' ');
  });

  constructor() {
    this.i18n.register(ENTITIES_DICTIONARIES);
  }

  private describe(e: UnescapeError, text: string): string {
    const { line, column } = lineColumn(text, e.index);
    const msg = this.i18n.t('ent.err.' + e.code, { seq: e.seq ?? '' });
    return this.i18n.t('ent.err.at', { line, col: column, msg });
  }

  protected onInput(e: Event): void {
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected swap(): void {
    const out = this.output();
    this.dir.set(this.dir() === 'encode' ? 'decode' : 'encode');
    if (out) this.input.set(out);
  }

  protected loadSample(): void {
    this.input.set(SAMPLES[this.mode()][this.dir()]);
  }

  protected clear(): void {
    this.input.set('');
  }
}
