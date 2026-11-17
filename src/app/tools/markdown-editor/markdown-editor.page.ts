// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes, safeFileName } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { WORDS_PER_MINUTE_READING, countChars, durationSeconds, formatDuration, words } from '../word-counter/text-count';
import { MD_DICTIONARIES } from './markdown-editor.i18n';
import { buildHtmlDocument, documentTitle } from './markdown-export';
import { FormatAction, applyFormat } from './markdown-format';
import { renderMarkdown } from './markdown';
import { sanitizeDom } from './markdown-sanitize';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './markdown-editor.share';

const DRAFT_KEY = 'rrstudio.markdown-editor.draft';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Oltre questa lunghezza anteprima e conteggi si aggiornano con un breve ritardo. */
const INSTANT_CHARS = 30000;

const ACTIONS: readonly { id: FormatAction; icon: 'type' | 'link' | 'code' | 'table'; key: string; shortcut?: string }[] = [
  { id: 'bold', icon: 'type', key: 'md.bold', shortcut: 'Ctrl+B' },
  { id: 'italic', icon: 'type', key: 'md.italic', shortcut: 'Ctrl+I' },
  { id: 'link', icon: 'link', key: 'md.link', shortcut: 'Ctrl+K' },
  { id: 'heading', icon: 'type', key: 'md.heading' },
  { id: 'list', icon: 'table', key: 'md.list' },
  { id: 'code', icon: 'code', key: 'md.code' },
];

