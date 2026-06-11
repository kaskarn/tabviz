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
import { computeV3BridgeVars } from "./v3-bridge-vars";
import { getCssVars, getCssVarsRaw, applySpacingPins } from "./consumer-bridge";
import { VIZ_MARGIN } from "../axis-utils";

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
  // Single-emission rewrite (2026-06-04):
  //
  //   The function previously emitted TWO parallel `--tv-*` blocks: a v3
  //   computation block (reading theme.X.Y from buildThemeStructure's
  //   resolved output) and a v4 manifest block (from resolveTheme's
  //   cssVars map). Same value sometimes appeared twice with subtle
  //   resolver drift between the two paths.
  //
  //   Now: v4 manifest emits first (canonical source of theme values),
  //   then a v3-alias block redirects every v3 var name to its v4
  //   manifest equivalent via CSS `var()` lookup. The DOM still has
  //   v3 names so existing Svelte/CSS consumers keep working — but
  //   the VALUES come from one source, eliminating drift.
  //
  //   Each `[v3-name]: var([v4-name])` line is a bridge. When
  //   the last Svelte consumer of a v3 name migrates to its v4
  //   counterpart, the alias line dies. When every alias is gone,
  //   this whole function can drop down to just `_emitV4CssVarsBody`.
  //
  //   A small tail of v3 vars STILL need computation from theme.X.Y
  //   because they have no v4 manifest equivalent yet:
  //     - header variants (bg/fg/rule depend on theme.variants.headerStyle)
  //     - first-column variants (bg/fg/weight from theme.firstColumn)
  //     - borders (theme.borders.{major,minor,table}.{color,style,...})
  //     - per-role italic (italic was dropped from v4 typography in
  //       Coh.22; emit hardcoded "normal" here as a kill-row)
  //     - text-numeric-figures (tabular-num flag; not in v4 manifest)
  //     - row-group-rule / semantic-* (depend on theme.rowGroup, theme.row.X)
  //   These cluster at the bottom and shrink as v4 manifest extends.
  // ───────────────────────────────────────────────────────────────────────

  const v4Body = _emitV4CssVarsBody(theme);
  // Compute v4 cssVars once for fallback paths in the v3 tail — eliminates
  // the v3-chrome read drift (e.g. theme.content.primary was slightly
  // different from --tv-text in the v4 manifest because the two resolvers
  // diverged at the 4th decimal of OKLCH).
  const cv = getCssVars(theme);

  // V3 user-config bridge values — single-sourced from
  // computeV3BridgeVars (v3-bridge-vars.ts) so this emission and
  // getCssVars' overlay agree by construction (R3 studio F3/F4: the
  // inline duplicates here diverged from what consumers read).
  const bridgeVars = computeV3BridgeVars(theme, cv);
  const bridgeBody = Object.entries(bridgeVars)
    .map(([k, v]) => `      ${k}: ${v};`)
    .join("\n");

  return `
      /* ── V4 manifest cssVars — canonical source of theme values. */
${v4Body}
      /* Literal font-weight constants — utility classes read these. */
      --tv-font-weight-normal:  400;
      --tv-font-weight-bold:    600;
      --tv-header-font-scale:   1.05;
      --tv-viz-margin:          ${VIZ_MARGIN}px;

      /* ── V3 user-config bridges (single source: v3-bridge-vars.ts).
            Each cluster has a follow-up task (#72-#74) to become a
            manifest entry. */
${bridgeBody}
    `.trim();
}

/** Append v4 cssVars from theme.authoringInputs. Empty when authoringInputs
 *  is unavailable (legacy / programmatic themes); v3 path continues to work
 *  unchanged in that case.
 *
 *  Failure policy (unified in Pass 0d-ii): a resolver throw here used to be
 *  swallowed silently — the ENTIRE v4 var block vanished and every theme
 *  value fell back to the v3 tail with zero observability. Now dev
 *  re-throws (CI/tests surface the bug at the moment of introduction) and
 *  prod logs loudly before degrading to the v3-tail fallback. */
function _emitV4CssVarsBody(theme: WebTheme): string {
  if (!theme.authoringInputs) return "";
  try {
    // roleOverrides + pins ride this resolve too (P0 review finding #1 /
    // the P0.1 lesson): this is the WIDGET PAINT path. It shares the
    // CACHED getCssVarsRaw with the export path (one cascade per paint),
    // then overlays spacing pins — which live OUTSIDE the cache key
    // (theme.spacing is per-figure, not cascade-derived). Without the
    // overlay the painted CSS padding diverged from both the JS layout
    // and the SVG export, which read the full getCssVars (round-2
    // cross-runtime review P1). The v3-bridge vars are emitted separately
    // by _buildThemeCSSImpl, so only spacing is overlaid here.
    const varsWithPins = applySpacingPins({ ...getCssVarsRaw(theme) }, theme);
    const lines: string[] = [];
    for (const [name, value] of Object.entries(varsWithPins)) {
      // Skip placeholder values (TBD / input / computed sentinels).
      if (value.startsWith("<")) continue;
      lines.push(`      ${name}: ${value};`);
    }
    return lines.join("\n");
  } catch (e) {
    if (_isDevBuild()) throw e;
    // eslint-disable-next-line no-console
    console.error(
      `tabviz: v4 cssVars emission failed for theme "${theme.name ?? "custom"}"; ` +
      `rendering on v3 fallbacks only.`,
      e,
    );
    return "";
  }
}

/** True under vite dev / vitest / bun:test (mirrors resolve-theme's isDev). */
function _isDevBuild(): boolean {
  try {
    return (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== true;
  } catch {
    return true;
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
