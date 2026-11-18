// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Icone line (stile Feather), disegnate come path SVG 24x24. */
const ICONS = {
  chart: 'M18 20V10M12 20V4M6 20v-6',
  sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  coffee: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  globe:
    'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  image:
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3zM21 15l-5-5L5 21',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  eyeOff:
    'M17.9 17.9A10.7 10.7 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  copy: 'M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  swap: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  check: 'M20 6L9 17l-5-5',
  braces:
    'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  rotateCw: 'M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10',
  rotateCcw: 'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  left: 'M19 12H5M12 19l-7-7 7-7',
  right: 'M5 12h14M12 5l7 7-7 7',
  close: 'M18 6L6 18M6 6l12 12',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  idcard: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM6 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5.5 16a3 2 0 0 1 5 0M14 10h5M14 14h4',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18M2 10h20',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  tree: 'M4 3h6v5H4zM14 10h6v5h-6zM14 17h6v4h-6zM7 8v10h7M7 12.5h7',
  search: 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM21 21l-4.35-4.35',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM6 6h1M17 6h1M6 17h1M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1',
  calculator:
    'M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM8 6h8v3H8zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01',
  columns: 'M3 4h18v16H3zM12 4v16M6 9h3M6 13h3M15 9h3M15 13h3',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8a5.5 5.5 0 0 1 7.8-7.8zM11.4 11.6L15.5 7.5m0 0l3 3L22 7l-3-3',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  contrast: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 2v20M12 2a10 10 0 0 1 0 20z',
  calendar: 'M3 4h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM16 2v4M8 2v4M2 10h20',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  regex: 'M12 3v11M6.5 6l11 6M17.5 6l-11 6M6 20h.01',
  markdown: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM6 15V9l3 3 3-3v6M17 9v6M14.5 12.5L17 15l2.5-2.5',
  pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  percent: 'M19 5L5 19M6.5 4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5zM17.5 15a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z',
  ruler: 'M21.3 8.7l-6-6L2.7 15.3l6 6zM12.3 5.7l1.5 1.5M9.3 8.7l1.5 1.5M6.3 11.7l1.5 1.5',
  binary: 'M15 3a2 3.5 0 1 0 0 7a2 3.5 0 0 0 0-7zM6 5l2-2v7M7 14a2 3.5 0 1 0 0 7a2 3.5 0 0 0 0-7zM14.5 16l2-2v7M14.5 21h4',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  palette:
    'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3a4.9 4.9 0 0 0 4.7-5C22 5.6 17.5 2 12 2zM6.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01M17.5 11.5h.01',
  pen: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6M11 13a2 2 0 1 0 0-4a2 2 0 0 0 0 4z',
  award: 'M12 15a7 7 0 1 0 0-14a7 7 0 0 0 0 14zM8.2 13.9L7 23l5-3 5 3-1.2-9.1',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  database:
    'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  markup: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16',
  ampersand: 'M18 20L9 9.5a2.8 2.8 0 1 1 5-1.7c0 2.2-7 3.3-7 7.7a4 4 0 0 0 7 2.5L18 13',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  aa: 'M2 18l5.5-13L13 18M4 13h7M16.5 12a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM19.5 12v6',
  slug: 'M3 12h4M10 12h4M17 12h4M5 6h14M5 18h9',
  paragraph: 'M13 4v16M17 4v16M13 4H9.5a4.5 4.5 0 0 0 0 9H13',
  barcode: 'M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14M8 5v14',
  scan: 'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10',
  sortLines: 'M4 6h9M4 12h6M4 18h3M17 5v14M14 16l3 3 3-3',
  findReplace: 'M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM21 21l-6-6M7 9h6M11 7l2 2-2 2',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  speaker: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  keyboard: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 16h6',
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    [attr.stroke-width]="stroke()"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="path()" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
      flex: none;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly stroke = input(1.6);
  protected readonly path = computed(() => ICONS[this.name()]);
}
