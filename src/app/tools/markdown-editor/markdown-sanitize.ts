// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ALLOWED_ATTRS, ALLOWED_TAGS, classifyUrl } from './markdown';

/**
 * Seconda difesa sull'HTML dell'anteprima, dopo il convertitore (che già produce solo tag e attributi ammessi):
 * l'HTML viene letto in un `<template>` (inerte: niente script, niente richieste) e ciò che non è in lista
 * bianca viene tolto. Se un giorno il convertitore avesse un difetto, questo passaggio lo contiene.
 * Si usa solo nel browser.
 */
export function sanitizeDom(html: string, doc: Document): string {
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  const walk = (parent: ParentNode): void => {
    for (const el of Array.from(parent.children)) {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'href') {
          const k = classifyUrl(attr.value).kind;
          if (k !== 'web' && k !== 'mail' && k !== 'relative') el.removeAttribute(attr.name);
        } else if (name === 'src') {
          // nell'anteprima solo immagini già nel testo: nessuna richiesta di rete
          if (tag !== 'img' || classifyUrl(attr.value).kind !== 'data-image') el.removeAttribute(attr.name);
        }
      }
      if (tag === 'input') {
        // solo la casella delle attività, mai modificabile
        if (el.getAttribute('type') !== 'checkbox') el.remove();
        else el.setAttribute('disabled', '');
        continue;
      }
      walk(el);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}
