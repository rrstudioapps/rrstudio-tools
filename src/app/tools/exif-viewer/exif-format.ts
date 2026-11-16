// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ExifTag, IfdName, PhotoMeta } from './exif-parser';

type T = (key: string, params?: Record<string, string | number>) => string;

export interface Row {
  label: string;
  value: string;
  /** Informazione che può rivelare qualcosa di personale (serie, proprietario). */
  sensitive?: boolean;
}

export interface Group {
  id: 'camera' | 'datetime' | 'shooting' | 'software' | 'author' | 'iptc' | 'xmp' | 'text';
  title: string;
  rows: Row[];
}

export interface Gps {
  lat: number;
  lon: number;
  /** Altitudine in metri (negativa sotto il livello del mare). */
  altitude: number | null;
  /** Precisione: errore orizzontale in metri, oppure DOP. */
  accuracyMeters: number | null;
  dop: number | null;
}

export type Sensitive = 'gps' | 'serial' | 'owner';

const find = (m: PhotoMeta, ifd: IfdName, tag: number): ExifTag | undefined => m.tags.find((t) => t.ifd === ifd && t.tag === tag);

const str = (m: PhotoMeta, ifd: IfdName, tag: number): string => {
  const v = find(m, ifd, tag)?.value;
  return typeof v === 'string' ? v.trim() : '';
};

const num = (m: PhotoMeta, ifd: IfdName, tag: number): number | null => {
  const v = find(m, ifd, tag)?.value;
  const n = Array.isArray(v) ? v[0] : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const dms = (v: unknown): number | null => {
  if (!Array.isArray(v) || v.length < 3) return null;
  const [d, m, s] = v as number[];
  return d + m / 60 + s / 3600;
};

/** Posizione GPS, se presente e valida. */
export function readGps(m: PhotoMeta): Gps | null {
  const lat = dms(find(m, 'gps', 2)?.value);
  const lon = dms(find(m, 'gps', 4)?.value);
  if (lat === null || lon === null) return null;
  const latRef = str(m, 'gps', 1).toUpperCase();
  const lonRef = str(m, 'gps', 3).toUpperCase();
  const la = latRef === 'S' ? -lat : lat;
  const lo = lonRef === 'W' ? -lon : lon;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null; // "Null Island": un GPS non agganciato
  const alt = num(m, 'gps', 6);
  const below = num(m, 'gps', 5) === 1;
  return {
    lat: la,
    lon: lo,
    altitude: alt === null ? null : below ? -alt : alt,
    accuracyMeters: num(m, 'gps', 0x1f),
    dop: num(m, 'gps', 0x0b),
  };
}

/** Coordinate decimali con 5 decimali (circa 1 m). */
export function formatCoords(g: Gps): string {
  return `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}`;
}

/** Link OpenStreetMap: si apre solo se l'utente lo clicca, nessuna mappa viene caricata nella pagina. */
export function osmUrl(g: Gps): string {
  return `https://www.openstreetmap.org/?mlat=${g.lat.toFixed(6)}&mlon=${g.lon.toFixed(6)}#map=16/${g.lat.toFixed(5)}/${g.lon.toFixed(5)}`;
}

/** Testo sulla precisione della posizione, o stringa vuota. */
export function formatAccuracy(g: Gps, t: T, locale: string): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (g.accuracyMeters !== null) return t('ex.gps.accuracy', { m: nf.format(g.accuracyMeters) });
  if (g.dop !== null) return t('ex.gps.dop', { dop: nf.format(g.dop) });
  return '';
}

/** Quali informazioni sensibili contiene la foto. */
export function sensitiveFlags(m: PhotoMeta): Sensitive[] {
  const out: Sensitive[] = [];
  if (readGps(m)) out.push('gps');
  if (str(m, 'exif', 0xa431) || str(m, 'exif', 0xa435) || str(m, 'ifd0', 0xc62f)) out.push('serial');
  if (str(m, 'exif', 0xa430) || str(m, 'ifd0', 0x013b) || m.iptc.some((e) => e.name === 'By-line') || m.xmp.some((p) => /^(dc:creator|photoshop:AuthorsPosition)$/.test(p.name)) || xp(m, 0x9c9d)) {
    out.push('owner');
  }
  return out;
}

