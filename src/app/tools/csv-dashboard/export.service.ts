// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Injectable } from '@angular/core';
import { buildExportHtml, ExportColors, ExportModel } from './export-html';

export const EXPORT_MAX_ROWS = 500;

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome file sicuro a partire dal titolo. */
export function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'dashboard';
  return `${base}.${ext}`;
}

/** Legge i design token correnti per colorare l'HTML esportato come il tema attivo. */
export function currentColors(): ExportColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    bg: v('--bg'),
    surface: v('--surface'),
    text: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    line: v('--line'),
  };
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  exportHtml(model: ExportModel, title: string): void {
    const html = buildExportHtml(model);
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFileName(title, 'html'));
  }

  /**
   * Cattura la dashboard con html2canvas e la mette su una tela più grande con un margine.
   * html2canvas disegna lettera per lettera il testo con letter-spacing diverso da zero e i
   * numeri grandi escono con spazi strani: nella copia clonata il letter-spacing torna normale.
   */
  private async capture(el: HTMLElement, background: string, scale = 2, padding = 40): Promise<HTMLCanvasElement> {
    const html2canvas = (await import('html2canvas')).default;
    el.setAttribute('data-export-root', '');
    try {
      const shot = await html2canvas(el, {
        scale,
        backgroundColor: background,
        logging: false,
        onclone: (doc) => {
          doc.querySelectorAll<HTMLElement>('[data-export-root], [data-export-root] *').forEach((n) => {
            n.style.letterSpacing = 'normal';
          });
        },
      });
      const pad = padding * scale;
      const out = document.createElement('canvas');
      out.width = shot.width + pad * 2;
      out.height = shot.height + pad * 2;
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(shot, pad, pad);
      return out;
    } finally {
      el.removeAttribute('data-export-root');
    }
  }

  async exportPng(el: HTMLElement, title: string, background: string): Promise<void> {
    const canvas = await this.capture(el, background);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('png');
    download(blob, safeFileName(title, 'png'));
  }

  /** PDF A4 orizzontale: l'immagine della dashboard è spezzata su più pagine se serve. */
  async exportPdf(el: HTMLElement, title: string, dateLabel: string, background: string): Promise<void> {
    // per il PDF basta scala 1.5 e JPEG: la qualità resta buona e il file passa da ~7 MB a meno di 1 MB
    const canvas = await this.capture(el, background, 1.5, 24);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW = pageW - margin * 2;
    const mmPerPx = imgW / canvas.width;

    pdf.setFontSize(16);
    pdf.text(title, margin, 14);
    pdf.setFontSize(10);
    pdf.text(dateLabel, margin, 20);

    let offsetPx = 0;
    let y = 26;
    while (offsetPx < canvas.height) {
      const availMm = pageH - margin - y;
      const slicePx = Math.min(canvas.height - offsetPx, Math.floor(availMm / mmPerPx));
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = slicePx;
      slice.getContext('2d')!.drawImage(canvas, 0, offsetPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, y, imgW, slicePx * mmPerPx);
      offsetPx += slicePx;
      if (offsetPx < canvas.height) {
        pdf.addPage();
        y = margin;
      }
    }
    pdf.save(safeFileName(title, 'pdf'));
  }
}
