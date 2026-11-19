// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, Injector, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { lineStartOffset, nextGroup, targetScrollTop } from '../text-diff/diff-nav';
import { offsetOf } from '../yaml-json-converter/convert';
import { ArrayMode, ChangeKind, DEFAULT_OPTIONS, Difference, JsonDiffOptions, Outcome, ParseError, differencesToText, formatValue, parseIgnoreList } from './json-diff';
import { JsonDiffClient, StaleCompare } from './json-diff-client';
import { TreeRow, filterDifferences, flattenTree } from './json-diff-view';
import { JSON_DIFF_DICTIONARIES } from './json-diff.i18n';
import { SAMPLE_A, SAMPLE_B } from './json-diff.sample';
import { SHARE_SCHEMA } from './json-diff.share';

type View = 'list' | 'tree';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PAGE_ROWS = 1000;
const KINDS: readonly ChangeKind[] = ['added', 'removed', 'changed', 'type'];

@Component({
  selector: 'app-json-diff',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-diff.page.html',
  styleUrl: './json-diff.page.scss',
})
export class JsonDiffPage {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly client = new JsonDiffClient();

  protected readonly textA = signal('');
  protected readonly textB = signal('');
  protected readonly nameA = signal('');
  protected readonly nameB = signal('');
  protected readonly arrayMode = signal<ArrayMode>('index');
  protected readonly key = signal('');
  protected readonly ignoreCase = signal(false);
  /** Tolleranza come testo (accetta anche la virgola decimale). */
  protected readonly epsilon = signal('');
  protected readonly ignore = signal('');
  protected readonly view = signal<View>('list');
  protected readonly collapse = signal(true);
  /** Tipi di differenza mostrati nell'elenco. */
  protected readonly activeKinds = signal<ReadonlySet<ChangeKind>>(new Set(KINDS));
  protected readonly optsOpen = signal(false);
  protected readonly inputsHidden = signal(false);
  protected readonly fileError = signal(false);
  protected readonly outcome = signal<Outcome | null>(null);
  protected readonly busy = signal(false);
  protected readonly current = signal(-1);
  protected readonly limit = signal(PAGE_ROWS);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  private navigated = false;

  protected readonly kinds = KINDS;

  protected readonly options = computed<JsonDiffOptions>(() => {
    const eps = Number(this.epsilon().trim().replace(',', '.'));
    return {
      ...DEFAULT_OPTIONS,
      arrayMode: this.arrayMode(),
      key: this.key().trim(),
      ignoreCase: this.ignoreCase(),
      epsilon: Number.isFinite(eps) && eps > 0 ? eps : 0,
      ignore: parseIgnoreList(this.ignore()),
    };
  });

  protected readonly arrayOptions = computed<SegmentOption<ArrayMode>[]>(() => [
    { value: 'index', label: this.i18n.t('jd.arrays.index') },
    { value: 'set', label: this.i18n.t('jd.arrays.set') },
    { value: 'key', label: this.i18n.t('jd.arrays.key') },
  ]);
  protected readonly viewOptions = computed<SegmentOption<View>[]>(() => [
    { value: 'list', label: this.i18n.t('jd.view.list') },
    { value: 'tree', label: this.i18n.t('jd.view.tree') },
  ]);

  protected readonly hasInput = computed(() => this.textA() !== '' || this.textB() !== '');
  protected readonly panelsHidden = computed(() => this.inputsHidden() && this.result() !== null);
  protected readonly metaA = computed(() => this.counter(this.textA(), 'a'));
  protected readonly metaB = computed(() => this.counter(this.textB(), 'b'));
  protected readonly hiddenSummary = computed(() =>
    this.i18n.t('jd.inputs.summary', {
      a: this.nameA() || this.i18n.t('jd.a'),
      ma: this.metaA(),
      b: this.nameB() || this.i18n.t('jd.b'),
      mb: this.metaB(),
    }),
  );

