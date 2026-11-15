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

  private async capture(el: HTMLElement, background: string): Promise<HTMLCanvasElement> {
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(el, { scale: 2, backgroundColor: background, logging: false });
  }

  async exportPng(el: HTMLElement, title: string, background: string): Promise<void> {
    const canvas = await this.capture(el, background);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('png');
    download(blob, safeFileName(title, 'png'));
  }

  /** PDF A4 orizzontale: l'immagine della dashboard è spezzata su più pagine se serve. */
  async exportPdf(el: HTMLElement, title: string, dateLabel: string, background: string): Promise<void> {
    const canvas = await this.capture(el, background);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, y, imgW, slicePx * mmPerPx);
      offsetPx += slicePx;
      if (offsetPx < canvas.height) {
        pdf.addPage();
        y = margin;
      }
    }
    pdf.save(safeFileName(title, 'pdf'));
  }
}
