// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { formatBytes, textStats } from '../../shared/text-stats';
import {
  Base64Error,
  DecodeResult,
  bytesToBase64,
  decodeInput,
  detectFileKind,
  encodeText,
  toDataUrl,
} from './base64';
import { BASE64_DICTIONARIES } from './base64.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './base64.share';

type Mode = 'encode' | 'decode';

/** Dimensione massima del file da codificare. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Oltre questa lunghezza l'output a schermo viene troncato (la copia resta completa). */
const MAX_SHOWN = 200_000;

interface LoadedFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

@Component({
  selector: 'app-base64',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base64.page.html',
  styleUrl: './base64.page.scss',
})
export class Base64Page {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('encode');
  protected readonly input = signal('');
  protected readonly urlSafe = signal(false);
  protected readonly asDataUrl = signal(false);
  protected readonly file = signal<LoadedFile | null>(null);
  private readonly fileError = signal<'toolarge' | 'read' | null>(null);
  protected readonly previewUrl = signal<string | null>(null);

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'encode', label: this.i18n.t('b64.mode.encode') },
    { value: 'decode', label: this.i18n.t('b64.mode.decode') },
  ]);

  /** Risultato della conversione corrente (output completo, errore, dati decodificati). */
  private readonly result = computed(() => {
    const mode = this.mode();
    const file = this.file();
    if (mode === 'encode') {
      if (file) {
        const output = this.asDataUrl()
          ? toDataUrl(file.bytes, file.mime)
          : bytesToBase64(file.bytes, this.urlSafe());
        return { output, error: null, decoded: null as DecodeResult | null };
      }
      return { output: encodeText(this.input(), this.urlSafe()), error: null, decoded: null };
    }
    const src = this.input();
    if (!src.trim()) return { output: '', error: null, decoded: null };
    try {
      const decoded = decodeInput(src);
      return { output: decoded.text ?? '', error: null, decoded };
    } catch (e) {
      return { output: '', error: e instanceof Base64Error ? e : new Base64Error('chars'), decoded: null };
    }
  });

  protected readonly decoded = computed(() => this.result().decoded);
  /** Dati binari in decodifica: nessun testo da mostrare. */
  protected readonly isBinary = computed(() => {
    const d = this.decoded();
    return d !== null && d.text === null;
  });
  protected readonly fullOutput = computed(() => this.result().output);

  protected readonly shownOutput = computed(() => {
    const d = this.decoded();
    if (d && d.text === null) {
      const type = d.mime ? ` · ${d.mime}` : '';
      return this.i18n.t('b64.binary', {
        size: formatBytes(d.bytes.length, this.i18n.locale()),
        type,
      });
    }
    const full = this.fullOutput();
    return full.length > MAX_SHOWN ? full.slice(0, MAX_SHOWN) : full;
  });

  protected readonly truncatedNote = computed(() => {
    const total = this.fullOutput().length;
    if (this.isBinary() || total <= MAX_SHOWN) return '';
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('b64.truncated', { shown: nf.format(MAX_SHOWN), total: nf.format(total) });
  });

  protected readonly errorMessage = computed(() => {
    const fe = this.fileError();
    if (fe) return this.i18n.t(fe === 'toolarge' ? 'b64.err.toolarge' : 'b64.err.read');
    const e = this.result().error;
    if (!e) return '';
    return this.i18n.t(`b64.err.${e.code}`, { ch: e.detail });
  });

  protected readonly inputMeta = computed(() => {
    const file = this.file();
    if (this.mode() === 'encode' && file) {
      return `${file.name} · ${formatBytes(file.bytes.length, this.i18n.locale())}`;
    }
    return this.counter(this.input());
  });

  protected readonly outputMeta = computed(() => {
    const d = this.decoded();
    if (d && d.text === null) return formatBytes(d.bytes.length, this.i18n.locale());
    return this.counter(this.fullOutput());
  });

  /** Dati scaricabili: il risultato di una decodifica che è un file. */
  protected readonly download = computed(() => {
    const d = this.decoded();
    return d && d.asFile ? d : null;
  });

  /** Sorgente dell'anteprima, se il contenuto è un'immagine. */
  private readonly previewSource = computed(() => {
    const file = this.file();
    if (this.mode() === 'encode' && file) {
      const mime = file.mime || detectFileKind(file.bytes)?.mime || '';
      return mime.startsWith('image/') ? { bytes: file.bytes, mime } : null;
    }
    const d = this.decoded();
    return d?.mime?.startsWith('image/') ? { bytes: d.bytes, mime: d.mime } : null;
  });

  protected readonly canSwap = computed(() => {
    if (this.file() !== null && this.mode() === 'encode') return false;
    if (this.errorMessage() || this.isBinary()) return false;
    return this.fullOutput().length > 0;
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    input: this.input,
    urlSafe: this.urlSafe,
    asDataUrl: this.asDataUrl,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(BASE64_DICTIONARIES);
    // L'anteprima usa un object URL, revocato quando cambia il contenuto o si chiude la pagina
    effect((onCleanup) => {
      const src = this.previewSource();
      if (!src) {
        this.previewUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(new Blob([src.bytes as BlobPart], { type: src.mime }));
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  private counter(text: string): string {
    const s = textStats(text);
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('common.counter', { chars: nf.format(s.chars), bytes: nf.format(s.bytes) });
  }

  protected onInput(e: Event): void {
    this.fileError.set(null);
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.fileError.set(null);
  }

  protected swap(): void {
    if (!this.canSwap()) return;
    const out = this.fullOutput();
    this.mode.update((m) => (m === 'encode' ? 'decode' : 'encode'));
    this.input.set(out);
  }

  protected clear(): void {
    this.input.set('');
    this.file.set(null);
    this.fileError.set(null);
  }

  protected removeFile(): void {
    this.file.set(null);
    this.fileError.set(null);
  }

  protected async onFile(f: File): Promise<void> {
    this.fileError.set(null);
    if (f.size > MAX_FILE_BYTES) {
      this.fileError.set('toolarge');
      return;
    }
    try {
      const bytes = await readFile(f);
      this.mode.set('encode');
      this.input.set('');
      this.file.set({ name: f.name, mime: f.type, bytes });
    } catch {
      this.fileError.set('read');
    }
  }

  protected downloadFile(): void {
    const d = this.download();
    if (!d) return;
    const blob = new Blob([d.bytes as BlobPart], { type: d.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file.${d.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function readFile(f: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(f);
  });
}
