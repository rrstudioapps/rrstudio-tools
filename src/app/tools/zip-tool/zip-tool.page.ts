// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { formatBytes } from '../../shared/text-stats';
import {
  LIMITS, ZIP_LEVELS, ZipError, archiveName, cleanInputPath, createZip, extractEntry, extractable, filterEntries, formatLimit, listZip, uniquePaths,
  type ZipEntry, type ZipInput, type ZipLevel,
} from './zip-tool';
import { ZIP_DICTIONARIES } from './zip-tool.i18n';
import { SHARE_SCHEMA } from './zip-tool.share';

type Mode = 'create' | 'extract';
interface Item {
  id: number;
  path: string;
  file: File;
}

/** Righe mostrate al massimo nella tabella del contenuto (con 20.000 voci il resto si raggiunge con la ricerca). */
const MAX_ROWS = 500;

@Component({
  selector: 'app-zip-tool',
  imports: [FileDrop, Icon, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zip-tool.page.html',
  styleUrl: './zip-tool.page.scss',
})
export class ZipToolPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('create');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'create', label: this.i18n.t('zip.mode.create') },
    { value: 'extract', label: this.i18n.t('zip.mode.extract') },
  ]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');

  // ---- crea ----
  protected readonly items = signal<Item[]>([]);
  private nextId = 1;
  protected readonly level = signal<ZipLevel>(6);
  protected readonly levels = computed<SegmentOption<string>[]>(() => ZIP_LEVELS.map((l) => ({ value: String(l), label: this.i18n.t('zip.level.' + l) })));
  protected readonly levelKey = computed(() => String(this.level()));
  protected readonly name = signal('archivio');
  protected readonly totalBytes = computed(() => this.items().reduce((n, i) => n + i.file.size, 0));

  // ---- estrai ----
  protected readonly archiveFile = signal('');
  protected readonly entries = signal<ZipEntry[]>([]);
  protected readonly opened = signal(false);
  private data: Uint8Array | null = null;
  protected readonly query = signal('');
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly filtered = computed(() => filterEntries(this.entries(), this.query()));
  protected readonly shown = computed(() => this.filtered().slice(0, MAX_ROWS));
  protected readonly maxRows = MAX_ROWS;
  protected readonly unsafeCount = computed(() => this.entries().filter((e) => !e.safe).length);
  protected readonly hasEncrypted = computed(() => this.entries().some((e) => e.encrypted));
  protected readonly expandedBytes = computed(() => this.entries().reduce((n, e) => n + e.size, 0));
  protected readonly archiveBytes = signal(0);
  protected readonly extractableAll = computed(() => this.entries().filter(extractable));
  protected readonly selectedList = computed(() => this.entries().filter((e) => this.selected().has(e.index) && extractable(e)));
  protected readonly allVisibleSelected = computed(() => {
    const vis = this.shown().filter(extractable);
    return vis.length > 0 && vis.every((e) => this.selected().has(e.index));
  });

  // ---- link condivisibile ----
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({ mode: this.mode(), level: this.level(), name: this.name().slice(0, 100) });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    if (s['mode'] === 'create' || s['mode'] === 'extract') this.mode.set(s['mode']);
    if (ZIP_LEVELS.includes(s['level'] as ZipLevel)) this.level.set(s['level'] as ZipLevel);
    if (typeof s['name'] === 'string') this.name.set(s['name'].slice(0, 100));
  }

  constructor() {
    this.i18n.register(ZIP_DICTIONARIES);
  }

  protected setLevel(v: string): void {
    const n = Number(v) as ZipLevel;
    if (ZIP_LEVELS.includes(n)) this.level.set(n);
  }

  protected setMode(m: Mode): void {
    this.mode.set(m);
    this.error.set('');
    this.status.set('');
  }

  protected size(bytes: number): string {
    return formatBytes(bytes, this.i18n.locale());
  }
  protected date(d: Date | null): string {
    return d ? new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'short', timeStyle: 'short' }).format(d) : '';
  }
  protected stateOf(e: ZipEntry): string {
    if (!e.safe) return this.i18n.t('zip.state.unsafe');
    if (e.encrypted) return this.i18n.t('zip.state.encrypted');
    if (!e.dir && e.method !== 0 && e.method !== 8) return this.i18n.t('zip.state.unsupported');
    return e.dir ? this.i18n.t('zip.dir') : '';
  }
  /** Messaggio per un errore della libreria ZIP. */
  private message(e: unknown, fallbackKey: string): string {
    if (e instanceof ZipError) {
      const params = { max: formatLimit(e.code === 'tooBigCompressed' ? LIMITS.maxCompressed : e.code === 'tooBigExpanded' ? LIMITS.maxExpanded : LIMITS.maxEntries) };
      if (e.code === 'tooManyEntries') params.max = LIMITS.maxEntries.toLocaleString(this.i18n.locale());
      return this.i18n.t('zip.err.' + e.code, params);
    }
    return this.i18n.t(fallbackKey);
  }

  // ---- crea ----
  protected addFiles(list: File[]): void {
    this.error.set('');
    this.status.set('');
    if (this.mode() !== 'create') return;
    const current = this.items();
    const added: Item[] = [];
    let total = this.totalBytes();
    let tooMany = false;
    let tooBig = false;
    for (const file of list) {
      if (current.length + added.length >= LIMITS.maxEntries) {
        tooMany = true;
        break;
      }
      if (total + file.size > LIMITS.maxExpanded) {
        tooBig = true;
        continue;
      }
      total += file.size;
      added.push({ id: this.nextId++, path: cleanInputPath(file.webkitRelativePath || file.name), file });
    }
    if (added.length) this.items.set([...current, ...added]);
    if (tooMany) this.error.set(this.i18n.t('zip.err.tooManyFiles', { max: LIMITS.maxEntries.toLocaleString(this.i18n.locale()) }));
    else if (tooBig) this.error.set(this.i18n.t('zip.err.tooBigInput', { max: formatLimit(LIMITS.maxExpanded) }));
  }
  protected onFolder(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }
  protected removeItem(id: number): void {
    this.items.update((l) => l.filter((i) => i.id !== id));
  }
  protected clearItems(): void {
    this.items.set([]);
    this.error.set('');
    this.status.set('');
  }

  protected async create(): Promise<void> {
    if (this.busy() || this.items().length === 0) return;
    this.busy.set(true);
    this.error.set('');
    this.status.set('');
    try {
      const inputs: ZipInput[] = [];
      const paths = uniquePaths(this.items().map((i) => i.path));
      for (const [n, item] of this.items().entries()) {
        let buf: ArrayBuffer;
        try {
          buf = await item.file.arrayBuffer();
        } catch {
          this.error.set(this.i18n.t('zip.err.read', { name: item.path }));
          return;
        }
        inputs.push({ path: paths[n], data: new Uint8Array(buf), mtime: item.file.lastModified });
      }
      const out = await createZip(inputs, this.level());
      const file = archiveName(this.name(), this.i18n.lang() === 'en' ? 'archive' : 'archivio');
      saveBytes(out, file, 'application/zip');
      const before = this.totalBytes();
      const saving = before > 0 ? Math.round((1 - out.length / before) * 100) : 0;
      const pct = `${saving > 0 ? '−' : saving < 0 ? '+' : ''}${Math.abs(saving)}%`;
      this.status.set(this.i18n.t('zip.created', { name: file, before: this.size(before), after: this.size(out.length), pct }));
    } catch (e) {
      this.error.set(this.message(e, 'zip.err.create'));
    } finally {
      this.busy.set(false);
    }
  }

  // ---- estrai ----
  protected async openArchive(list: File[]): Promise<void> {
    const file = list[0];
    if (!file || this.mode() !== 'extract') return;
    this.error.set('');
    this.status.set('');
    this.opened.set(false);
    this.entries.set([]);
    this.selected.set(new Set());
    this.query.set('');
    this.data = null;
    if (file.size > LIMITS.maxCompressed) {
      this.error.set(this.i18n.t('zip.err.tooBigCompressed', { max: formatLimit(LIMITS.maxCompressed) }));
      return;
    }
    this.busy.set(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const entries = listZip(bytes);
      this.data = bytes;
      this.archiveBytes.set(bytes.length);
      this.archiveFile.set(file.name);
      this.entries.set(entries);
      this.opened.set(true);
    } catch (e) {
      this.error.set(this.message(e, 'zip.err.notZip'));
    } finally {
      this.busy.set(false);
    }
  }

  protected toggle(e: ZipEntry, checked: boolean): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (checked) next.add(e.index);
      else next.delete(e.index);
      return next;
    });
  }
  protected toggleVisible(checked: boolean): void {
    this.selected.update((s) => {
      const next = new Set(s);
      for (const e of this.shown().filter(extractable)) {
        if (checked) next.add(e.index);
        else next.delete(e.index);
      }
      return next;
    });
  }

  protected extractable(e: ZipEntry): boolean {
    return extractable(e);
  }

  protected async downloadOne(e: ZipEntry): Promise<void> {
    if (!this.data || this.busy() || !extractable(e)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const bytes = await extractEntry(this.data, e);
      const base = e.path.slice(e.path.lastIndexOf('/') + 1) || 'file';
      saveBytes(bytes, base, 'application/octet-stream');
    } catch (err) {
      this.error.set(err instanceof ZipError && err.code !== 'corrupt' ? this.message(err, 'zip.err.extract') : this.i18n.t('zip.err.extract', { name: e.name }));
    } finally {
      this.busy.set(false);
    }
  }

  protected downloadSelected(): Promise<void> {
    return this.downloadAsZip(this.selectedList(), 'zip.suffix.selected');
  }
  protected downloadAll(): Promise<void> {
    return this.downloadAsZip(this.extractableAll(), 'zip.suffix.all');
  }

  private async downloadAsZip(list: ZipEntry[], suffixKey: string): Promise<void> {
    if (!this.data || this.busy()) return;
    this.error.set('');
    this.status.set('');
    if (list.length === 0) {
      this.error.set(this.i18n.t('zip.nothing'));
      return;
    }
    this.busy.set(true);
    try {
      const inputs: ZipInput[] = [];
      for (const e of list) inputs.push({ path: e.path, data: await extractEntry(this.data, e), mtime: e.date?.getTime() });
      const out = await createZip(inputs, 6);
      const stem = this.archiveFile().replace(/\.zip$/i, '') || 'archivio';
      const file = archiveName(`${stem}-${this.i18n.t(suffixKey)}`);
      saveBytes(out, file, 'application/zip');
      this.status.set(this.i18n.t('zip.extracted', { name: file, n: list.length }));
    } catch (e) {
      this.error.set(this.message(e, 'zip.err.extract'));
    } finally {
      this.busy.set(false);
    }
  }
}
