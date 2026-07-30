/**
 * Theme → CSS custom properties.
 *
 * The widget applies a set of `--tv-*` CSS custom properties to its root
 * container; descendants read these for color, typography, spacing, etc.
 * This module produces those properties as a string from a resolved theme.
 *
 * There are two surfaces:
 *
 *   - `buildThemeCSS(theme)` — portable, depends only on the theme. The
 *     output is suitable for inspection, export, or applying to a non-tabviz
 *     element to match its styling. Memoized by theme identity.
 *
 *   - `buildWidgetCSS(theme, ctx)` — full CSS used by the running widget.
 *     Composes `buildThemeCSS` plus a small set of widget-instance vars
 *     (max-width/max-height clamps, header/axis dimensions, zoom/scale).
 *
 * The public alias `getThemeCSS` is what consumers should call.
 */

import type { WebTheme } from "../../types/theme-resolved";
import { composeCssVars } from "./consumer-bridge";
import { VIZ_MARGIN } from "../axis-utils";
import { isDevBuild } from "../build-env";

// ─────────────────────────────────────────────────────────────────────────
// Caches
// ─────────────────────────────────────────────────────────────────────────

// Resolved themes are stable references between cascade runs (the cascade
// produces a fresh object identity per resolution). Once a theme reaches
// here, its identity persists until the user changes inputs/variants, at
// which point a new theme object arrives and the old cache entry GCs.
const _themeCSSCache = new WeakMap<WebTheme, string>();

// ─────────────────────────────────────────────────────────────────────────
// Widget-instance context
// ─────────────────────────────────────────────────────────────────────────

