// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton, writeClipboard } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { JsonError, formatJson, jsonStats, minifyJson, parseJson } from '../json-formatter/json-tools';
import {
  EditResult, addChild, changeType, duplicateAt, editableText, moveAt, parseEditedValue, removeAt, renameKey, setValue,
} from './json-edit';
import { History, canRedo, canUndo, createHistory, pushState, redo, undo } from './json-history';
import {
  JsonPath, JsonType, breadcrumbs, nearestValidPath, toJsPath, toJsonPointer,
} from './json-path';
import { SearchResult, TextPart, highlightParts, searchTree, stepMatch } from './json-search';
import {
  MoreRow, NodeRow, PAGE_SIZE, TreeRow, expandToLevel, flattenTree, remapExpanded, revealPath,
} from './json-tree';
import { JSON_VIEWER_DICTIONARIES } from './json-viewer.i18n';

type View = 'tree' | 'text';
type EditMode = 'value' | 'key';
interface EditState {
  id: string;
  mode: EditMode;
  text: string;
  error: string | null;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Oltre questa lunghezza il testo non si valida a ogni tasto (lo si fa passando alla vista Albero). */
const LIVE_PARSE_MAX = 400_000;
/** Altezza fissa delle righe dell'albero: serve al rendering a finestra. Deve coincidere con lo SCSS. */
const ROW_H = 28;
const OVERSCAN = 8;
const DEFAULT_VIEW_H = 520;
const INDENT = 16;
const MAX_TEXT_PREVIEW = 300;
/** Oltre questa dimensione la textarea diventa inutilizzabile: la vista Testo non si apre (restano Copia e Scarica). */
const TEXT_VIEW_MAX = 3_000_000;
const TYPES: readonly JsonType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];
const SAMPLE = JSON.stringify(
  {
    utenti: [
      {
        id: 1,
        nome: 'Mario Rossi',
        eta: 34,
        attivo: true,
        indirizzo: { via: 'Via Roma 1', citta: 'Milano', cap: '20121' },
        tag: ['dev', 'json', 'test'],
        note: null,
      },
      {
        id: 2,
        nome: 'Anna Verdi',
        eta: 29,
        attivo: false,
        indirizzo: { via: 'Corso Italia 22', citta: 'Torino', cap: '10121' },
        tag: ['design'],
        note: 'Preferisce la posta elettronica',
      },
    ],
    totale: 2,
    aggiornato: '2026-11-16T08:00:00Z',
    ordini: [
      { id: 'A-100', importo: 19.9 },
      { id: 'A-101', importo: 5 },
    ],
  },
  null,
  2,
);

type WindowRow = { i: number; id: string; node: NodeRow; more: null } | { i: number; id: string; node: null; more: MoreRow };

