// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrintButton, PrintParam } from '../../shared/print-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  Ipv4Info,
  Ipv6Info,
  SplitResult,
  SubnetRow,
  VlsmResult,
  binaryOctets,
  formatIpv4,
  groupDigits,
  ipv4Contains,
  ipv4Info,
  ipv6Contains,
  ipv6Info,
  isIpv6Text,
  parseIpv4,
  parseIpv4Cidr,
  parseIpv6,
  parseIpv6Cidr,
  parseRequests,
  splitByCount,
  splitByHosts,
  vlsm,
  compressIpv6,
  expandIpv6,
} from './subnet';
import { SUBNET_DICTIONARIES } from './subnet-calculator.i18n';
import { SHARE_SCHEMA } from './subnet-calculator.share';
import { ToolHandoff } from '../../shared/tool-handoff';

type SplitMode = 'count' | 'hosts' | 'vlsm';

interface Row {
  label: string;
  value: string;
}
interface BinRow {
  label: string;
  octets: { net: string; host: string }[];
}
interface View {
  label: string;
  network: string;
  first: string;
  last: string;
  broadcast: string;
  hosts: string;
}

@Component({
  selector: 'app-subnet-calculator',
  imports: [ShareLink, PrintButton, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subnet-calculator.page.html',
  styleUrl: './subnet-calculator.page.scss',
})
export class SubnetCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly splitMode = signal<SplitMode>('count');
  protected readonly splitValue = signal('');
  protected readonly checkIp = signal('');

  protected readonly splitModes = computed<SegmentOption<SplitMode>[]>(() => [
    { value: 'count', label: this.i18n.t('subnet.split.count') },
    { value: 'hosts', label: this.i18n.t('subnet.split.hosts') },
    { value: 'vlsm', label: this.i18n.t('subnet.split.vlsm') },
  ]);

  private readonly nf = computed(() => new Intl.NumberFormat(this.i18n.locale()));
  private num(n: number): string {
    return this.nf().format(n);
  }

  /** Analisi dell'indirizzo scritto: IPv4 o IPv6 (si riconosce dai due punti). */
  private readonly parsed = computed(() => {
    const raw = this.input().trim();
    if (raw === '') return null;
    if (isIpv6Text(raw)) {
      const p = parseIpv6Cidr(raw);
      return 'error' in p ? p : { v: 6 as const, ...p };
    }
    const p = parseIpv4Cidr(raw);
    return 'error' in p ? p : { v: 4 as const, ...p };
  });

  protected readonly error = computed(() => {
    const p = this.parsed();
    return p && 'error' in p ? this.i18n.t('subnet.err.' + p.error) : '';
  });

  protected readonly v4 = computed<Ipv4Info | null>(() => {
    const p = this.parsed();
    return p && 'v' in p && p.v === 4 ? ipv4Info(p.ip, p.prefix) : null;
  });
  protected readonly v6 = computed<Ipv6Info | null>(() => {
    const p = this.parsed();
    return p && 'v' in p && p.v === 6 ? ipv6Info(p.ip, p.prefix) : null;
  });

  protected readonly rows4 = computed<Row[]>(() => {
    const i = this.v4();
    if (!i) return [];
    const t = (k: string) => this.i18n.t('subnet.' + k);
    const hostsNote = i.prefix === 31 ? ' ' + t('note.p2p') : i.prefix === 32 ? ' ' + t('note.single') : '';
    return [
      { label: t('row.address'), value: formatIpv4(i.ip) },
      { label: t('row.cidr'), value: `${formatIpv4(i.network)}/${i.prefix}` },
      { label: t('row.network'), value: formatIpv4(i.network) },
      { label: t('row.broadcast'), value: formatIpv4(i.broadcast) },
      { label: t('row.first'), value: formatIpv4(i.firstHost) },
      { label: t('row.last'), value: formatIpv4(i.lastHost) },
      { label: t('row.hosts'), value: this.num(i.hosts) + hostsNote },
      { label: t('row.total'), value: this.num(i.total) },
      { label: t('row.mask'), value: formatIpv4(i.mask) },
      { label: t('row.wildcard'), value: formatIpv4(i.wildcard) },
      { label: t('row.class'), value: t('class.' + i.cls) },
      { label: t('row.type'), value: t('kind4.' + i.kind) },
    ];
  });

  protected readonly bin4 = computed<BinRow[]>(() => {
    const i = this.v4();
    if (!i) return [];
    const t = (k: string) => this.i18n.t('subnet.' + k);
    return [
      { label: t('row.address'), octets: binaryOctets(i.ip, i.prefix) },
      { label: t('row.mask'), octets: binaryOctets(i.mask, i.prefix) },
      { label: t('row.network'), octets: binaryOctets(i.network, i.prefix) },
      { label: t('row.broadcast'), octets: binaryOctets(i.broadcast, i.prefix) },
    ];
  });

  protected readonly rows6 = computed<Row[]>(() => {
    const i = this.v6();
    if (!i) return [];
    const t = (k: string) => this.i18n.t('subnet.' + k);
    return [
      { label: t('row.expanded'), value: i.expanded },
      { label: t('row.compressed'), value: i.compressed },
      { label: t('row.prefix'), value: i.networkCidr },
      { label: t('row.range.first'), value: compressIpv6(i.first) },
      { label: t('row.range.last'), value: compressIpv6(i.last) },
      { label: t('row.range.firstFull'), value: expandIpv6(i.first) },
      { label: t('row.range.lastFull'), value: expandIpv6(i.last) },
      { label: t('row.total'), value: groupDigits(i.total, this.i18n.locale() === 'it-IT' ? '.' : ',') },
      { label: t('row.type'), value: t('kind6.' + i.kind) },
    ];
  });

  // ---------- suddivisione ----------

  private readonly splitRaw = computed<SplitResult | VlsmResult | { error: string } | null>(() => {
    const i = this.v4();
    const v = this.splitValue().trim();
    if (!i || v === '') return null;
    if (this.splitMode() === 'vlsm') {
      const req = parseRequests(v);
      return req ? vlsm(i.network, i.prefix, req) : { error: 'badList' };
    }
    if (!/^\d{1,10}$/.test(v)) return { error: this.splitMode() === 'count' ? 'badCount' : 'badHosts' };
    const n = Number(v);
    return this.splitMode() === 'count' ? splitByCount(i.network, i.prefix, n) : splitByHosts(i.network, i.prefix, n);
  });

  protected readonly splitError = computed(() => {
    const r = this.splitRaw();
    return r && 'error' in r ? this.i18n.t('subnet.err.' + r.error) : '';
  });

  private view(r: SubnetRow, label: string): View {
    return {
      label,
      network: `${formatIpv4(r.network)}/${r.prefix}`,
      first: formatIpv4(r.firstHost),
      last: formatIpv4(r.lastHost),
      broadcast: formatIpv4(r.broadcast),
      hosts: this.num(r.hosts),
    };
  }

  protected readonly splitRows = computed<View[]>(() => {
    const r = this.splitRaw();
    if (!r || 'error' in r) return [];
    if ('allocations' in r) return r.allocations.map((a, k) => this.view(a, `${k + 1} · ${this.i18n.t('subnet.vlsm.need', { n: this.num(a.requested) })}`));
    return r.rows.map((a, k) => this.view(a, String(k + 1)));
  });

  protected readonly splitSummary = computed(() => {
    const r = this.splitRaw();
    if (!r || 'error' in r) return '';
    if ('allocations' in r) {
      const parts = [this.i18n.t('subnet.vlsm.free', { n: this.num(r.free) })];
      if (r.failed.length) parts.push(this.i18n.t('subnet.vlsm.failed', { list: r.failed.map((n) => this.num(n)).join(', ') }));
      return parts.join(' ');
    }
    const round = this.splitMode() === 'count' && r.count !== Number(this.splitValue().trim()) ? ' ' + this.i18n.t('subnet.split.rounded') : '';
    const trunc = r.truncated ? ' ' + this.i18n.t('subnet.split.truncated', { n: this.num(r.rows.length) }) : '';
    return this.i18n.t('subnet.split.summary', { count: this.num(r.count), prefix: r.newPrefix }) + round + trunc;
  });

  protected readonly splitCsv = computed(() => this.splitRows().map((r) => [r.network, r.first, r.last, r.broadcast, r.hosts].join('\t')).join('\n'));

  // ---------- appartenenza ----------

  protected readonly check = computed<{ ok: boolean | null; text: string }>(() => {
    const raw = this.checkIp().trim();
    const p = this.parsed();
    if (raw === '' || !p || 'error' in p) return { ok: null, text: '' };
    if (p.v === 4) {
      const ip = parseIpv4(raw);
      if (ip === null) return { ok: null, text: this.i18n.t('subnet.err.badAddress') };
      const i = ipv4Info(p.ip, p.prefix);
      const inside = ipv4Contains(i.network, i.prefix, ip);
      return { ok: inside, text: this.i18n.t(inside ? 'subnet.check.yes' : 'subnet.check.no', { ip: formatIpv4(ip), net: `${formatIpv4(i.network)}/${i.prefix}` }) };
    }
    const ip = parseIpv6(raw);
    if (ip === null) return { ok: null, text: this.i18n.t('subnet.err.badAddress') };
    const i = ipv6Info(p.ip, p.prefix);
    const inside = ipv6Contains(i.first, i.prefix, ip);
    return { ok: inside, text: this.i18n.t(inside ? 'subnet.check.yes' : 'subnet.check.no', { ip: compressIpv6(ip), net: i.networkCidr }) };
  });

  protected readonly splitHint = computed(() => this.i18n.t('subnet.split.ph.' + this.splitMode()));

  protected loadSample(): void {
    this.input.set('192.168.10.37/26');
  }

  /** Parametri per il riepilogo di stampa (al posto dei campi). */
  protected readonly printParams = computed<PrintParam[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const p = (label: string, value: string): PrintParam => ({ label, value: value.trim() || '-' });
    const out = [p(t('subnet.input'), this.input())];
    if (this.splitRows().length > 0) out.push(p(t('subnet.split.mode'), t('subnet.split.' + this.splitMode())), p(t('subnet.split.value.' + this.splitMode()), this.splitValue()));
    if (this.check().text) out.push(p(t('subnet.check.label'), this.checkIp()));
    return out;
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { input: this.input, splitMode: this.splitMode, splitValue: this.splitValue, checkIp: this.checkIp };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(SUBNET_DICTIONARIES);
    const rx = inject(ToolHandoff).take('subnet-calculator');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }
}