export interface WidgetCSSContext {
  /** Outer container clamps — null means "no clamp". */
  maxWidth: number | null;
  maxHeight: number | null;
  /** True if any column has a visible header (drives header-height collapse). */
  anyHeaderVisible: boolean;
  /** Pixel height of the entire header block (all rows combined). */
  headerHeight: number;
  /** Number of header rows in the multi-row header (1 = flat). */
  headerDepth: number;
  /** Effective rendered header depth (collapsed/expanded state). */
  effectiveHeaderDepth: number;
  /** Pixel height of the inline axis. */
  axisHeight: number;
  /** Pixel width of the forest plot column(s). */
  forestWidth: number;
  /** Final scale applied to the scalable subtree (auto-fit zoom). */
  actualScale: number;
  /** User-requested zoom (independent of auto-fit). */
  zoom: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build the portable theme CSS — only theme-derived custom properties, no
 * widget-instance state. Suitable for inspection, sharing, or applying
 * tabviz colors to surrounding chrome.
 *
 * Memoized by theme reference identity.
 */
export function buildThemeCSS(theme: WebTheme): string {
  const hit = _themeCSSCache.get(theme);
  if (hit !== undefined) return hit;
  const built = _buildThemeCSSImpl(theme);
  _themeCSSCache.set(theme, built);
  return built;
}

/** Public alias intended for export/inspection consumers. */
export const getThemeCSS = buildThemeCSS;

/**
 * Build the complete widget CSS used by the running TabvizPlot — theme
 * tokens plus widget-instance vars (max-width/height, header/axis
 * dimensions, zoom).
 */
export function buildWidgetCSS(
  theme: WebTheme | null | undefined,
  ctx: WidgetCSSContext
): string {
  if (!theme) return "";
  return buildThemeCSS(theme) + "\n" + _buildWidgetExtras(ctx);
}

// ─────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────

function _buildThemeCSSImpl(theme: WebTheme): string {
  // ───────────────────────────────────────────────────────────────────────
  // SINGLE V4 EMISSION (W4 complete, 2026-06-11). This function emits ONLY:
  //   1. `_emitV4CssVarsBody` — the composed cssVars map (canonical source;
  //      cascade + token pins + live-config + spacing pins, all of it owned
  //      by consumer-bridge's composeCssVars).
  //   2. A handful of literal utility constants (font weights, header scale,
  //      viz margin) that aren't theme-derived.
  // There is NO v3-alias block and NO v3-tail computation anymore: W4 ported
  // header/first-column/border/italic/numeric-figures/row-group/semantic vars
  // into real v4 resolver groups (computeV3BridgeVars was deleted). Lockstep
  // with getCssVars is now STRUCTURAL — both read composeCssVars — rather
  // than a review promise (gate: role-overrides-wiring.test.ts).
  // ───────────────────────────────────────────────────────────────────────

  return `
      /* ── V4 manifest cssVars — canonical source of theme values.
            Includes the live-config bridge (series slot 0 + layout), which
            composeCssVars overlays: this block and what every consumer
            reads through getCssVars are now the SAME map by construction,
            not two compositions kept in step by review. */
${_emitV4CssVarsBody(theme)}
      /* Literal font-weight constants — utility classes read these. */
      --tv-font-weight-normal:  400;
      --tv-font-weight-bold:    600;
      --tv-header-font-scale:   1.05;
      --tv-viz-margin:          ${VIZ_MARGIN}px;
    `.trim();
}

/** Emit the theme's cssVars as CSS declarations. Empty when authoringInputs
 *  is unavailable (legacy / programmatic themes).
 *
 *  Composition is NOT done here — `composeCssVars` owns it, and this is one
 *  of its two consumers (the other is `getCssVars`). Until 2026-07-28 this
 *  function assembled its own map (cascade + spacing pins) while
 *  `_buildThemeCSSImpl` separately appended the live-config vars and
 *  `getCssVars` assembled a third, differently-ordered variant — three
 *  spellings of one composition, held in step only by review and the
 *  role-overrides-wiring gate. Now the paint block and every consumer read
 *  the same function.
 *
 *  What DOES live here is the failure POLICY, which is genuinely different
 *  from getCssVars': dev re-throws so CI surfaces a resolver bug at the
 *  moment of introduction; production logs loudly and drops the block. */
function _emitV4CssVarsBody(theme: WebTheme): string {
  if (!theme.authoringInputs) return "";
  try {
    const lines: string[] = [];
    for (const [name, value] of Object.entries(composeCssVars(theme))) {
      // Skip placeholder values (TBD / input / computed sentinels).
      if (value.startsWith("<")) continue;
      lines.push(`      ${name}: ${value};`);
    }
    return lines.join("\n");
  } catch (e) {
    if (isDevBuild()) throw e;
    // eslint-disable-next-line no-console
    console.error(
      `tabviz: v4 cssVars emission failed for theme "${theme.name ?? "custom"}"; ` +
      `theme values dropped from this block.`,
      e,
    );
    return "";
  }
}

function _buildWidgetExtras(ctx: WidgetCSSContext): string {
  return `
      --tv-max-width: ${ctx.maxWidth ? `${ctx.maxWidth}px` : "none"};
      --tv-max-height: ${ctx.maxHeight ? `${ctx.maxHeight}px` : "none"};
      --tv-header-height: ${ctx.anyHeaderVisible ? ctx.headerHeight : 0}px;
      --tv-header-row-height: ${ctx.anyHeaderVisible ? ctx.headerHeight / ctx.headerDepth : 0}px;
      --tv-axis-height: ${ctx.axisHeight}px;
      --tv-actual-scale: ${ctx.actualScale};
      --tv-zoom: ${ctx.zoom};
    `.trim();
}

// emitCssVarsFromManifest stub deleted 2026-06-03. The substrate's wire is
// `ResolvedTheme.cssVars` directly — built by `resolveTheme(wire)` in
// `lib/theme/resolve-theme.ts`. The M2-era placeholder-emit stub was a
// dispatch-shape canary; v4-preset-coverage.test.ts now validates the same
// invariant (and more) across the full 18-preset roster.
