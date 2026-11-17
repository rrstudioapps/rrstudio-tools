// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { textStats } from '../../shared/text-stats';
import { DiffClient, StaleDiff } from './diff-client';
import { DEFAULT_OPTIONS, DiffModel, DiffOptions, Row, Seg, toUnifiedDiff } from './diff-core';
import { DIFF_DICTIONARIES } from './text-diff.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './text-diff.share';

type View = 'side' | 'inline';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CONTEXT = 3;
const PAGE_ROWS = 1500;

/** Riga mostrata nella vista in linea. */
interface InlineLine {
  kind: 'eq' | 'del' | 'ins';
  aNo?: number;
  bNo?: number;
  segs: Seg[];
  group: number;
}

type Shown<T> = { fold: false; line: T; first: boolean } | { fold: true; id: number; count: number };

@Component({
  selector: 'app-text-diff',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-diff.page.html',
  styleUrl: './text-diff.page.scss',
})
export class TextDiffPage {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly client = new DiffClient();

  protected readonly textA = signal('');
  protected readonly textB = signal('');
  protected readonly nameA = signal('');
  protected readonly nameB = signal('');
  protected readonly ignoreWs = signal(false);
  protected readonly ignoreCase = signal(false);
  protected readonly ignoreBlank = signal(false);
  protected readonly granularity = signal<'word' | 'char'>('word');
  protected readonly view = signal<View>('side');
  protected readonly collapse = signal(true);
  protected readonly fileError = signal(false);
  protected readonly model = signal<DiffModel | null>(null);
  protected readonly busy = signal(false);
  protected readonly current = signal(-1);
  protected readonly limit = signal(PAGE_ROWS);
  private readonly expanded = signal<ReadonlySet<number>>(new Set());

  protected readonly options = computed<DiffOptions>(() => ({
    ...DEFAULT_OPTIONS,
    ignoreWhitespace: this.ignoreWs(),
    ignoreCase: this.ignoreCase(),
    ignoreBlank: this.ignoreBlank(),
    granularity: this.granularity(),
  }));

  protected readonly viewOptions = computed<SegmentOption<View>[]>(() => [
    { value: 'side', label: this.i18n.t('diff.view.side') },
    { value: 'inline', label: this.i18n.t('diff.view.inline') },
  ]);
  protected readonly detailOptions = computed<SegmentOption<'word' | 'char'>[]>(() => [
    { value: 'word', label: this.i18n.t('diff.detail.word') },
    { value: 'char', label: this.i18n.t('diff.detail.char') },
  ]);

  protected readonly metaA = computed(() => this.counter(this.textA()));
  protected readonly metaB = computed(() => this.counter(this.textB()));
  protected readonly hasInput = computed(() => this.textA() !== '' || this.textB() !== '');

  protected readonly stats = computed(() => this.model()?.stats ?? null);
  protected readonly groups = computed(() => this.stats()?.groups ?? 0);
  protected readonly patch = computed(() => {
    const m = this.model();
    if (!m) return '';
    return toUnifiedDiff(m, this.nameA() || this.i18n.t('diff.patch.a'), this.nameB() || this.i18n.t('diff.patch.b'));
  });

  /** Righe della vista affiancata, con le parti uguali lontane dalle modifiche raccolte in una riga "nascoste". */
  protected readonly sideItems = computed<Shown<Row>[]>(() => {
    const m = this.model();
    if (!m) return [];
    return this.fold(m.rows, (r) => r.group);
  });

  protected readonly inlineItems = computed<Shown<InlineLine>[]>(() => {
    const m = this.model();
    if (!m) return [];
    const lines: InlineLine[] = [];
    let i = 0;
    while (i < m.rows.length) {
      const r = m.rows[i];
      if (r.kind === 'eq') {
        lines.push({ kind: 'eq', aNo: r.aNo, bNo: r.bNo, segs: [{ text: r.a ?? '', changed: false }], group: -1 });
        i++;
        continue;
      }
      const block: Row[] = [];
      while (i < m.rows.length && m.rows[i].group === r.group) block.push(m.rows[i++]);
      for (const x of block) if (x.a !== undefined) lines.push({ kind: 'del', aNo: x.aNo, segs: x.aSegs ?? [{ text: x.a, changed: false }], group: x.group });
      for (const x of block) if (x.b !== undefined) lines.push({ kind: 'ins', bNo: x.bNo, segs: x.bSegs ?? [{ text: x.b, changed: false }], group: x.group });
    }
    return this.fold(lines, (l) => l.group);
  });

  protected readonly items = computed(() => (this.view() === 'side' ? this.sideItems() : this.inlineItems()));
  protected readonly shownSide = computed(() => this.sideItems().slice(0, this.limit()));
  protected readonly shownInline = computed(() => this.inlineItems().slice(0, this.limit()));
  protected readonly remaining = computed(() => Math.max(0, this.items().length - this.limit()));

