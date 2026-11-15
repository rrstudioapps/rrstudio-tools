// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Genera public/samples/vendite-demo.csv in modo deterministico (generatore LCG con seme fisso).
import { writeFileSync } from 'node:fs';

let seed = 0;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
// scelta pesata: il Nord vende più delle Isole, l'Online più del Rivenditore
const pickWeighted = (arr, w) => {
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < arr.length; i++) if ((r -= w[i]) < 0) return arr[i];
  return arr[arr.length - 1];
};

const regioni = ['Nord', 'Centro', 'Sud', 'Isole'];
const canali = ['Online', 'Negozio', 'Rivenditore'];
const prodotti = [
  ['Cuffie Bluetooth', 59.9],
  ['Tastiera meccanica', 89.0],
  ['Mouse wireless', 24.5],
  ['Monitor 27"', 249.0],
  ['Webcam HD', 45.0],
  ['Hub USB-C', 34.9],
];

function genera(s0) {
seed = s0;
const rows = ['Data,Regione,Prodotto,Canale,Quantità,Prezzo unitario,Ricavo (€)'];
const months = 18; // da maggio 2025 a ottobre 2026
for (let m = 0; m < months; m++) {
  const year = 2025 + Math.floor((4 + m) / 12);
  const month = ((4 + m) % 12) + 1;
  // crescita + stagionalità (picchi a novembre-dicembre e a luglio)
  const growth = 1 + m * 0.035;
  const seasonal = 1 + 0.35 * Math.cos(((month - 12) / 12) * 2 * Math.PI) + (month === 7 ? 0.15 : 0);
  const n = Math.round(14 + 8 * growth * seasonal);
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: n }, () => 1 + Math.floor(rnd() * dim)).sort((a, b) => a - b);
  for (const d of days) {
    const [nome, base] = pick(prodotti);
    const prezzo = Math.round(base * (0.92 + rnd() * 0.16) * 100) / 100;
    const q = 1 + Math.floor(rnd() * 6 * growth);
    const ricavo = Math.round(prezzo * q * 100) / 100;
    const data = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    rows.push(`${data},${pickWeighted(regioni, [40, 27, 21, 12])},"${nome.replaceAll('"', '""')}",${pickWeighted(canali, [48, 34, 18])},${q},${prezzo.toFixed(2)},${ricavo.toFixed(2)}`);
  }
}
return rows;
}

// ricavo per mese "aaaa-mm"
function perMese(rows) {
  const m = new Map();
  for (const r of rows.slice(1)) {
    const k = r.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + Number(r.slice(r.lastIndexOf(',') + 1)));
  }
  return [...m.values()];
}

// Il campione è piccolo (~25 righe al mese) e il caso pesa molto: si cerca, in modo deterministico,
// il primo seme con un andamento credibile (ultimo mese +3..+15% sul precedente, ultimo trimestre
// sopra il primo).
let s0 = 20261015;
let rows;
for (;; s0++) {
  rows = genera(s0);
  const v = perMese(rows);
  const delta = v.at(-1) / v.at(-2) - 1;
  const primo = v.slice(0, 3).reduce((a, b) => a + b, 0);
  const ultimo = v.slice(-3).reduce((a, b) => a + b, 0);
  if (delta >= 0.03 && delta <= 0.15 && ultimo > primo * 1.6) break;
}
writeFileSync(new URL('../public/samples/vendite-demo.csv', import.meta.url), rows.join('\n') + '\n');
console.log(`${rows.length - 1} righe scritte (seme ${s0})`);
