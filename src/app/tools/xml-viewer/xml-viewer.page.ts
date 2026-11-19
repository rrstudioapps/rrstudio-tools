// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton, writeClipboard } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { SendTo } from '../../shared/send-to';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { History, canRedo, canUndo, createHistory, pushState, redo, undo } from '../json-viewer/json-history';
import { XmlError, formatNodes, minifyNodes, normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import {
  Doc, EditResult, MAX_ROWS, NewKind, Path, Row, addChild, breadcrumbs, duplicateNode, editableText, expandLevels, flatten, getNode,
  moveNode, nearestPath, pathKey, removeAttr, removeNode, renameElement, reveal, searchDoc, setAttr, setText, unescapeXml, visibleChildren,
  xmlStats, xpathOf,
} from './xml-tree';
import { XpItem, XpResult, namespaceMap, resolveNs, runXpath } from './xml-xpath';
import { XML_VIEWER_DICTIONARIES } from './xml-viewer.i18n';
import { SHARE_SCHEMA } from './xml-viewer.share';

type View = 'tree' | 'text';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Oltre questa lunghezza il testo non si valida a ogni tasto (lo si fa passando alla vista Albero). */
const LIVE_PARSE_MAX = 400_000;
/** Oltre questa dimensione la textarea diventa inutilizzabile: la vista Testo non si apre. */
const TEXT_VIEW_MAX = 3_000_000;
const PREVIEW = 140;
const FMT = { indent: 2, keepComments: true } as const;

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Catalogo di esempio -->
<biblioteca citta="Milano" aperta="true">
  <libro id="b1" lingua="it">
    <titolo>I promessi sposi</titolo>
    <autore>Alessandro Manzoni</autore>
    <anno>1827</anno>
    <prezzo valuta="EUR">12.90</prezzo>
  </libro>
  <libro id="b2" lingua="it">
    <titolo>Il nome della rosa</titolo>
    <autore>Umberto Eco</autore>
    <anno>1980</anno>
    <prezzo valuta="EUR">14.50</prezzo>
    <note><![CDATA[Edizione con <illustrazioni> & mappe]]></note>
  </libro>
  <libro id="b3" lingua="en">
    <titolo>Invisible Cities</titolo>
    <autore>Italo Calvino</autore>
    <anno>1972</anno>
    <prezzo valuta="USD">11.00</prezzo>
  </libro>
  <chiusa/>
</biblioteca>
`;

const truncate = (s: string): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > PREVIEW ? one.slice(0, PREVIEW) + '…' : one;
};

@Component({
  selector: 'app-xml-viewer',
  imports: [ShareLink, Icon, PrivacyNote, FileDrop, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xml-viewer.page.html',
  styleUrl: './xml-viewer.page.scss',
})
export class XmlViewerPage {
  protected readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);

  // ---- documento e cronologia ----
  protected readonly view = signal<View>('text');
  protected readonly text = signal('');
  /** Il testo è stato scritto a mano dopo l'ultima lettura dell'albero. */
  private textDirty = false;
  /** L'albero è stato modificato: il testo si rigenera dal documento. */
  private readonly changed = signal(false);
  private readonly history = signal<History<Doc> | null>(null);
  protected readonly doc = computed<Doc>(() => this.history()?.present ?? []);
  protected readonly hasDoc = computed(() => this.history() !== null);
  protected readonly canUndo = computed(() => {
    const h = this.history();
    return h !== null && canUndo(h);
  });
  protected readonly canRedo = computed(() => {
    const h = this.history();
    return h !== null && canRedo(h);
  });
  protected readonly parseError = signal<XmlError | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly editError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly copied = signal(false);

  // ---- albero ----
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly cursor = signal<Path>([]);
  protected readonly flat = computed(() => (this.hasDoc() ? flatten(this.doc(), this.expanded()) : { rows: [] as Row[], truncated: false }));
  protected readonly rows = computed(() => this.flat().rows);
  protected readonly maxRows = MAX_ROWS;
  protected readonly cursorKey = computed(() => pathKey(this.cursor()));
  protected readonly node = computed(() => (this.cursor().length ? getNode(this.doc(), this.cursor()) : null));
  protected readonly xpath = computed(() => xpathOf(this.doc(), this.cursor()));
  protected readonly crumbs = computed(() => breadcrumbs(this.doc(), this.cursor()));
  protected readonly stats = computed(() => xmlStats(this.doc()));
  protected readonly isRoot = computed(() => {
    const n = this.node();
    return this.cursor().length === 1 && (n?.t === 'el' || n?.t === 'doctype');
  });
  protected readonly kindLabel = computed(() => {
    const n = this.node();
    return n ? this.i18n.t(('xv.kind.' + n.t) as 'xv.kind.el') : '';
  });

  // ---- XPath e namespace ----
  protected readonly xpExpr = signal('');
  protected readonly xp = signal<XpResult | null>(null);
  protected readonly xpMax = 500;
  protected readonly hasNs = computed(() => this.hasDoc() && namespaceMap(this.doc()).size > 0);
  protected readonly ns = computed(() => (this.hasNs() && this.cursor().length ? resolveNs(this.doc(), this.cursor()) : null));
  protected readonly xpText = computed(() => {
    const r = this.xp();
    if (!r) return '';
    if (!r.ok) return r.message === '' ? '' : this.i18n.t('xv.xp.err', { msg: r.message });
    if (r.kind === 'value') return '';
    return r.total === 0 ? this.i18n.t('xv.xp.none') : this.i18n.t('xv.xp.count', { n: r.total });
  });

  // ---- ricerca ----
  protected readonly query = signal('');
  private readonly matchPos = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly matches = computed(() => (this.hasDoc() ? searchDoc(this.doc(), this.query()) : []));
  private readonly matchKeys = computed(() => new Set(this.matches().map(pathKey)));
  private readonly currentMatchKey = computed(() => {
    const m = this.matches();
    return m.length ? pathKey(m[Math.min(this.matchPos(), m.length - 1)]) : '';
  });
  protected readonly searchStatus = computed(() => {
    if (!this.query().trim()) return '';
    const m = this.matches();
    if (!m.length) return this.i18n.t('xv.search.none');
    return this.i18n.t('xv.search.count', { current: Math.min(this.matchPos(), m.length - 1) + 1, total: m.length });
  });

  protected readonly views = computed(() => [
    { value: 'tree' as View, label: this.i18n.t('xv.view.tree') },
    { value: 'text' as View, label: this.i18n.t('xv.view.text') },
  ]);

  protected readonly errorText = computed(() => {
    const file = this.fileError();
    if (file) return this.i18n.t(file as 'xv.err.read');
    const e = this.parseError();
    if (!e) return '';
    const msg = this.i18n.t(('xml.err.' + e.code) as 'xml.err.badName', { ...e.params, col: e.column, line: e.params['line'] ?? e.line });
    return this.i18n.t('xml.err.at', { line: e.line, col: e.column, msg });
  });
  protected readonly editErrorText = computed(() => {
    const e = this.editError();
    return e ? this.i18n.t(('xv.err.edit.' + e) as 'xv.err.edit.type') : '';
  });
  protected readonly statusText = computed(() => {
    if (this.errorText() || this.editErrorText() || this.busy()) return '';
    if (this.view() === 'tree' && this.hasDoc()) {
      const s = this.stats();
      return this.i18n.t('xv.stats', { elements: s.elements, attrs: s.attributes, depth: s.depth });
    }
    return '';
  });

  protected readonly canExport = computed(() =>
    this.view() === 'tree' ? this.hasDoc() : this.text().trim() !== '' && this.parseError() === null,
  );
  protected readonly textTooBig = computed(() => this.text().length > TEXT_VIEW_MAX);

  // Link di condivisione: documento + vista (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({ text: this.currentText(), view: this.view() });

  protected restoreShared(data: ShareData): void {
    if (typeof data['text'] !== 'string') return;
    this.resetMessages();
    this.text.set(data['text']);
    this.textDirty = true;
    this.view.set('text');
    this.changed.set(false);
    if (data['view'] === 'tree') this.commitText();
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(XML_VIEWER_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xml-viewer');
    if (rx?.text !== undefined) void this.onFile(new File([rx.text], 'received.xml', { type: 'application/xml' }));
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.searchTimer);
      clearTimeout(this.copyTimer);
    });
  }

  // =====================================================================================
  // Caricamento e viste
  // =====================================================================================

  private resetMessages(): void {
    this.fileError.set(null);
    this.editError.set(null);
    this.parseError.set(null);
  }

  protected loadSample(): void {
    this.resetMessages();
    this.text.set(SAMPLE);
    this.textDirty = true;
    this.changed.set(false);
    if (this.commitText()) this.view.set('tree');
  }

  protected clear(): void {
    this.history.set(null);
    this.text.set('');
    this.textDirty = false;
    this.changed.set(false);
    this.resetMessages();
    this.cursor.set([]);
    this.expanded.set(new Set());
    this.query.set('');
    this.view.set('text');
  }

  protected async onFile(f: File): Promise<void> {
    this.resetMessages();
    if (f.size > MAX_FILE_BYTES) {
      this.fileError.set('xv.err.toolarge');
      return;
    }
    this.busy.set(true);
    try {
      const t = await f.text();
      this.text.set(t);
      this.textDirty = true;
      this.changed.set(false);
      if (this.commitText()) this.view.set('tree');
      else this.view.set(this.textTooBig() ? 'tree' : 'text');
    } catch {
      this.fileError.set('xv.err.read');
    } finally {
      this.busy.set(false);
    }
  }

  /** Legge il testo e ne fa l'albero. Se non è ben formato resta com'è e mostra l'errore. */
  private commitText(): boolean {
    const src = this.text();
    if (src.trim() === '') {
      this.history.set(null);
      this.textDirty = false;
      this.parseError.set(null);
      return true;
    }
    const r = parseXml(normalizeNewlines(src));
    if (!r.ok) {
      this.parseError.set(r.error);
      return false;
    }
    this.parseError.set(null);
    this.history.set(createHistory(r.nodes));
    this.xp.set(null);
    this.textDirty = false;
    this.query.set('');
    this.matchPos.set(0);
    this.expanded.set(expandLevels(r.nodes, 2));
    const first = r.nodes.findIndex((n) => n.t === 'el');
    this.cursor.set(first >= 0 ? [first] : []);
    return true;
  }

  protected setView(v: View): void {
    if (v === this.view()) return;
    this.editError.set(null);
    if (v === 'tree') {
      if (this.textDirty || !this.hasDoc()) {
        if (!this.commitText()) return;
      }
    } else {
      if (this.textTooBig() && !this.changed()) {
        this.fileError.set('xv.textTooBig');
        return;
      }
      if (this.hasDoc() && this.changed()) {
        this.text.set(this.currentText());
        this.changed.set(false);
        this.textDirty = false;
      }
      this.parseError.set(null);
    }
    this.view.set(v);
  }

  protected onTextInput(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.text.set(value);
    this.textDirty = true;
    this.fileError.set(null);
    if (value.length > LIVE_PARSE_MAX || value.trim() === '') {
      this.parseError.set(null);
      return;
    }
    const r = parseXml(normalizeNewlines(value));
    this.parseError.set(r.ok ? null : r.error);
  }

  protected formatText(minify: boolean): void {
    const r = parseXml(normalizeNewlines(this.text()));
    if (!r.ok) {
      this.parseError.set(r.error);
      return;
    }
    this.parseError.set(null);
    this.text.set(minify ? minifyNodes(r.nodes, FMT) : formatNodes(r.nodes, FMT) + '\n');
    this.textDirty = true;
  }

  // =====================================================================================
  // Albero: selezione, apertura, tastiera
  // =====================================================================================

  protected select(path: Path, scroll = false): void {
    this.cursor.set(path);
    this.editError.set(null);
    if (scroll) this.scrollTo(pathKey(path));
  }

  private scrollTo(key: string): void {
    afterNextRender(() => document.getElementById('xv-row-' + key)?.scrollIntoView({ block: 'nearest' }), { injector: this.injector });
  }

  protected toggle(key: string): void {
    this.expanded.update((s) => {
      const n = new Set(s);
      if (!n.delete(key)) n.add(key);
      return n;
    });
  }

  protected onRowClick(r: Row): void {
    this.select(r.path);
  }

  protected onCaret(r: Row, e: Event): void {
    e.stopPropagation();
    if (r.expandable) this.toggle(r.key);
    this.select(r.path);
  }

  protected expandAll(): void {
    this.expanded.set(expandLevels(this.doc(), 10_000));
  }

  protected collapseAll(): void {
    this.expanded.set(new Set());
    const top = this.cursor().slice(0, 1);
    this.cursor.set(top);
  }

  protected onTreeKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const rows = this.rows();
    if (!rows.length) return;
    const key = this.cursorKey();
    const i = Math.max(0, rows.findIndex((r) => r.key === key));
    const cur = rows[i];
    let target: Row | undefined;
    switch (e.key) {
      case 'ArrowDown':
        target = rows[Math.min(rows.length - 1, i + 1)];
        break;
      case 'ArrowUp':
        target = rows[Math.max(0, i - 1)];
        break;
      case 'Home':
        target = rows[0];
        break;
      case 'End':
        target = rows[rows.length - 1];
        break;
      case 'ArrowRight':
        if (cur.expandable && !cur.expanded) this.toggle(cur.key);
        else if (cur.expanded) target = rows[i + 1];
        break;
      case 'ArrowLeft':
        if (cur.expanded) this.toggle(cur.key);
        else if (cur.path.length > 1) target = rows.find((r) => r.key === pathKey(cur.path.slice(0, -1)));
        break;
      case 'Delete':
        e.preventDefault();
        this.deleteNode();
        return;
      default:
        return;
    }
    e.preventDefault();
    if (target) this.select(target.path, true);
  }

  /** Ctrl+Z / Ctrl+Y fuori dai campi di testo (dentro ai campi vale l'annulla del browser). */
  protected onPageKey(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || this.view() !== 'tree') return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) this.undo();
    else if (k === 'y' || (k === 'z' && e.shiftKey)) this.redo();
    else return;
    e.preventDefault();
  }

  // =====================================================================================
  // Ricerca
  // =====================================================================================

  protected runXp(): void {
    this.xp.set(runXpath(this.doc(), this.xpExpr()));
  }

  protected onXpInput(e: Event): void {
    this.xpExpr.set((e.target as HTMLInputElement).value);
  }

  protected onXpKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.runXp();
    }
  }

  protected goXp(item: XpItem): void {
    if (!item.path) return;
    this.expanded.set(reveal(this.expanded(), item.path));
    this.select(item.path, true);
  }

  protected onSearchInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.query.set(v);
      this.matchPos.set(0);
      this.goToMatch();
    }, 200);
  }

  protected onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.step(e.shiftKey ? -1 : 1);
    }
  }

  protected step(dir: 1 | -1): void {
    const n = this.matches().length;
    if (!n) return;
    this.matchPos.set((this.matchPos() + dir + n) % n);
    this.goToMatch();
  }

  private goToMatch(): void {
    const m = this.matches();
    if (!m.length) return;
    const p = m[Math.min(this.matchPos(), m.length - 1)];
    this.expanded.set(reveal(this.expanded(), p));
    this.select(p, true);
  }

  protected isMatch(key: string): boolean {
    return this.matchKeys().has(key);
  }

  protected isCurrentMatch(key: string): boolean {
    return key === this.currentMatchKey();
  }

  // =====================================================================================
  // Modifica
  // =====================================================================================

  private apply(r: EditResult): boolean {
    if (!r.ok) {
      this.editError.set(r.error);
      return false;
    }
    const h = this.history();
    if (!h) return false;
    this.editError.set(null);
    this.history.set(pushState(h, r.doc));
    this.changed.set(true);
    this.expanded.set(reveal(this.expanded(), r.path));
    this.cursor.set(r.path);
    this.scrollTo(pathKey(r.path));
    return true;
  }

  protected rename(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!this.apply(renameElement(this.doc(), this.cursor(), input.value.trim()))) this.restore(input);
  }

  protected editContent(e: Event): void {
    const input = e.target as HTMLTextAreaElement;
    if (!this.apply(setText(this.doc(), this.cursor(), input.value))) this.restore(input);
  }

  protected editAttr(e: Event, index: number, part: 'name' | 'value', current: { name: string; value: string }): void {
    const input = e.target as HTMLInputElement;
    const name = part === 'name' ? input.value.trim() : current.name;
    const value = part === 'value' ? input.value : unescapeXml(current.value);
    if (!this.apply(setAttr(this.doc(), this.cursor(), index, name, value))) this.restore(input);
  }

  protected addAttr(name: HTMLInputElement, value: HTMLInputElement): void {
    if (this.apply(setAttr(this.doc(), this.cursor(), -1, name.value.trim(), value.value))) {
      name.value = '';
      value.value = '';
    }
  }

  protected removeAttr(index: number): void {
    this.apply(removeAttr(this.doc(), this.cursor(), index));
  }

  /** Rimette nel campo il valore del documento quando la modifica è stata rifiutata. */
  private restore(input: HTMLInputElement | HTMLTextAreaElement): void {
    const n = this.node();
    if (!n) return;
    if (input.dataset['f'] === 'name') input.value = n.t === 'el' ? n.name : '';
    else if (input.dataset['f'] === 'text') input.value = editableText(n) ?? '';
    else input.value = input.defaultValue;
  }

  protected add(kind: NewKind): void {
    this.apply(addChild(this.doc(), this.cursor(), kind, this.i18n.t('xv.newTag')));
  }

  protected duplicateNode(): void {
    this.apply(duplicateNode(this.doc(), this.cursor()));
  }

  protected moveNode(dir: -1 | 1): void {
    this.apply(moveNode(this.doc(), this.cursor(), dir));
  }

  protected deleteNode(): void {
    if (this.node()) this.apply(removeNode(this.doc(), this.cursor()));
  }

  protected undo(): void {
    const h = this.history();
    if (!h || !canUndo(h)) return;
    this.travel(undo(h));
  }

  protected redo(): void {
    const h = this.history();
    if (!h || !canRedo(h)) return;
    this.travel(redo(h));
  }

  private travel(h: History<Doc>): void {
    this.history.set(h);
    this.changed.set(true);
    this.editError.set(null);
    const p = nearestPath(h.present, this.cursor());
    this.expanded.set(reveal(this.expanded(), p));
    this.cursor.set(p);
  }

  // =====================================================================================
  // Presentazione delle righe
  // =====================================================================================

  protected attrsText(r: Row): string {
    return r.node.t === 'el' ? truncate(r.node.attrs.map((a) => `${a.name}="${unescapeXml(a.value)}"`).join(' ')) : '';
  }

  protected leafText(r: Row): string {
    const n = r.node;
    if (n.t === 'el') return r.text === null ? '' : truncate(r.text);
    if (n.t === 'doctype' || n.t === 'pi') return truncate(n.raw);
    return truncate(editableText(n) ?? '');
  }

  protected tagName(r: Row): string {
    return r.node.t === 'el' ? r.node.name : '';
  }

  protected commentText(r: Row): string {
    return `<!-- ${this.leafText(r)} -->`;
  }

  protected countLabel(r: Row): string {
    return r.count === 1 ? this.i18n.t('xv.children.one') : this.i18n.t('xv.children', { n: r.count });
  }

  protected childCount(): number {
    const n = this.node();
    return n?.t === 'el' ? visibleChildren(n.children).length : 0;
  }

  protected nodeName(): string {
    const n = this.node();
    return n?.t === 'el' ? n.name : '';
  }

  protected nodeAttrs(): { name: string; value: string; raw: string }[] {
    const n = this.node();
    return n?.t === 'el' ? n.attrs.map((a) => ({ name: a.name, value: unescapeXml(a.value), raw: a.value })) : [];
  }

  /** Contenuto modificabile del nodo selezionato, o null. */
  protected content(): string | null {
    const n = this.node();
    return n ? editableText(n) : null;
  }

  protected isElement(): boolean {
    return this.node()?.t === 'el';
  }

  protected canMove(dir: -1 | 1): boolean {
    const p = this.cursor();
    const n = this.node();
    if (!n || n.t === 'doctype') return false;
    const parent = p.length > 1 ? getNode(this.doc(), p.slice(0, -1)) : null;
    const sibs = p.length === 1 ? this.doc() : parent?.t === 'el' ? parent.children : [];
    const sibsV = visibleChildren(sibs);
    const at = sibsV.findIndex((s) => s.index === p[p.length - 1]);
    const other = sibsV[at + dir];
    return at >= 0 && !!other && other.node.t !== 'doctype';
  }

  // =====================================================================================
  // Esportazione
  // =====================================================================================

  protected currentText(): string {
    if (this.view() === 'text' || !this.changed()) return this.text();
    return this.hasDoc() ? formatNodes(this.doc(), FMT) + '\n' : '';
  }

  protected readonly sendText = computed(() => {
    // dipende dai segnali che cambiano il testo, così il menu "Invia a…" riceve sempre l'ultima versione
    this.view();
    this.text();
    this.history();
    return this.currentText();
  });

  protected async copyAll(): Promise<void> {
    if (!(await writeClipboard(this.currentText()))) return;
    this.copied.set(true);
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(false), 1500);
  }

  protected download(): void {
    const out = this.currentText();
    if (out) saveBytes(new TextEncoder().encode(out), 'document.xml', 'application/xml;charset=utf-8');
  }
}
