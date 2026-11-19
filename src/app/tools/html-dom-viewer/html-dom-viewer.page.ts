// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { DomRow, MAX_RESULTS, MAX_ROWS, QueryHit, QueryMode, QueryResult, ancestorsOf, buildRows, cssPathOf, defaultOpen, domStats, parseHtml, runQuery, treeNodeOf, xpathOfNode } from './dom-tree';
import { HTML_DOM_DICTIONARIES } from './html-dom-viewer.i18n';
import { SHARE_SCHEMA } from './html-dom-viewer.share';

const MAX_FILE = 5 * 1024 * 1024;
const SAMPLE =
  '<!DOCTYPE html>\n<html lang="it">\n<head>\n  <meta charset="utf-8">\n  <title>Pagina di prova</title>\n</head>\n<body>\n  <header id="top"><h1>Titolo</h1><nav class="menu"><a href="/a">A</a> <a href="/b" class="on">B</a></nav></header>\n  <main>\n    <article class="post"><h2>Primo</h2><p>Testo con <b>grassetto</b>.</p></article>\n    <article class="post"><h2>Secondo</h2><p>Altro testo.</p><!-- da rivedere --></article>\n  </main>\n  <ul><li>uno</li><li>due</li><li>tre</li></ul>\n</body>\n</html>\n';

@Component({
  selector: 'app-html-dom-viewer',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './html-dom-viewer.page.html',
  styleUrl: './html-dom-viewer.page.scss',
})
export class HtmlDomViewerPage {
  protected readonly i18n = inject(I18nService);
  protected readonly maxRows = MAX_ROWS;
  protected readonly maxResults = MAX_RESULTS;
  protected readonly text = signal('');
  protected readonly mode = signal<QueryMode>('css');
  protected readonly query = signal('');
  protected readonly result = signal<QueryResult | null>(null);
  protected readonly fileError = signal('');
  private readonly open = signal<ReadonlySet<number>>(new Set());
  private readonly cursor = signal<Node | null>(null);

  protected readonly modes = computed<SegmentOption<QueryMode>[]>(() => [
    { value: 'css', label: 'CSS' },
    { value: 'xpath', label: 'XPath' },
  ]);

