/**
 * Single source of truth for the density px scales.
 *
 * The 15 spacing concepts (row_height, header_height, padding, ...) each
 * carry three different "labels" depending on who's reading:
 *
 *   - concept name      — `row_height`        — used here as the key
 *   - SpacingTokens key — `rowHeight`         — the v3 adapter's shape
 *   - cssVar            — `--tv-spacing-row-height` — the v4 wire
 *
 * Authors edit this one table; the two projection helpers derive the
 * other two shapes. Mirrors the v3 path's `DENSITY_SPACING` (in
 * `theme-adapter.ts`) and the v4 path's `DENSITY_PRESETS` (in
 * `resolve-theme.ts`) so they cannot drift.
 */

export type DensityPreset = "compact" | "comfortable" | "spacious";

/** Canonical density px scale, keyed by concept name. */
export const DENSITY_PX: Record<DensityPreset, Record<string, number>> = {
  compact: {
    row_height: 20, header_height: 26, padding: 8, container_padding: 0,
    axis_gap: 8, column_group_padding: 6, row_group_padding: 8,
    cell_padding_x: 8, cell_padding_y: 0, group_padding: 6,
    footer_gap: 6, title_subtitle_gap: 10,
    header_gap: 8, bottom_margin: 12, indent_per_level: 14,
  },
  comfortable: {
    row_height: 24, header_height: 32, padding: 12, container_padding: 0,
    axis_gap: 12, column_group_padding: 8, row_group_padding: 12,
    cell_padding_x: 10, cell_padding_y: 0, group_padding: 8,
    footer_gap: 8, title_subtitle_gap: 13,
    header_gap: 12, bottom_margin: 16, indent_per_level: 16,
  },
  spacious: {
    row_height: 30, header_height: 40, padding: 16, container_padding: 0,
    axis_gap: 16, column_group_padding: 12, row_group_padding: 16,
    cell_padding_x: 14, cell_padding_y: 0, group_padding: 12,
    footer_gap: 12, title_subtitle_gap: 18,
    header_gap: 16, bottom_margin: 22, indent_per_level: 20,
  },
};

/** snake_case → camelCase for the SpacingTokens shape. */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** snake_case concept → cssVar `--tv-spacing-<dashed>`. */
function snakeToCssVar(key: string): string {
  return `--tv-spacing-${key.replace(/_/g, "-")}`;
}

/** Project the canonical DENSITY_PX into the SpacingTokens camelCase shape
 *  the v3 adapter consumes. */
export function densityPresetAsSpacingTokens(
  preset: DensityPreset,
): Record<string, number> {
  const src = DENSITY_PX[preset];
  const out: Record<string, number> = {};
  for (const k of Object.keys(src)) out[snakeToCamel(k)] = src[k]!;
  return out;
}

/** Project the canonical DENSITY_PX into the cssVar-keyed shape the v4
 *  resolver looks up. */
export function densityPresetAsCssVars(
  preset: DensityPreset,
): Record<string, number> {
  const src = DENSITY_PX[preset];
  const out: Record<string, number> = {};
  for (const k of Object.keys(src)) out[snakeToCssVar(k)] = src[k]!;
  return out;
}
