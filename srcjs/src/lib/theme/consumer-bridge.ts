/**
 * Consumer migration bridge (Phase 6).
 *
 * During the substrate sprint, consumers transition from reading the v3
 * resolved theme object (`theme.row.alt.bg` etc.) to reading the v4 cssVars
 * map (`cssVars["--tv-row-alt-bg"]`). This module provides the bridge:
 * given a v3 WebTheme (which carries `authoringInputs`), it builds a v4
 * wire, runs `resolveTheme()`, and returns the cssVars map.
 *
 * Once all consumers have migrated, this bridge becomes unnecessary and
 * gets deleted (step 10 of Stage 1 §40 — v3 dead-code purge). Until then,
 * it lets consumers opt into reading v4 cssVars one cluster at a time
 * without committing to a wholesale rewrite.
 *
 * Usage pattern:
 *
 *   const cssVars = getCssVars(spec.theme);
 *   const bg = readVar(cssVars, "--tv-row-alt-bg", spec.theme.row.alt.bg);
 *   // bg is the v4 cssVar value when available; falls back to v3 read.
 *
 * The readVar helper supports the fallback so consumers can migrate
 * field-by-field with safe defaults.
 */

import type { WebTheme } from "../../types/theme-resolved";
import { createWire } from "./theme-wire";
import { resolveTheme } from "./resolve-theme";

/** Build the v4 cssVars map for a given v3 WebTheme.
 *
 *  When `theme.authoringInputs` is undefined (older specs, hand-built
 *  themes), returns an empty record — consumers fall back to reading
 *  v3 fields directly per `readVar(...)`.
 *
 *  After resolving from authoringInputs, applies theme.spacing.* as
 *  override pins. This honors callers that mutate `spec.theme.spacing.X`
 *  after construction (a v3-era pattern that bypasses the v4 wire). */
export function getCssVars(theme: WebTheme | undefined | null): Record<string, string> {
  if (!theme?.authoringInputs) return {};
  try {
    const wire = createWire(theme.authoringInputs, theme.name ?? "custom");
    const resolved = resolveTheme(wire);
    return applySpacingPins({ ...resolved.cssVars }, theme);
  } catch {
    // Resolver errors during the sprint are tolerated; consumers fall
    // back to v3 reads. Drift gates + visual regression catch silent
    // mismatches.
    return {};
  }
}

/** Apply theme.spacing.* + theme.plot.* + theme.row.borderWidth as override
 *  pins on the cssVars map. Mirrors the v3-side "spec.theme.spacing.X = N"
 *  mutation pattern so the v4 path stays in sync with v3 mutations. */
function applySpacingPins(
  cssVars: Record<string, string>,
  theme: WebTheme,
): Record<string, string> {
  const s = theme.spacing;
  // Each pin: only override when the field is set (preserves authoringInputs
  // density when no override exists).
  const pin = (cssVar: string, value: number | undefined): void => {
    if (value === undefined) return;
    cssVars[cssVar] = `${value}px`;
  };
  pin("--tv-spacing-row-height", s.rowHeight);
  pin("--tv-spacing-header-height", s.headerHeight);
  pin("--tv-spacing-padding", s.padding);
  pin("--tv-spacing-cell-padding-x", s.cellPaddingX);
  pin("--tv-spacing-cell-padding-y", s.cellPaddingY);
  pin("--tv-spacing-axis-gap", s.axisGap);
  pin("--tv-spacing-column-group-padding", s.columnGroupPadding);
  pin("--tv-spacing-row-group-padding", s.rowGroupPadding);
  pin("--tv-spacing-header-gap", s.headerGap);
  pin("--tv-spacing-footer-gap", s.footerGap);
  pin("--tv-spacing-title-subtitle-gap", s.titleSubtitleGap);
  pin("--tv-spacing-bottom-margin", s.bottomMargin);
  pin("--tv-spacing-indent-per-level", s.indentPerLevel);
  pin("--tv-spacing-container-padding", s.containerPadding);
  // Plot dims (non-density-scaled).
  if (theme.plot?.tickMarkLength !== undefined) pin("--tv-plot-tick-mark-length", theme.plot.tickMarkLength);
  if (theme.plot?.lineWidth !== undefined) pin("--tv-plot-line-width", theme.plot.lineWidth);
  if (theme.plot?.pointSize !== undefined) pin("--tv-plot-point-size", theme.plot.pointSize);
  return cssVars;
}

/** Read a cssVar with a v3 fallback.
 *
 *  Returns `cssVars[name]` when present (the v4 path); otherwise returns
 *  the `fallback` (the v3 field read). Treats placeholder values starting
 *  with `<` (TBD / input / computed / const) as "not yet resolved" and
 *  also falls back. */
export function readVar(
  cssVars: Record<string, string>,
  name: string,
  fallback: string | null | undefined,
): string | null | undefined {
  const v = cssVars[name];
  if (v === undefined) return fallback;
  if (v.startsWith("<")) return fallback;  // placeholder
  return v;
}

/** Read a dimensional (px) cssVar with a numeric v3 fallback.
 *
 *  Parses strings like `"16px"`, `"16"`, `"1.5"`, `"1.5px"` into the
 *  underlying number. Returns `fallback` when the cssVar is missing,
 *  a placeholder, or unparseable. Used for spacing/plot-dim tokens where
 *  consumers expect a `number` (e.g. `theme.plot.lineWidth: number`). */
export function readVarPx(
  cssVars: Record<string, string>,
  name: string,
  fallback: number,
): number {
  const v = cssVars[name];
  if (v === undefined) return fallback;
  if (v.startsWith("<")) return fallback;
  // Strip `px` suffix and parse. Tolerate float, integer, or numeric strings.
  const trimmed = v.endsWith("px") ? v.slice(0, -2) : v;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  return n;
}
