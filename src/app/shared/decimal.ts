// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Lingue dell'interfaccia (decidono quale carattere è il separatore decimale più probabile). */
type DecimalLang = 'it' | 'en';

/**
 * Numero digitato → number, accettando le due convenzioni. Spazi, apostrofi e simbolo % ignorati;
 * segno + o - (anche il meno tipografico) ed esponente ("1e3", "2,5E-4").
 * Con un solo separatore: nella lingua dell'interfaccia è il decimale ("1,5" in italiano); l'altro carattere
 * è un raggruppamento solo se segue il modello delle migliaia ("1.500" in italiano = 1500), altrimenti è un decimale.
 * Con entrambi, l'ultimo è il decimale. null se non è un numero finito valido.
 */
export function parseDecimal(input: string, lang: DecimalLang): number | null {
  let v = input.replace(/[\s%']/g, '').replace(/[−–]/g, '-');
  if (v === '') return null;
  let exp = '';
  const e = v.match(/[eE][+-]?\d+$/);
  if (e) {
    exp = e[0];
    v = v.slice(0, -exp.length);
  }
  let sign = '';
  if (v[0] === '-' || v[0] === '+') {
    sign = v[0] === '-' ? '-' : '';
    v = v.slice(1);
  }
  if (!/^[\d.,]+$/.test(v) || !/\d/.test(v)) return null;
  const decMain = lang === 'it' ? ',' : '.';
  const grpMain = lang === 'it' ? '.' : ',';
  const lastDec = v.lastIndexOf(decMain);
  const lastGrp = v.lastIndexOf(grpMain);
  let intPart: string;
  let frac = '';
  const grouped = (s: string, sep: string) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(s);
  if (lastDec >= 0 && lastGrp >= 0) {
    // entrambi: il decimale è l'ultimo dei due, e compare una volta sola
    const dec = Math.max(lastDec, lastGrp);
    const sd = v[dec];
    const sg = sd === ',' ? '.' : ',';
    if (v.split(sd).length !== 2) return null;
    const ip = v.slice(0, dec);
    if (!new RegExp(`^\\d{1,3}(\\${sg}\\d{3})*$`).test(ip)) return null;
    intPart = ip.split(sg).join('');
    frac = v.slice(dec + 1);
  } else if (lastDec >= 0) {
    if (v.indexOf(decMain) !== lastDec) return null;
    intPart = v.slice(0, lastDec);
    frac = v.slice(lastDec + 1);
  } else if (lastGrp >= 0) {
    if (grouped(v, grpMain)) intPart = v.split(grpMain).join('');
    else if (v.indexOf(grpMain) === lastGrp) {
      intPart = v.slice(0, lastGrp);
      frac = v.slice(lastGrp + 1);
    } else return null;
  } else intPart = v;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac) || (intPart === '' && frac === '')) return null;
  const n = Number(`${sign}${intPart || '0'}.${frac || '0'}${exp}`);
  return Number.isFinite(n) ? n : null;
}

/**
 * Numero → testo con raggruppamento delle migliaia a mano (Intl in italiano non raggruppa i numeri di quattro cifre),
 * al massimo `maxFrac` decimali senza zeri finali; 12 cifre significative eliminano il rumore della virgola mobile
 * (0,1 + 0,2 → 0,3). Fuori da 1e-6…1e15 usa la notazione scientifica.
 */
export function formatNumber(n: number, lang: DecimalLang, maxFrac = 6): string {
  if (!Number.isFinite(n)) return String(n);
  const x = Number(n.toPrecision(12));
  if (x === 0) return '0';
  const it = lang === 'it';
  const abs = Math.abs(x);
  if (abs < 1e-6 || abs >= 1e15) {
    const s = x.toExponential(8).replace(/\.?0+e/, 'e').replace('e+', 'e');
    return it ? s.replace('.', ',') : s;
  }
  const fixed = x.toFixed(Math.min(maxFrac, 20));
  const neg = fixed.startsWith('-');
  let [i, f = ''] = (neg ? fixed.slice(1) : fixed).split('.');
  f = f.replace(/0+$/, '');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, it ? '.' : ',');
  const body = f ? i + (it ? ',' : '.') + f : i;
  // un valore che arrotondato a zero non deve mostrare "-0"
  return neg && /[1-9]/.test(body) ? '-' + body : body;
}