  protected readonly result = computed(() => {
    const o = this.outcome();
    return o?.state === 'ok' ? o.result : null;
  });
  protected readonly errors = computed(() => {
    const o = this.outcome();
    if (o?.state !== 'error') return [];
    const out: { side: 'a' | 'b'; label: string; error: ParseError }[] = [];
    if (o.a) out.push({ side: 'a', label: this.i18n.t('jd.a'), error: o.a });
    if (o.b) out.push({ side: 'b', label: this.i18n.t('jd.b'), error: o.b });
    return out;
  });
  protected readonly diffs = computed<readonly Difference[]>(() => this.result()?.differences ?? []);
  protected readonly counts = computed(() => this.result()?.counts ?? null);
  protected readonly filtered = computed(() => filterDifferences(this.diffs(), this.activeKinds()));
  protected readonly flat = computed(() => {
    const r = this.result();
    if (!r || this.view() !== 'tree') return { rows: [] as TreeRow[], truncated: false };
    return flattenTree(r.root, { hideSame: this.collapse(), expanded: this.expanded() });
  });
  protected readonly groups = computed(() => (this.view() === 'list' ? this.filtered().length : this.diffs().length));
  protected readonly shownList = computed(() => this.filtered().slice(0, this.limit()));
  protected readonly shownTree = computed(() => this.flat().rows.slice(0, this.limit()));
  protected readonly remaining = computed(() => Math.max(0, (this.view() === 'list' ? this.filtered().length : this.flat().rows.length) - this.limit()));

  protected readonly statsText = computed(() => {
    const n = this.counts()?.total ?? 0;
    return n === 1 ? this.i18n.t('jd.stats.one') : this.i18n.t('jd.stats', { n: new Intl.NumberFormat(this.i18n.locale()).format(n) });
  });
  protected readonly positionText = computed(() => (this.current() >= 0 ? this.i18n.t('jd.position', { n: this.current() + 1, total: this.groups() }) : ''));

  // esportazione
  private readonly labels = computed(() => ({
    added: this.i18n.t('jd.export.added'),
    removed: this.i18n.t('jd.export.removed'),
    changed: this.i18n.t('jd.export.changed'),
    type: this.i18n.t('jd.export.type'),
    root: this.i18n.t('jd.root'),
  }));
  protected readonly listText = computed(() => differencesToText(this.diffs(), this.labels(), false));
  protected readonly markdownText = computed(() => differencesToText(this.diffs(), this.labels(), true));
  protected readonly patchText = computed(() => {
    const o = this.outcome();
    return o?.state === 'ok' ? JSON.stringify(o.patch, null, 2) : '';
  });

