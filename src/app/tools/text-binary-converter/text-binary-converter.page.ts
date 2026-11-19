// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { TBIN_DICTIONARIES } from './text-binary-converter.i18n';
import { SHARE_SCHEMA } from './text-binary-converter.share';
import {
  BYTE_FORMATS, ENCODINGS, HEX_DUMP_BYTES, MAX_CHARS, MAX_FILE_BYTES, SEPARATORS, TABLE_ROWS,
  charTable, decodeBytes, encodeText, formatBytes, hexDump, parseBytes, textStats,
  type ByteFormat, type Encoding, type SeparatorKind,
} from './text-binary-converter';

type Direction = 'toBytes' | 'toText';

interface LoadedFile {
  name: string;
  size: number;
  bytes: Uint8Array;
}

/** Stato calcolato della conversione: byte, testo e messaggi. */
interface Model {
  bytes: Uint8Array;
  text: string;
  error: string;
  warning: string;
}

const EMPTY = new Uint8Array(0);

@Component({
  selector: 'app-text-binary-converter',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-binary-converter.page.html',
  styleUrl: './text-binary-converter.page.scss',
})
export class TextBinaryConverterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly direction = signal<Direction>('toBytes');
  protected readonly format = signal<ByteFormat>('hex');
  protected readonly encoding = signal<Encoding>('utf-8');
  protected readonly separator = signal<SeparatorKind>('space');
  protected readonly uppercase = signal(true);
  protected readonly group = signal('1');
  protected readonly pad = signal(true);
  protected readonly perLine = signal(0);
  protected readonly replace = signal(false);
  protected readonly bom = signal(false);
  protected readonly file = signal<LoadedFile | null>(null);
  protected readonly fileError = signal('');

  protected readonly formats = BYTE_FORMATS;
  protected readonly encodings = ENCODINGS;
  protected readonly tableRows = TABLE_ROWS;

  protected readonly directionOptions = computed<SegmentOption<Direction>[]>(() => [
    { value: 'toBytes', label: this.i18n.t('tbin.dir.toBytes') },
    { value: 'toText', label: this.i18n.t('tbin.dir.toText') },
  ]);
  protected readonly formatOptions = computed<SegmentOption<ByteFormat>[]>(() =>
    BYTE_FORMATS.map((f) => ({ value: f, label: this.i18n.t('tbin.fmt.' + f) })),
  );
  protected readonly groupOptions = computed<SegmentOption<string>[]>(() =>
    ['1', '2', '4', '8'].map((g) => ({ value: g, label: g })),
  );
  /** I prefissi \x e 0x si offrono solo per l'esadecimale. */
  protected readonly separatorChoices = computed<SeparatorKind[]>(() =>
    this.format() === 'hex' ? [...SEPARATORS] : SEPARATORS.filter((s) => s !== 'bs-x' && s !== '0x'),
  );

  /** Si sta producendo una rappresentazione dei byte (testo → byte, oppure un file caricato). */
  protected readonly producing = computed(() => this.file() !== null || this.direction() === 'toBytes');
  protected readonly isBase64 = computed(() => this.format() === 'base64');
  protected readonly showGroup = computed(() => this.producing() && (this.format() === 'hex' || this.format() === 'bin'));
  protected readonly showPad = computed(() => this.producing() && (this.format() === 'bin' || this.format() === 'dec' || this.format() === 'oct'));
  protected readonly showHexCase = computed(() => this.producing() && this.format() === 'hex');
  protected readonly showSeparator = computed(() => this.producing() && !this.isBase64());
  protected readonly showBom = computed(() => this.direction() === 'toBytes' && !this.file() && this.encoding().startsWith('utf'));
  protected readonly showReplace = computed(() => this.direction() === 'toText' && !this.file());

  protected readonly tooBig = computed(() => this.direction() === 'toBytes' && !this.file() && this.input().length > MAX_CHARS);

  private readonly model = computed<Model>(() => {
    const loc = this.i18n.locale();
    const enc = this.encoding();
    const encName = this.i18n.t('tbin.enc.' + enc);
    const f = this.file();
    // un file binario non è quasi mai testo valido: la lettura sostituisce i byte non validi invece di fermarsi
    if (f) return this.fromBytes(f.bytes, enc, encName, false);
    if (this.direction() === 'toBytes') {
      if (this.tooBig()) {
        return { bytes: EMPTY, text: '', warning: '', error: this.i18n.t('tbin.tooBig', { chars: this.input().length.toLocaleString(loc), max: MAX_CHARS.toLocaleString(loc) }) };
      }
      const r = encodeText(this.input(), enc, { bom: this.bom() });
      const warning = r.unmappable > 0 ? this.i18n.t('tbin.warn.unmappable', { count: r.unmappable.toLocaleString(loc), enc: encName }) : '';
      return { bytes: r.bytes, text: this.input(), error: '', warning };
    }
    if (this.input().length > MAX_CHARS) {
      return { bytes: EMPTY, text: '', warning: '', error: this.i18n.t('tbin.tooBig', { chars: this.input().length.toLocaleString(loc), max: MAX_CHARS.toLocaleString(loc) }) };
    }
    const p = parseBytes(this.input(), this.format());
    if (!p.ok) {
      const msg = this.i18n.t('tbin.err.' + p.error, { token: p.token, fmt: this.i18n.t('tbin.fmt.' + this.format()) });
      return { bytes: EMPTY, text: '', warning: '', error: this.i18n.t('tbin.err.at', { msg, pos: String(p.position + 1) }) };
    }
    return this.fromBytes(p.bytes, enc, encName, !this.replace());
  });

  /** Byte → testo, con l'errore di decodifica (modo rigoroso) o l'avviso sui byte sostituiti. */
  private fromBytes(bytes: Uint8Array, enc: Encoding, encName: string, strict: boolean): Model {
    const r = decodeBytes(bytes, enc, { strict });
    if (!r.ok) {
      const byte = r.byte === null ? '' : '0x' + r.byte.toString(16).toUpperCase().padStart(2, '0');
      return {
        bytes, text: '', warning: '',
        error: this.i18n.t('tbin.err.decode', { enc: encName, pos: r.position.toLocaleString(this.i18n.locale()), byte }),
      };
    }
    const parts: string[] = [];
    if (r.replaced > 0) parts.push(this.i18n.t('tbin.warn.replaced', { count: r.replaced.toLocaleString(this.i18n.locale()) }));
    if (r.bom) parts.push(this.i18n.t('tbin.warn.bom'));
    return { bytes, text: r.text, error: '', warning: parts.join(' ') };
  }

  protected readonly bytes = computed(() => this.model().bytes);
  protected readonly error = computed(() => this.model().error);
  protected readonly warning = computed(() => this.model().warning);
  protected readonly output = computed(() => {
    const m = this.model();
    if (m.error) return '';
    if (!this.producing()) return m.text;
    return formatBytes(m.bytes, this.format(), {
      separator: this.separator(),
      uppercase: this.uppercase(),
      group: Number(this.group()),
      pad: this.pad(),
      perLine: this.perLine(),
    });
  });
  protected readonly hasResult = computed(() => !this.error() && (this.input() !== '' || this.file() !== null));
  protected readonly stats = computed(() => textStats(this.model().text, this.model().bytes.length));
  protected readonly statsText = computed(() => {
    const s = this.stats();
    const loc = this.i18n.locale();
    return this.i18n.t('tbin.stats', {
      chars: s.graphemes === null ? '—' : s.graphemes.toLocaleString(loc),
      points: s.codePoints.toLocaleString(loc),
      bytes: s.bytes.toLocaleString(loc),
    });
  });
  protected readonly table = computed(() => (this.hasResult() ? charTable(this.model().text, this.encoding()) : []));
  protected readonly dump = computed(() => (this.file() ? hexDump(this.file()!.bytes) : ''));
  protected readonly fileInfo = computed(() => {
    const f = this.file();
    if (!f) return '';
    const loc = this.i18n.locale();
    return this.i18n.t(f.size > f.bytes.length ? 'tbin.file.info.cut' : 'tbin.file.info', {
      name: f.name, size: f.size.toLocaleString(loc), read: f.bytes.length.toLocaleString(loc),
    });
  });
  protected readonly dumpNote = computed(() =>
    this.i18n.t('tbin.dump.note', { shown: Math.min(this.file()?.bytes.length ?? 0, HEX_DUMP_BYTES).toLocaleString(this.i18n.locale()) }),
  );

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts); il file non ne fa parte
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    direction: this.direction,
    format: this.format,
    encoding: this.encoding,
    separator: this.separator,
    uppercase: this.uppercase,
    group: this.group,
    pad: this.pad,
    perLine: this.perLine,
    replace: this.replace,
    bom: this.bom,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(TBIN_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('text-binary-converter');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected setFormat(f: ByteFormat): void {
    this.format.set(f);
    if (f !== 'hex' && (this.separator() === 'bs-x' || this.separator() === '0x')) this.separator.set('space');
  }

  protected setPerLine(raw: string): void {
    const n = Math.floor(Number(raw));
    this.perLine.set(Number.isFinite(n) ? Math.min(4096, Math.max(0, n)) : 0);
  }

  protected sepLabel(s: SeparatorKind): string {
    return this.i18n.t('tbin.sep.' + s);
  }

  /** Legge il file come byte, nel browser: solo i primi 1 MB. */
  protected async onFile(event: Event): Promise<void> {
    const el = event.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    this.fileError.set('');
    try {
      const buf = await f.slice(0, MAX_FILE_BYTES).arrayBuffer();
      this.file.set({ name: f.name, size: f.size, bytes: new Uint8Array(buf) });
    } catch {
      this.fileError.set(this.i18n.t('tbin.file.error'));
    }
  }

  protected clearFile(): void {
    this.file.set(null);
  }

  /** Il risultato diventa il nuovo testo e la direzione si inverte. */
  protected swap(): void {
    if (this.direction() === 'toBytes') {
      this.input.set(this.output());
      this.direction.set('toText');
    } else {
      this.input.set(this.model().text);
      this.direction.set('toBytes');
    }
  }

  protected reset(): void {
    this.input.set('');
    this.file.set(null);
    this.fileError.set('');
  }

  protected downloadBin(): void {
    saveBytes(this.bytes(), this.i18n.t('tbin.file.bin'), 'application/octet-stream');
  }

  protected downloadTxt(): void {
    saveBytes(new TextEncoder().encode(this.output()), this.i18n.t('tbin.file.txt'), 'text/plain;charset=utf-8');
  }
}
