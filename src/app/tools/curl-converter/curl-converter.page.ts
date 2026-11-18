// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { CurlWarning, parseCurl } from './curl';
import { CurlTarget, TARGETS, generate } from './curl-generate';
import { CURL_DICTIONARIES } from './curl-converter.i18n';
import { SHARE_SCHEMA } from './curl-converter.share';
import { ToolHandoff } from '../../shared/tool-handoff';

/** Esempio nello stile di "Copia come cURL" di Chrome. */
export const SAMPLE_CURL = `curl 'https://api.example.com/v1/orders?expand=items' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc' \\
  -H 'content-type: application/json' \\
  -H 'referer: https://app.example.com/' \\
  --data-raw '{"customer":"Mario Rossi","items":[{"sku":"A-100","qty":2}],"gift":false}' \\
  --compressed`;

@Component({
  selector: 'app-curl-converter',
  imports: [CopyButton, Icon, IoPanel, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curl-converter.page.html',
  styleUrl: './curl-converter.page.scss',
})
export class CurlConverterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly command = signal('');
  protected readonly target = signal<CurlTarget>('fetch');

  protected readonly targets = computed<SegmentOption<CurlTarget>[]>(() => TARGETS.map((t) => ({ value: t, label: this.i18n.t('curl.t.' + t) })));

  private readonly parsed = computed(() => (this.command().trim() === '' ? null : parseCurl(this.command())));
  protected readonly error = computed(() => {
    const p = this.parsed();
    return p && !p.ok ? this.i18n.t('curl.err.' + p.error) : '';
  });
  private readonly generated = computed(() => {
    const p = this.parsed();
    return p?.ok ? generate(p.request, this.target()) : null;
  });
  protected readonly code = computed(() => this.generated()?.code ?? '');
  protected readonly parseWarnings = computed(() => {
    const p = this.parsed();
    return p?.ok ? this.texts(p.request.warnings) : [];
  });
  protected readonly langWarnings = computed(() => this.texts(this.generated()?.warnings ?? []));

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { command: this.command, target: this.target };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  constructor() {
    this.i18n.register(CURL_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('curl-converter');
    if (rx?.text !== undefined) this.command.set(rx.text.trim());
  }

  private texts(ws: CurlWarning[]): string[] {
    return ws.map((w) => this.i18n.t('curl.warn.' + w.code, { p: w.param ?? '' }));
  }

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }
  protected loadSample(): void {
    this.command.set(SAMPLE_CURL);
  }
  protected clearAll(): void {
    this.command.set('');
  }
}
