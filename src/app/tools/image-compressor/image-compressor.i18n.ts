// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Guida "come si usa" e domande frequenti (It): vedi shared/tool-guide.ts. */
const guideIt = {
  'guide.image-compressor.step.1': 'Trascina le immagini nell\'area di caricamento oppure scegli i file (JPG, PNG, WebP, AVIF, GIF o BMP).',
  'guide.image-compressor.step.2': 'In «Impostazioni di conversione» scegli il «Formato di uscita» (anche «Originale») e regola la «Qualità».',
  'guide.image-compressor.step.3': 'Se serve, con «Ridimensiona» imposta una larghezza o un\'altezza massima, oppure una percentuale: le proporzioni restano quelle e l\'immagine non viene mai ingrandita.',
  'guide.image-compressor.step.4': 'Nell\'elenco vedi il peso prima e dopo di ogni immagine; con «Confronto prima e dopo» controlli la qualità a occhio.',
  'guide.image-compressor.step.5': 'Scarica un file con «Scarica» oppure tutti insieme con «Scarica tutto (.zip)».',
  'guide.image-compressor.q.1': 'Quale formato conviene scegliere?',
  'guide.image-compressor.a.1':
    'JPEG va bene per le foto ed è letto da tutto. WebP e AVIF di solito pesano meno a parità di qualità, ma non tutti i programmi li aprono. PNG è senza perdita ed è adatto a grafica e screenshot, ma una foto in PNG pesa molto.',
  'guide.image-compressor.q.2': 'Che qualità devo impostare?',
  'guide.image-compressor.a.2':
    'Dipende dall\'uso: prova a scendere e guarda il confronto prima e dopo, fermandoti quando noti la differenza. Per il PNG la qualità non si applica, perché il formato è senza perdita.',
  'guide.image-compressor.q.3': 'Perché a volte il file risultante pesa di più?',
  'guide.image-compressor.a.3':
    'Capita con immagini già molto compresse. In quel caso lo strumento tiene il file originale e te lo segnala, invece di darti un file più pesante.',
  'guide.image-compressor.q.4': 'Le informazioni delle foto vengono mantenute?',
  'guide.image-compressor.a.4':
    'No: i metadati EXIF vengono rimossi, quindi anche la posizione GPS non finisce nei file prodotti. Se ti servono data o fotocamera, conserva l\'originale.',
  'guide.image-compressor.q.5': 'Perché non vedo AVIF fra i formati?',
  'guide.image-compressor.a.5':
    'Mostriamo solo i formati che il tuo browser sa produrre. Se AVIF non compare, scegli WebP o JPEG.',
  'guide.image-compressor.q.6': 'Ci sono limiti di numero e di peso?',
  'guide.image-compressor.a.6':
    'Sì: fino a 50 immagini per volta e 50 MB per ciascuna. I file oltre il limite o in un formato non supportato vengono saltati e lo strumento te lo segnala.',
  'guide.image-compressor.privacy':
    'Le immagini non vengono caricate: la conversione avviene sul tuo dispositivo, quindi puoi usare anche foto personali o riservate.',
};

/** Guida "come si usa" e domande frequenti (En): vedi shared/tool-guide.ts. */
const guideEn = {
  'guide.image-compressor.step.1': 'Drop your images on the upload area or choose the files (JPG, PNG, WebP, AVIF, GIF or BMP).',
  'guide.image-compressor.step.2': 'Under "Conversion settings" pick the "Output format" (or "Original") and adjust the "Quality".',
  'guide.image-compressor.step.3': 'If needed, use "Resize" to set a maximum width or height, or a percentage: proportions are kept and images are never enlarged.',
  'guide.image-compressor.step.4': 'The list shows each image\'s size before and after; "Before and after" lets you check the quality by eye.',
  'guide.image-compressor.step.5': 'Download a single file with "Download" or everything at once with "Download all (.zip)".',
  'guide.image-compressor.q.1': 'Which format should I choose?',
  'guide.image-compressor.a.1':
    'JPEG suits photos and opens everywhere. WebP and AVIF are usually smaller at the same quality, but not every program opens them. PNG is lossless and suits graphics and screenshots, but a photo saved as PNG is heavy.',
  'guide.image-compressor.q.2': 'What quality should I set?',
  'guide.image-compressor.a.2':
    'It depends on the use: lower it step by step and watch the before and after comparison, stopping when you notice a difference. Quality does not apply to PNG, which is lossless.',
  'guide.image-compressor.q.3': 'Why is the result sometimes bigger than the original?',
  'guide.image-compressor.a.3':
    'It happens with images that are already heavily compressed. In that case the tool keeps the original file and tells you, rather than giving you a heavier one.',
  'guide.image-compressor.q.4': 'Is the photo information kept?',
  'guide.image-compressor.a.4':
    'No: EXIF metadata is removed, so the GPS location does not end up in the output files either. If you need the date or camera data, keep the original.',
  'guide.image-compressor.q.5': 'Why is AVIF missing from the formats?',
  'guide.image-compressor.a.5':
    'We only list the formats your browser can produce. If AVIF is not there, choose WebP or JPEG.',
  'guide.image-compressor.q.6': 'Are there limits on number and size?',
  'guide.image-compressor.a.6':
    'Yes: up to 50 images at a time and 50 MB each. Files over the limit or in an unsupported format are skipped and the tool tells you.',
  'guide.image-compressor.privacy':
    'Images are not uploaded: the conversion runs on your device, so you can use personal or confidential photos.',
};

