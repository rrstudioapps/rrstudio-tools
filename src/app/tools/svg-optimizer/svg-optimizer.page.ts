// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal, afterNextRender } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SendTo } from '../../shared/send-to';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import {
  DEFAULT_OPTIONS,
  MAX_PRECISION,
  MIN_PRECISION,
  SvgOptions,
  SvgResult,
  byteLength,
  clampPrecision,
  formatBytes,
  optimizeSvg,
  optimizedName,
  svgDataUrl,
  uniqueNames,
} from './svg-opt';
import { SVGO_DICTIONARIES } from './svg-optimizer.i18n';
import { ToolHandoff } from '../../shared/tool-handoff';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 50;

interface Item {
  id: number;
  name: string;
  source: string;
  result: SvgResult | null;
  /** Dati di anteprima (data URL) calcolati una volta sola. */
  beforeUrl: string;
  afterUrl: string;
}

@Component({
  selector: 'app-svg-optimizer',
  imports: [Icon, PrivacyNote, FileDrop, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './svg-optimizer.page.html',
  styleUrl: './svg-optimizer.page.scss',
})
export class SvgOptimizerPage {
  protected readonly i18n = inject(I18nService);
  protected readonly minPrecision = MIN_PRECISION;
  protected readonly maxPrecision = MAX_PRECISION;

  protected readonly options = signal<SvgOptions>({ ...DEFAULT_OPTIONS });
  protected readonly items = signal<Item[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly pasteText = signal('');
  protected readonly messages = signal<string[]>([]);
  protected readonly busy = signal(false);

  private nextId = 1;
  private runToken = 0;

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    const list = this.items();
    return list.find((i) => i.id === id) ?? list[0] ?? null;
  });
  protected readonly selectedOk = computed(() => {
    const r = this.selected()?.result;
    return r && r.ok ? r : null;
  });
  protected readonly totals = computed(() => {
    let before = 0;
    let after = 0;
    let n = 0;
    for (const i of this.items()) {
      if (i.result?.ok) {
        before += i.result.before;
        after += i.result.after;
        n++;
      }
    }
    return n > 1 && before > 0
      ? { before, after, percent: Math.round(((before - after) / before) * 1000) / 10 }
      : null;
  });
  protected readonly okCount = computed(() => this.items().filter((i) => i.result?.ok).length);

  constructor() {
    this.i18n.register(SVGO_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('svg-optimizer');
    if (rx?.text !== undefined) {
      this.pasteText.set(rx.text);
      afterNextRender(() => void this.addPasted());
    }
  }

  protected size(n: number): string {
    return formatBytes(n);
  }

  protected errorText(r: SvgResult): string {
    return r.ok ? '' : this.i18n.t('svgo.err.' + r.error, { detail: r.detail ?? '' });
  }

  protected totalsText(): string {
    const t = this.totals();
    return t ? this.i18n.t('svgo.total', { before: formatBytes(t.before), after: formatBytes(t.after), p: t.percent }) : '';
  }

  // ---- ingresso ----
  protected async onFiles(files: File[]): Promise<void> {
    const msgs: string[] = [];
    const room = MAX_FILES - this.items().length;
    if (files.length > room) msgs.push(this.i18n.t('svgo.err.count', { n: MAX_FILES }));
    const added: Item[] = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      if (!/\.svg$/i.test(f.name) && f.type !== 'image/svg+xml') {
        msgs.push(this.i18n.t('svgo.err.type', { name: f.name }));
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        msgs.push(this.i18n.t('svgo.err.size', { name: f.name }));
        continue;
      }
      try {
        added.push(this.makeItem(f.name, await f.text()));
      } catch {
        msgs.push(this.i18n.t('svgo.err.read', { name: f.name }));
      }
    }
    this.messages.set(msgs);
    if (added.length) await this.addItems(added);
  }

  protected async addPasted(): Promise<void> {
    const text = this.pasteText();
    if (text.trim() === '') return;
    if (this.items().length >= MAX_FILES) {
      this.messages.set([this.i18n.t('svgo.err.count', { n: MAX_FILES })]);
      return;
    }
    this.messages.set([]);
    await this.addItems([this.makeItem('pasted.svg', text)]);
    this.pasteText.set('');
  }

  private makeItem(name: string, source: string): Item {
    return { id: this.nextId++, name, source, result: null, beforeUrl: svgDataUrl(source), afterUrl: '' };
  }

  private async addItems(added: Item[]): Promise<void> {
    this.items.update((l) => [...l, ...added]);
    if (this.selectedId() === null) this.selectedId.set(added[0].id);
    await this.optimizeAll(added.map((a) => a.id));
  }

  // ---- elaborazione ----
  protected setOption<K extends keyof SvgOptions>(key: K, value: SvgOptions[K]): void {
    this.options.update((o) => ({ ...o, [key]: value }));
    void this.optimizeAll();
  }

  protected setPrecision(v: string): void {
    this.setOption('precision', clampPrecision(Number(v)));
  }

  /** Rielabora gli elementi indicati (o tutti), dimenticando i risultati se nel frattempo cambiano le opzioni. */
  private async optimizeAll(only?: number[]): Promise<void> {
    const token = ++this.runToken;
    const opts = this.options();
    this.busy.set(true);
    const ids = only ?? this.items().map((i) => i.id);
    const done = new Map<number, { result: SvgResult; afterUrl: string }>();
    for (const id of ids) {
      const item = this.items().find((i) => i.id === id);
      if (!item) continue;
      const result = await optimizeSvg(item.source, opts);
      if (token !== this.runToken && !only) return; // un'altra rielaborazione completa è partita
      done.set(id, { result, afterUrl: result.ok ? svgDataUrl(result.data) : '' });
    }
    this.items.update((l) => l.map((i) => (done.has(i.id) ? { ...i, ...done.get(i.id)! } : i)));
    if (token === this.runToken) this.busy.set(false);
  }

  // ---- azioni ----
  protected select(id: number): void {
    this.selectedId.set(id);
  }

  protected remove(id: number): void {
    this.items.update((l) => l.filter((i) => i.id !== id));
    if (this.selectedId() === id) this.selectedId.set(this.items()[0]?.id ?? null);
  }

  protected clear(): void {
    this.items.set([]);
    this.selectedId.set(null);
    this.messages.set([]);
  }

  protected downloadOne(item: Item): void {
    if (!item.result?.ok) return;
    saveBytes(new TextEncoder().encode(item.result.data), optimizedName(item.name), 'image/svg+xml');
  }

  protected async downloadZip(): Promise<void> {
    const ok = this.items().filter((i) => i.result?.ok);
    if (!ok.length) return;
    const { zipSync } = await import('fflate');
    const names = uniqueNames(ok.map((i) => optimizedName(i.name)));
    const files: Record<string, Uint8Array> = {};
    ok.forEach((i, n) => {
      files[names[n]] = new TextEncoder().encode((i.result as Extract<SvgResult, { ok: true }>).data);
    });
    saveBytes(zipSync(files), this.i18n.t('svgo.zip.name'), 'application/zip');
  }

  protected savedText(r: SvgResult | null): string {
    if (!r || !r.ok) return '';
    return r.savedBytes > 0 ? this.i18n.t('svgo.saved', { p: r.savedPercent }) : this.i18n.t('svgo.grew');
  }

  protected bytes(text: string): number {
    return byteLength(text);
  }
}
