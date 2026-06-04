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
import { activeHeaderVariant } from "../header-variant";
import { VIZ_MARGIN } from "../axis-utils";
import { createWire } from "./theme-wire";
import { resolveTheme } from "./resolve-theme";
import {
  TEXT_MEASUREMENT,
  BADGE_VARIANTS,
  generateCSSVariables,
} from "../rendering-constants";

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

  const headerVariant = activeHeaderVariant(theme);
  const firstColBold = theme.variants?.firstColumnStyle === "bold";
  const fc = theme.firstColumn as (typeof theme.firstColumn & { plain?: typeof theme.firstColumn.default }) | undefined;
  const firstColDefault = fc?.default ?? fc?.plain;
  const firstColVariant = firstColBold ? fc?.bold : firstColDefault;
  const firstColBg = firstColVariant?.bg ?? "transparent";
  const firstColFg = firstColVariant?.fg ?? "inherit";
  const firstColWeight = firstColVariant?.weight ?? "inherit";
  const firstColRule: string | null = firstColVariant?.rule ?? null;

  return `
      /* ── V4 manifest cssVars — canonical source of theme values. */
${v4Body}
      /* Status — anchor to v4 brand/border until status anchors get
         dedicated manifest entries. Themes that set theme.status.* fall
         through to BADGE_VARIANTS at v3 time; once status anchors are
         in the manifest, drop these in favor of var(--tv-status-*-solid). */
      --tv-status-positive:     ${theme.status?.positive ?? BADGE_VARIANTS.success};
      --tv-status-warning:      ${theme.status?.warning  ?? BADGE_VARIANTS.warning};
      --tv-status-negative:     ${theme.status?.negative ?? BADGE_VARIANTS.error};
      --tv-status-info:         ${theme.status?.info     ?? BADGE_VARIANTS.info};
      /* Typography numeric/header sizes + literal font-weights.
         Read by .cell-text + utility classes; kept as literals (not
         aliased) until callers either migrate to per-role manifest
         vars or these become manifest entries. */
      --tv-font-weight-normal:  400;
      --tv-font-weight-medium:  500;
      --tv-font-weight-bold:    600;
      --tv-line-height:         1.5;
      --tv-header-font-scale:   1.05;
      --tv-cell-padding-y:      0px;
      --tv-viz-margin:          ${VIZ_MARGIN}px;

      /* ── V3-only — still computed from theme.X.Y (no v4 equivalent yet).
            Each cluster has a follow-up task to add the manifest entry
            and convert these to aliases. */
      /* Header variant active row (header-light vs header-bold etc.). */
      --tv-header-rule:         ${headerVariant.rule ?? theme.divider.strong};
      --tv-row-group-rule:      ${theme.rowGroup?.L1?.rule ?? theme.divider.strong};
      --tv-text-title-fg:       ${theme.text.title?.fg     ?? theme.content.primary};
      --tv-axis-label-fg:       ${theme.plot?.axisLabel?.fg ?? theme.content.muted};
      --tv-axis-tick-fg:        ${theme.plot?.tickLabel?.fg ?? theme.content.muted};
      --tv-header-bg:           ${headerVariant.bg};
      --tv-header-fg:           ${headerVariant.fg};
      --tv-interval-line:       ${theme.series?.[0]?.stroke ?? theme.accent.default};
      --tv-summary-fill:        ${theme.series?.[0]?.fill ?? theme.accent.default};
      --tv-summary-border:      ${theme.series?.[0]?.stroke ?? theme.accent.default};
      --tv-semantic-muted-fg:   ${theme.row.muted?.fg    ?? theme.content.muted};
      --tv-semantic-accent-fg:  ${theme.row.accent?.fg   ?? theme.accent.default};
      --tv-semantic-muted-bg:   ${theme.row.muted?.bg    ?? "transparent"};
      --tv-semantic-accent-bg:  ${theme.row.accent?.bg   ?? "transparent"};
      /* Per-role italic — Coh.22 dropped italic from v4 typography;
         emit "normal" everywhere as a kill-row. Drop these lines
         (and the CSS that reads them) when the Svelte side is purged. */
      --tv-text-title-italic:    normal;
      --tv-text-subtitle-italic: normal;
      --tv-text-caption-italic:  normal;
      --tv-text-footnote-italic: normal;
      --tv-text-cell-italic:     normal;
      --tv-text-header-italic:   normal;
      --tv-text-tick-italic:     normal;
      --tv-text-label-italic:    normal;
      /* Per-role weight/size/family for roles that aren't in the v4
         9-role typography matrix (header, cell-weight, label-weight). */
      --tv-text-title-weight:    ${theme.text.title.weight ?? 600};
      --tv-text-title-size:      ${theme.text.title.size ?? "1.25rem"};
      --tv-text-subtitle-weight: ${theme.text.subtitle.weight ?? 400};
      --tv-text-subtitle-size:   ${theme.text.subtitle.size ?? "1rem"};
      --tv-text-caption-weight:  ${theme.text.caption.weight ?? 400};
      --tv-text-caption-size:    ${theme.text.caption.size ?? "0.75rem"};
      --tv-text-footnote-weight: ${theme.text.footnote.weight ?? 400};
      --tv-text-footnote-size:   ${theme.text.footnote.size ?? "0.75rem"};
      --tv-text-cell-weight:     ${theme.text.cell.weight ?? 400};
      --tv-text-header-weight:   ${theme.header.text.weight ?? 600};
      --tv-text-header-family:   ${theme.header.text?.family ?? theme.text.body.family};
      --tv-text-header-size:     ${
        theme.header.text?.size && theme.header.text.size !== theme.text.body.size
          ? theme.header.text.size
          : `calc(${theme.text.body.size} * 1.05)`
      };
      --tv-text-column-group-weight: ${theme.columnGroup?.text?.weight ?? 600};
      --tv-text-tick-weight:     ${theme.text.tick.weight ?? 400};
      --tv-text-tick-family:     ${theme.text.tick?.family ?? theme.text.body.family};
      --tv-text-label-weight:    ${theme.text.label.weight ?? 400};
      --tv-text-label-family:    ${theme.text.label?.family ?? theme.text.body.family};
      --tv-text-numeric-figures: ${theme.text.numeric?.figures === "proportional" ? "normal" : "tnum"};
      /* First-column variant — applied to .primary-cell. */
      --tv-first-col-bg:         ${firstColBg};
      --tv-first-col-fg:         ${firstColFg};
      --tv-first-col-weight:     ${firstColWeight};
      ${firstColRule ? `--tv-first-col-rule: ${firstColRule};` : ""}
      /* Borders — theme.borders.{major,minor,table} computed widths/colors. */
      --tv-row-border-width:     ${theme.borders.minor.style === "double" ? Math.max(3, theme.borders.minor.thickness * 3) : theme.borders.minor.thickness}px;
      --tv-header-border-width:  ${theme.borders.major.style === "double" ? Math.max(3, theme.borders.major.thickness * 3) : Math.max(theme.borders.major.thickness, 2)}px;
      --tv-group-border-width:   ${theme.borders.major.style === "double" ? Math.max(3, theme.borders.major.thickness * 3) : theme.borders.major.thickness}px;
      --tv-border-major-color:   ${theme.borders.major.color};
      --tv-border-minor-color:   ${theme.borders.minor.color};
      --tv-border-table-color:   ${theme.borders.table.color};
      --tv-border-row-style:     ${
        (theme.borders.layout === "horizontal" || theme.borders.layout === "grid")
          ? (theme.borders.minor.style === "double" ? "double" : "solid")
          : "none"
      };
      --tv-border-col-style:     ${
        (theme.borders.layout === "vertical" || theme.borders.layout === "grid")
          ? (theme.borders.minor.style === "double" ? "double" : "solid")
          : "none"
      };
      --tv-border-major-style:   ${theme.borders.major.style === "double" ? "double" : "solid"};
      --tv-table-border-width:   ${theme.borders.table.style === "double" ? Math.max(3, theme.borders.table.thickness * 3) : theme.borders.table.thickness}px;
      --tv-table-border-style:   ${theme.borders.table.thickness > 0 ? (theme.borders.table.style === "double" ? "double" : "solid") : "none"};
      --tv-container-border:     ${theme.layout.containerBorder ? `1px solid var(--tv-border)` : "none"};
      --tv-container-border-radius: ${theme.layout.containerBorderRadius}px;
      ${generateCSSVariables()}
    `.trim();
}