/** Testo UTF-16LE delle tag Windows XP* (titolo, autore, parole chiave...). */
function xp(m: PhotoMeta, tag: number): string {
  const b = find(m, 'ifd0', tag)?.bytes;
  if (!b || b.length < 2) return '';
  return new TextDecoder('utf-16le').decode(b).replace(/\0+$/, '').trim();
}

function userComment(m: PhotoMeta): string {
  const b = find(m, 'exif', 0x9286)?.bytes;
  if (!b || b.length <= 8) return '';
  const body = b.subarray(8);
  const charset = String.fromCharCode(...b.subarray(0, 5));
  const text = charset === 'UNICO' ? new TextDecoder('utf-16le').decode(body) : new TextDecoder('utf-8').decode(body);
  return text.replace(/\0+$/, '').trim();
}

/** "2026:03:15 10:22:01" in data e ora locali (senza fuso: la fotocamera non lo dice). */
export function formatExifDate(s: string, locale: string): string {
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return s;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(d);
}

export function formatExposure(v: number): string {
  if (v <= 0) return '';
  if (v >= 1) return `${Number.isInteger(v) ? v : v.toFixed(1)} s`;
  return `1/${Math.round(1 / v)} s`;
}

const clean = (rows: (Row | null)[]): Row[] => rows.filter((r): r is Row => !!r && r.value !== '');

