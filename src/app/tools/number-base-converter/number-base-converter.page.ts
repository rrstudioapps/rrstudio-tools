// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { NB_DICTIONARIES } from './number-base-converter.i18n';
import {
  FLOAT_LAYOUT,
  FloatDecoded,
  FloatKind,
  Width,
  WIDTHS,
  decodeFloat,
  groupFromRight,
  isExactMatch,
  isValidBase,
  parseFloatInput,
  parseInteger,
  toBase,
  twosComplement,
} from './base';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './number-base-converter.share';

type InBase = '2' | '8' | '10' | '16' | 'custom';

interface Row {
  key: string;
  label: string;
  text: string;
}

const MAX_EXACT_SHOWN = 80;

@Component({
  selector: 'app-number-base-converter',
  imports: [ShareLink, CopyButton, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './number-base-converter.page.html',
  styleUrl: './number-base-converter.page.scss',
})
export class NumberBaseConverterPage {
  protected readonly i18n = inject(I18nService);

  // ---- conversione di base ----
  protected readonly input = signal('');
  protected readonly inBase = signal<InBase>('10');
  protected readonly customIn = signal('7');
  protected readonly customOut = signal('36');
  protected readonly upper = signal(true);
  protected readonly group = signal(false);

  protected readonly inBases = computed<SegmentOption<InBase>[]>(() => [
    { value: '2', label: '2' },
    { value: '8', label: '8' },
    { value: '10', label: '10' },
    { value: '16', label: '16' },
    { value: 'custom', label: this.i18n.t('nb.inbase.custom') },
  ]);

  private readonly baseNumber = computed(() => (this.inBase() === 'custom' ? this.parseBase(this.customIn()) : Number(this.inBase())));
  protected readonly customInError = computed(() => this.inBase() === 'custom' && this.baseNumber() === null);
  protected readonly customOutBase = computed(() => this.parseBase(this.customOut()));
  protected readonly customOutError = computed(() => this.customOut().trim() !== '' && this.customOutBase() === null);

  private parseBase(text: string): number | null {
    const t = text.trim();
    if (!/^\d{1,2}$/.test(t)) return null;
    const n = Number(t);
    return isValidBase(n) ? n : null;
  }

  private readonly parsed = computed(() => {
    const b = this.baseNumber();
    if (this.input().trim() === '') return null;
    if (b === null) return null;
    return parseInteger(this.input(), b);
  });

  protected readonly value = computed(() => {
    const p = this.parsed();
    return p && p.ok ? p.value : null;
  });

  protected readonly error = computed(() => {
    const p = this.parsed();
    if (!p || p.ok || p.error === 'empty') return '';
    return this.i18n.t('nb.err.' + p.error, { char: p.char ?? '', base: this.baseNumber() ?? '' });
  });

  protected readonly rows = computed<Row[]>(() => {
    const v = this.value();
    if (v === null) return [];
    const o = { upper: this.upper(), group: this.group(), lang: this.i18n.lang() };
    const rows: Row[] = [
      { key: 'bin', label: this.i18n.t('nb.row.bin'), text: toBase(v, 2, o) },
      { key: 'oct', label: this.i18n.t('nb.row.oct'), text: toBase(v, 8, o) },
      { key: 'dec', label: this.i18n.t('nb.row.dec'), text: toBase(v, 10, o) },
      { key: 'hex', label: this.i18n.t('nb.row.hex'), text: toBase(v, 16, o) },
    ];
    const c = this.customOutBase();
    if (c !== null) rows.push({ key: 'custom', label: this.i18n.t('nb.row.custom', { base: c }), text: toBase(v, c, o) });
    return rows;
  });

  /** Testo senza separatori di raggruppamento, per la copia. */
  protected plain(text: string): string {
    return text.replace(/[ .]/g, '');
  }

  // ---- complemento a due e vista bit ----
  protected readonly widths = WIDTHS;
  protected readonly width = signal<Width>(8);
  protected readonly widthOptions = computed<SegmentOption<string>[]>(() => WIDTHS.map((w) => ({ value: String(w), label: String(w) })));

  protected readonly twos = computed(() => {
    const v = this.value();
    return v === null ? null : twosComplement(v, this.width());
  });

  protected readonly twosError = computed(() => {
    const t = this.twos();
    if (!t || t.ok) return '';
    return this.i18n.t('nb.twos.err', { width: this.width(), min: t.min.toString(), max: t.max.toString() });
  });

  /** I bit divisi per byte, dal più significativo; ogni bit con il suo indice. */
  protected readonly bytes = computed(() => {
    const t = this.twos();
    if (!t || !t.ok) return [];
    const w = t.value.width;
    const out: { n: number; bits: { v: string; index: number; sign: boolean }[] }[] = [];
    for (let b = 0; b < w / 8; b++) {
      const chunk = t.value.bits.slice(b * 8, b * 8 + 8);
      out.push({
        n: w / 8 - b,
        bits: [...chunk].map((v, i) => {
          const index = w - 1 - (b * 8 + i);
          return { v, index, sign: index === w - 1 };
        }),
      });
    }
    return out;
  });

  protected groupedBits(bits: string): string {
    return groupFromRight(bits, 4);
  }

  // ---- IEEE-754 ----
  protected readonly floatKind = signal<FloatKind>('f32');
  protected readonly floatText = signal('');
  protected readonly floatKinds = computed<SegmentOption<FloatKind>[]>(() => [
    { value: 'f32', label: 'float32' },
    { value: 'f64', label: 'float64' },
  ]);

  private readonly floatParsed = computed(() => {
    if (this.floatText().trim() === '') return null;
    return parseFloatInput(this.floatText(), this.floatKind());
  });

  protected readonly floatError = computed(() => {
    const p = this.floatParsed();
    return p && !p.ok && p.error !== 'empty' ? this.i18n.t('nb.float.err.' + p.error) : '';
  });

  protected readonly float = computed<{ d: FloatDecoded; notes: string[] } | null>(() => {
    const p = this.floatParsed();
    if (!p || !p.ok) return null;
    const kind = this.floatKind();
    const d = decodeFloat(p.bits, kind);
    const notes: string[] = [];
    if (p.fromBits) notes.push(this.i18n.t('nb.float.fromBits'));
    else if (p.requested !== null && Number.isFinite(p.requested)) {
      if (d.cls === 'infinity') notes.push(this.i18n.t('nb.float.overflow'));
      else if (d.cls === 'zero' && p.requested !== 0) notes.push(this.i18n.t('nb.float.underflow'));
      else if (!isExactMatch(this.floatText(), d.exact)) notes.push(this.i18n.t('nb.float.rounded'));
    }
    return { d, notes };
  });

  protected readonly layout = computed(() => FLOAT_LAYOUT[this.floatKind()]);

  /** Valore esatto accorciato per lo schermo; la copia contiene tutto. */
  protected readonly exactShown = computed(() => {
    const f = this.float();
    if (!f) return '';
    const e = f.d.exact;
    return e.length > MAX_EXACT_SHOWN ? e.slice(0, MAX_EXACT_SHOWN) + '…' : e;
  });
  protected readonly exactLongNote = computed(() => {
    const f = this.float();
    return f && f.d.exact.length > MAX_EXACT_SHOWN ? this.i18n.t('nb.float.exactLong', { n: f.d.exact.length }) : '';
  });

  protected valueText(d: FloatDecoded): string {
    if (Number.isNaN(d.value)) return 'NaN';
    if (Object.is(d.value, -0)) return '-0';
    return String(d.value);
  }

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    inBase: this.inBase,
    customIn: this.customIn,
    customOut: this.customOut,
    upper: this.upper,
    group: this.group,
    width: this.width,
    floatKind: this.floatKind,
    floatText: this.floatText,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(NB_DICTIONARIES);
  }

  protected setInBase(v: InBase): void {
    this.inBase.set(v);
  }
  protected setWidth(v: string): void {
    this.width.set(Number(v) as Width);
  }
}