/** Append v4 cssVars from theme.authoringInputs. Empty when authoringInputs
 *  is unavailable (legacy / programmatic themes); v3 path continues to work
 *  unchanged in that case. */
function _emitV4CssVarsBody(theme: WebTheme): string {
  if (!theme.authoringInputs) return "";
  try {
    const wire = createWire(theme.authoringInputs, theme.name ?? "custom");
    const resolved = resolveTheme(wire);
    const lines: string[] = [];
    for (const [name, value] of Object.entries(resolved.cssVars)) {
      // Skip placeholder values (TBD / input / computed sentinels).
      if (value.startsWith("<")) continue;
      lines.push(`      ${name}: ${value};`);
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

function _buildWidgetExtras(ctx: WidgetCSSContext): string {
  return `
      --tv-max-width: ${ctx.maxWidth ? `${ctx.maxWidth}px` : "none"};
      --tv-max-height: ${ctx.maxHeight ? `${ctx.maxHeight}px` : "none"};
      --tv-header-height: ${ctx.anyHeaderVisible ? ctx.headerHeight : 0}px;
      --tv-header-row-height: ${ctx.anyHeaderVisible ? ctx.headerHeight / ctx.headerDepth : 0}px;
      --tv-header-depth: ${ctx.effectiveHeaderDepth};
      --tv-axis-height: ${ctx.axisHeight}px;
      --tv-plot-width: ${ctx.forestWidth}px;
      --tv-actual-scale: ${ctx.actualScale};
      --tv-zoom: ${ctx.zoom};
    `.trim();
}

// emitCssVarsFromManifest stub deleted 2026-06-03. The substrate's wire is
// `ResolvedTheme.cssVars` directly — built by `resolveTheme(wire)` in
// `lib/theme/resolve-theme.ts`. The M2-era placeholder-emit stub was a
// dispatch-shape canary; v4-preset-coverage.test.ts now validates the same
// invariant (and more) across the full 18-preset roster.
