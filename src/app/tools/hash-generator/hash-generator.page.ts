// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes, textStats } from '../../shared/text-stats';
import {
  ALGOS,
  ALGO_LABEL,
  Algo,
  BUFFER_LIMIT,
  HashCancelled,
  HashSet,
  MAX_FILE_BYTES,
  WebCryptoUnavailable,
  hashFile,
  hashText,
  matchingAlgos,
  toBase64,
  toHex,
} from './hash';
import { HASH_DICTIONARIES } from './hash-generator.i18n';

interface Row {
  algo: Algo;
  label: string;
  hex: string;
  base64: string;
  /** false se l'algoritmo non è calcolabile per questo input. */
  available: boolean;
  match: boolean;
}

@Component({
  selector: 'app-hash-generator',
  imports: [Icon, PrivacyNote, IoPanel, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hash-generator.page.html',
  styleUrl: './hash-generator.page.scss',
})
export class HashGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly text = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly upper = signal(false);
  protected readonly expected = signal('');
  private readonly hashes = signal<HashSet | null>(null);
  protected readonly partial = signal(false);
  protected readonly busy = signal(false);
  protected readonly progress = signal({ fraction: 0, phase: 'read' as 'read' | 'hash' });
  protected readonly status = signal<'cancelled' | 'toolarge' | 'read' | 'crypto' | null>(null);

  private abort: AbortController | null = null;
  private textToken = 0;

  protected readonly limitText = computed(() => formatBytes(BUFFER_LIMIT, this.i18n.locale()));

  protected readonly matches = computed<Algo[]>(() => {
    const h = this.hashes();
    return h ? matchingAlgos(this.expected(), h) : [];
  });

  protected readonly rows = computed<Row[]>(() => {
    const h = this.hashes();
    const up = this.upper();
    const matches = this.matches();
    return ALGOS.map((algo) => {
      const bytes = h?.[algo];
      return {
        algo,
        label: ALGO_LABEL[algo],
        hex: bytes ? toHex(bytes, up) : '',
        base64: bytes ? toBase64(bytes) : '',
        available: !h || bytes !== undefined,
        match: matches.includes(algo),
      };
    });
  });

  protected readonly hasResults = computed(() => this.hashes() !== null);

  protected readonly compareMessage = computed(() => {
    if (!this.expected().trim() || !this.hashes()) return '';
    const m = this.matches();
    return m.length
      ? this.i18n.t('hash.cmp.match', { algo: m.map((a) => ALGO_LABEL[a]).join(', ') })
      : this.i18n.t('hash.cmp.none');
  });

  protected readonly statusMessage = computed(() => {
    const s = this.status();
    return s ? this.i18n.t(s === 'cancelled' ? 'hash.cancelled' : `hash.err.${s}`) : '';
  });

  protected readonly largeWarning = computed(() => {
    const f = this.file();
    if (!f || f.size <= BUFFER_LIMIT) return '';
    return this.i18n.t('hash.warn.large', { size: formatBytes(f.size, this.i18n.locale()), limit: this.limitText() });
  });

  protected readonly inputMeta = computed(() => {
    const f = this.file();
    if (f) return `${f.name} · ${formatBytes(f.size, this.i18n.locale())}`;
    const s = textStats(this.text());
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('hash.stats', { chars: nf.format(s.chars), bytes: nf.format(s.bytes) });
  });

  protected readonly progressPct = computed(() => Math.round(this.progress().fraction * 100));
  protected readonly progressText = computed(() =>
    this.progress().phase === 'read'
      ? this.i18n.t('hash.progress.read', { pct: `${this.progressPct()}%` })
      : this.i18n.t('hash.progress.hash'),
  );

  constructor() {
    this.i18n.register(HASH_DICTIONARIES);
    // Testo: hash live (solo nel browser; la pagina prerenderizzata parte vuota)
    effect(() => {
      const t = this.text();
      if (!this.browser || this.file()) return;
      untracked(() => void this.runText(t));
    });
    inject(DestroyRef).onDestroy(() => this.abort?.abort());
  }

  private async runText(t: string): Promise<void> {
    const token = ++this.textToken;
    try {
      const h = await hashText(t);
      if (token !== this.textToken) return;
      this.partial.set(false);
      this.hashes.set(h);
    } catch (e) {
      if (token !== this.textToken) return;
      this.hashes.set(null);
      this.status.set(e instanceof WebCryptoUnavailable ? 'crypto' : 'read');
    }
  }

  protected onInput(e: Event): void {
    this.status.set(null);
    this.text.set((e.target as HTMLTextAreaElement).value);
  }

  protected async onFile(f: File): Promise<void> {
    this.cancel(false);
    this.status.set(null);
    if (f.size > MAX_FILE_BYTES) {
      this.status.set('toolarge');
      return;
    }
    this.textToken++; // scarta un eventuale calcolo di testo in corso
    this.file.set(f);
    this.hashes.set(null);
    this.partial.set(false);
    const ctrl = new AbortController();
    this.abort = ctrl;
    this.busy.set(true);
    this.progress.set({ fraction: 0, phase: 'read' });
    try {
      const r = await hashFile(f, {
        signal: ctrl.signal,
        onProgress: (fraction, phase) => this.progress.set({ fraction, phase }),
      });
      if (ctrl.signal.aborted) return;
      this.hashes.set(r.hashes);
      this.partial.set(r.partial);
    } catch (e) {
      if (e instanceof HashCancelled || ctrl.signal.aborted) return;
      this.status.set(e instanceof WebCryptoUnavailable ? 'crypto' : 'read');
    } finally {
      if (this.abort === ctrl) {
        this.abort = null;
        this.busy.set(false);
      }
    }
  }

  /** Annulla il calcolo in corso: il file viene tolto e si torna al testo. */
  protected cancel(announce = true): void {
    if (!this.abort) return;
    this.abort.abort();
    this.abort = null;
    this.busy.set(false);
    this.file.set(null);
    this.hashes.set(null);
    this.partial.set(false);
    if (announce) this.status.set('cancelled');
    // l'effect sul testo (che dipende da file()) ricalcola gli hash live
  }

  protected removeFile(): void {
    this.cancel(false);
    this.file.set(null);
    this.status.set(null);
  }

  protected clear(): void {
    this.cancel(false);
    this.file.set(null);
    this.status.set(null);
    this.text.set('');
    this.expected.set('');
  }
}