@Component({
  selector: 'app-markdown-editor',
  imports: [ShareLink, Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // stili senza incapsulamento: servono anche all'HTML dell'anteprima, inserito con innerHTML, e alla stampa
  encapsulation: ViewEncapsulation.None,
  templateUrl: './markdown-editor.page.html',
  styleUrl: './markdown-editor.page.scss',
})
export class MarkdownEditorPage {
  protected readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  protected readonly actions = ACTIONS;
  protected readonly text = signal('');
  /** Testo da cui si calcolano anteprima e conteggi (con ritardo se il testo è molto lungo). */
  private readonly rendered = signal('');
  protected readonly fileError = signal(false);
  protected readonly draftState = signal<'none' | 'saved' | 'off'>('none');
  private restored = false;

  private readonly html = computed(() =>
    renderMarkdown(this.rendered(), {
      images: 'placeholder',
      externalImageLabel: (url) => this.i18n.t('md.img.ext', { url }),
      offImageLabel: (alt) => this.i18n.t('md.img.off', { alt }),
    }),
  );

  /** HTML dell'anteprima: prodotto dal convertitore e riletto in un template inerte (lista bianca) nel browser. */
  protected readonly preview = computed<SafeHtml>(() => {
    const html = this.html();
    const safe = this.isBrowser ? sanitizeDom(html, document) : html;
    return this.sanitizer.bypassSecurityTrustHtml(safe);
  });
  protected readonly isEmpty = computed(() => this.rendered().trim() === '');

  protected readonly stats = computed(() => {
    const t = this.rendered();
    if (t.trim() === '') return this.i18n.t('md.stats.empty');
    const w = words(t, this.i18n.lang()).length;
    const f = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('md.stats', {
      words: f.format(w),
      chars: f.format(countChars(t)),
      reading: formatDuration(durationSeconds(w, WORDS_PER_MINUTE_READING)),
    });
  });

  // Link di condivisione: il testo nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({ text: this.text() });
  /** Testo arrivato da un link: finché non viene modificato non sostituisce la bozza salvata di chi lo apre. */
  private linkedText: string | null = null;

  protected restoreShared(d: ShareData): void {
    if (typeof d['text'] !== 'string') return;
    this.linkedText = d['text'];
    this.text.set(d['text']);
  }

  constructor() {
    this.i18n.register(MD_DICTIONARIES);

    effect((onCleanup) => {
      const t = this.text();
      if (t.length <= INSTANT_CHARS) {
        this.rendered.set(t);
        return;
      }
      const id = setTimeout(() => this.rendered.set(t), 250);
      onCleanup(() => clearTimeout(id));
    });

    // bozza: prima si ripristina (solo nel browser, dopo il primo render per non divergere dall'HTML prerenderizzato),
    // poi ogni modifica si salva con un breve ritardo
    afterNextRender(() => {
      const saved = this.readDraft();
      this.text.set(saved ?? this.i18n.t('md.sample.text'));
      if (saved !== null) this.draftState.set('saved');
      this.restored = true;
    });
    effect((onCleanup) => {
      const t = this.text();
      if (!this.isBrowser || !this.restored || t === this.linkedText) return;
      const id = setTimeout(() => this.saveDraft(t), 400);
      onCleanup(() => clearTimeout(id));
    });
    inject(DestroyRef).onDestroy(() => {
      this.restored = false;
    });
  }

  // ---- bozza (localStorage può mancare o lanciare: la pagina funziona lo stesso) ----

  private readDraft(): string | null {
    try {
      return localStorage.getItem(DRAFT_KEY);
    } catch {
      this.draftState.set('off');
      return null;
    }
  }

  private saveDraft(t: string): void {
    try {
      if (t === '' || t === this.i18n.t('md.sample.text')) {
        localStorage.removeItem(DRAFT_KEY);
        this.draftState.set('none');
      } else {
        localStorage.setItem(DRAFT_KEY, t);
        this.draftState.set('saved');
      }
    } catch {
      this.draftState.set('off');
    }
  }

  protected clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* niente da cancellare */
    }
    this.text.set('');
    if (this.draftState() !== 'off') this.draftState.set('none');
    this.editor()?.nativeElement.focus();
  }

  protected loadSample(): void {
    this.text.set(this.i18n.t('md.sample.text'));
  }

  // ---- modifica ----

  protected onInput(e: Event): void {
    this.text.set((e.target as HTMLTextAreaElement).value);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const map: Record<string, FormatAction> = { b: 'bold', i: 'italic', k: 'link' };
    const action = map[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    this.format(action);
  }

  protected format(action: FormatAction): void {
    const el = this.editor()?.nativeElement;
    if (!el) return;
    const before = el.value;
    const next = applyFormat(
      { text: before, start: el.selectionStart, end: el.selectionEnd },
      action,
      { link: this.i18n.t('md.link.ph'), text: this.i18n.t('md.text.ph') },
    );
    if (next.text !== before) this.replaceText(el, before, next.text);
    el.focus();
    el.setSelectionRange(next.start, next.end);
  }

  /** Sostituisce solo la parte cambiata, con execCommand quando c'è (così annulla/ripeti del browser restano). */
  private replaceText(el: HTMLTextAreaElement, before: string, after: string): void {
    let p = 0;
    const max = Math.min(before.length, after.length);
    while (p < max && before[p] === after[p]) p++;
    let s = 0;
    while (s < max - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
    el.focus();
    el.setSelectionRange(p, before.length - s);
    const insert = after.slice(p, after.length - s);
    let ok = false;
    try {
      ok = insert === '' ? document.execCommand('delete') : document.execCommand('insertText', false, insert);
    } catch {
      ok = false;
    }
    if (!ok || el.value !== after) el.value = after;
    this.text.set(el.value);
  }

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.fileError.set(false);
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(true);
      return;
    }
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      this.text.set(new TextDecoder('utf-8', { fatal: true }).decode(buf));
    } catch {
      this.fileError.set(true);
    }
  }

  // ---- esportazione ----

  private baseName(): string {
    return safeFileName(documentTitle(this.text(), this.i18n.t('md.title.fallback')), this.i18n.t('md.title.fallback')).slice(0, 80);
  }

  protected exportMd(): void {
    saveBytes(new TextEncoder().encode(this.text()), this.baseName() + '.md', 'text/markdown;charset=utf-8');
  }

  protected exportHtml(): void {
    const body = renderMarkdown(this.text(), { images: 'embed' });
    const title = documentTitle(this.text(), this.i18n.t('md.title.fallback'));
    const doc = buildHtmlDocument(title, body, this.i18n.lang());
    saveBytes(new TextEncoder().encode(doc), this.baseName() + '.html', 'text/html;charset=utf-8');
  }

  /** PDF dalla stampa del browser: lo stile di stampa mostra solo l'anteprima; il titolo diventa il nome del file. */
  protected exportPdf(): void {
    const previous = document.title;
    document.title = this.baseName();
    const restore = (): void => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  /** I link dell'anteprima: gli indirizzi relativi e le ancore non devono far uscire dall'editor. */
  protected onPreviewClick(e: MouseEvent): void {
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (!/^(https?:|mailto:)/i.test(href)) e.preventDefault();
  }
}