  protected readonly doc = computed<Document | null>(() => (this.text().trim() === '' || typeof DOMParser === 'undefined' ? null : parseHtml(this.text())));
  protected readonly flat = computed(() => {
    const d = this.doc();
    return d ? buildRows(d, this.open(), MAX_ROWS) : { rows: [] as DomRow[], truncated: false, total: 0 };
  });
  protected readonly rows = computed(() => this.flat().rows);
  protected readonly stats = computed(() => {
    const d = this.doc();
    return d ? domStats(d) : null;
  });
  protected readonly statusText = computed(() => {
    const s = this.stats();
    return s ? this.i18n.t('hd.stats', { elements: s.elements, attrs: s.attributes, depth: s.depth }) : '';
  });
  protected readonly cursorId = computed(() => this.rows().find((r) => r.node === this.cursor())?.id ?? null);
  protected readonly node = computed(() => this.cursor());
  protected readonly nodeInfo = computed(() => {
    const n = this.cursor();
    if (!n) return null;
    const el = n.nodeType === 1 ? (n as Element) : null;
    const html = el ? el.outerHTML : (n.nodeValue ?? '');
    return {
      kind: this.i18n.t('hd.kind.' + (n.nodeType === 1 ? 'el' : n.nodeType === 3 ? 'text' : n.nodeType === 8 ? 'comment' : 'doctype')),
      name: el ? el.localName : '',
      xpath: xpathOfNode(n),
      css: el ? cssPathOf(el) : '',
      attrs: el ? Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value })) : [],
      text: (el ? el.textContent : n.nodeValue)?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? '',
      html: html.length > 3000 ? html.slice(0, 3000) + '…' : html,
      children: el ? el.children.length : 0,
    };
  });
  protected readonly queryText = computed(() => {
    const r = this.result();
    if (!r) return '';
    if (!r.ok) return r.message === '' ? '' : this.i18n.t('hd.q.err', { msg: r.message });
    if (r.kind === 'value') return '';
    return r.total === 0 ? this.i18n.t('hd.q.none') : this.i18n.t(r.total === 1 ? 'hd.q.count.one' : 'hd.q.count', { n: r.total });
  });
  protected readonly fileErrorText = computed(() => (this.fileError() ? this.i18n.t(this.fileError() as 'hd.err.read') : ''));

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { text: this.text, mode: this.mode, query: this.query };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    this.reset();
  }

  constructor() {
    this.i18n.register(HTML_DOM_DICTIONARIES);
    const rx = inject(ToolHandoff).take('html-dom-viewer');
    if (rx?.text !== undefined) {
      this.text.set(rx.text);
      this.reset();
    }
  }

  /** Dopo un nuovo testo: albero aperto ai primi livelli, nessun nodo scelto e nessun risultato di query. */
  private reset(): void {
    const d = this.doc();
    this.open.set(d ? defaultOpen(d) : new Set());
    this.cursor.set(null);
    this.result.set(null);
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.text.set((e.target as HTMLTextAreaElement).value);
    this.reset();
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.text.set(SAMPLE);
    this.reset();
  }

  protected clear(): void {
    this.fileError.set('');
    this.text.set('');
    this.query.set('');
    this.reset();
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE) {
      this.fileError.set('hd.err.tooBig');
      return;
    }
    try {
      this.text.set(await file.text());
      this.reset();
    } catch {
      this.fileError.set('hd.err.read');
    }
  }

  // ---- query ----
  protected onQuery(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
  protected onQueryKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.runQ();
    }
  }
  protected runQ(): void {
    const d = this.doc();
    this.result.set(d ? runQuery(d, this.mode(), this.query()) : null);
  }
  protected setMode(m: QueryMode): void {
    this.mode.set(m);
    this.result.set(null);
  }
  protected goHit(h: QueryHit): void {
    this.select(treeNodeOf(h.node), true);
  }

  // ---- albero ----
  protected select(n: Node, reveal: boolean): void {
    const d = this.doc();
    if (reveal && d) this.open.update((o) => new Set([...o, ...ancestorsOf(d, n)]));
    this.cursor.set(n);
    queueMicrotask(() => {
      const id = this.cursorId();
      if (id !== null) document.getElementById('dv-row-' + id)?.scrollIntoView({ block: 'nearest' });
    });
  }
  protected onRowClick(r: DomRow): void {
    this.cursor.set(r.node);
  }
  protected onCaret(r: DomRow, e: Event): void {
    e.stopPropagation();
    this.toggle(r);
    this.cursor.set(r.node);
  }
  private toggle(r: DomRow): void {
    if (!r.hasChildren) return;
    this.open.update((o) => {
      const next = new Set(o);
      if (next.has(r.id)) next.delete(r.id);
      else next.add(r.id);
      return next;
    });
  }
  protected expandAll(): void {
    const d = this.doc();
    if (d) this.open.set(new Set(Array.from({ length: this.flat().total }, (_, i) => i)));
  }
  protected collapseAll(): void {
    this.open.set(new Set());
  }

  protected onTreeKey(e: KeyboardEvent): void {
    const rows = this.rows();
    if (!rows.length || e.ctrlKey || e.metaKey || e.altKey) return;
    let i = rows.findIndex((r) => r.node === this.cursor());
    const cur = i === -1 ? null : rows[i];
    switch (e.key) {
      case 'ArrowDown':
        i = Math.min(rows.length - 1, i + 1);
        break;
      case 'ArrowUp':
        i = Math.max(0, i === -1 ? 0 : i - 1);
        break;
      case 'Home':
        i = 0;
        break;
      case 'End':
        i = rows.length - 1;
        break;
      case 'ArrowRight':
        if (cur?.hasChildren && !cur.open) {
          this.toggle(cur);
          e.preventDefault();
          return;
        }
        i = cur?.open ? i + 1 : i;
        break;
      case 'ArrowLeft':
        if (cur?.open) {
          this.toggle(cur);
          e.preventDefault();
          return;
        }
        if (cur) {
          let j = i - 1;
          while (j >= 0 && rows[j].depth >= cur.depth) j--;
          if (j >= 0) i = j;
        }
        break;
      case 'Enter':
      case ' ':
        if (cur) {
          this.toggle(cur);
          e.preventDefault();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    const target = rows[Math.max(0, Math.min(rows.length - 1, i))];
    this.select(target.node, false);
  }

  protected commentText(r: DomRow): string {
    return r.kind === 'comment' ? `<!-- ${r.label} -->` : r.label;
  }

  protected attrsText(r: DomRow): string {
    return r.attrs.join(' ');
  }
}