@Component({
  selector: 'app-json-viewer',
  imports: [Icon, PrivacyNote, FileDrop, CopyButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-viewer.page.html',
  styleUrl: './json-viewer.page.scss',
})
export class JsonViewerPage {
  protected readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly treeEl = viewChild<ElementRef<HTMLElement>>('tree');

  protected readonly rowH = ROW_H;
  protected readonly indent = INDENT;
  protected readonly lineHeight = 20;
  protected readonly padY = 12;

  // ---- documento e cronologia ----
  protected readonly view = signal<View>('text');
  protected readonly text = signal('');
  private textDirty = false;
  private readonly history = signal<History<unknown> | null>(null);
  protected readonly root = computed(() => this.history()?.present);
  protected readonly hasDoc = computed(() => this.history() !== null);
  protected readonly canUndo = computed(() => {
    const h = this.history();
    return h !== null && canUndo(h);
  });
  protected readonly canRedo = computed(() => {
    const h = this.history();
    return h !== null && canRedo(h);
  });

  // ---- stato dell'albero ----
  protected readonly expanded = signal<ReadonlySet<string>>(new Set(['']));
  private readonly shown = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly cursorId = signal('');
  protected readonly edit = signal<EditState | null>(null);
  protected readonly level = signal(2);
  private readonly scrollTop = signal(0);
  private readonly viewH = signal(DEFAULT_VIEW_H);

  protected readonly rows = computed<TreeRow[]>(() => (this.hasDoc() ? flattenTree(this.root(), this.expanded(), this.shown()) : []));
  protected readonly cursorIndex = computed(() => {
    const id = this.cursorId();
    const i = this.rows().findIndex((r) => r.id === id);
    return i === -1 ? 0 : i;
  });
  protected readonly cursor = computed<TreeRow | null>(() => this.rows()[this.cursorIndex()] ?? null);
  protected readonly node = computed<NodeRow | null>(() => {
    const c = this.cursor();
    return c && c.kind === 'node' ? c : null;
  });
  protected readonly windowRows = computed<WindowRow[]>(() => {
    const rows = this.rows();
    const top = this.scrollTop();
    const start = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
    const end = Math.min(rows.length, Math.ceil((top + this.viewH()) / ROW_H) + OVERSCAN);
    const out: WindowRow[] = [];
    for (let i = start; i < end; i++) {
      const r = rows[i];
      out.push(r.kind === 'node' ? { i, id: r.id, node: r, more: null } : { i, id: r.id, node: null, more: r });
    }
    return out;
  });
  protected readonly sizerH = computed(() => this.rows().length * ROW_H);

  // ---- pannello del nodo selezionato ----
  protected readonly jsPath = computed(() => {
    const n = this.node();
    return n ? toJsPath(n.path) : '';
  });
  protected readonly pointer = computed(() => this.node()?.id ?? '');
  protected readonly crumbs = computed(() => {
    const n = this.node();
    return n ? breadcrumbs(n.path) : [];
  });
  protected readonly valuePreview = computed(() => {
    const n = this.node();
    if (!n) return '';
    if (n.type === 'object' || n.type === 'array') return this.itemsText(n.count);
    if (n.type === 'string') {
      const s = n.value as string;
      return s.length > 2000 ? s.slice(0, 2000) + '…' : s;
    }
    return String(n.value);
  });
  protected readonly typeOptions = computed(() =>
    TYPES.map((t) => ({ value: t, label: this.i18n.t('jv.type.' + t) })),
  );
  protected readonly canEditValue = computed(() => {
    const n = this.node();
    return !!n && n.type !== 'object' && n.type !== 'array' && n.type !== 'null';
  });
  protected readonly canRename = computed(() => this.node()?.parentType === 'object');
  protected readonly isRoot = computed(() => this.node()?.id === '');
  protected readonly canMoveUp = computed(() => {
    const n = this.node();
    return !!n && n.parentType === 'array' && n.index > 0;
  });
  protected readonly canMoveDown = computed(() => {
    const n = this.node();
    return !!n && n.parentType === 'array' && n.index < n.size - 1;
  });
  protected readonly canAdd = computed(() => {
    const n = this.node();
    return !!n && (n.type === 'object' || n.type === 'array');
  });

  // ---- ricerca ----
  protected readonly query = signal('');
  private readonly appliedQuery = signal('');
  protected readonly results = signal<SearchResult>({ matches: [], truncated: false });
  protected readonly matchIndex = signal(-1);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly matchIds = computed(() => new Set(this.results().matches.map((m) => m.id)));
  private readonly currentMatchId = computed(() => this.results().matches[this.matchIndex()]?.id ?? null);
  protected readonly searchStatus = computed(() => {
    if (this.appliedQuery() === '') return '';
    const r = this.results();
    if (r.matches.length === 0) return this.i18n.t('jv.search.none');
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t(r.truncated ? 'jv.search.countMore' : 'jv.search.count', {
      current: nf.format(Math.max(1, this.matchIndex() + 1)),
      total: nf.format(r.matches.length),
    });
  });

  // ---- testo, errori, statistiche ----
  protected readonly parseError = signal<JsonError | null>(null);
  private readonly fileError = signal<'toolarge' | 'read' | null>(null);
  private readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  private readonly statsInfo = signal<{ keys: number; depth: number; bytes: number } | null>(null);
  private statsTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly copied = signal(false);
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly scrollTopText = signal(0);

  private readonly liveParse = computed(() => {
    const t = this.text();
    if (this.view() !== 'text' || t.trim() === '' || t.length > LIVE_PARSE_MAX) return null;
    return parseJson(t);
  });
  private readonly activeError = computed<JsonError | null>(() => {
    if (this.view() !== 'text') return null;
    const live = this.liveParse();
    return this.parseError() ?? (live && !live.ok ? live.error : null);
  });
  protected readonly errorLine = computed(() => this.activeError()?.line ?? null);
  protected readonly bandTop = computed(() => {
    const l = this.errorLine();
    return l === null ? null : this.padY + (l - 1) * this.lineHeight - this.scrollTopText();
  });
  protected readonly lineCount = computed(() => {
    const t = this.text();
    let n = 1;
    for (let i = t.indexOf('\n'); i !== -1; i = t.indexOf('\n', i + 1)) n++;
    return n;
  });
  protected readonly showGutter = computed(() => this.lineCount() <= 20000);
  protected readonly gutterText = computed(() =>
    this.showGutter() ? Array.from({ length: this.lineCount() }, (_, i) => i + 1).join('\n') : '',
  );
  protected readonly gutterWidth = computed(() => String(this.lineCount()).length);

  protected readonly status = computed<{ kind: 'ok' | 'error'; text: string } | null>(() => {
    const ed = this.edit();
    if (ed?.error) return { kind: 'error', text: ed.error };
    const fe = this.fileError();
    if (fe) return { kind: 'error', text: this.i18n.t(fe === 'toolarge' ? 'jv.err.toolarge' : 'jv.err.read') };
    if (this.busy()) return { kind: 'ok', text: this.i18n.t('jv.loading') };
    const err = this.parseError();
    const live = this.liveParse();
    const e = err ?? (live && !live.ok ? live.error : null);
    if (e && this.view() === 'text') {
      const at =
        e.line !== null && e.column !== null ? ` (${this.i18n.t('jv.error.at', { line: e.line, column: e.column })})` : '';
      return { kind: 'error', text: `${this.i18n.t('jv.error')}${at}: ${e.message}` };
    }
    const note = this.notice();
    if (note) return { kind: 'ok', text: note };
    if (this.view() === 'text') {
      if (this.text().length > LIVE_PARSE_MAX) return { kind: 'ok', text: this.i18n.t('jv.textBig') };
      if (live && live.ok) return { kind: 'ok', text: this.i18n.t('jv.valid') };
      return null;
    }
    const s = this.statsInfo();
    if (!this.hasDoc() || !s) return null;
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return {
      kind: 'ok',
      text: [
        this.i18n.t('jv.valid'),
        this.i18n.t('jv.size', { size: formatBytes(s.bytes, this.i18n.locale()) }),
        this.i18n.t('jv.keys', { n: nf.format(s.keys) }),
        this.i18n.t('jv.depth', { n: s.depth }),
      ].join(' · '),
    };
  });

  protected readonly views = computed<{ value: View; label: string }[]>(() => [
    { value: 'tree', label: this.i18n.t('jv.view.tree') },
    { value: 'text', label: this.i18n.t('jv.view.text') },
  ]);

  constructor() {
    this.i18n.register(JSON_VIEWER_DICTIONARIES);
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      clearTimeout(this.searchTimer);
      clearTimeout(this.statsTimer);
      clearTimeout(this.copyTimer);
    });
    afterNextRender(() => {
      const onResize = () => this.measure();
      window.addEventListener('resize', onResize);
      destroy.onDestroy(() => window.removeEventListener('resize', onResize));
    });
  }

  // =====================================================================================
  // Caricamento
  // =====================================================================================

  protected loadSample(): void {
    this.fileError.set(null);
    const value = JSON.parse(SAMPLE) as unknown;
    this.load(value, new Blob([SAMPLE]).size, 3);
  }

  protected clear(): void {
    this.history.set(null);
    this.text.set('');
    this.textDirty = false;
    this.parseError.set(null);
    this.fileError.set(null);
    this.notice.set(null);
    this.edit.set(null);
    this.statsInfo.set(null);
    this.resetSearch();
    this.view.set('text');
  }

  protected async onFile(f: File): Promise<void> {
    this.fileError.set(null);
    this.notice.set(null);
    if (f.size > MAX_FILE_BYTES) {
      this.fileError.set('toolarge');
      return;
    }
    this.busy.set(true);
    try {
      const content = await f.text();
      // lascia al browser il tempo di mostrare "Lettura e analisi…" prima del parsing, che blocca il thread
      await new Promise((r) => setTimeout(r, 30));
      const p = parseJson(content);
      if (p.ok) {
        this.load(p.value, f.size, 2);
      } else {
        this.history.set(null);
        // un testo enorme bloccherebbe la textarea: si mostra solo l'errore con riga e colonna
        this.text.set(content.length > TEXT_VIEW_MAX ? '' : content);
        this.textDirty = true;
        this.parseError.set(p.error);
        this.view.set('text');
      }
    } catch {
      this.fileError.set('read');
    } finally {
      this.busy.set(false);
    }
  }

  /** Mette un documento nuovo: azzera cronologia, apertura dei nodi, ricerca e selezione. */
  private load(value: unknown, bytes: number, levels: number): void {
    this.history.set(createHistory(value));
    const { ids, truncated } = expandToLevel(value, levels);
    this.expanded.set(ids.size > 0 ? ids : new Set(['']));
    this.shown.set(new Map());
    this.cursorId.set('');
    this.level.set(levels);
    this.edit.set(null);
    this.parseError.set(null);
    this.text.set('');
    this.textDirty = false;
    this.resetSearch();
    this.notice.set(truncated ? this.i18n.t('jv.truncated', { n: ids.size }) : null);
    this.scrollTop.set(0);
    this.view.set('tree');
    this.scheduleStats(bytes);
    this.after(() => {
      const el = this.treeEl()?.nativeElement;
      if (el) el.scrollTop = 0;
      this.measure();
    });
  }

  private scheduleStats(knownBytes?: number): void {
    clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => {
      const root = this.root();
      if (!this.hasDoc()) return;
      const s = jsonStats(root);
      const bytes = knownBytes ?? new Blob([JSON.stringify(root)]).size;
      this.statsInfo.set({ keys: s.keys, depth: s.depth, bytes });
    }, 40);
  }

  // =====================================================================================
  // Passaggio Albero <-> Testo
  // =====================================================================================

  protected setView(v: View): void {
    if (v === this.view()) return;
    this.edit.set(null);
    this.notice.set(null);
    if (v === 'text') {
      if (this.hasDoc() && (this.statsInfo()?.bytes ?? 0) > TEXT_VIEW_MAX) {
        this.notice.set(this.i18n.t('jv.textTooBig'));
        return;
      }
      if (this.hasDoc()) {
        this.text.set(formatJson(this.root(), 2, false));
        this.textDirty = false;
      }
      this.parseError.set(null);
      this.view.set('text');
      return;
    }
    this.commitText();
  }

  /** Dal testo all'albero: rifà il parsing; se c'è un errore resta sul testo col messaggio. */
  private commitText(): void {
    const t = this.text();
    if (t.trim() === '') {
      if (this.hasDoc()) this.view.set('tree');
      return;
    }
    if (!this.textDirty && this.hasDoc()) {
      this.view.set('tree');
      return;
    }
    const p = parseJson(t);
    if (!p.ok) {
      this.parseError.set(p.error);
      this.view.set('text');
      return;
    }
    this.parseError.set(null);
    const h = this.history();
    if (h === null) {
      this.load(p.value, new Blob([t]).size, 2);
      return;
    }
    this.history.set(pushState(h, p.value));
    this.textDirty = false;
    this.view.set('tree');
    this.resetSearch();
    this.cursorId.set(toJsonPointer(nearestValidPath(p.value, this.node()?.path ?? [])));
    this.scheduleStats();
    this.after(() => this.measure());
  }

  protected onTextInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    const wasEmptyNoDoc = !this.hasDoc() && this.text().trim() === '';
    this.fileError.set(null);
    this.parseError.set(null);
    this.text.set(ta.value);
    this.textDirty = true;
    // primo incolla in un campo vuoto: se è un JSON valido si passa subito all'albero
    if (wasEmptyNoDoc && (e as InputEvent).inputType === 'insertFromPaste' && ta.value.length <= LIVE_PARSE_MAX) {
      if (parseJson(ta.value).ok) this.commitText();
    }
  }

  protected onTextScroll(e: Event): void {
    this.scrollTopText.set((e.target as HTMLTextAreaElement).scrollTop);
  }

  protected formatText(minify: boolean): void {
    const p = parseJson(this.text());
    if (!p.ok) {
      this.parseError.set(p.error);
      return;
    }
    this.parseError.set(null);
    this.text.set(minify ? minifyJson(p.value, false) : formatJson(p.value, 2, false));
    this.textDirty = true;
  }

  // =====================================================================================
  // Copia e scarica
  // =====================================================================================

  protected currentText(): string {
    if (this.view() === 'text') return this.text();
    return this.hasDoc() ? formatJson(this.root(), 2, false) : '';
  }

  protected readonly canExport = computed(() =>
    this.view() === 'tree' ? this.hasDoc() : this.text().trim() !== '' && this.activeError() === null,
  );

  protected async copyAll(): Promise<void> {
    if (!(await writeClipboard(this.currentText()))) return;
    this.copied.set(true);
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(false), 1500);
  }

  protected download(): void {
    const out = this.currentText();
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =====================================================================================
  // Espansione
  // =====================================================================================

  protected expandAll(): void {
    this.expandLevels(1000);
  }

  protected collapseAll(): void {
    this.expanded.set(new Set(['']));
    this.shown.set(new Map());
    this.cursorId.set('');
    this.notice.set(null);
    this.scrollToTop();
  }

  protected expandLevels(n: number): void {
    const levels = Math.max(1, Math.min(1000, Math.floor(n) || 1));
    const { ids, truncated } = expandToLevel(this.root(), levels);
    this.expanded.set(ids.size > 0 ? ids : new Set(['']));
    this.shown.set(new Map());
    this.notice.set(truncated ? this.i18n.t('jv.truncated', { n: ids.size }) : null);
    // il cursore va su un nodo ancora visibile
    const visible = new Set(this.rows().map((r) => r.id));
    if (!visible.has(this.cursorId())) this.cursorId.set('');
    this.scrollToTop();
  }

  protected onLevelInput(e: Event): void {
    const n = Number((e.target as HTMLInputElement).value);
    this.level.set(Number.isFinite(n) ? Math.max(1, Math.min(99, Math.floor(n))) : 1);
  }

  private scrollToTop(): void {
    this.scrollTop.set(0);
    const el = this.treeEl()?.nativeElement;
    if (el) el.scrollTop = 0;
  }

  protected toggle(row: NodeRow): void {
    if (row.count === 0) return;
    const ex = new Set(this.expanded());
    if (ex.has(row.id)) {
      ex.delete(row.id);
      // chiudendo un antenato del cursore, il cursore passa al nodo chiuso
      const c = this.cursorId();
      if (c !== row.id && c.startsWith(row.id + '/')) this.cursorId.set(row.id);
    } else ex.add(row.id);
    this.expanded.set(ex);
  }

  protected showMore(parentId: string): void {
    const sh = new Map(this.shown());
    sh.set(parentId, (sh.get(parentId) ?? PAGE_SIZE) + PAGE_SIZE);
    this.shown.set(sh);
  }

  // =====================================================================================
  // Mouse e tastiera sull'albero
  // =====================================================================================

  protected onScroll(e: Event): void {
    const el = e.target as HTMLElement;
    this.scrollTop.set(el.scrollTop);
    if (el.clientHeight !== this.viewH()) this.viewH.set(el.clientHeight);
  }

  private measure(): void {
    const el = this.treeEl()?.nativeElement;
    if (el && el.clientHeight > 0) this.viewH.set(el.clientHeight);
  }

  protected onRowClick(row: TreeRow, e: MouseEvent): void {
    e.stopPropagation();
    this.cursorId.set(row.id);
    if (row.kind === 'more') this.showMore(row.parentId);
  }

  protected onCaret(row: NodeRow, e: MouseEvent): void {
    e.stopPropagation();
    this.cursorId.set(row.id);
    this.toggle(row);
    this.focusTree();
  }

  protected onRowDblClick(row: TreeRow, e: MouseEvent): void {
    if (row.kind !== 'node') return;
    if ((e.target as HTMLElement).closest('.k') && row.parentType === 'object') this.startRename(row);
    else if (row.type === 'object' || row.type === 'array') this.toggle(row);
    else this.startEditValue(row);
  }

  protected onTreeKey(e: KeyboardEvent): void {
    if (e.target !== e.currentTarget) return; // i tasti dei campi in linea non sono dell'albero
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const rows = this.rows();
    if (rows.length === 0) return;
    const i = this.cursorIndex();
    const row = rows[i];
    const go = (n: number) => {
      e.preventDefault();
      this.moveCursor(Math.max(0, Math.min(rows.length - 1, n)));
    };
    switch (e.key) {
      case 'ArrowDown':
        return go(i + 1);
      case 'ArrowUp':
        return go(i - 1);
      case 'Home':
        return go(0);
      case 'End':
        return go(rows.length - 1);
      case 'PageDown':
        return go(i + 10);
      case 'PageUp':
        return go(i - 10);
      case 'ArrowRight':
        e.preventDefault();
        if (row.kind !== 'node' || row.count === 0) return;
        if (!row.expanded) this.toggle(row);
        else this.moveCursor(i + 1);
        return;
      case 'ArrowLeft': {
        e.preventDefault();
        if (row.kind === 'node' && row.expanded) {
          this.toggle(row);
          return;
        }
        for (let j = i - 1; j >= 0; j--) {
          if (rows[j].depth < row.depth) {
            this.moveCursor(j);
            return;
          }
        }
        return;
      }
      case 'Enter':
        e.preventDefault();
        if (row.kind === 'more') this.showMore(row.parentId);
        else if (row.type === 'object' || row.type === 'array') this.toggle(row);
        else this.startEditValue(row);
        return;
      case 'F2':
        e.preventDefault();
        if (row.kind === 'node') this.startRename(row);
        return;
      case 'Delete':
        e.preventDefault();
        this.deleteNode();
        return;
    }
  }

  /** Annulla/ripeti con Ctrl/Cmd+Z, Ctrl/Cmd+Maiusc+Z e Ctrl+Y, tranne dentro i campi di testo (hanno il loro). */
  protected onViewerKey(e: KeyboardEvent): void {
    if (this.view() !== 'tree' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (k === 'y') {
      e.preventDefault();
      this.redo();
    }
  }

  private moveCursor(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.cursorId.set(row.id);
    this.scrollToIndex(index);
  }

  private scrollToIndex(i: number): void {
    const el = this.treeEl()?.nativeElement;
    const h = el?.clientHeight || this.viewH();
    const top = i * ROW_H;
    let st = this.scrollTop();
    if (top < st) st = top;
    else if (top + ROW_H > st + h) st = top + ROW_H - h;
    else return;
    this.scrollTop.set(st);
    if (!el) return;
    // il contenitore si allunga solo dopo il rendering: un salto oltre il fondo attuale va completato dopo
    if (st <= el.scrollHeight - el.clientHeight) el.scrollTop = st;
    else this.after(() => (el.scrollTop = st));
  }

  protected focusTree(): void {
    this.treeEl()?.nativeElement.focus({ preventScroll: true });
  }

  protected selectPath(path: JsonPath): void {
    const r = revealPath(this.root(), path, this.expanded(), this.shown());
    this.expanded.set(r.expanded);
    this.shown.set(r.shown);
    this.cursorId.set(toJsonPointer(path));
    this.scrollToIndex(this.cursorIndex());
    this.after(() => this.focusTree());
  }

  protected activeDescendant(): string | null {
    return this.hasDoc() ? 'tv-' + this.cursorIndex() : null;
  }

  // =====================================================================================
  // Modifica
  // =====================================================================================

  protected startEditValue(row: NodeRow | null = this.node()): void {
    if (!row || row.type === 'object' || row.type === 'array' || row.type === 'null') return;
    this.cursorId.set(row.id);
    this.edit.set({ id: row.id, mode: 'value', text: editableText(row.value), error: null });
    this.focusEditor();
  }

  protected startRename(row: NodeRow | null = this.node()): void {
    if (!row || row.parentType !== 'object' || row.key === null) return;
    this.cursorId.set(row.id);
    this.edit.set({ id: row.id, mode: 'key', text: String(row.key), error: null });
    this.focusEditor();
  }

  private focusEditor(): void {
    this.scrollToIndex(this.cursorIndex());
    this.after(() => {
      const input = document.getElementById('jv-edit') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected onEditInput(e: Event): void {
    const ed = this.edit();
    if (ed) this.edit.set({ ...ed, text: (e.target as HTMLInputElement).value, error: null });
  }

  protected onEditKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitEdit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
    e.stopPropagation();
  }

  protected onEditBlur(): void {
    // uscendo dal campo si conferma se è valido, altrimenti si annulla
    if (this.edit()) this.commitEdit(true);
  }

  private cancelEdit(): void {
    this.edit.set(null);
    this.after(() => this.focusTree());
  }

  private commitEdit(fromBlur: boolean): void {
    const ed = this.edit();
    const n = this.node();
    if (!ed || !n || n.id !== ed.id) {
      this.edit.set(null);
      return;
    }
    if (ed.mode === 'value') {
      const p = parseEditedValue(n.type, ed.text);
      if (!p.ok) {
        if (fromBlur) this.cancelEdit();
        else this.edit.set({ ...ed, error: this.i18n.t(p.error === 'number' ? 'jv.err.number' : p.error === 'empty' ? 'jv.err.empty' : 'jv.err.boolean') });
        return;
      }
      this.edit.set(null);
      this.apply(setValue(this.root(), n.path, p.value), { refocus: !fromBlur });
      return;
    }
    const r = renameKey(this.root(), n.path, ed.text);
    if (!r.ok) {
      if (fromBlur) this.cancelEdit();
      else this.edit.set({ ...ed, error: this.i18n.t(r.error === 'duplicate' ? 'jv.err.dup' : 'jv.err.edit') });
      return;
    }
    this.edit.set(null);
    const from = n.id;
    this.apply(r, { refocus: !fromBlur });
    this.expanded.set(remapExpanded(this.expanded(), from, toJsonPointer(r.path)));
  }

  /** Applica il risultato di un'operazione: cronologia, selezione, visibilità del nodo. */
  private apply(r: EditResult, opts: { refocus?: boolean } = {}): boolean {
    if (!r.ok) {
      this.notice.set(this.i18n.t('jv.err.edit'));
      return false;
    }
    const h = this.history();
    if (!h) return false;
    this.notice.set(null);
    this.history.set(pushState(h, r.root));
    this.afterRootChange(r.path);
    if (opts.refocus !== false) this.after(() => this.focusTree());
    return true;
  }

  private afterRootChange(path: JsonPath): void {
    const root = this.root();
    const valid = nearestValidPath(root, path);
    const rv = revealPath(root, valid, this.expanded(), this.shown());
    this.expanded.set(rv.expanded);
    this.shown.set(rv.shown);
    this.cursorId.set(toJsonPointer(valid));
    this.refreshSearch();
    this.scheduleStats();
    this.scrollToIndex(this.cursorIndex());
  }

  protected deleteNode(): void {
    const n = this.node();
    if (!n || n.id === '') return;
    this.apply(removeAt(this.root(), n.path));
  }

  protected duplicateNode(): void {
    const n = this.node();
    if (!n || n.id === '') return;
    this.apply(duplicateAt(this.root(), n.path));
  }

  protected moveNode(delta: number): void {
    const n = this.node();
    if (!n) return;
    this.apply(moveAt(this.root(), n.path, delta));
  }

  protected addNode(): void {
    const n = this.node();
    if (!n || !this.canAdd()) return;
    const isObj = n.type === 'object';
    const r = addChild(this.root(), n.path, null, 'chiave');
    if (!this.apply(r, { refocus: !isObj }) || !r.ok) return;
    if (isObj) {
      // il cursore è già sul nodo nuovo: si parte subito col nome della chiave
      const nn = this.node();
      if (nn) this.startRename(nn);
    }
  }

  protected onTypeChange(e: Event): void {
    const n = this.node();
    if (!n) return;
    const to = (e.target as HTMLSelectElement).value as JsonType;
    this.apply(changeType(this.root(), n.path, to), { refocus: false });
  }

  protected undo(): void {
    this.stepHistory(undo);
  }

  protected redo(): void {
    this.stepHistory(redo);
  }

  private stepHistory(fn: (h: History<unknown>) => History<unknown>): void {
    const h = this.history();
    if (!h) return;
    const next = fn(h);
    if (next === h) return;
    const before = this.node()?.path ?? [];
    this.edit.set(null);
    this.history.set(next);
    this.afterRootChange(before);
  }

  // =====================================================================================
  // Ricerca
  // =====================================================================================

  protected onSearchInput(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    this.query.set(q);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.runSearch(), 220);
  }

  private runSearch(): void {
    const q = this.query().trim();
    this.appliedQuery.set(q);
    if (q === '' || !this.hasDoc()) {
      this.results.set({ matches: [], truncated: false });
      this.matchIndex.set(-1);
      return;
    }
    const res = searchTree(this.root(), q);
    this.results.set(res);
    this.matchIndex.set(-1);
    if (res.matches.length > 0) this.goToMatch(0, false);
  }

  /** Rifà la ricerca dopo una modifica, senza spostare la selezione. */
  private refreshSearch(): void {
    const q = this.appliedQuery();
    if (q === '') return;
    const res = searchTree(this.root(), q);
    this.results.set(res);
    this.matchIndex.set(Math.min(this.matchIndex(), res.matches.length - 1));
  }

  protected step(direction: 1 | -1): void {
    if (this.query().trim() !== this.appliedQuery()) {
      clearTimeout(this.searchTimer);
      this.runSearch();
      return;
    }
    const n = this.results().matches.length;
    const next = stepMatch(this.matchIndex(), n, direction);
    if (next >= 0) this.goToMatch(next, false);
  }

  protected onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.step(e.shiftKey ? -1 : 1);
    }
  }

  private goToMatch(index: number, focus: boolean): void {
    const m = this.results().matches[index];
    if (!m) return;
    this.matchIndex.set(index);
    const r = revealPath(this.root(), m.path, this.expanded(), this.shown());
    this.expanded.set(r.expanded);
    this.shown.set(r.shown);
    this.cursorId.set(m.id);
    this.scrollToIndex(this.cursorIndex());
    if (focus) this.after(() => this.focusTree());
  }

  private resetSearch(): void {
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.appliedQuery.set('');
    this.results.set({ matches: [], truncated: false });
    this.matchIndex.set(-1);
  }

  // =====================================================================================
  // Presentazione delle righe
  // =====================================================================================

  protected isMatch(id: string): boolean {
    return this.appliedQuery() !== '' && this.matchIds().has(id);
  }

  protected isCurrentMatch(id: string): boolean {
    return this.currentMatchId() === id;
  }

  protected parts(text: string): TextPart[] {
    return highlightParts(text, this.appliedQuery());
  }

  protected keyText(row: NodeRow): string {
    return String(row.key);
  }

  /** Valore semplice come appare in riga: le stringhe tra virgolette e tagliate se lunghissime. */
  protected valueText(row: NodeRow): string {
    if (row.type === 'string') {
      const s = row.value as string;
      return '"' + (s.length > MAX_TEXT_PREVIEW ? s.slice(0, MAX_TEXT_PREVIEW) + '…' : s) + '"';
    }
    return String(row.value);
  }

  protected itemsText(n: number): string {
    return this.i18n.t(n === 1 ? 'jv.items.one' : 'jv.items', { n });
  }

  protected rowLabel(row: NodeRow): string {
    const type = this.i18n.t('jv.type.' + row.type);
    const name = row.key === null ? '$' : String(row.key);
    return row.count > 0 || row.type === 'object' || row.type === 'array'
      ? `${name}: ${type}, ${this.itemsText(row.count)}`
      : `${name}: ${type} ${this.valueText(row)}`;
  }

  protected moreLabel(remaining: number): string {
    return this.i18n.t('jv.more', { n: Math.min(PAGE_SIZE, remaining) }) + ` (${remaining})`;
  }

  protected isContainerRow(row: NodeRow): boolean {
    return row.type === 'object' || row.type === 'array';
  }

  protected pathKind(kind: string): string {
    return this.i18n.t('jv.copyPath', { kind });
  }

  protected typeName(t: JsonType): string {
    return this.i18n.t('jv.type.' + t);
  }

  /** `{3}` per un oggetto, `[3]` per un array. */
  protected summary(row: NodeRow): string {
    return row.type === 'array' ? `[${row.count}]` : `{${row.count}}`;
  }

  /** Esegue `fn` dopo il prossimo ciclo di rendering (quando il DOM riflette i signal cambiati). */
  private after(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