  protected readonly statsText = computed(() => {
    const s = this.stats();
    if (!s || s.identical) return '';
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('diff.stats', { added: nf.format(s.added), removed: nf.format(s.removed), groups: nf.format(s.groups) });
  });
  protected readonly modifiedText = computed(() => {
    const s = this.stats();
    return s && s.modified > 0 ? this.i18n.t('diff.stats.mod', { n: new Intl.NumberFormat(this.i18n.locale()).format(s.modified) }) : '';
  });
  protected readonly positionText = computed(() =>
    this.current() >= 0 ? this.i18n.t('diff.position', { n: this.current() + 1, total: this.groups() }) : '',
  );

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    textA: this.textA,
    textB: this.textB,
    ignoreWs: this.ignoreWs,
    ignoreCase: this.ignoreCase,
    ignoreBlank: this.ignoreBlank,
    granularity: this.granularity,
    view: this.view,
    collapse: this.collapse,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(DIFF_DICTIONARIES);
    // confronto con un breve ritardo (digitazione), in un worker; le risposte superate vengono scartate
    effect((onCleanup) => {
      const a = this.textA();
      const b = this.textB();
      const options = this.options();
      if (a === '' && b === '') {
        this.model.set(null);
        this.busy.set(false);
        this.current.set(-1);
        return;
      }
      let cancelled = false;
      const timer = setTimeout(() => {
        const slow = setTimeout(() => !cancelled && this.busy.set(true), 150);
        this.client
          .run(a, b, options)
          .then((m) => {
            if (cancelled) return;
            this.model.set(m);
            this.current.set(-1);
            this.limit.set(PAGE_ROWS);
            this.expanded.set(new Set());
          })
          .catch((e) => {
            if (!(e instanceof StaleDiff)) throw e;
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

  private counter(text: string): string {
    const s = textStats(text);
    const nf = new Intl.NumberFormat(this.i18n.locale());
    const lines = text === '' ? 0 : text.split(/\r\n|\n|\r/).length;
    return this.i18n.t('diff.counter', { lines: nf.format(lines), chars: nf.format(s.chars) });
  }

  /** Raccoglie le righe uguali lontane più di CONTEXT dalle modifiche, se "nascondi" è attivo. */
  private fold<T>(lines: readonly T[], groupOf: (l: T) => number): Shown<T>[] {
    const out: Shown<T>[] = [];
    const seenGroups = new Set<number>();
    const mark = (l: T): boolean => {
      const g = groupOf(l);
      if (g < 0 || seenGroups.has(g)) return false;
      seenGroups.add(g);
      return true;
    };
    if (!this.collapse()) {
      return lines.map((l) => ({ fold: false as const, line: l, first: mark(l) }));
    }
    const expanded = this.expanded();
    const near = new Array<boolean>(lines.length).fill(false);
    lines.forEach((l, i) => {
      if (groupOf(l) < 0) return;
      for (let k = Math.max(0, i - CONTEXT); k <= Math.min(lines.length - 1, i + CONTEXT); k++) near[k] = true;
    });
    for (let i = 0; i < lines.length; ) {
      if (near[i] || groupOf(lines[i]) >= 0) {
        out.push({ fold: false, line: lines[i], first: mark(lines[i]) });
        i++;
        continue;
      }
      let j = i;
      while (j < lines.length && !near[j] && groupOf(lines[j]) < 0) j++;
      if (expanded.has(i)) for (let k = i; k < j; k++) out.push({ fold: false, line: lines[k], first: false });
      else out.push({ fold: true, id: i, count: j - i });
      i = j;
    }
    return out;
  }

  protected segs(r: Row, side: 'a' | 'b'): Seg[] {
    const text = side === 'a' ? r.a : r.b;
    const segs = side === 'a' ? r.aSegs : r.bSegs;
    return segs ?? (text !== undefined ? [{ text, changed: false }] : []);
  }

  protected expand(id: number): void {
    this.expanded.update((s) => new Set([...s, id]));
  }

  protected showMore(): void {
    this.limit.update((l) => l + PAGE_ROWS);
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
  }

  protected loadSample(): void {
    this.textA.set(this.i18n.t('diff.sample.a'));
    this.textB.set(this.i18n.t('diff.sample.b'));
    this.nameA.set('');
    this.nameB.set('');
  }

  // ---- navigazione ----

  protected go(delta: 1 | -1): void {
    const n = this.groups();
    if (n === 0) return;
    const cur = this.current();
    const next = cur < 0 ? (delta === 1 ? 0 : n - 1) : (cur + delta + n) % n;
    this.current.set(next);
    const idx = this.items().findIndex((it) => !it.fold && it.first && this.groupOf(it.line) === next);
    if (idx >= this.limit()) this.limit.set(idx + 200);
    // il DOM si aggiorna al ciclo successivo: si cerca la riga dopo il rendering
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-group="${next}"]`);
      el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 30);
  }

  private groupOf(line: Row | InlineLine): number {
    return line.group;
  }

  protected downloadPatch(): void {
    const p = this.patch();
    if (p) saveBytes(new Blob([p], { type: 'text/x-diff;charset=utf-8' }), 'diff.patch', 'text/x-diff');
  }
}