  // link di condivisione (testi e opzioni nell'hash; l'avviso per i testi grandi lo dà ShareLink)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    textA: this.textA,
    textB: this.textB,
    arrayMode: this.arrayMode,
    key: this.key,
    ignoreCase: this.ignoreCase,
    epsilon: this.epsilon,
    ignore: this.ignore,
    view: this.view,
    collapse: this.collapse,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(JSON_DIFF_DICTIONARIES);
    const rx = inject(ToolHandoff).take('json-diff');
    if (rx?.text !== undefined) this.receive(rx.text);
    // confronto con un breve ritardo (digitazione); le risposte superate si scartano
    effect((onCleanup) => {
      const a = this.textA();
      const b = this.textB();
      const options = this.options();
      if (a.trim() === '' || b.trim() === '') {
        this.outcome.set(null);
        this.busy.set(false);
        this.current.set(-1);
        return;
      }
      let cancelled = false;
      const timer = setTimeout(() => {
        const slow = setTimeout(() => !cancelled && this.busy.set(true), 150);
        this.client
          .run(a, b, options)
          .then((o) => {
            if (cancelled) return;
            this.outcome.set(o);
            this.current.set(-1);
            this.limit.set(PAGE_ROWS);
            this.expanded.set(new Set());
            this.navigated = false;
          })
          .catch((e) => {
            if (!(e instanceof StaleCompare)) throw e;
          })
          .finally(() => {
            clearTimeout(slow);
            if (!cancelled) this.busy.set(false);
          });
      }, 150);
      onCleanup(() => {
        cancelled = true;
        clearTimeout(timer);
      });
    });
    inject(DestroyRef).onDestroy(() => this.client.dispose());
  }

  /** Contenuto ricevuto da un altro strumento: nel pannello A, in B se A è già pieno. */
  private receive(text: string): void {
    if (this.textA().trim() === '') this.textA.set(text);
    else this.textB.set(text);
  }

  private counter(text: string, side: 'a' | 'b'): string {
    const o = this.outcome();
    let format = text === '' ? this.i18n.t('jd.format.none') : '—';
    if (o?.state === 'ok') format = this.i18n.t(`jd.format.${side === 'a' ? o.formatA : o.formatB}`);
    return this.i18n.t('jd.counter', { format, chars: new Intl.NumberFormat(this.i18n.locale()).format(text.length) });
  }

  // ---- ingressi ----

  protected onText(which: 'a' | 'b', e: Event): void {
    (which === 'a' ? this.textA : this.textB).set((e.target as HTMLTextAreaElement).value);
  }

  protected async onFile(which: 'a' | 'b', e: Event): Promise<void> {
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
      const text = await file.text();
      (which === 'a' ? this.textA : this.textB).set(text);
      (which === 'a' ? this.nameA : this.nameB).set(file.name);
    } catch {
      this.fileError.set(true);
    }
  }

  protected swap(): void {
    const a = this.textA();
    this.textA.set(this.textB());
    this.textB.set(a);
    const n = this.nameA();
    this.nameA.set(this.nameB());
    this.nameB.set(n);
  }

  protected clear(): void {
    this.textA.set('');
    this.textB.set('');
    this.nameA.set('');
    this.nameB.set('');
    this.fileError.set(false);
    this.inputsHidden.set(false);
  }

  protected loadSample(): void {
    this.textA.set(SAMPLE_A);
    this.textB.set(SAMPLE_B);
    this.nameA.set('');
    this.nameB.set('');
  }

  protected toggleInputs(): void {
    this.inputsHidden.update((v) => !v);
  }

  /** Dal messaggio d'errore al punto nella textarea: mostra i testi, focus e cursore sulla riga e colonna. */
  protected goToError(side: 'a' | 'b', e: ParseError): void {
    this.inputsHidden.set(false);
    afterNextRender(
      () => {
        const ta = this.host.nativeElement.querySelector<HTMLTextAreaElement>(side === 'a' ? '#jd-a' : '#jd-b');
        if (!ta) return;
        const off = e.line === undefined ? 0 : e.column === undefined ? lineStartOffset(ta.value, e.line) : offsetOf(ta.value, e.line, e.column);
        ta.focus();
        ta.setSelectionRange(off, off);
      },
      { injector: this.injector },
    );
  }

  // ---- vista ----

  protected setView(v: View): void {
    this.view.set(v);
    this.current.set(-1);
    this.limit.set(PAGE_ROWS);
  }

  protected toggleKind(k: ChangeKind): void {
    this.activeKinds.update((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
    this.current.set(-1);
  }

  protected expand(id: string): void {
    this.expanded.update((s) => new Set([...s, id]));
  }

  protected showMore(): void {
    this.limit.update((l) => l + PAGE_ROWS);
  }

  protected fmt(v: unknown): string {
    return formatValue(v);
  }

  protected kindLabel(k: ChangeKind | string): string {
    return this.i18n.t(`jd.kind.${k}` as 'jd.kind.added');
  }

  protected kindCount(k: ChangeKind): string {
    return this.i18n.t('jd.kind.count', { kind: this.kindLabel(k), n: this.counts()?.[k] ?? 0 });
  }

  protected foldText(n: number): string {
    return n === 1 ? this.i18n.t('jd.fold.one') : this.i18n.t('jd.fold', { n });
  }

  protected indent(depth: number): string {
    return `${0.5 + depth * 1.1}rem`;
  }

  // ---- navigazione (stessa logica di text-diff) ----

  protected go(delta: 1 | -1): void {
    const n = this.groups();
    if (n === 0) return;
    const next = nextGroup(this.current(), delta, n);
    this.current.set(next);
    const idx = this.view() === 'list' ? next : this.flat().rows.findIndex((r) => r.group === next);
    if (idx >= this.limit()) this.limit.set(idx + 200);
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    const box = this.host.nativeElement.querySelector<HTMLElement>('.viewer');
    // la prima volta si porta in vista il contenitore (l'unico movimento della pagina); poi si scorre solo dentro
    if (!this.navigated) {
      this.navigated = true;
      box?.scrollIntoView({ block: 'start', behavior });
    }
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-group="${next}"]`);
      if (!box || !el) return;
      const c = box.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const top = targetScrollTop({
        scrollTop: box.scrollTop,
        containerTop: c.top + box.clientTop,
        elTop: r.top,
        elHeight: r.height,
        containerHeight: box.clientHeight,
        stickyHeight: box.querySelector<HTMLElement>('.bar')?.offsetHeight ?? 0,
        maxScroll: box.scrollHeight - box.clientHeight,
      });
      box.scrollTo({ top, behavior });
    }, 30);
  }

  protected downloadPatch(): void {
    const p = this.patchText();
    if (p) saveBytes(new Blob([p + '\n'], { type: 'application/json-patch+json;charset=utf-8' }), 'patch.json', 'application/json');
  }
}
