// Forest series legend (R3 viz review B1 closure).
//
// Multi-effect forest columns draw 2–4 differently-shaped, differently-
// colored marks per row; `effect.label` was captured by the renderers and
// then never surfaced anywhere — the flagship plot was uninterpretable
// without out-of-band documentation. This module is the single source for
// legend entries; the DOM (TabvizPlot) and SVG (svg-generator) paths both
// consume it so the key matches the marks by construction.
//
// Color/shape resolution MIRRORS RowInterval's getEffectStyle precedence
// (minus the row-level paint layers, which are per-row and don't belong
// in a column-level key):
//   color: effect.color ?? theme.series[i % n].fill ?? accent default
//   shape: effect.shape ?? theme.series[i].shape ?? 4-shape rotation

import type { WebSpec, WebTheme, MarkerShape, EffectSpec, ColumnSpec } from "../types";

export interface LegendEntry {
  label: string;
  color: string;
  shape: MarkerShape;
}

const SHAPE_ROTATION: MarkerShape[] = ["circle", "square", "diamond", "triangle"];

/** Resolve the legend entries for the first multi-effect forest column.
 *  Returns [] when no column needs a key (zero or one effect — a single
 *  series is self-explanatory). Effects without labels get "Series N". */
export function resolveForestLegend(
  spec: Pick<WebSpec, "columns"> | null | undefined,
  theme: WebTheme | null | undefined,
): LegendEntry[] {
  if (!spec) return [];
  // ColumnDef = ColumnSpec | ColumnGroup; groups have no type/options —
  // flatten one level so a grouped forest column is still found.
  const leaves: ColumnSpec[] = (spec.columns ?? []).flatMap((c) =>
    "isGroup" in c && c.isGroup && "columns" in c
      ? ((c as { columns?: ColumnSpec[] }).columns ?? [])
      : [c as ColumnSpec],
  );
  const col = leaves.find((c) => {
    if (c.type !== "forest") return false;
    const effects = (c.options as { forest?: { effects?: EffectSpec[] | null } } | undefined)
      ?.forest?.effects;
    return Array.isArray(effects) && effects.length >= 2;
  });
  if (!col) return [];
  const effects = (col.options as { forest?: { effects?: EffectSpec[] } }).forest!.effects!;

  const series = theme?.series ?? [];
  const fallback = theme?.accent?.default ?? "#2563eb";
  return effects.map((e, i) => {
    const slot = series[i % Math.max(1, series.length)];
    const color = e.color ?? slot?.fill ?? fallback;
    const slotShape = (series[i]?.shape ?? null) as MarkerShape | null;
    const shape = e.shape ?? slotShape ?? SHAPE_ROTATION[i % SHAPE_ROTATION.length]!;
    return { label: e.label ?? `Series ${i + 1}`, color, shape };
  });
}

/** SVG path for a legend glyph centered at (cx, cy) with the given size.
 *  Matches the mark shapes the renderers draw. */
export function legendGlyphSvg(
  shape: MarkerShape,
  cx: number,
  cy: number,
  size: number,
  color: string,
): string {
  const r = size / 2;
  switch (shape) {
    case "square":
      return `<rect x="${cx - r}" y="${cy - r}" width="${size}" height="${size}" fill="${color}"/>`;
    case "diamond":
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${color}"/>`;
    case "triangle":
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}" fill="${color}"/>`;
    case "circle":
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
  }
}
