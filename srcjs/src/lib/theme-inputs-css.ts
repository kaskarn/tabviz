// CSS variable emission from theme inputs.
//
// Emits `--tv-*` CSS custom properties from a ThemeStructure. Token names
// become CSS variable names directly: `ink` → `--tv-ink`, `brand_ink`
// → `--tv-brand-ink`, `rule_subtle` → `--tv-rule-subtle`, etc.
//
// Lives alongside the legacy theme-css.ts during the rationalization arc.
// PR I retires the legacy module.

import type { ThemeStructure, TokenName, RoleName } from "../types/theme-inputs";
import { resolveRef } from "./theme-resolve";

/** Token name → CSS variable name. `brand_ink` → `--tv-brand-ink`. */
function tokenToVar(token: TokenName): string {
  return `--tv-${token.replace(/_/g, "-")}`;
}

/** Build the full `--tv-*` CSS variable block from a ThemeStructure. */
export function buildThemeCssFromInputs(theme: ThemeStructure): string {
  const lines: string[] = [];

  // ── T2 tokens ────────────────────────────────────────────────────
  for (const [token, hex] of Object.entries(theme.tokens)) {
    lines.push(`  ${tokenToVar(token as TokenName)}: ${hex};`);
  }

  // ── Cluster-resolved CSS variables (chrome the renderer consumes) ─
  const ramps = theme.ramps;
  const c = theme.clusters;

  // Active header variant — render-time picks based on inputs.mode +
  // (future) variants.header_style. For now emit all three so CSS can
  // switch via class selector.
  const headerLight = c.header.light;
  const headerBoldBg = resolveRef(c.header.bold.bg, ramps);
  const headerBoldFg = resolveRef(c.header.bold.fg, ramps);

  lines.push(`  --tv-header-light-bg: ${resolveRef(headerLight.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-header-light-fg: ${resolveRef(headerLight.fg, ramps) ?? "inherit"};`);
  lines.push(`  --tv-header-bold-bg: ${headerBoldBg ?? "transparent"};`);
  lines.push(`  --tv-header-bold-fg: ${headerBoldFg ?? "inherit"};`);

  // Row states
  lines.push(`  --tv-row-bg: ${resolveRef(c.row.base.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-row-fg: ${resolveRef(c.row.base.fg, ramps) ?? "inherit"};`);
  lines.push(`  --tv-row-alt-bg: ${resolveRef(c.row.alt.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-row-hover-bg: ${resolveRef(c.row.hover.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-row-selected-bg: ${resolveRef(c.row.selected.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-row-selected-edge-width: ${c.row.selectedEdgeWidth}px;`);
  lines.push(`  --tv-row-border-width: ${c.row.borderWidth}px;`);

  // Cell
  lines.push(`  --tv-cell-bg: ${resolveRef(c.cell.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-cell-fg: ${resolveRef(c.cell.fg, ramps) ?? "inherit"};`);
  lines.push(`  --tv-cell-border: ${resolveRef(c.cell.border, ramps) ?? "transparent"};`);

  // First column
  lines.push(`  --tv-first-col-bg: ${resolveRef(c.firstColumn.default.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-first-col-bold-bg: ${resolveRef(c.firstColumn.bold.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-first-col-bold-fg: ${resolveRef(c.firstColumn.bold.fg, ramps) ?? "inherit"};`);

  // Plot
  lines.push(`  --tv-plot-bg: ${resolveRef(c.plot.bg, ramps) ?? "transparent"};`);
  lines.push(`  --tv-plot-axis: ${resolveRef(c.plot.axisLine, ramps) ?? "transparent"};`);
  lines.push(`  --tv-plot-tick: ${resolveRef(c.plot.tickMark, ramps) ?? "transparent"};`);
  lines.push(`  --tv-plot-gridline: ${resolveRef(c.plot.gridline, ramps) ?? "transparent"};`);
  lines.push(`  --tv-plot-reference: ${resolveRef(c.plot.reference, ramps) ?? "transparent"};`);
  lines.push(`  --tv-plot-tick-length: ${c.plot.tickMarkLength}px;`);
  lines.push(`  --tv-plot-line-width: ${c.plot.lineWidth}px;`);
  lines.push(`  --tv-plot-point-size: ${c.plot.pointSize}px;`);

  // RowGroup tiers
  for (const tier of ["L1", "L2", "L3"] as const) {
    const t = c.rowGroup[tier];
    const key = tier.toLowerCase();
    lines.push(`  --tv-row-group-${key}-bg: ${resolveRef(t.bg, ramps) ?? "transparent"};`);
    lines.push(`  --tv-row-group-${key}-fg: ${resolveRef(t.fg, ramps) ?? "inherit"};`);
    lines.push(`  --tv-row-group-${key}-rule: ${resolveRef(t.rule, ramps) ?? "transparent"};`);
    lines.push(`  --tv-row-group-${key}-weight: ${t.fontWeight ?? "inherit"};`);
  }

  // Paint roles — emit fg/bg vars per role for renderer-side CSS classes
  const roles = theme.roles;
  for (const roleName of Object.keys(roles) as RoleName[]) {
    const r = roles[roleName];
    const fg = resolveRef(r.fg ?? undefined, ramps);
    const bg = resolveRef(r.bg ?? undefined, ramps);
    if (fg !== null) lines.push(`  --tv-role-${roleName}-fg: ${fg};`);
    if (bg !== null) lines.push(`  --tv-role-${roleName}-bg: ${bg};`);
    if (r.fontWeight != null) {
      lines.push(`  --tv-role-${roleName}-weight: ${r.fontWeight};`);
    }
  }

  return `:root {\n${lines.join("\n")}\n}\n`;
}

/** Build the full :root block + a stable hash of theme inputs (for caching). */
export function buildThemeCssBlockFromInputs(theme: ThemeStructure): { css: string } {
  return { css: buildThemeCssFromInputs(theme) };
}
