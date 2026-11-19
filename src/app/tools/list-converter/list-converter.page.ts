// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { LCO_DICTIONARIES } from './list-converter.i18n';
import { SHARE_SCHEMA } from './list-converter.share';
import {
  DEFAULT_CLEAN, DEFAULT_FORMAT, DEFAULT_TO_LIST, MAX_CHARS, PRESETS, PRESET_IDS, SEPARATORS, cleanItems, detectSeparator, itemsToLine,
  lineToList, separatorName, splitLines, unescapeSeparator,
  type CaseMode, type Escape, type PresetId, type Quote, type SeparatorName, type SortMode,
} from './list-converter';

type Dir = 'toLine' | 'toList';
type SepKind = SeparatorName | 'custom';
type FromSep = 'auto' | 'comma' | 'semicolon' | 'tab' | 'pipe' | 'space' | 'custom';

const SEP_KINDS: SepKind[] = ['comma', 'commaSpace', 'semicolon', 'space', 'tab', 'pipe', 'custom'];
const FROM_SEPS: FromSep[] = ['auto', 'comma', 'semicolon', 'tab', 'pipe', 'space', 'custom'];

/** Inverso di `unescapeSeparator`, per riportare un separatore nel campo «personalizzato». */
function escapeSeparator(s: string): string {
  return s.replace(/[\\\n\t\r]/g, (c) => (c === '\\' ? '\\\\' : c === '\n' ? '\\n' : c === '\t' ? '\\t' : '\\r'));
}

@Component({
  selector: 'app-list-converter',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-converter.page.html',
  styleUrl: './list-converter.page.scss',
})
export class ListConverterPage {
  protected readonly i18n = inject(I18nService);
  protected readonly presetIds = PRESET_IDS;

  protected readonly text = signal('');
  protected readonly dir = signal<Dir>('toLine');

  // da elenco a riga: formato
  protected readonly sepKind = signal<SepKind>('commaSpace');
  protected readonly customSep = signal('');
  protected readonly quote = signal<Quote>(DEFAULT_FORMAT.quote);
  protected readonly escape = signal<Escape>(DEFAULT_FORMAT.escape);
  protected readonly prefix = signal('');
  protected readonly suffix = signal('');
  protected readonly trailing = signal(false);
  protected readonly noQuoteNumbers = signal(false);
  protected readonly encodeUri = signal(false);
  protected readonly caseMode = signal<CaseMode>('none');

  // da riga a elenco
  protected readonly fromSep = signal<FromSep>('auto');
  protected readonly fromCustom = signal('');
  protected readonly stripQuotes = signal(DEFAULT_TO_LIST.stripQuotes);
  protected readonly backslash = signal(DEFAULT_TO_LIST.backslash);
  protected readonly stripWrapper = signal(DEFAULT_TO_LIST.stripWrapper);

  // pulizia (comune alle due direzioni)
  protected readonly trim = signal(DEFAULT_CLEAN.trim);
  protected readonly dropEmpty = signal(DEFAULT_CLEAN.dropEmpty);
  protected readonly unique = signal(DEFAULT_CLEAN.unique);
  protected readonly sort = signal<SortMode>(DEFAULT_CLEAN.sort);

  private opts<T extends string>(keys: readonly T[], prefix: string): SegmentOption<T>[] {
    return keys.map((k) => ({ value: k, label: this.i18n.t(prefix + k) }));
  }

  protected readonly dirOptions = computed(() => this.opts<Dir>(['toLine', 'toList'], 'lco.dir.'));
  protected readonly sepOptions = computed(() => this.opts<SepKind>(SEP_KINDS, 'lco.sep.'));
  protected readonly fromSepOptions = computed(() => this.opts<FromSep>(FROM_SEPS, 'lco.sep.'));
  protected readonly quoteOptions = computed(() => this.opts<Quote>(['none', 'double', 'single', 'backtick', 'minimal'], 'lco.quote.'));
  protected readonly escapeOptions = computed(() => this.opts<Escape>(['double', 'backslash', 'json', 'shell', 'none'], 'lco.escape.'));
  protected readonly sortOptions = computed(() => this.opts<SortMode>(['none', 'az', 'za', 'numeric'], 'lco.sort.'));
  protected readonly caseOptions = computed(() => this.opts<CaseMode>(['none', 'lower', 'upper'], 'lco.case.'));

  protected num(n: number): string {
    return n.toLocaleString(this.i18n.locale());
  }

  protected readonly error = computed(() =>
    this.text().length > MAX_CHARS ? this.i18n.t('lco.tooBig', { chars: this.num(this.text().length), max: this.num(MAX_CHARS) }) : '',
  );