const it = {
  ...guideIt,
  'ic.lead': 'Riduci il peso delle foto e convertile in JPEG, WebP, PNG o AVIF, anche tante insieme. Imposta qualità e dimensioni e scarica tutto in uno ZIP.',
  'ic.exif': 'I metadati EXIF vengono rimossi: anche la posizione GPS delle foto non finisce nei file prodotti.',
  'ic.drop': 'Trascina qui le immagini (JPG, PNG, WebP, AVIF, GIF, BMP; fino a {max} file da 50 MB), oppure',
  'ic.settings': 'Impostazioni di conversione',
  'ic.format': 'Formato di uscita',
  'ic.fmt.original': 'Originale',
  'ic.quality': 'Qualità',
  'ic.quality.png': 'Il PNG è senza perdita: la qualità non si applica.',
  'ic.resize': 'Ridimensiona',
  'ic.resize.value': 'Valore del ridimensionamento',
  'ic.resize.none': 'Nessuno',
  'ic.resize.width': 'Larghezza massima',
  'ic.resize.height': 'Altezza massima',
  'ic.resize.percent': 'Percentuale',
  'ic.resize.hint': 'Mantiene le proporzioni e non ingrandisce mai.',
  'ic.bg': 'Sfondo per la trasparenza',
  'ic.bg.hint': 'Usato solo quando l\'uscita è JPEG.',
  'ic.list': 'Immagini caricate',
  'ic.status.progress': 'Elaborate {done} su {total}',
  'ic.status.complete': 'Fatto: {count} immagini elaborate',
  'ic.st.queued': 'In coda',
  'ic.st.processing': 'In elaborazione',
  'ic.st.done': 'Fatto',
  'ic.st.error': 'Errore',
  'ic.kept': 'Il risultato pesava di più: tenuto il file originale.',
  'ic.err.item': 'Impossibile leggere questa immagine (file danneggiato o formato non decodificabile da questo browser).',
  'ic.err.type': '{n} file ignorati: formato non supportato.',
  'ic.err.size': '{n} file ignorati: superano i 50 MB.',
  'ic.err.count': '{n} file ignorati: il massimo è {max} immagini.',
  'ic.err.zip': 'Impossibile creare lo ZIP.',
  'ic.summary': 'Totale',
  'ic.zip': 'Scarica tutto (.zip)',
  'ic.zip.busy': 'Creo lo ZIP…',
  'ic.clear': 'Ricomincia',
  'ic.download': 'Scarica',
  'ic.download.one': 'Scarica {name}',
  'ic.remove.one': 'Rimuovi {name}',
  'ic.compare': 'Confronto prima e dopo',
  'ic.compare.pick': 'Confronta {name}',
  'ic.compare.hint': 'Trascina la maniglia o usa le frecce sinistra e destra.',
  'ic.cmp.before': 'Prima',
  'ic.cmp.after': 'Dopo',
  'ic.cmp.slider': 'Posizione del confronto',
  'ic.cmp.valuetext': '{pct}% dell\'immagine dopo la conversione',
};

const en: typeof it = {
  ...guideEn,
  'ic.lead': 'Shrink photos and convert them to JPEG, WebP, PNG or AVIF, many at once. Set quality and size, then download everything as a ZIP.',
  'ic.exif': 'EXIF metadata is removed: the GPS location of your photos does not end up in the files produced.',
  'ic.drop': 'Drop images here (JPG, PNG, WebP, AVIF, GIF, BMP; up to {max} files of 50 MB each), or',
  'ic.settings': 'Conversion settings',
  'ic.format': 'Output format',
  'ic.fmt.original': 'Original',
  'ic.quality': 'Quality',
  'ic.quality.png': 'PNG is lossless: quality does not apply.',
  'ic.resize': 'Resize',
  'ic.resize.value': 'Resize value',
  'ic.resize.none': 'None',
  'ic.resize.width': 'Max width',
  'ic.resize.height': 'Max height',
  'ic.resize.percent': 'Percentage',
  'ic.resize.hint': 'Keeps the aspect ratio and never enlarges.',
  'ic.bg': 'Background for transparency',
  'ic.bg.hint': 'Only used when the output is JPEG.',
  'ic.list': 'Uploaded images',
  'ic.status.progress': 'Processed {done} of {total}',
  'ic.status.complete': 'Done: {count} images processed',
  'ic.st.queued': 'Queued',
  'ic.st.processing': 'Processing',
  'ic.st.done': 'Done',
  'ic.st.error': 'Error',
  'ic.kept': 'The result was larger: kept the original file.',
  'ic.err.item': 'Cannot read this image (damaged file, or a format this browser cannot decode).',
  'ic.err.type': '{n} files skipped: unsupported format.',
  'ic.err.size': '{n} files skipped: larger than 50 MB.',
  'ic.err.count': '{n} files skipped: the limit is {max} images.',
  'ic.err.zip': 'Could not create the ZIP.',
  'ic.summary': 'Total',
  'ic.zip': 'Download all (.zip)',
  'ic.zip.busy': 'Creating ZIP…',
  'ic.clear': 'Start over',
  'ic.download': 'Download',
  'ic.download.one': 'Download {name}',
  'ic.remove.one': 'Remove {name}',
  'ic.compare': 'Before and after',
  'ic.compare.pick': 'Compare {name}',
  'ic.compare.hint': 'Drag the handle or use the left and right arrow keys.',
  'ic.cmp.before': 'Before',
  'ic.cmp.after': 'After',
  'ic.cmp.slider': 'Comparison position',
  'ic.cmp.valuetext': '{pct}% of the converted image shown',
};

export const IMAGE_COMPRESSOR_DICTIONARIES: ToolDictionaries = { it, en };
