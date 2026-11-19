// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { EXAMPLES } from './json-query.examples';
import { JSON_QUERY_DICTIONARIES } from './json-query.i18n';
import { SHARE_SCHEMA } from './json-query.share';
import { MAX_RESULTS, compileJsonPath, parseJson, runJsonPath } from './jsonpath';
import { jsonToSchemaText, jsonToTypeScript } from './json-types';
import { ToolHandoff } from '../../shared/tool-handoff';

type Tab = 'query' | 'ts' | 'schema';
/** Righe mostrate nella tabella dei percorsi. */
const MAX_ROWS = 200;

/** Riga di testo con un segno sotto la posizione dell'errore. */
function caretContext(text: string, pos: number): { ctx: string } {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  let end = text.indexOf('\n', pos);
  if (end < 0) end = text.length;
  const col = pos - start;
  // si mostrano al massimo 80 caratteri attorno all'errore
  const from = Math.max(0, col - 40);
  const line = text.slice(start + from, Math.min(end, start + from + 80)).replace(/\t/g, ' ');
  return { ctx: line + '\n' + ' '.repeat(col - from) + '^' };
}

@Component({
  selector: 'app-json-query',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-query.page.html',
  styleUrl: './json-query.page.scss',
})
export class JsonQueryPage {
  protected readonly i18n = inject(I18nService);

  protected readonly json = signal('');
  protected readonly expr = signal('');
  protected readonly tab = signal<Tab>('query');
  protected readonly rootName = signal('Root');
  protected readonly tsStyle = signal<'interface' | 'type'>('interface');
  protected readonly tsExport = signal(true);

  protected readonly examples = EXAMPLES;
  protected readonly exampleId = signal<(typeof EXAMPLES)[number]['id']>('books');
  protected readonly exampleExprs = computed(() => EXAMPLES.find((e) => e.id === this.exampleId())!.exprs);

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    { value: 'query', label: this.i18n.t('jq.tab.query') },
    { value: 'ts', label: this.i18n.t('jq.tab.ts') },
    { value: 'schema', label: this.i18n.t('jq.tab.schema') },
  ]);
  protected readonly styles = computed<SegmentOption<'interface' | 'type'>[]>(() => [
    { value: 'interface', label: 'interface' },
    { value: 'type', label: 'type' },
  ]);

  // ---- JSON ----
  private readonly parsed = computed(() => (this.json().trim() === '' ? null : parseJson(this.json())));
  protected readonly jsonError = computed(() => {
    const p = this.parsed();
    if (!p || p.ok) return null;
    return { line: p.line, col: p.col, ...caretContext(this.json(), p.pos) };
  });
  private readonly value = computed(() => {
    const p = this.parsed();
    return p && p.ok ? { v: p.value } : null;
  });

  // ---- JSONPath ----
  private readonly compiled = computed(() => (this.expr().trim() === '' ? null : compileJsonPath(this.expr())));
  protected readonly exprError = computed(() => {
    const c = this.compiled();
    if (!c || c.ok) return null;
    const e = c.error;
    return { text: this.i18n.t('jq.err.' + e.code, { pos: e.pos + 1, detail: e.detail ?? '' }), ...caretContext(this.expr(), Math.min(e.pos, this.expr().length)) };
  });
  private readonly result = computed(() => {
    const c = this.compiled();
    const v = this.value();
    if (!c || !c.ok || !v) return null;
    return runJsonPath(v.v, c.path);
  });
  protected readonly runError = computed(() => {
    const r = this.result();
    return r && !r.ok ? this.i18n.t('jq.err.budget') : '';
  });
  protected readonly nodes = computed(() => {
    const r = this.result();
    return r && r.ok ? r.nodes : [];
  });
  protected readonly total = computed(() => {
    const r = this.result();
    return r && r.ok ? r.total : 0;
  });
  protected readonly ranOk = computed(() => !!this.result()?.ok);
  protected readonly truncated = computed(() => {
    const r = this.result();
    return !!r && r.ok && r.truncated;
  });
  protected readonly maxResults = MAX_RESULTS;
  protected readonly maxRows = MAX_ROWS;
  protected readonly rows = computed(() =>
    this.nodes().slice(0, MAX_ROWS).map((n) => ({ path: n.path, preview: this.preview(n.value) })),
  );
  /** Valori trovati, come array JSON. */
  protected readonly valuesText = computed(() => (this.ranOk() ? JSON.stringify(this.nodes().map((n) => n.value), null, 2) : ''));
  protected readonly pathsText = computed(() => this.nodes().map((n) => n.path).join('\n'));
  protected readonly summary = computed(() => {
    if (!this.ranOk()) return '';
    const n = this.total();
    return n === 0 ? this.i18n.t('jq.res.none') : this.i18n.t(n === 1 ? 'jq.res.one' : 'jq.res.many', { n });
  });

  private preview(v: unknown): string {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  }

  // ---- TypeScript e Schema ----
  protected readonly tsText = computed(() => {
    const v = this.value();
    return v ? jsonToTypeScript(v.v, { rootName: this.rootName(), style: this.tsStyle(), exportKeyword: this.tsExport() }) : '';
  });
  protected readonly schemaText = computed(() => {
    const v = this.value();
    return v ? jsonToSchemaText(v.v) : '';
  });
  protected readonly needJson = computed(() => !this.value());

  // ---- condivisione ----
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    json: this.json,
    expr: this.expr,
    tab: this.tab,
    rootName: this.rootName,
    tsStyle: this.tsStyle,
    tsExport: this.tsExport,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(JSON_QUERY_DICTIONARIES);
    const rx = inject(ToolHandoff).take('json-query');
    if (rx?.text !== undefined) this.json.set(rx.text);
  }

  protected loadExample(id: (typeof EXAMPLES)[number]['id']): void {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    this.exampleId.set(id);
    this.json.set(ex.json);
    this.expr.set(ex.exprs[0]);
    this.tab.set('query');
  }

  protected setRootName(v: string): void {
    this.rootName.set(v);
  }

  protected download(): void {
    const t = this.tab();
    const text = t === 'ts' ? this.tsText() : t === 'schema' ? this.schemaText() : this.valuesText();
    if (!text) return;
    const name = t === 'ts' ? 'types.ts' : t === 'schema' ? 'schema.json' : 'result.json';
    saveBytes(new TextEncoder().encode(text), name, t === 'ts' ? 'text/plain;charset=utf-8' : 'application/json');
  }
}
