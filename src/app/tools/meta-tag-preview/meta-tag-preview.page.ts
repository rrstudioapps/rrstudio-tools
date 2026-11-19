// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  FIELD_KEYS,
  MAX_HTML,
  breadcrumb,
  buildSnippet,
  checkMeta,
  effective,
  emptyFields,
  parseHtml,
  summarize,
  truncate,
  type Check,
  type MetaFields,
  type ParsedInfo,
} from './meta-tags';
import { META_DICTIONARIES } from './meta-tag-preview.i18n';
import { SHARE_SCHEMA } from './meta-tag-preview.share';

interface FieldDef {
  key: keyof MetaFields;
  long?: boolean;
  /** Mostra il contatore dei caratteri. */
  count?: boolean;
}
interface Group {
  id: string;
  fields: FieldDef[];
}

const GROUPS: Group[] = [
  {
    id: 'page',
    fields: [
      { key: 'title', count: true },
      { key: 'description', long: true, count: true },
      { key: 'canonical' },
      { key: 'robots' },
      { key: 'favicon' },
      { key: 'themeColor' },
    ],
  },
  {
    id: 'og',
    fields: [
      { key: 'ogTitle', count: true },
      { key: 'ogDescription', long: true, count: true },
      { key: 'ogImage' },
      { key: 'ogUrl' },
      { key: 'ogType' },
      { key: 'ogSiteName' },
      { key: 'ogLocale' },
    ],
  },
  {
    id: 'tw',
    fields: [{ key: 'twitterCard' }, { key: 'twitterTitle', count: true }, { key: 'twitterDescription', long: true, count: true }, { key: 'twitterImage' }, { key: 'twitterSite' }],
  },
];

/** Esempio: un'intestazione realistica, con foglio di stile e script esterni che NON vengono caricati. */
export const SAMPLE_HTML = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pizzeria da Mario - la vera pizza napoletana a Roma</title>
  <meta name="description" content="Pizza napoletana cotta nel forno a legna, impasto a lunga lievitazione e ingredienti campani. Prenota online il tuo tavolo a Roma, zona Trastevere.">
  <link rel="canonical" href="https://www.pizzeriadamario.example/">
  <link rel="icon" href="/favicon.ico">
  <link rel="alternate" hreflang="it" href="https://www.pizzeriadamario.example/">
  <link rel="alternate" hreflang="en" href="https://www.pizzeriadamario.example/en/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Pizzeria da Mario, Roma">
  <meta property="og:description" content="La vera pizza napoletana nel cuore di Trastevere.">
  <meta property="og:url" content="https://www.pizzeriadamario.example/">
  <meta property="og:image" content="https://www.pizzeriadamario.example/img/anteprima.jpg">
  <meta property="og:site_name" content="Pizzeria da Mario">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="https://cdn.pizzeriadamario.example/stile.css">
  <script src="https://cdn.pizzeriadamario.example/analytics.js"></script>
