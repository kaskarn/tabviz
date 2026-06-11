// V3 user-config bridge values, as a MAP — the DYING tail (W4).
//
// What remains after the 2026-06-11 porting arcs: the firstColumn
// variant (4 rows — retires when first_column_style becomes a theme
// INPUT, the W3 pattern) and the borders cluster (11 rows — retires
// with the border-input design). Everything else was ported into real
// v4 resolver groups (header-active, ramp-direct, role/anchor/const
// entries, the typography header role) or moved to
// computeLiveConfigVars (rows reading blob fields that deliberately
// STAY on the wire — series, layout).
//
// Single source: theme-css.ts emits from these maps; consumer-bridge
// overlays them onto resolved cssVars. Both surfaces agree by
// construction. W4 done-condition: computeV3BridgeVars deletes.

import type { WebTheme } from "../../types";
import { componentChannelOverride } from "./component-bindings";
import { TOKENS_BY_VAR } from "./component-tokens";

/** LIVE-CONFIG emissions — NOT v3 debt. These read blob fields the W4
 *  verdict table deliberately keeps (`series` = the slot system;
 *  `layout` = spec-side figure config). They ride the same overlay path
 *  as the bridge but SURVIVE W4. */
export function computeLiveConfigVars(
  theme: WebTheme,
  cv: Record<string, string>,
): Record<string, string> {
  const v4Accent = cv["--tv-accent"] ?? "#2563eb";
  return {
    // Pooled-summary marker reads slot 0 — the slot system is
    // deliberately separate from the component model.
    "--tv-summary-fill":   theme.series?.[0]?.fill ?? v4Accent,
    "--tv-summary-border": theme.series?.[0]?.stroke ?? v4Accent,
    "--tv-container-border": theme.layout.containerBorder ? "1px solid var(--tv-border)" : "none",
    "--tv-container-border-radius": `${theme.layout.containerBorderRadius}px`,
  };
}

/** Compute the v3 bridge token values for a theme.
 *
 *  `cv` is the BASE resolved cssVars (pre-overlay) — used only for the
 *  v4-derived fallbacks, passed in by the caller to avoid an import
 *  cycle (theme-css → consumer-bridge → this module). */
export function computeV3BridgeVars(
  theme: WebTheme,
  cv: Record<string, string>,
): Record<string, string> {
  const v4Text       = cv["--tv-text"] ?? "#1a1a1a";
  const v4TextSubtle = cv["--tv-text-muted"] ?? "#64748b";
  const v4Border     = cv["--tv-border"] ?? "#e2e8f0";
  const v4Accent     = cv["--tv-accent"] ?? "#2563eb";

  const dbl = (style: string | undefined, thickness: number, floor = 0): number =>
    style === "double" ? Math.max(3, thickness * 3) : Math.max(thickness, floor);

  const out: Record<string, string> = {
    "--tv-row-border-width":   `${dbl(theme.borders.minor.style, theme.borders.minor.thickness)}px`,
    "--tv-header-border-width": `${dbl(theme.borders.major.style, theme.borders.major.thickness, 2)}px`,
    "--tv-group-border-width": `${dbl(theme.borders.major.style, theme.borders.major.thickness)}px`,
    "--tv-border-major-color": theme.borders.major.color,
    "--tv-border-minor-color": theme.borders.minor.color,
    "--tv-border-table-color": theme.borders.table.color,
    "--tv-border-row-style":
      (theme.borders.layout === "horizontal" || theme.borders.layout === "grid")
        ? (theme.borders.minor.style === "double" ? "double" : "solid")
        : "none",
    "--tv-border-col-style":
      (theme.borders.layout === "vertical" || theme.borders.layout === "grid")
        ? (theme.borders.minor.style === "double" ? "double" : "solid")
        : "none",
    "--tv-border-major-style": theme.borders.major.style === "double" ? "double" : "solid",
    "--tv-table-border-width": `${theme.borders.table.style === "double" ? Math.max(3, theme.borders.table.thickness * 3) : theme.borders.table.thickness}px`,
    "--tv-table-border-style": theme.borders.table.thickness > 0 ? (theme.borders.table.style === "double" ? "double" : "solid") : "none",
  };
  // Component-model guard (W6): a bridged token with an ACTIVE re-route
  // must keep its v4-resolved value — the bridge would otherwise stamp the
  // v3 config back over the user's `components` edit and the re-route
  // would be silently inert on exactly the tokens v3 still owns
  // (--tv-text-title-fg was the live case). The bridge itself retires
  // with W4; this keeps the verb honest until then.
  for (const k of Object.keys(out)) {
    const tok = TOKENS_BY_VAR.get(k);
    if (tok && componentChannelOverride(tok, theme.components) !== null) {
      delete out[k];
    }
  }
  return out;
}
