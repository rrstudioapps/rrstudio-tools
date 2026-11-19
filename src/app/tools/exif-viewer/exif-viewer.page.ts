// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { safeFileName, saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { inspectImage, isHeic, isSupportedImage } from '../images-pdf/image-prepare';
import { cleanImage } from './exif-clean';
import { Group, Gps, Sensitive, buildGroups, formatAccuracy, formatCoords, osmUrl, otherTagCount, readGps, sensitiveFlags } from './exif-format';
import { PhotoMeta, countFields, readMetadata } from './exif-parser';
import { rotatePixels } from './exif-rotate';
import { EXIF_DICTIONARIES } from './exif-viewer.i18n';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

const MAX_FILES = 30;
const MAX_BYTES = 50 * 1024 * 1024;
const pause = () => new Promise<void>((r) => setTimeout(r, 0));

interface Cleaned {
  bytes: Uint8Array;
  fieldsAfter: number;
  /** Come è stata ottenuta la copia pulita. */
  how: 'plain' | 'kept' | 'rotated';
}

interface Photo {
  uid: number;
  file: File;
  name: string;
  size: number;
  meta: PhotoMeta;
  fields: number;
  gps: Gps | null;
  sensitive: Sensitive[];
  other: number;
  preview: string;
  thumb: string;
  cleaned: Cleaned | null;
}

