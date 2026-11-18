// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { ESC_DICTIONARIES } from './string-escape.i18n';
import { SHARE_SCHEMA } from './string-escape.share';
import {
  FORMATS, MAX_CHARS, SEPARATORS, countChars, escapeString, lineCol, quoteChoices, supportsAscii, supportsWrap, unescapeString,
  type EscapeFormat, type QuoteStyle,
} from './string-escape';

type Direction = 'escape' | 'unescape';

@Component({
  selector: 'app-string-escape',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './string-escape.page.html',
  styleUrl: './string-escape.page.scss',
})
export class StringEscapePage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly format = signal<EscapeFormat>('json');
  protected readonly direction = signal<Direction>('escape');
  protected readonly quote = signal<QuoteStyle>('double');
  protected readonly wrap = signal(false);
  protected readonly ascii = signal(false);
  protected readonly separator = signal(',');

  protected readonly formatOptions = computed<SegmentOption<EscapeFormat>[]>(() =>
    FORMATS.map((f) => ({ value: f, label: this.i18n.t('esc.fmt.' + f) })),
  );
  protected readonly directionOptions = computed<SegmentOption<Direction>[]>(() => [
    { value: 'escape', label: this.i18n.t('esc.dir.escape') },
    { value: 'unescape', label: this.i18n.t('esc.dir.unescape') },
  ]);
  protected readonly quoteOptions = computed<SegmentOption<QuoteStyle>[]>(() =>
    quoteChoices(this.format()).map((q) => ({ value: q, label: this.i18n.t('esc.quote.' + q) })),
  );
  protected readonly separatorOptions = computed<SegmentOption<string>[]>(() =>
    SEPARATORS.map((s) => ({ value: s, label: s === '\t' ? this.i18n.t('esc.sep.tab') : s })),
  );

  protected readonly showQuote = computed(() => quoteChoices(this.format()).length > 0);
  protected readonly showWrap = computed(() => supportsWrap(this.format()));
  protected readonly showAscii = computed(() => this.direction() === 'escape' && supportsAscii(this.format()));
  protected readonly showSeparator = computed(() => this.format() === 'csv' && this.direction() === 'escape');
  protected readonly wrapLabel = computed(() => this.i18n.t(this.format() === 'csv' ? 'esc.opt.wrap.csv' : 'esc.opt.wrap'));

  protected readonly tooBig = computed(() => this.input().length > MAX_CHARS);

  /** Risultato della conversione: valore oppure codice d'errore con posizione. */
  private readonly converted = computed<{ value: string; error: string }>(() => {
    const text = this.input();
    if (this.tooBig()) {
      return {
        value: '',
        error: this.i18n.t('esc.tooBig', { chars: text.length.toLocaleString(this.i18n.locale()), max: MAX_CHARS.toLocaleString(this.i18n.locale()) }),
      };
    }
    const opts = { quote: this.quote(), wrap: this.wrap(), ascii: this.ascii(), separator: this.separator() };
    if (this.direction() === 'escape') return { value: escapeString(this.format(), text, opts), error: '' };
    const r = unescapeString(this.format(), text, opts);
    if (r.ok) return { value: r.value, error: '' };
    const msg = this.i18n.t('esc.err.' + r.error);
    if (r.position === undefined) return { value: '', error: msg };
    const { line, col } = lineCol(text, r.position);
    return { value: '', error: this.i18n.t('esc.err.at', { msg, pos: String(r.position + 1), line: String(line), col: String(col) }) };
  });
  protected readonly output = computed(() => this.converted().value);
  protected readonly error = computed(() => this.converted().error);
  protected readonly hasResult = computed(() => this.input() !== '' && !this.error());

  protected readonly countText = computed(() => {
    const loc = this.i18n.locale();
    return this.i18n.t('esc.count', {
      before: countChars(this.input()).toLocaleString(loc),
      after: countChars(this.output()).toLocaleString(loc),
    });
  });
  protected readonly inputCounter = computed(() => this.i18n.t('esc.counter', { chars: countChars(this.input()).toLocaleString(this.i18n.locale()) }));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    format: this.format,
    direction: this.direction,
    quote: this.quote,
    wrap: this.wrap,
    ascii: this.ascii,
    separator: this.separator,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(ESC_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('string-escape');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  /** Il formato cambia: se l'apice scelto non esiste per il nuovo formato si torna a uno ammesso. */
  protected setFormat(f: EscapeFormat): void {
    this.format.set(f);
    const choices = quoteChoices(f);
    if (choices.length > 0 && !choices.includes(this.quote())) this.quote.set(choices.includes('double') ? 'double' : choices[0]);
  }

  /** Il risultato diventa il nuovo testo e la direzione si inverte. */
  protected swap(): void {
    this.input.set(this.output());
    this.direction.set(this.direction() === 'escape' ? 'unescape' : 'escape');
  }

  protected reset(): void {
    this.input.set('');
  }
}
