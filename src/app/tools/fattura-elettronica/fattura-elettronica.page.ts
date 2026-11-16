// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { safeFileName, saveBytes } from '../../shared/download';
import {
  CONDIZIONI_PAGAMENTO,
  CodeTable,
  ESIGIBILITA_IVA,
  FORMATI,
  MODALITA_PAGAMENTO,
  NATURA,
  REGIME_FISCALE,
  SOGGETTO_EMITTENTE,
  TIPO_CASSA,
  TIPO_DOCUMENTO,
  TIPO_RITENUTA,
  TIPO_SCONTO,
  describeCode,
} from './fattura-codes';
import { FATTURA_DICTIONARIES } from './fattura-elettronica.i18n';
import { LARGE_FILE_BYTES, LoadError, LoadedInvoice, loadInvoiceFile } from './fattura-input';
import {
  Allegato,
  Body,
  Party,
  ScontoMaggiorazione,
  addressLines,
  formatBytes,
  formatDate,
  formatMoney,
  formatPercent,
  formatQty,
  groupIban,
  partyName,
  totals,
} from './fattura-parser';
import { summaryText } from './fattura-text';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const pause = () => new Promise<void>((r) => setTimeout(r, 0));

@Component({
  selector: 'app-fattura-elettronica',
  imports: [Icon, PrivacyNote, FileDrop, CopyButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fattura-elettronica.page.html',
  styleUrl: './fattura-elettronica.page.scss',
})
export class FatturaElettronicaPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly items = signal<LoadedInvoice[]>([]);
  protected readonly notices = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly status = signal('');
  protected readonly selFile = signal(0);
  protected readonly selBody = signal(0);

  protected readonly TD = TIPO_DOCUMENTO;
  protected readonly NAT = NATURA;
  protected readonly MP = MODALITA_PAGAMENTO;
  protected readonly TP = CONDIZIONI_PAGAMENTO;
  protected readonly RF = REGIME_FISCALE;
  protected readonly TC = TIPO_CASSA;
  protected readonly RT = TIPO_RITENUTA;
  protected readonly ESI = ESIGIBILITA_IVA;
  protected readonly EMIT = SOGGETTO_EMITTENTE;
  protected readonly SCO = TIPO_SCONTO;

  protected readonly current = computed(() => {
    const item = this.items()[this.selFile()];
    if (!item) return null;
    const idx = Math.min(this.selBody(), item.fattura.bodies.length - 1);
    return { item, body: item.fattura.bodies[idx], index: idx };
  });

  protected readonly totals = computed(() => {
    const c = this.current();
    return c ? totals(c.body) : null;
  });

  protected readonly summary = computed(() => {
    const c = this.current();
    if (!c) return '';
    return summaryText(c.item.fattura, c.index, (k, p) => this.i18n.t(k, p), this.i18n.lang(), this.i18n.locale());
  });

  constructor() {
    this.i18n.register(FATTURA_DICTIONARIES);
  }

  protected async onFiles(files: File[]): Promise<void> {
    if (!this.isBrowser || this.loading()) return;
    this.loading.set(true);
    this.status.set(this.i18n.t('fe.loading'));
    const notes: string[] = [];
    const found: LoadedInvoice[] = [];
    try {
      for (const file of files) {
        await pause();
        if (file.size > MAX_FILE_BYTES) {
          notes.push(this.i18n.t('fe.err.size', { name: file.name }));
          continue;
        }
        if (file.size > LARGE_FILE_BYTES) {
          notes.push(this.i18n.t('fe.large', { name: file.name, size: formatBytes(file.size, this.i18n.locale()) }));
          await pause();
        }
        const res = loadInvoiceFile(file.name, new Uint8Array(await file.arrayBuffer()));
        found.push(...res.items);
        for (const e of res.errors) notes.push(this.errorText(e));
      }
    } finally {
      this.loading.set(false);
      this.notices.set(notes);
    }
    if (found.length > 0) {
      this.items.set(found);
      this.selFile.set(0);
      this.selBody.set(0);
      this.status.set(this.i18n.t(found.length === 1 ? 'fe.loaded.one' : 'fe.loaded', { n: found.length }));
    } else {
      this.status.set('');
    }
  }

  private errorText(e: LoadError): string {
    return this.i18n.t(`fe.err.${e.code}`, { name: e.name });
  }

  protected reset(): void {
    this.items.set([]);
    this.notices.set([]);
    this.selFile.set(0);
    this.selBody.set(0);
    this.status.set(this.i18n.t('fe.say.reset'));
  }

  protected pickFile(v: string): void {
    this.selFile.set(Number(v));
    this.selBody.set(0);
  }

  protected pickBody(v: string): void {
    this.selBody.set(Number(v));
  }

  protected print(): void {
    window.print();
  }

  protected downloadXml(): void {
    const c = this.current();
    if (!c) return;
    const name = safeFileName(c.item.xmlName, 'fattura.xml');
    saveBytes(c.item.xmlBytes, name, 'application/xml');
    this.status.set(this.i18n.t('fe.say.downloaded', { name }));
  }

  protected downloadAttachment(a: Allegato, n: number): void {
    try {
      const bin = atob(a.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const fallback = `${this.i18n.t('fe.att.unnamed')}-${n}${a.formato ? '.' + a.formato.toLowerCase() : ''}`;
      const name = safeFileName(a.nome, fallback);
      saveBytes(bytes, name, 'application/octet-stream');
      this.status.set(this.i18n.t('fe.say.downloaded', { name }));
    } catch {
      this.notices.set([this.i18n.t('fe.err.attachment', { name: a.nome || String(n) })]);
    }
  }

  // ---- testi per il template ----
  protected bodyLabel(b: Body, i: number, total: number): string {
    return this.i18n.t('fe.invoice.opt', { n: i + 1, total, num: b.numero });
  }

  /** "TD01 · Fattura" (solo il codice se non è in tabella). */
  protected code(table: CodeTable, c: string): string {
    if (!c) return '';
    const d = describeCode(table, c, this.i18n.lang());
    return d ? `${c} · ${d}` : c;
  }

  protected name(p: Party): string {
    return partyName(p);
  }

  protected addr(p: Party): string[] {
    return addressLines(p.sede);
  }

  protected vatId(p: Party): string {
    return p.partitaIva ? `${p.idPaese}${p.partitaIva}` : '';
  }

  protected date(s: string): string {
    return formatDate(s, this.i18n.locale());
  }

  protected money(v: number | string, b: Body): string {
    return formatMoney(v, b.divisa, this.i18n.locale());
  }

  protected qty(v: string): string {
    return formatQty(v, this.i18n.locale());
  }

  protected pct(v: string): string {
    return formatPercent(v, this.i18n.locale());
  }

  protected size(n: number): string {
    return formatBytes(n, this.i18n.locale());
  }

  protected iban(s: string): string {
    return groupIban(s);
  }

  protected discount(s: ScontoMaggiorazione): string {
    const sign = s.tipo === 'MG' ? '+' : '-';
    const value = s.percentuale ? this.pct(s.percentuale) : s.importo;
    return `${sign}${value}`;
  }

  protected docTitle(b: Body): string {
    return this.i18n.t('fe.title.docs', {
      type: describeCode(TIPO_DOCUMENTO, b.tipoDocumento, this.i18n.lang()) || b.tipoDocumento,
      num: b.numero,
      date: this.date(b.data),
    });
  }

  protected formatName(code: string): string {
    return FORMATI[code]?.[this.i18n.lang()] ?? code;
  }

  protected sub(key: string, params: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected yes(v: string): string {
    return v === 'SI' ? this.i18n.t('fe.yes') : v;
  }

  protected refKinds(b: Body): { label: string; docs: { id: string; text: string }[] }[] {
    const lang = (k: string) => this.i18n.t(k);
    const mapRef = (list: Body['ordini']) =>
      list.map((d) => ({
        id: d.id,
        text: [
          d.data ? this.date(d.data) : '',
          d.cig ? `CIG ${d.cig}` : '',
          d.cup ? `CUP ${d.cup}` : '',
          d.codiceCommessa,
          d.righe ? this.i18n.t('fe.refs.lines', { lines: d.righe }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }));
    return [
      { label: lang('fe.refs.orders'), docs: mapRef(b.ordini) },
      { label: lang('fe.refs.contracts'), docs: mapRef(b.contratti) },
      { label: lang('fe.refs.agreements'), docs: mapRef(b.convenzioni) },
      { label: lang('fe.refs.receipts'), docs: mapRef(b.ricezioni) },
      { label: lang('fe.refs.related'), docs: mapRef(b.fattureCollegate) },
      {
        label: lang('fe.refs.ddt'),
        docs: b.ddt.map((d) => ({
          id: d.numero,
          text: [d.data ? this.date(d.data) : '', d.righe ? this.i18n.t('fe.refs.lines', { lines: d.righe }) : ''].filter(Boolean).join(' · '),
        })),
      },
    ].filter((k) => k.docs.length > 0);
  }
}