@Component({
  selector: 'app-exif-viewer',
  imports: [Icon, PrivacyNote, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exif-viewer.page.html',
  styleUrl: './exif-viewer.page.scss',
})
export class ExifViewerPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly maxFiles = MAX_FILES;

  protected readonly photos = signal<Photo[]>([]);
  protected readonly notices = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly announcement = signal('');
  /** Come trattare le foto con orientamento diverso dal normale. */
  protected readonly orientMode = signal<'keep' | 'rotate'>('keep');
  private nextUid = 1;

  protected readonly hasRotated = computed(() => this.photos().some((p) => p.meta.orientation !== 1));
  protected readonly anyCleaned = computed(() => this.photos().filter((p) => p.cleaned).length);
  protected readonly anyDirty = computed(() => this.photos().some((p) => !p.cleaned));

  constructor() {
    this.i18n.register(EXIF_DICTIONARIES);
    // immagini ricevute da un altro strumento: stessa strada del file-drop
    const rx = inject(ToolHandoff).take('exif-viewer');
    if (rx?.files?.length) afterNextRender(() => void this.onFiles(rx.files!));
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    for (const p of this.photos()) this.revoke(p);
    this.photos.set([]);
  }

  private revoke(p: Photo): void {
    if (p.preview) URL.revokeObjectURL(p.preview);
    if (p.thumb) URL.revokeObjectURL(p.thumb);
  }

  private announce(text: string): void {
    this.announcement.set(text);
  }

  protected async onFiles(files: File[]): Promise<void> {
    if (!this.isBrowser || this.busy()) return;
    this.busy.set(true);
    this.status.set(this.i18n.t('ex.loading'));
    const notes: string[] = [];
    let added = 0;
    try {
      for (const file of files) {
        const name = file.name;
        if (isHeic(file)) notes.push(this.i18n.t('ex.err.heic', { name }));
        else if (!isSupportedImage(file)) notes.push(this.i18n.t('ex.err.type', { name }));
        else if (file.size > MAX_BYTES) notes.push(this.i18n.t('ex.err.size', { name }));
        else if (this.photos().length >= MAX_FILES) notes.push(this.i18n.t('ex.err.count', { name, max: MAX_FILES }));
        else {
          try {
            const photo = await this.readPhoto(file);
            this.photos.update((l) => [...l, photo]);
            added++;
          } catch (e) {
            const heic = (e as { kind?: string })?.kind === 'heic';
            notes.push(this.i18n.t(heic ? 'ex.err.heic' : 'ex.err.read', { name }));
          }
        }
        await pause();
      }
    } finally {
      this.busy.set(false);
      this.status.set('');
      this.notices.set(notes);
      if (added > 0) this.announce(this.i18n.t('ex.say.added', { n: added, total: this.photos().length }));
    }
  }

  private async readPhoto(file: File): Promise<Photo> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const meta = readMetadata(bytes); // lancia per HEIC e formati sconosciuti
    let preview = '';
    try {
      preview = (await inspectImage(file)).thumbUrl;
    } catch {
      /* anteprima non disponibile: restano i metadati */
    }
    const thumb = meta.thumbnail ? URL.createObjectURL(new Blob([meta.thumbnail as BlobPart], { type: 'image/jpeg' })) : '';
    return {
      uid: this.nextUid++,
      file,
      name: file.name,
      size: file.size,
      meta,
      fields: countFields(meta),
      gps: readGps(meta),
      sensitive: sensitiveFlags(meta),
      other: otherTagCount(meta),
      preview,
      thumb,
      cleaned: null,
    };
  }

  protected removePhoto(p: Photo): void {
    this.revoke(p);
    this.photos.update((l) => l.filter((x) => x.uid !== p.uid));
    this.announce(this.i18n.t('ex.say.removed', { name: p.name }));
  }

  protected reset(): void {
    this.release();
    this.notices.set([]);
    this.announce(this.i18n.t('ex.say.cleared'));
  }

  // ---- pulizia ----
  private async cleanOne(p: Photo): Promise<Cleaned> {
    const bytes = new Uint8Array(await p.file.arrayBuffer());
    const rotate = p.meta.orientation !== 1 && this.orientMode() === 'rotate';
    if (rotate) {
      const out = await rotatePixels(bytes, p.meta.format);
      return { bytes: out, fieldsAfter: countFields(readMetadata(out)), how: 'rotated' };
    }
    const keep = p.meta.orientation !== 1;
    const out = cleanImage(bytes, { keepOrientation: keep, orientation: p.meta.orientation });
    return { bytes: out, fieldsAfter: countFields(readMetadata(out)), how: keep ? 'kept' : 'plain' };
  }

  private async cleanMany(targets: Photo[]): Promise<void> {
    if (this.busy() || targets.length === 0) return;
    this.busy.set(true);
    const notes: string[] = [];
    let done = 0;
    try {
      for (const p of targets) {
        try {
          const cleaned = await this.cleanOne(p);
          this.photos.update((l) => l.map((x) => (x.uid === p.uid ? { ...x, cleaned } : x)));
          done++;
        } catch {
          notes.push(this.i18n.t(p.meta.orientation !== 1 && this.orientMode() === 'rotate' ? 'ex.err.rotate' : 'ex.err.clean', { name: p.name }));
        }
        await pause();
      }
    } finally {
      this.busy.set(false);
      this.notices.set(notes);
      if (done === 1 && targets.length === 1) this.announce(this.i18n.t('ex.say.cleaned', { name: targets[0].name }));
      else if (done > 0) this.announce(this.i18n.t('ex.say.cleanedAll', { n: done }));
    }
  }

  protected cleanPhoto(p: Photo): Promise<void> {
    return this.cleanMany([p]);
  }

  protected cleanAll(): Promise<void> {
    return this.cleanMany(this.photos().filter((p) => !p.cleaned));
  }

  /** Cambiando la scelta sull'orientamento le copie già fatte vanno rifatte. */
  protected setOrientMode(m: 'keep' | 'rotate'): void {
    if (m === this.orientMode()) return;
    this.orientMode.set(m);
    this.photos.update((l) => l.map((p) => (p.meta.orientation !== 1 ? { ...p, cleaned: null } : p)));
  }

  protected cleanName(p: Photo): string {
    const dot = p.name.lastIndexOf('.');
    const stem = dot > 0 ? p.name.slice(0, dot) : p.name;
    const ext = dot > 0 ? p.name.slice(dot) : `.${p.meta.format === 'jpeg' ? 'jpg' : p.meta.format}`;
    return safeFileName(`${stem}-${this.i18n.t('ex.suffix')}${ext}`, `foto.${p.meta.format}`);
  }

  private mime(p: Photo): string {
    return `image/${p.meta.format}`;
  }

  /** Le foto ripulite come file, per "Invia a…". */
  protected readonly cleanedFiles = (): File[] =>
    this.photos()
      .filter((p) => p.cleaned)
      .map((p) => new File([p.cleaned!.bytes as BlobPart], this.cleanName(p), { type: this.mime(p) }));

  protected download(p: Photo): void {
    if (p.cleaned) saveBytes(p.cleaned.bytes, this.cleanName(p), this.mime(p));
  }

  protected async downloadZip(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      const used = new Set<string>();
      for (const p of this.photos()) {
        if (!p.cleaned) continue;
        let name = this.cleanName(p);
        for (let n = 2; used.has(name.toLowerCase()); n++) name = this.cleanName(p).replace(/(\.[^.]+)?$/, ` (${n})$1`);
        used.add(name.toLowerCase());
        files[name] = p.cleaned.bytes;
      }
      saveBytes(zipSync(files, { level: 0 }), `${this.i18n.t('ex.zip.name')}.zip`, 'application/zip');
    } catch {
      this.notices.set([this.i18n.t('ex.err.zip')]);
    } finally {
      this.busy.set(false);
    }
  }

  // ---- testi per il template ----
  protected groups(p: Photo): Group[] {
    return buildGroups(p.meta, (k, params) => this.i18n.t(k, params), this.i18n.locale());
  }

  protected fieldsText(n: number): string {
    return n === 1 ? this.i18n.t('ex.fields.one') : this.i18n.t('ex.fields', { n });
  }

  protected coords(g: Gps): string {
    return formatCoords(g);
  }

  protected osm(g: Gps): string {
    return osmUrl(g);
  }

  protected accuracy(g: Gps): string {
    return formatAccuracy(g, (k, params) => this.i18n.t(k, params), this.i18n.locale());
  }

  protected altitude(g: Gps): string {
    return g.altitude === null ? '' : `${new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 0 }).format(g.altitude)} m`;
  }

  protected size(n: number): string {
    const nf = new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 });
    if (n < 1024) return this.i18n.t('ex.bytes', { n });
    if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
    return `${nf.format(n / 1024 / 1024)} MB`;
  }

  protected saved(p: Photo): string {
    const diff = p.size - (p.cleaned?.bytes.length ?? p.size);
    return this.i18n.t('ex.result.saved', { bytes: new Intl.NumberFormat(this.i18n.locale()).format(Math.max(0, diff)) });
  }

  protected sensitiveText(f: Sensitive): string {
    return this.i18n.t(`ex.warn.${f}`);
  }
}
