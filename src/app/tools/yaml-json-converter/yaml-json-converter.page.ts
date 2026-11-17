// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ConvertResult, DEFAULT_OPTIONS, EXTENSIONS, Format, Indent, convert, formatFromFileName, offsetOf } from './convert';
import { YAML_JSON_DICTIONARIES } from './yaml-json-converter.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './yaml-json-converter.share';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

const MAX_FILE = 5 * 1024 * 1024;
const FORMAT_LABEL: Record<Format, string> = { yaml: 'YAML', json: 'JSON', toml: 'TOML' };
const SAMPLES: Record<Format, string> = {
  yaml: 'name: rrstudio-tools\nversion: 1.2\nserver:\n  host: localhost\n  ports: [80, 443]\nfeatures:\n  - json\n  - yaml\n  - toml\n---\nname: second-doc\n',
  json: '{\n  "name": "rrstudio-tools",\n  "server": { "host": "localhost", "ports": [80, 443] },\n  "features": ["json", "yaml", "toml"]\n}\n',
  toml: 'name = "rrstudio-tools"\nfeatures = ["json", "yaml", "toml"]\n\n[server]\nhost = "localhost"\nports = [80, 443]\n',
};

interface ErrorInfo {
  title: string;
  text: string;
  line?: number;
  column?: number;
}

@Component({
  selector: 'app-yaml-json-converter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './yaml-json-converter.page.html',
  styleUrl: './yaml-json-converter.page.scss',
})
export class YamlJsonConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  protected readonly from = signal<Format>('yaml');
  protected readonly to = signal<Format>('json');
  protected readonly indent = signal<Indent>('2');
  protected readonly sortKeys = signal(false);
  protected readonly arrayDocs = signal(false);
  protected readonly input = signal('');
  protected readonly fileError = signal('');

  protected readonly formats = computed<SegmentOption<Format>[]>(() =>
    (['yaml', 'json', 'toml'] as const).map((f) => ({ value: f, label: FORMAT_LABEL[f] })),
  );
  protected readonly indents = computed<SegmentOption<Indent>[]>(() => [
    { value: '2', label: this.i18n.t('yj.indent.2') },
    { value: '4', label: this.i18n.t('yj.indent.4') },
    { value: 'tab', label: this.i18n.t('yj.indent.tab') },
  ]);

  protected readonly result = computed<ConvertResult | null>(() => {
    const text = this.input();
    if (text.trim() === '') return null;
    return convert(text, this.from(), this.to(), { ...DEFAULT_OPTIONS, indent: this.indent(), sortKeys: this.sortKeys(), arrayAsDocuments: this.arrayDocs() });
  });
  protected readonly output = computed(() => {
    const r = this.result();
    return r?.ok ? r.text : '';
  });
  protected readonly error = computed<ErrorInfo | null>(() => {
    const file = this.fileError();
    if (file) return { title: '', text: file };
    const r = this.result();
    if (!r || r.ok) return null;
    const e = r.error;
    if (r.stage === 'write') {
      const fmt = FORMAT_LABEL[this.to()];
      let text = e.message;
      if (text === 'toml-root') text = this.i18n.t('yj.err.tomlRoot');
      else if (text.startsWith('toml-null:')) text = this.i18n.t('yj.err.tomlNull', { path: text.slice('toml-null:'.length) });
      else if (text.startsWith('json-nonfinite:')) text = this.i18n.t('yj.err.jsonNonFinite', { path: text.slice('json-nonfinite:'.length) });
      return { title: this.i18n.t('yj.err.write', { fmt }), text };
    }
    const title = this.i18n.t('yj.err.parse', { fmt: FORMAT_LABEL[this.from()] });
    if (e.line !== undefined && e.column !== undefined) {
      return { title, line: e.line, column: e.column, text: this.i18n.t('yj.err.at', { line: e.line, col: e.column, msg: e.message }) };
    }
    return { title, text: this.i18n.t('yj.err.plain', { msg: e.message }) };
  });
  protected readonly note = computed(() => {
    const r = this.result();
    if (!r?.ok) return '';
    if (this.from() === 'yaml' && r.documents > 1 && this.to() === 'json') return this.i18n.t('yj.docsFound', { n: r.documents });
    return this.i18n.t('yj.ok', { from: FORMAT_LABEL[this.from()], to: FORMAT_LABEL[this.to()] });
  });
  protected readonly inputMeta = computed(() => this.meta(this.input()));
  protected readonly outputMeta = computed(() => this.meta(this.output()));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    from: this.from,
    to: this.to,
    indent: this.indent,
    sortKeys: this.sortKeys,
    arrayDocs: this.arrayDocs,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(YAML_JSON_DICTIONARIES);
    const rx = inject(ToolHandoff).take('yaml-json-converter');
    if (rx?.text !== undefined) {
      // un JSON in arrivo si converte in YAML; il testo semplice resta nel formato scelto
      if (rx.kind === 'json') {
        this.from.set('json');
        this.to.set('yaml');
      }
      this.input.set(rx.text);
    }
  }

  private meta(text: string): string {
    if (text === '') return '';
    return this.i18n.t('yj.meta', { lines: text.split('\n').length, chars: text.length });
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected swap(): void {
    const out = this.output();
    const f = this.from();
    this.from.set(this.to());
    this.to.set(f);
    if (out) this.input.set(out);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.input.set(SAMPLES[this.from()]);
  }

  protected clear(): void {
    this.fileError.set('');
    this.input.set('');
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE) {
      this.fileError.set(this.i18n.t('yj.err.tooBig'));
      return;
    }
    try {
      const text = await file.text();
      const f = formatFromFileName(file.name);
      if (f) this.from.set(f);
      this.input.set(text);
    } catch {
      this.fileError.set(this.i18n.t('yj.err.read'));
    }
  }

  protected download(): void {
    const mime = this.to() === 'json' ? 'application/json' : 'text/plain';
    saveBytes(new TextEncoder().encode(this.output()), `converted.${EXTENSIONS[this.to()]}`, `${mime};charset=utf-8`);
  }

  protected goToError(): void {
    const e = this.error();
    const el = this.inputEl()?.nativeElement;
    if (!e?.line || !e.column || !el) return;
    const at = offsetOf(this.input(), e.line, e.column);
    el.focus();
    el.setSelectionRange(at, Math.min(at + 1, this.input().length));
  }
}
