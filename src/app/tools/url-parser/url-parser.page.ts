// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { URL_PARSER_DICTIONARIES } from './url-parser.i18n';
import { SHARE_SCHEMA } from './url-parser.share';
import { QueryParam, isTrackingParam, moveParam, newParam, parseUrl, rebuildUrl, removeTracking, updateParam } from './url-parser';
import { ToolHandoff } from '../../shared/tool-handoff';

export const SAMPLE_URL = 'https://mario:p%40ss@shop.example.co.uk:8443/prodotti/caff%C3%A8%20macinato/42?colore=rosso&q=due+parole&utm_source=newsletter&utm_medium=email&fbclid=IwAR0abc#recensioni';

interface Part {
  label: string;
  value: string;
  mono?: boolean;
}

@Component({
  selector: 'app-url-parser',
  imports: [CopyButton, Icon, IoPanel, PrivacyNote, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './url-parser.page.html',
  styleUrl: './url-parser.page.scss',
})
export class UrlParserPage {
  protected readonly i18n = inject(I18nService);

  protected readonly text = signal('');
  /** Righe della tabella: partono dall'URL scritto e poi si modificano da qui. */
  protected readonly params = signal<QueryParam[]>([]);

  private readonly outcome = computed(() => parseUrl(this.text()));
  protected readonly url = computed(() => {
    const o = this.outcome();
    return o.ok ? o.url : null;
  });
  protected readonly invalid = computed(() => {
    const o = this.outcome();
    return !o.ok && o.error === 'invalid';
  });

  protected readonly parts = computed<Part[]>(() => {
    const u = this.url();
    if (!u) return [];
    const none = this.i18n.t('urlp.part.none');
    const v = (s: string) => (s === '' ? none : s);
    const p = u.hostParts;
    const list: Part[] = [
      { label: this.i18n.t('urlp.part.protocol'), value: u.protocol, mono: true },
      { label: this.i18n.t('urlp.part.username'), value: v(u.username), mono: true },
      { label: this.i18n.t('urlp.part.password'), value: v(u.password), mono: true },
      { label: this.i18n.t('urlp.part.host'), value: v(u.host), mono: true },
    ];
    if (u.host !== u.hostAscii) list.push({ label: this.i18n.t('urlp.part.hostAscii'), value: u.hostAscii, mono: true });
    if (p.isIp) list.push({ label: this.i18n.t('urlp.part.domain'), value: this.i18n.t('urlp.part.ip'), mono: false });
    else if (u.host !== '') {
      list.push({ label: this.i18n.t('urlp.part.subdomain'), value: v(p.subdomain), mono: true });
      list.push({ label: this.i18n.t('urlp.part.domain'), value: v(p.domain), mono: true });
      list.push({ label: this.i18n.t('urlp.part.tld'), value: v(p.tld), mono: true });
    }
    list.push({ label: this.i18n.t('urlp.part.port'), value: u.port !== '' ? u.port : u.defaultPort !== '' ? this.i18n.t('urlp.part.defaultPort', { n: u.defaultPort }) : none, mono: true });
    list.push({ label: this.i18n.t('urlp.part.path'), value: v(u.path), mono: true });
    if (u.path !== u.pathRaw) list.push({ label: this.i18n.t('urlp.part.pathRaw'), value: u.pathRaw, mono: true });
    list.push({ label: this.i18n.t('urlp.part.search'), value: v(u.search), mono: true });
    list.push({ label: this.i18n.t('urlp.part.hash'), value: v(u.hash), mono: true });
    return list;
  });

  protected readonly trackingCount = computed(() => this.params().filter((p) => isTrackingParam(p.key)).length);
  protected readonly rebuilt = computed(() => {
    const u = this.url();
    return u ? rebuildUrl(u, this.params()) : '';
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { url: this.text };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  constructor() {
    this.i18n.register(URL_PARSER_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('url-parser');
    if (rx?.text !== undefined) this.text.set(rx.text.trim());
  }

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    this.resetParams();
  }

  protected onUrl(value: string): void {
    this.text.set(value);
    this.resetParams();
  }
  private resetParams(): void {
    const o = parseUrl(this.text());
    this.params.set(o.ok ? o.url.params : []);
  }
  protected loadSample(): void {
    this.onUrl(SAMPLE_URL);
  }
  protected clearAll(): void {
    this.onUrl('');
  }

  protected isTracking(key: string): boolean {
    return isTrackingParam(key);
  }
  protected setKey(i: number, key: string): void {
    this.params.update((p) => updateParam(p, i, { key }));
  }
  protected setValue(i: number, value: string): void {
    this.params.update((p) => updateParam(p, i, { value }));
  }
  protected move(i: number, d: -1 | 1): void {
    this.params.update((p) => moveParam(p, i, d));
  }
  protected remove(i: number): void {
    this.params.update((p) => p.filter((_, k) => k !== i));
  }
  protected add(): void {
    this.params.update((p) => [...p, newParam()]);
  }
  protected stripTracking(): void {
    this.params.update((p) => removeTracking(p));
  }
}
