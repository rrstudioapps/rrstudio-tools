// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS } from '../tools/tools.registry';
import { categoryFromSlug, categoryFromUrl, filterTools, groupByCategory, normalizeText, searchTerms } from './tool-filter';

const texts = (t: { id: string }) => ({ title: `Titolo ${t.id}`, description: 'Descrizione generica' });

describe('registry: categorie', () => {
  it('ogni tool ha una categoria esistente e gli id sono unici', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const t of TOOLS) expect(ids.has(t.category), t.id).toBe(true);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
  });
  it('ogni categoria ha almeno un tool', () => {
    for (const c of CATEGORIES) expect(TOOLS.some((t) => t.category === c.id), c.id).toBe(true);
  });
});

describe('normalizeText e searchTerms', () => {
  it('toglie gli accenti e le maiuscole', () => {
    expect(normalizeText('Caffè ÀÈÌ')).toBe('caffe aei');
  });
  it('separa le parole e ignora gli spazi doppi', () => {
    expect(searchTerms('  sha256   Hash ')).toEqual(['sha256', 'hash']);
    expect(searchTerms('   ')).toEqual([]);
  });
});

describe('filterTools', () => {
  it('senza filtri restituisce tutti i tool', () => {
    expect(filterTools(TOOLS, null, '', texts)).toHaveLength(TOOLS.length);
  });
  it('filtra per categoria', () => {
    const r = filterTools(TOOLS, 'italy', '', texts);
    expect(r.map((t) => t.id).sort()).toEqual(['calcolo-giorni-lavorativi', 'calcolo-iva', 'codice-fiscale', 'fattura-elettronica', 'iban-partita-iva']);
  });
  it('cerca nelle parole chiave', () => {
    expect(filterTools(TOOLS, null, 'sha256', texts).map((t) => t.id)).toEqual(['hash-generator']);
    expect(filterTools(TOOLS, null, 'checksum', texts).map((t) => t.id)).toContain('hash-generator');
  });
  it('cerca nel titolo e nella descrizione, ignorando gli accenti', () => {
    const t = (x: { id: string }) => ({ title: x.id === 'base64' ? 'Codifica però' : 'x', description: x.id === 'url-encode' ? 'perché sì' : 'y' });
    expect(filterTools(TOOLS, null, 'pero', t).map((x) => x.id)).toEqual(['base64']);
    expect(filterTools(TOOLS, null, 'perche', t).map((x) => x.id)).toEqual(['url-encode']);
  });
  it('più parole: devono esserci tutte', () => {
    expect(filterTools(TOOLS, null, 'json albero', texts).map((t) => t.id)).toEqual(['json-viewer']);
    expect(filterTools(TOOLS, null, 'json zzzz', texts)).toEqual([]);
  });
  it('combina categoria e ricerca', () => {
    // tra gli strumenti per sviluppatori solo il decodificatore JWT parla di JSON ("JSON Web Token")
    expect(filterTools(TOOLS, 'dev', 'json', texts).map((t) => t.id)).toEqual(['jwt-decoder']);
    expect(filterTools(TOOLS, 'data', 'json', texts).length).toBe(3);
  });
  it('nessun risultato per una ricerca assurda', () => {
    expect(filterTools(TOOLS, null, 'qwertyuiop', texts)).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('rispetta l\'ordine delle categorie e salta quelle vuote', () => {
    const g = groupByCategory(TOOLS);
    expect(g.map((x) => x.category.id)).toEqual(['data', 'dev', 'security', 'italy']);
    expect(g.reduce((n, x) => n + x.tools.length, 0)).toBe(TOOLS.length);
    const only = groupByCategory(TOOLS.filter((t) => t.category === 'dev'));
    expect(only.map((x) => x.category.id)).toEqual(['dev']);
  });
});

describe('categoryFromSlug / categoryFromUrl', () => {
  it('riconosce gli slug', () => {
    expect(categoryFromSlug('sviluppatori')).toBe('dev');
    expect(categoryFromSlug(' Italia ')).toBe('italy');
    expect(categoryFromSlug('boh')).toBeNull();
    expect(categoryFromSlug(null)).toBeNull();
  });
  it('legge la query e il fragment', () => {
    expect(categoryFromUrl('/?categoria=sicurezza')).toBe('security');
    expect(categoryFromUrl('/#dati')).toBe('data');
    expect(categoryFromUrl('/?categoria=dati#italia')).toBe('data');
    expect(categoryFromUrl('/?x=1')).toBeNull();
    expect(categoryFromUrl('/')).toBeNull();
  });
});

describe('categorie in inglese', () => {
  it('?category= e gli slug inglesi sono accettati come quelli italiani', () => {
    expect(categoryFromUrl('/en?category=developers')).toBe('dev');
    expect(categoryFromUrl('/en?category=data')).toBe('data');
    expect(categoryFromUrl('/en#security')).toBe('security');
    expect(categoryFromUrl('/?categoria=sviluppatori')).toBe('dev');
    expect(categoryFromUrl('/en?category=nope')).toBeNull();
  });
});
