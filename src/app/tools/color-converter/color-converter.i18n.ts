// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'colc.lead':
    'Scrivi un colore in qualunque notazione CSS o sceglilo con il selettore e vedilo in HEX, RGB, HSL, HWB, OKLCH, OKLAB e CMYK. Genera la scala di tinte 50-950 e le armonie, da copiare o esportare come variabili CSS e JSON.',
  'colc.input': 'Colore',
  'colc.picker': 'Selettore di colore',
  'colc.hint': 'HEX (3, 4, 6 o 8 cifre), rgb(), hsl(), hwb(), oklch(), oklab() o un nome CSS come rebeccapurple.',
  'colc.err': 'Colore non riconosciuto: prova con #3b82f6, rgb(59 130 246), hsl(217 91% 60%), oklch(62% 0.19 260) o un nome CSS.',
  'colc.gamut':
    'Questo colore è fuori dal gamut sRGB: è stato riportato dentro riducendo la croma, mantenendo luminosità e tinta. Valore usato: oklch({value}).',
  'colc.reps': 'Rappresentazioni',
  'colc.copy': 'Copia {what}',
  'colc.cmyk.note': 'Il CMYK è solo indicativo: è una formula semplice, senza profilo colore di stampa, e non coincide con quello di una tipografia.',
  'colc.contrast': 'Verifica il contrasto con questo colore',
  'colc.shades': 'Scala di tinte e ombre',
  'colc.shades.hint':
    'Da 50 (chiarissimo) a 950 (quasi nero), con stessa tinta in OKLCH. Il gradino evidenziato è il tuo colore. Premi un campione per copiarne l\'HEX.',
  'colc.harmonies': 'Colori abbinati',
  'colc.h.complementary': 'Complementare',
  'colc.h.analogous': 'Analoghi',
  'colc.h.triadic': 'Triadici',
  'colc.swatch.copy': '{name} {hex}: copia',
  'colc.copied': 'Copiato {hex}',
  'colc.export': 'Esporta la scala',
  'colc.export.as': 'Formato di esportazione',
  'colc.export.css': 'Variabili CSS',
  'colc.export.json': 'JSON',
  'colc.name': 'Nome',
  'colc.export.copy': 'Copia',
  'colc.info.oklch.title': 'Perché OKLCH',
  'colc.info.oklch.desc':
    'In OKLCH la luminosità percepita è uniforme: cambiando solo la L si ottengono tinte e ombre equilibrate, cosa che con HSL non succede.',
  'colc.info.gamut.title': 'Fuori gamut',
  'colc.info.gamut.desc':
    'Alcuni OKLCH non esistono in sRGB. Come fa CSS, si riduce la croma fino a rientrare, senza cambiare luminosità e tinta, e lo strumento te lo segnala.',
  'colc.info.priv.title': 'Dove vanno i dati',
  'colc.info.priv.desc':
    'Tutto avviene in questa pagina. Il link di condivisione contiene solo il colore e le opzioni, nella parte dopo il # che il server non riceve.',
};

const en: typeof it = {
  'colc.lead':
    'Type a color in any CSS notation or pick it, and see it as HEX, RGB, HSL, HWB, OKLCH, OKLAB and CMYK. Generate the 50-950 shade scale and color harmonies, ready to copy or export as CSS variables and JSON.',
  'colc.input': 'Color',
  'colc.picker': 'Color picker',
  'colc.hint': 'HEX (3, 4, 6 or 8 digits), rgb(), hsl(), hwb(), oklch(), oklab() or a CSS name such as rebeccapurple.',
  'colc.err': 'Color not recognised: try #3b82f6, rgb(59 130 246), hsl(217 91% 60%), oklch(62% 0.19 260) or a CSS name.',
  'colc.gamut':
    'This color is outside the sRGB gamut: it was brought back in by reducing the chroma, keeping lightness and hue. Value used: oklch({value}).',
  'colc.reps': 'Representations',
  'colc.copy': 'Copy {what}',
  'colc.cmyk.note': 'CMYK is only indicative: it is a simple formula with no print color profile, and will not match a print shop\'s.',
  'colc.contrast': 'Check the contrast with this color',
  'colc.shades': 'Shade scale',
  'colc.shades.hint':
    'From 50 (very light) to 950 (almost black), same hue in OKLCH. The highlighted step is your color. Press a swatch to copy its HEX.',
  'colc.harmonies': 'Matching colors',
  'colc.h.complementary': 'Complementary',
  'colc.h.analogous': 'Analogous',
  'colc.h.triadic': 'Triadic',
  'colc.swatch.copy': '{name} {hex}: copy',
  'colc.copied': 'Copied {hex}',
  'colc.export': 'Export the scale',
  'colc.export.as': 'Export format',
  'colc.export.css': 'CSS variables',
  'colc.export.json': 'JSON',
  'colc.name': 'Name',
  'colc.export.copy': 'Copy',
  'colc.info.oklch.title': 'Why OKLCH',
  'colc.info.oklch.desc':
    'In OKLCH perceived lightness is uniform: changing only L gives balanced tints and shades, which HSL does not.',
  'colc.info.gamut.title': 'Out of gamut',
  'colc.info.gamut.desc':
    'Some OKLCH colors do not exist in sRGB. Like CSS does, the chroma is reduced until it fits, keeping lightness and hue, and the tool tells you.',
  'colc.info.priv.title': 'Where the data goes',
  'colc.info.priv.desc':
    'Everything happens on this page. The share link holds only the color and the options, in the part after the # that the server never receives.',
};

export const COLOR_CONVERTER_DICTIONARIES: ToolDictionaries = { it, en };