</head>
<body></body>
</html>`;

type Device = 'desktop' | 'mobile';

@Component({
  selector: 'app-meta-tag-preview',
  imports: [CopyButton, Icon, IoPanel, NgTemplateOutlet, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meta-tag-preview.page.html',
  styleUrl: './meta-tag-preview.page.scss',
})
export class MetaTagPreviewPage {
  protected readonly i18n = inject(I18nService);
  protected readonly groups = GROUPS;
  protected readonly maxHtml = MAX_HTML;

  protected readonly html = signal('');
  protected readonly fields = signal<MetaFields>(emptyFields());
  private readonly info = signal<ParsedInfo | null>(null);
  protected readonly device = signal<Device>('desktop');
  protected readonly localImage = signal('');

  protected readonly devices = computed<SegmentOption<Device>[]>(() => [
    { value: 'desktop', label: this.i18n.t('meta.device.desktop') },
    { value: 'mobile', label: this.i18n.t('meta.device.mobile') },
  ]);

  protected readonly eff = computed(() => effective(this.fields()));
  protected readonly snippet = computed(() => buildSnippet(this.fields()));
  protected readonly checks = computed<Check[]>(() => checkMeta(this.fields(), this.info() ?? undefined));
  protected readonly summary = computed(() => summarize(this.checks()));
  protected readonly parsedStatus = computed(() => {
    const i = this.info();
    if (!i) return '';
    const n = FIELD_KEYS.filter((k) => this.fields()[k] !== '').length;
    return i.found ? this.i18n.t('meta.parsed', { n }) : this.i18n.t('meta.parsedNone');
  });

  // ---- anteprime ----
  protected readonly google = computed(() => {
    const e = this.eff();
    const mobile = this.device() === 'mobile';
    const crumb = breadcrumb(e.url);
    return {
      title: truncate(e.title || this.i18n.t('meta.noTitle'), 60),
      description: truncate(e.description, mobile ? 120 : 160),
      host: crumb.host || e.host || 'example.com',
      path: crumb.path,
      letter: (e.host || 'e').charAt(0).toUpperCase(),
      name: e.siteName || e.host || 'example.com',
    };
  });
  protected readonly facebook = computed(() => {
    const e = this.eff();
    return { title: truncate(e.fbTitle || this.i18n.t('meta.noTitle'), 88), description: truncate(e.fbDescription, 200), host: (e.host || 'example.com').toUpperCase() };
  });
  protected readonly twitter = computed(() => {
    const e = this.eff();
    return {
      card: e.twitterCard,
      title: truncate(e.twTitle || this.i18n.t('meta.noTitle'), 70),
      description: truncate(e.twDescription, 125),
      host: e.host || 'example.com',
    };
  });
  protected readonly chat = computed(() => {
    const e = this.eff();
    return { title: truncate(e.fbTitle || this.i18n.t('meta.noTitle'), 80), description: truncate(e.fbDescription, 120), host: e.host || 'example.com' };
  });
  /** Segnaposto dell'immagine: l'indirizzo remoto non si scarica mai. */
  protected imageUrl(kind: 'og' | 'tw'): string {
    return kind === 'tw' ? this.eff().twImage : this.eff().image;
  }

  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => {
    const out: ShareData = {};
    const f = this.fields();
    for (const k of FIELD_KEYS) if (f[k] !== '') out[k] = f[k];
    return out;
  };

  constructor() {
    this.i18n.register(META_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.revokeLocal());
  }

  protected restoreShared(data: ShareData): void {
    const f = emptyFields();
    for (const k of FIELD_KEYS) if (typeof data[k] === 'string') f[k] = data[k];
    this.fields.set(f);
  }

  protected onHtml(value: string): void {
    this.html.set(value);
    if (value.trim() === '') {
      this.info.set(null);
      return;
    }
    const parsed = parseHtml(value);
    this.fields.set(parsed.fields);
    this.info.set(parsed.info);
  }
  protected loadSample(): void {
    this.onHtml(SAMPLE_HTML);
  }
  protected clearAll(): void {
    this.html.set('');
    this.info.set(null);
    this.fields.set(emptyFields());
    this.removeLocalImage();
  }
  protected setField(key: keyof MetaFields, value: string): void {
    this.fields.update((f) => ({ ...f, [key]: value }));
  }
  protected len(key: keyof MetaFields): number {
    return this.fields()[key].trim().length;
  }

  protected onImage(file: File | undefined): void {
    if (!file || !file.type.startsWith('image/')) return;
    this.revokeLocal();
    this.localImage.set(URL.createObjectURL(file));
  }
  protected removeLocalImage(): void {
    this.revokeLocal();
    this.localImage.set('');
  }
  private revokeLocal(): void {
    const u = this.localImage();
    if (u) URL.revokeObjectURL(u);
  }

  protected levelKey(c: Check): string {
    return 'meta.level.' + c.level;
  }
}
