// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument } from 'pdf-lib';
import { fillForm, readForm } from './pdf-form';

async function formPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const t = form.createTextField('nome');
  t.addToPage(page, { x: 20, y: 350, width: 200, height: 20 });
  const m = form.createTextField('note');
  m.enableMultiline();
  m.addToPage(page, { x: 20, y: 250, width: 200, height: 60 });
  const c = form.createCheckBox('accetto');
  c.addToPage(page, { x: 20, y: 220, width: 16, height: 16 });
  const d = form.createDropdown('citta');
  d.addOptions(['Roma', 'Milano']);
  d.addToPage(page, { x: 20, y: 180, width: 120, height: 20 });
  const r = form.createRadioGroup('sesso');
  r.addOptionToPage('F', page, { x: 20, y: 150, width: 14, height: 14 });
  r.addOptionToPage('M', page, { x: 60, y: 150, width: 14, height: 14 });
  const l = form.createOptionList('lingue');
  l.addOptions(['it', 'en', 'fr']);
  l.enableMultiselect();
  l.addToPage(page, { x: 20, y: 80, width: 100, height: 60 });
  const ro = form.createTextField('fisso');
  ro.setText('non toccare');
  ro.enableReadOnly();
  ro.addToPage(page, { x: 200, y: 180, width: 100, height: 20 });
  return doc.save();
}

describe('moduli PDF', () => {
  it('elenca i campi con tipo, valore e opzioni', async () => {
    const info = await readForm(await formPdf());
    expect(info.xfa).toBe(false);
    const by = Object.fromEntries(info.fields.map((f) => [f.name, f]));
    expect(Object.keys(by).sort()).toEqual(['accetto', 'citta', 'fisso', 'lingue', 'nome', 'note', 'sesso']);
    expect(by['nome']).toMatchObject({ kind: 'text', value: '', multiline: false, editable: true });
    expect(by['note'].multiline).toBe(true);
    expect(by['accetto']).toMatchObject({ kind: 'checkbox', value: false });
    expect(by['citta']).toMatchObject({ kind: 'dropdown', options: ['Roma', 'Milano'] });
    expect(by['sesso']).toMatchObject({ kind: 'radio', options: ['F', 'M'] });
    expect(by['lingue'].kind).toBe('list');
    expect(by['fisso']).toMatchObject({ readOnly: true, value: 'non toccare' });
  });
  it('compila ogni tipo di campo e i valori si rileggono', async () => {
    const r = await fillForm(await formPdf(), { nome: 'Mario Rossi', note: 'riga 1\nriga 2', accetto: true, citta: 'Milano', sesso: 'M', lingue: ['it', 'fr'] }, false);
    if (!r.ok) throw new Error('no');
    expect(r.filled).toBe(6);
    expect(r.problems).toEqual([]);
    const by = Object.fromEntries((await readForm(r.bytes)).fields.map((f) => [f.name, f.value]));
    expect(by).toMatchObject({ nome: 'Mario Rossi', note: 'riga 1\nriga 2', accetto: true, citta: 'Milano', sesso: 'M', lingue: ['it', 'fr'] });
  });
  it('appiattisce: i campi spariscono e le pagine restano', async () => {
    const r = await fillForm(await formPdf(), { nome: 'Anna' }, true);
    if (!r.ok) throw new Error('no');
    const info = await readForm(r.bytes);
    expect(info.fields).toEqual([]);
    expect(info.pages).toBe(1);
  });
  it('problemi segnalati: campo sconosciuto, solo lettura, valore sbagliato, caratteri non scrivibili', async () => {
    const r = await fillForm(await formPdf(), { zzz: 'x', fisso: 'y', accetto: 'si' as unknown as boolean, citta: 'Atlantide', nome: 'Città → 5' }, false);
    if (!r.ok) throw new Error('no');
    const p = Object.fromEntries(r.problems.map((x) => [x.name, x.reason]));
    expect(p).toEqual({ zzz: 'unknown', fisso: 'readOnly', accetto: 'value', citta: 'value', nome: 'chars' });
    expect(r.filled).toBe(1);
  });
  it('PDF senza modulo', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    expect((await readForm(bytes)).fields).toEqual([]);
    expect(await fillForm(bytes, {}, false)).toEqual({ ok: false, error: 'noForm' });
  });
});
