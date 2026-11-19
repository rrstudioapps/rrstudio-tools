// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFCheckBox, PDFDict, PDFDropdown, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import type { PDFField } from 'pdf-lib';
import { openForEdit } from '../pdf-common/pdf-file';

/**
 * Moduli PDF (AcroForm): elenco dei campi, compilazione e «appiattimento» (i valori diventano testo fisso della pagina e i
 * campi spariscono). I moduli XFA (Adobe LiveCycle) non sono supportati: se il file ha anche i campi AcroForm si compilano,
 * ma alcuni lettori mostrano il modulo XFA e non questi.
 */

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'list' | 'button' | 'signature' | 'other';

export interface FormField {
  /** Nome completo del campo (unico nel documento). */
  name: string;
  kind: FieldKind;
  /** Testo (text, dropdown, radio: l'opzione scelta, '' se nessuna), `true`/`false` per le caselle, elenco per le liste. */
  value: string | boolean | string[];
  options: string[];
  readOnly: boolean;
  required: boolean;
  multiline: boolean;
  maxLength: number | null;
  /** Campi che il lettore non sa compilare qui (pulsanti, firme). */
  editable: boolean;
}

export interface FormInfo {
  fields: FormField[];
  /** Il file ha anche un modulo XFA. */
  xfa: boolean;
  pages: number;
}

export type Values = Record<string, string | boolean | string[]>;

function kindOf(f: PDFField): FieldKind {
  if (f instanceof PDFTextField) return 'text';
  if (f instanceof PDFCheckBox) return 'checkbox';
  if (f instanceof PDFRadioGroup) return 'radio';
  if (f instanceof PDFDropdown) return 'dropdown';
  if (f instanceof PDFOptionList) return 'list';
  const n = f.constructor.name;
  if (/Button/.test(n)) return 'button';
  if (/Signature/.test(n)) return 'signature';
  return 'other';
}

export async function readForm(bytes: Uint8Array): Promise<FormInfo> {
  const doc = await openForEdit(bytes);
  const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
  const xfa = acro instanceof PDFDict && acro.has(PDFName.of('XFA'));
  const fields: FormField[] = [];
  if (acro instanceof PDFDict) {
    for (const f of doc.getForm().getFields()) {
      const kind = kindOf(f);
      let value: FormField['value'] = '';
      let options: string[] = [];
      let multiline = false;
      let maxLength: number | null = null;
      if (f instanceof PDFTextField) {
        value = f.getText() ?? '';
        multiline = f.isMultiline();
        maxLength = f.getMaxLength() ?? null;
      } else if (f instanceof PDFCheckBox) value = f.isChecked();
      else if (f instanceof PDFRadioGroup) {
        value = f.getSelected() ?? '';
        options = f.getOptions();
      } else if (f instanceof PDFDropdown) {
        value = f.getSelected()[0] ?? '';
        options = f.getOptions();
      } else if (f instanceof PDFOptionList) {
        value = f.getSelected();
        options = f.getOptions();
      }
      fields.push({ name: f.getName(), kind, value, options, readOnly: f.isReadOnly(), required: f.isRequired(), multiline, maxLength, editable: !['button', 'signature', 'other'].includes(kind) });
    }
  }
  return { fields, xfa, pages: doc.getPageCount() };
}

export interface FillProblem {
  name: string;
  reason: 'unknown' | 'readOnly' | 'value' | 'chars';
}

export type FillResult = { ok: true; bytes: Uint8Array; problems: FillProblem[]; filled: number } | { ok: false; error: 'noForm' | 'build' };

/** Compila i campi con `values` (solo quelli che cambiano) e, con `flatten`, li appiattisce. */
export async function fillForm(bytes: Uint8Array, values: Values, flatten: boolean): Promise<FillResult> {
  const { StandardFonts } = await import('pdf-lib');
  const doc = await openForEdit(bytes);
  if (!(doc.catalog.lookup(PDFName.of('AcroForm')) instanceof PDFDict)) return { ok: false, error: 'noForm' };
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const problems: FillProblem[] = [];
  let filled = 0;
  const safe = (s: string): { text: string; changed: boolean } => {
    let out = '';
    let changed = false;
    for (const ch of s) {
      if (ch === '\n' || ch === '\r') {
        out += ch; // gli a capo dei campi su più righe li gestisce pdf-lib
        continue;
      }
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += '?';
        changed = true;
      }
    }
    return { text: out, changed };
  };
  for (const [name, v] of Object.entries(values)) {
    let f: PDFField | undefined;
    try {
      f = form.getField(name);
    } catch {
      problems.push({ name, reason: 'unknown' });
      continue;
    }
    if (f.isReadOnly()) {
      problems.push({ name, reason: 'readOnly' });
      continue;
    }
    try {
      if (f instanceof PDFTextField && typeof v === 'string') {
        const s = safe(v);
        if (s.changed) problems.push({ name, reason: 'chars' });
        if (s.text === '') f.setText(undefined);
        else f.setText(s.text);
      } else if (f instanceof PDFCheckBox && typeof v === 'boolean') {
        if (v) f.check();
        else f.uncheck();
      } else if (f instanceof PDFRadioGroup && typeof v === 'string') {
        if (v === '') f.clear();
        else f.select(v);
      } else if (f instanceof PDFDropdown && typeof v === 'string') {
        if (v !== '' && !f.getOptions().includes(v) && !f.isEditable()) throw new Error('option');
        if (v === '') f.clear();
        else f.select(v);
      } else if (f instanceof PDFOptionList && Array.isArray(v)) {
        if (v.some((x) => !f.getOptions().includes(x))) throw new Error('option');
        f.select(v);
      } else {
        problems.push({ name, reason: 'value' });
        continue;
      }
      filled++;
    } catch {
      problems.push({ name, reason: 'value' });
    }
  }
  try {
    form.updateFieldAppearances(font);
    if (flatten) form.flatten({ updateFieldAppearances: false });
    return { ok: true, bytes: await doc.save({ useObjectStreams: true }), problems, filled };
  } catch {
    return { ok: false, error: 'build' };
  }
}
