// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { EChartsCoreOption } from 'echarts/core';
import { formatNumber, formatPeriod } from './format';
import { CategoryChartType, CategoryPoint, Granularity, PeriodPoint, TimeChartType } from './models';

export interface ChartTheme {
  /** Inchiostro del tema: colore di default delle serie. */
  ink: string;
  text: string;
  muted: string;
  /** Assi. */
  line: string;
  /** Griglia tratteggiata. */
  grid: string;
  background: string;
}
const MONO = 'JetBrains Mono, monospace';

// Valori uguali ai token di styles.scss (ECharts li vuole come stringhe JS)
export const LIGHT_CHART: ChartTheme = {
  ink: '#1c1c1e',
  text: '#1c1c1e',
  muted: '#6b6b70',
  line: '#e4e2dc',
  grid: '#ecebe6',
  background: '#f7f6f3',
};
export const DARK_CHART: ChartTheme = {
  ink: '#f2f1ed',
  text: '#f2f1ed',
  muted: '#9a9993',
  line: '#2a2a28',
  grid: '#222220',
  background: '#121211',
};

/** Un solo colore con opacità decrescente per le serie (torta). */
function fade(i: number, n: number): number {
  return n <= 1 ? 1 : Math.max(0.2, 1 - (i / n) * 0.8);
}

const axisText = (theme: ChartTheme) => ({ color: theme.muted, fontFamily: MONO, fontSize: 11 });
const tooltip = (theme: ChartTheme, extra: object) => ({
  backgroundColor: theme.background,
  borderColor: theme.line,
  borderWidth: 1,
  extraCssText: 'box-shadow:none;',
  textStyle: { color: theme.text, fontFamily: MONO, fontSize: 11 },
  ...extra,
});
const gridLine = (theme: ChartTheme) => ({ lineStyle: { color: theme.grid, type: 'dashed' as const } });

/** Colore principale scelto dall'utente, altrimenti l'inchiostro del tema. */
const mainColor = (color: string | null, theme: ChartTheme) => color ?? theme.ink;

export function timeOption(
  points: readonly PeriodPoint[],
  g: Granularity,
  type: TimeChartType,
  color: string | null,
  theme: ChartTheme,
  locale: string,
): EChartsCoreOption {
  const main = mainColor(color, theme);
  const last = points.length - 1;
  return {
    animationDuration: 600,
    animationEasing: 'cubicOut',
    color: [main],
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: tooltip(theme, {
      trigger: 'axis',
      valueFormatter: (v: number) => formatNumber(v, locale),
    }),
    xAxis: {
      type: 'category',
      data: points.map((p) => formatPeriod(p.key, g, locale)),
      boundaryGap: type === 'bar',
      axisLabel: axisText(theme),
      axisLine: { lineStyle: { color: theme.line } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...axisText(theme), formatter: (v: number) => formatNumber(v, locale) },
      splitLine: gridLine(theme),
    },
    series: [
      {
        type: type === 'bar' ? 'bar' : 'line',
        data: points.map((p, i) =>
          i === last && type !== 'bar'
            ? { value: p.value, symbol: 'circle', symbolSize: 7 }
            : p.value,
        ),
        smooth: false,
        symbol: 'none', // solo l'ultimo punto ha il simbolo
        lineStyle: { width: 1.6 },
        itemStyle: { color: main },
        ...(type === 'bar' ? { barMaxWidth: 10, itemStyle: { color: main, borderRadius: 3 } } : {}),
        ...(type === 'area' ? { areaStyle: { color: main, opacity: 0.12 } } : {}),
      },
    ],
  };
}

export function categoryOption(
  data: readonly CategoryPoint[],
  type: CategoryChartType,
  color: string | null,
  theme: ChartTheme,
  locale: string,
): EChartsCoreOption {
  const main = mainColor(color, theme);
  const fmt = (v: number) => formatNumber(v, locale);
  if (type === 'pie') {
    return {
      animationDuration: 600,
      tooltip: tooltip(theme, { trigger: 'item', valueFormatter: fmt }),
      legend: { type: 'scroll', bottom: 0, textStyle: axisText(theme), icon: 'circle' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '68%'],
          center: ['50%', '45%'],
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: main, opacity: fade(i, data.length) },
          })),
          label: { show: false },
          itemStyle: { borderColor: theme.background, borderWidth: 2 },
        },
      ],
    };
  }
  const horizontal = type === 'hbar';
  const category = {
    type: 'category' as const,
    data: data.map((d) => d.name),
    inverse: horizontal,
    axisLabel: { ...axisText(theme), interval: 0, width: 110, overflow: 'truncate' as const },
    axisLine: { lineStyle: { color: theme.line } },
    axisTick: { show: false },
  };
  const value = {
    type: 'value' as const,
    axisLabel: { ...axisText(theme), formatter: fmt },
    splitLine: gridLine(theme),
  };
  return {
    animationDuration: 600,
    animationEasing: 'cubicOut',
    color: [main],
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: tooltip(theme, { trigger: 'axis', axisPointer: { type: 'none' }, valueFormatter: fmt }),
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.value),
        barMaxWidth: horizontal ? 8 : 10,
        itemStyle: { color: main, borderRadius: 3 },
      },
    ],
  };
}