  private readonly clean = computed(() => ({
    trim: this.trim(), dropEmpty: this.dropEmpty(), unique: this.unique(), sort: this.sort(), caseMode: this.caseMode(), locale: this.i18n.locale(),
  }));

  private readonly separator = computed(() => {
    const k = this.sepKind();
    return k === 'custom' ? unescapeSeparator(this.customSep()) : SEPARATORS[k];
  });

  /** Separatore usato da riga a elenco (quello rilevato, se automatico). */
  protected readonly resolvedFrom = computed(() => {
    const f = this.fromSep();
    if (f === 'custom') return unescapeSeparator(this.fromCustom());
    if (f !== 'auto') return SEPARATORS[f];
    return this.error() ? ',' : detectSeparator(this.text(), { stripWrapper: this.stripWrapper(), backslash: this.backslash() });
  });

  protected readonly detectedLabel = computed(() => {
    const name = separatorName(this.resolvedFrom());
    return name ? this.i18n.t('lco.sep.' + name).toLowerCase() : '';
  });

  /** Voci ottenute e testo del risultato nella direzione scelta. */
  protected readonly converted = computed<{ count: number; output: string } | null>(() => {
    if (this.error() || this.text() === '') return null;
    if (this.dir() === 'toLine') {
      const items = cleanItems(splitLines(this.text()), this.clean());
      // la pulizia è già fatta: itemsToLine non deve rifarla
      const output = itemsToLine(items, {
        separator: this.separator(), quote: this.quote(), escape: this.escape(), prefix: this.prefix(), suffix: this.suffix(),
        trailing: this.trailing(), noQuoteNumbers: this.noQuoteNumbers(), encodeUri: this.encodeUri(),
        trim: false, dropEmpty: false, unique: false, sort: 'none', caseMode: 'none',
      });
      return { count: items.length, output };
    }
    const items = lineToList(this.text(), {
      ...this.clean(), separator: this.resolvedFrom(), stripQuotes: this.stripQuotes(), backslash: this.backslash(), stripWrapper: this.stripWrapper(),
    });
    return { count: items.length, output: items.join('\n') };
  });

  protected readonly output = computed(() => this.converted()?.output ?? '');
  protected readonly countText = computed(() => {
    const c = this.converted()?.count ?? 0;
    return this.i18n.t(c === 1 ? 'lco.count.one' : 'lco.count.many', { n: this.num(c) });
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    text: this.text, dir: this.dir, sepKind: this.sepKind, customSep: this.customSep, quote: this.quote, escape: this.escape,
    prefix: this.prefix, suffix: this.suffix, trailing: this.trailing, noQuoteNumbers: this.noQuoteNumbers, encodeUri: this.encodeUri,
    trim: this.trim, dropEmpty: this.dropEmpty, unique: this.unique, sort: this.sort, caseMode: this.caseMode,
    fromSep: this.fromSep, fromCustom: this.fromCustom, stripQuotes: this.stripQuotes, backslash: this.backslash, stripWrapper: this.stripWrapper,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(LCO_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('list-converter');
    if (rx?.text !== undefined) this.text.set(rx.text);
  }

  /** Imposta tutto il formato del preset (la pulizia resta com'è). */
  protected applyPreset(id: PresetId): void {
    const p = PRESETS[id];
    const name = separatorName(p.separator);
    if (name) this.sepKind.set(name);
    else {
      this.sepKind.set('custom');
      this.customSep.set(escapeSeparator(p.separator));
    }
    this.quote.set(p.quote);
    this.escape.set(p.escape);
    this.prefix.set(p.prefix);
    this.suffix.set(p.suffix);
    this.trailing.set(p.trailing);
    this.noQuoteNumbers.set(p.noQuoteNumbers);
    this.encodeUri.set(p.encodeUri);
  }

  /** Scambia la direzione usando il risultato come nuovo testo; da elenco a riga si preparano le impostazioni inverse. */
  protected swap(): void {
    const out = this.output();
    if (this.dir() === 'toLine') {
      const name = separatorName(this.separator());
      if (name === 'commaSpace') this.fromSep.set('comma');
      else if (name) this.fromSep.set(name);
      else {
        this.fromSep.set('custom');
        this.fromCustom.set(escapeSeparator(this.separator()));
      }
      this.backslash.set(this.escape() === 'backslash' || this.escape() === 'json');
      this.stripWrapper.set(this.prefix() !== '' || this.suffix() !== '');
      this.stripQuotes.set(true);
      this.dir.set('toList');
    } else {
      this.dir.set('toLine');
    }
    this.text.set(out);
  }

  protected reset(): void {
    this.text.set('');
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output()), this.i18n.t('lco.file'), 'text/plain;charset=utf-8');
  }
}
