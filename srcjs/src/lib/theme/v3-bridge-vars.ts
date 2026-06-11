// V3 user-config bridge values, as a MAP.
//
// These ~28 tokens have no v4 manifest resolver (they derive from
// user-pinnable WebTheme config: borders, header variant, first-column
// variant, title/axis text fg, …). The v4 manifest emits the literal
// sentinel "<v3-bridge>" for them; the real values were computed inline
// in theme-css.ts's template string — which meant `getCssVars()` (and
// therefore R's `theme_css_vars()` / `diff_themes()` / `inspect_token()`
// and any TS consumer reading via the bridge) returned the SENTINEL
// while the painted CSS had the real value (R3 studio effectiveness
// F3/F4: 16 tokens reported "<V3-BRIDGE>" in R, and --tv-text-title-fg
// diverged between the studio preview and the R render).
//
// Single source: theme-css.ts emits from this map; consumer-bridge
// overlays it onto resolved cssVars. Both surfaces agree by construction.

import type { WebTheme } from "../../types";
import { activeHeaderVariant } from "../header-variant";
import { componentChannelOverride } from "./component-bindings";
import { TOKENS_BY_VAR } from "./component-tokens";

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

  const headerVariant = activeHeaderVariant(theme);
  const firstColBold = theme.variants?.firstColumnStyle === "bold";
  const fc = theme.firstColumn as (typeof theme.firstColumn & { plain?: typeof theme.firstColumn.default }) | undefined;
  const firstColDefault = fc?.default ?? fc?.plain;
  const firstColVariant = firstColBold ? fc?.bold : firstColDefault;

  const dbl = (style: string | undefined, thickness: number, floor = 0): number =>
    style === "double" ? Math.max(3, thickness * 3) : Math.max(thickness, floor);

  const out: Record<string, string> = {
    "--tv-header-rule":        headerVariant.rule ?? v4Border,
    "--tv-row-group-rule":     theme.rowGroup?.L1?.rule ?? v4Border,
    "--tv-header-bg":          headerVariant.bg ?? "transparent",
    "--tv-header-fg":          headerVariant.fg ?? v4Text,
    "--tv-summary-fill":       theme.series?.[0]?.fill ?? v4Accent,
    "--tv-summary-border":     theme.series?.[0]?.stroke ?? v4Accent,
    "--tv-first-col-bg":       firstColVariant?.bg ?? "transparent",
    "--tv-first-col-fg":       firstColVariant?.fg ?? "inherit",
    "--tv-first-col-weight":   String(firstColVariant?.weight ?? "inherit"),
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
    "--tv-container-border":   theme.layout.containerBorder ? "1px solid var(--tv-border)" : "none",
    "--tv-container-border-radius": `${theme.layout.containerBorderRadius}px`,
  };
  // "transparent" when the variant has no rule — the consumer's
  // documented default (TabvizPlot .primary-cell: transparent means
  // "don't override .grid-cell's border"). Emitting it always also
  // clears the manifest's <v3-bridge> sentinel for this token.
  out["--tv-first-col-rule"] = firstColVariant?.rule ?? "transparent";
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