/** Raggruppa i metadati in sezioni leggibili. I gruppi vuoti non compaiono. */
export function buildGroups(m: PhotoMeta, t: T, locale: string): Group[] {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const row = (label: string, value: string, sensitive = false): Row => ({ label: t(label), value, sensitive });
  const s = (ifd: IfdName, tag: number) => str(m, ifd, tag);

  const fnum = num(m, 'exif', 0x829d);
  const exposure = num(m, 'exif', 0x829a);
  const iso = num(m, 'exif', 0x8827);
  const focal = num(m, 'exif', 0x920a);
  const focal35 = num(m, 'exif', 0xa405);
  const flash = num(m, 'exif', 0x9209);
  const bias = num(m, 'exif', 0x9204);
  const px = num(m, 'exif', 0xa002);
  const py = num(m, 'exif', 0xa003);
  const orient = num(m, 'ifd0', 0x0112);

  const groups: Group[] = [
    {
      id: 'camera',
      title: t('ex.group.camera'),
      rows: clean([
        row('ex.f.make', s('ifd0', 0x010f)),
        row('ex.f.model', s('ifd0', 0x0110)),
        row('ex.f.lensMake', s('exif', 0xa433)),
        row('ex.f.lensModel', s('exif', 0xa434)),
        row('ex.f.bodySerial', s('exif', 0xa431), true),
        row('ex.f.lensSerial', s('exif', 0xa435), true),
        row('ex.f.uniqueId', s('exif', 0xa420)),
      ]),
    },
    {
      id: 'datetime',
      title: t('ex.group.datetime'),
      rows: clean([
        s('exif', 0x9003) ? row('ex.f.dateOriginal', formatExifDate(s('exif', 0x9003), locale)) : null,
        s('exif', 0x9004) ? row('ex.f.dateDigitized', formatExifDate(s('exif', 0x9004), locale)) : null,
        s('ifd0', 0x0132) ? row('ex.f.dateModified', formatExifDate(s('ifd0', 0x0132), locale)) : null,
        row('ex.f.offset', s('exif', 0x9011) || s('exif', 0x9010)),
      ]),
    },
    {
      id: 'shooting',
      title: t('ex.group.shooting'),
      rows: clean([
        exposure ? row('ex.f.exposure', formatExposure(exposure)) : null,
        fnum ? row('ex.f.aperture', `f/${nf.format(fnum)}`) : null,
        iso ? row('ex.f.iso', String(iso)) : null,
        focal ? row('ex.f.focal', `${nf.format(focal)} mm${focal35 ? ` (${nf.format(focal35)} mm ${t('ex.f.eq35')})` : ''}`) : null,
        bias !== null && bias !== 0 ? row('ex.f.bias', `${bias > 0 ? '+' : ''}${nf.format(bias)} EV`) : null,
        flash !== null ? row('ex.f.flash', t(flash & 1 ? 'ex.flash.fired' : 'ex.flash.off')) : null,
        px && py ? row('ex.f.size', `${px} × ${py}`) : null,
        orient ? row('ex.f.orientation', t(`ex.orientation.${orient}`)) : null,
      ]),
    },
    {
      id: 'software',
      title: t('ex.group.software'),
      rows: clean([row('ex.f.software', s('ifd0', 0x0131)), row('ex.f.host', s('ifd0', 0x013c))]),
    },
    {
      id: 'author',
      title: t('ex.group.author'),
      rows: clean([
        row('ex.f.artist', s('ifd0', 0x013b), true),
        row('ex.f.owner', s('exif', 0xa430), true),
        row('ex.f.copyright', s('ifd0', 0x8298)),
        row('ex.f.description', s('ifd0', 0x010e)),
        row('ex.f.xpTitle', xp(m, 0x9c9b)),
        row('ex.f.xpAuthor', xp(m, 0x9c9d), true),
        row('ex.f.xpComment', xp(m, 0x9c9c)),
        row('ex.f.xpKeywords', xp(m, 0x9c9e)),
        row('ex.f.userComment', userComment(m)),
        ...m.comments.map((c) => row('ex.f.jpegComment', c)),
      ]),
    },
    {
      id: 'iptc',
      title: t('ex.group.iptc'),
      rows: groupIptc(m).map((e) => ({ label: e.name, value: e.value, sensitive: e.name === 'By-line' })),
    },
    {
      id: 'xmp',
      title: t('ex.group.xmp'),
      rows: m.xmp.map((p) => ({ label: p.name, value: p.value })),
    },
    {
      id: 'text',
      title: t('ex.group.text'),
      rows: [
        ...m.textChunks.map((c) => ({ label: c.keyword, value: c.value || t('ex.compressed') })),
        ...(m.hasTime ? [{ label: t('ex.f.pngTime'), value: t('ex.present') }] : []),
      ],
    },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

/** Voci IPTC con le parole chiave unite in una sola riga. */
function groupIptc(m: PhotoMeta): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const keywords: string[] = [];
  for (const e of m.iptc) {
    if (e.name === 'Keywords') keywords.push(e.value);
    else out.push({ name: e.name, value: e.value });
  }
  if (keywords.length) out.push({ name: 'Keywords', value: keywords.join(', ') });
  return out;
}

/** Quanti tag EXIF restano senza una riga dedicata (marker tecnici, MakerNote...). */
export function otherTagCount(m: PhotoMeta): number {
  const shown = new Set([0x010f, 0x0110, 0x0112, 0x0131, 0x0132, 0x013b, 0x013c, 0x8298, 0x010e, 0x9c9b, 0x9c9c, 0x9c9d, 0x9c9e, 0x8769, 0x8825]);
  const shownExif = new Set([0x829a, 0x829d, 0x8827, 0x9003, 0x9004, 0x9010, 0x9011, 0x9204, 0x9209, 0x920a, 0x9286, 0xa002, 0xa003, 0xa005, 0xa405, 0xa420, 0xa430, 0xa431, 0xa433, 0xa434, 0xa435]);
  return m.tags.filter((tag) => {
    if (tag.ifd === 'ifd1' || tag.ifd === 'gps') return false;
    return tag.ifd === 'ifd0' ? !shown.has(tag.tag) : !shownExif.has(tag.tag);
  }).length;
}
