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

import type { WebThemeV2 } from "../types/theme-v2";
import { activeHeaderVariant } from "./header-variant";
import { VIZ_MARGIN } from "./axis-utils";
import {
  TEXT_MEASUREMENT,
  BADGE_VARIANTS,
  generateCSSVariables,
} from "./rendering-constants";

// ─────────────────────────────────────────────────────────────────────────
// Caches
// ─────────────────────────────────────────────────────────────────────────

// Resolved themes are stable references between cascade runs (the cascade
// produces a fresh object identity per resolution). Once a theme reaches
// here, its identity persists until the user changes inputs/variants, at
// which point a new theme object arrives and the old cache entry GCs.
const _themeCSSCache = new WeakMap<WebThemeV2, string>();

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
export function buildThemeCSS(theme: WebThemeV2): string {
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
  theme: WebThemeV2 | null | undefined,
  ctx: WidgetCSSContext
): string {
  if (!theme) return "";
  return buildThemeCSS(theme) + "\n" + _buildWidgetExtras(ctx);
}

// ─────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────

function _buildThemeCSSImpl(theme: WebThemeV2): string {
  const headerVariant = activeHeaderVariant(theme);
  const firstColBold = theme.variants?.firstColumnStyle === "bold";
  const firstColVariant = firstColBold ? theme.firstColumn?.bold : theme.firstColumn?.plain;
  const firstColBg = firstColVariant?.bg ?? "transparent";
  const firstColFg = firstColVariant?.fg ?? "inherit";
  const firstColWeight = firstColVariant?.weight ?? "inherit";
  const firstColRule = firstColVariant?.rule ?? "transparent";

  const inputs = theme.inputs as
    | { primary?: string; primaryDeep?: string; secondary?: string; secondaryDeep?: string }
    | undefined;
  const primary = inputs?.primary ?? theme.accent.default;
  const primaryDeep = inputs?.primaryDeep ?? inputs?.primary ?? theme.accent.default;
  const secondary = inputs?.secondary ?? inputs?.primary ?? theme.accent.default;
  const secondaryDeep = inputs?.secondaryDeep ?? inputs?.primaryDeep ?? theme.accent.default;

  return `
      --tv-bg: ${theme.surface.base};
      --tv-fg: ${theme.content.primary};
      /* Identity tiers (2-tier mirror chain: secondary→primary). */
      --tv-primary:        ${primary};
      --tv-primary-deep:   ${primaryDeep};
      --tv-secondary:      ${secondary};
      --tv-secondary-deep: ${secondaryDeep};
      /* Engagement (orthogonal to identity). */
      --tv-accent: ${theme.accent.default};
      /* Text-muted (was --tv-secondary in pre-rework code; renamed to free
         up --tv-secondary for identity). */
      --tv-text-muted: ${theme.content.secondary};
      --tv-muted: ${theme.content.muted};
      --tv-border: ${theme.divider.subtle};
      /* Hover/popover backgrounds — contrast-safe across every theme.
         CONVENTION: never use bare --tv-border, --tv-accent, or
         --tv-primary-deep as a hover background (themes that pin those
         tokens dark — JAMA's accent=#000000 and divider.subtle=#000000,
         dark theme's primary_deep=#2E5290 — produce illegible dark-on-dark
         hover surfaces). Always use --tv-hover-bg or an inline
         color-mix(--tv-accent N%, --tv-bg) at 6-14% strength. */
      --tv-hover-bg: color-mix(in srgb, var(--tv-accent) 8%, var(--tv-bg));
      /* Strong rules — header bottom, group row bottom, axis line, tick marks,
         summary-row top. v2 R resolver computes these but the frontend
         previously read --tv-border (the subtle one) for everything,
         silently flattening strong → subtle. */
      --tv-divider-strong:    ${theme.divider.strong};
      --tv-header-rule:       ${headerVariant.rule ?? theme.divider.strong};
      --tv-row-group-rule:    ${theme.rowGroup?.L1?.rule ?? theme.divider.strong};
      --tv-axis-line:         ${theme.plot?.axisLine ?? theme.divider.strong};
      --tv-axis-tick:         ${theme.plot?.tickMark ?? theme.divider.strong};
      /* primary_deep-derived identity colors. Title fg defaults to
         primary_deep on the R side; the panel can override per-field.
         Fallback chain ends at content tones so themes that bypass the
         resolver still degrade gracefully. */
      --tv-text-title-fg:     ${theme.text.title?.fg     ?? theme.content.primary};
      --tv-axis-label-fg:     ${theme.plot?.axisLabel?.fg ?? theme.content.muted};
      --tv-axis-tick-fg:      ${theme.plot?.tickLabel?.fg ?? theme.content.muted};
      --tv-row-bg: ${theme.row.base.bg};
      --tv-alt-bg: ${theme.row.alt.bg};
      --tv-header-bg: ${headerVariant.bg};
      --tv-cell-fg: ${theme.cell.fg ?? theme.content.primary};
      --tv-header-fg: ${headerVariant.fg};
      --tv-interval-line: ${theme.series?.[0]?.stroke ?? theme.accent.default};
      --tv-summary-fill: ${theme.series?.[0]?.fill ?? theme.accent.default};
      --tv-summary-border: ${theme.series?.[0]?.stroke ?? theme.accent.default};
      --tv-semantic-emphasis-fg: ${theme.row.emphasis?.fg ?? theme.content.primary};
      --tv-semantic-muted-fg:    ${theme.row.muted?.fg    ?? theme.content.muted};
      --tv-semantic-accent-fg:   ${theme.row.accent?.fg   ?? theme.accent.default};
      --tv-semantic-emphasis-bg: ${theme.row.emphasis?.bg ?? "transparent"};
      --tv-semantic-muted-bg:    ${theme.row.muted?.bg    ?? "transparent"};
      --tv-semantic-accent-bg:   ${theme.row.accent?.bg   ?? "transparent"};
      /* Status colors. --tv-status-* are the semantic names any column
         type can reference (col_ring thresholds, col_pictogram fills,
         col_badge scales). --tv-badge-* are the historical badge-variant
         names; they alias to --tv-status-* so a single edit on the theme
         flows through both surfaces. */
      --tv-status-positive: ${theme.status?.positive ?? BADGE_VARIANTS.success};
      --tv-status-warning:  ${theme.status?.warning  ?? BADGE_VARIANTS.warning};
      --tv-status-negative: ${theme.status?.negative ?? BADGE_VARIANTS.error};
      --tv-status-info:     ${theme.status?.info     ?? BADGE_VARIANTS.info};
      --tv-badge-success: var(--tv-status-positive);
      --tv-badge-warning: var(--tv-status-warning);
      --tv-badge-error:   var(--tv-status-negative);
      --tv-badge-info:    var(--tv-status-info);
      --tv-badge-muted:   ${theme.content.muted};
      --tv-font-family: ${theme.text.body.family};
      --tv-text-title-family: ${theme.text.title?.family ?? theme.text.body.family};
      /* Phase 12: numeric-flavored text role. Resolver guarantees a
         fully-defined TextRole on the wire (falls back to body when
         the theme doesn't pin numeric). Numeric-category cells pick
         this via .numeric-cell. */
      --tv-text-numeric-family: ${theme.text.numeric?.family ?? theme.text.body.family};
      --tv-text-numeric-figures: ${theme.text.numeric?.figures === "proportional" ? "normal" : "tnum"};
      --tv-font-size-sm: ${theme.text.label.size};
      --tv-font-size-base: ${theme.text.body.size};
      --tv-font-size-lg: ${theme.text.subtitle.size};
      --tv-font-weight-normal: 400;
      --tv-font-weight-medium: 500;
      --tv-font-weight-bold: 600;
      --tv-line-height: 1.5;
      --tv-header-font-scale: 1.05;
      /* Per-text-role weight + italic + size, read by PlotHeader / PlotFooter
         and any cell that wants role-aware typography. Editing any
         theme.text.{role}.{weight,italic,size} from the panel propagates
         here and re-renders. */
      --tv-text-title-weight: ${theme.text.title.weight ?? 600};
      --tv-text-title-italic: ${theme.text.title.italic ? "italic" : "normal"};
      --tv-text-title-size: ${theme.text.title.size ?? "1.25rem"};
      --tv-text-subtitle-weight: ${theme.text.subtitle.weight ?? 400};
      --tv-text-subtitle-italic: ${theme.text.subtitle.italic ? "italic" : "normal"};
      --tv-text-subtitle-size: ${theme.text.subtitle.size ?? "1rem"};
      --tv-text-caption-weight: ${theme.text.caption.weight ?? 400};
      --tv-text-caption-italic: ${theme.text.caption.italic ? "italic" : "normal"};
      --tv-text-caption-size: ${theme.text.caption.size ?? "0.75rem"};
      --tv-text-footnote-weight: ${theme.text.footnote.weight ?? 400};
      --tv-text-footnote-italic: ${theme.text.footnote.italic ? "italic" : "normal"};
      --tv-text-footnote-size: ${theme.text.footnote.size ?? "0.75rem"};
      --tv-text-cell-weight: ${theme.text.cell.weight ?? 400};
      --tv-text-cell-italic: ${theme.text.cell.italic ? "italic" : "normal"};
      --tv-text-header-weight: ${theme.header.text.weight ?? 600};
      --tv-text-header-italic: ${theme.header.text.italic ? "italic" : "normal"};
      --tv-text-header-family: ${theme.header.text?.family ?? theme.text.body.family};
      /*
       * Header text size. theme.header.text.size composes from
       * theme.text.body.size at resolve time, so when nothing has been
       * pinned the two are equal — fall back to the historical
       * body.size times the --tv-header-font-scale (1.05) so the
       * default look (5% bigger than body) is preserved. Once a user
       * pins a distinct size via the panel or set_theme_field, the
       * explicit value wins.
       */
      --tv-text-header-size: ${
        theme.header.text?.size && theme.header.text.size !== theme.text.body.size
          ? theme.header.text.size
          : `calc(${theme.text.body.size} * 1.05)`
      };
      --tv-text-column-group-weight: ${theme.columnGroup?.text?.weight ?? 600};
      --tv-text-tick-weight: ${theme.text.tick.weight ?? 400};
      --tv-text-tick-italic: ${theme.text.tick.italic ? "italic" : "normal"};
      --tv-text-tick-family: ${theme.text.tick?.family ?? theme.text.body.family};
      --tv-text-label-weight: ${theme.text.label.weight ?? 400};
      --tv-text-label-italic: ${theme.text.label.italic ? "italic" : "normal"};
      --tv-text-label-family: ${theme.text.label?.family ?? theme.text.body.family};
      /* First-column variant — applied to .primary-cell. */
      --tv-first-col-bg: ${firstColBg};
      --tv-first-col-fg: ${firstColFg};
      --tv-first-col-weight: ${firstColWeight};
      --tv-first-col-rule: ${firstColRule};
      --tv-row-height: ${theme.spacing.rowHeight}px;
      --tv-row-group-padding: ${theme.spacing.rowGroupPadding ?? 0}px;
      --tv-padding: ${theme.spacing.padding}px;
      --tv-container-padding: ${theme.spacing.containerPadding}px;
      --tv-cell-padding-x: ${theme.spacing.cellPaddingX}px;
      /* --tv-cell-padding-y deprecated v0.21.x -- kept emitting at 0 so
         any downstream consumer that still references the var doesn't
         break, but .grid-cell no longer applies it (rows are flex-
         centered + grid-template-rows pinned, so vertical cell padding
         could only clip content). */
      --tv-cell-padding-y: 0px;
      --tv-viz-margin: ${VIZ_MARGIN}px;
      --tv-axis-gap: ${theme.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}px;
      --tv-group-padding: ${theme.spacing.columnGroupPadding ?? 8}px;
      --tv-footer-gap: ${theme.spacing.footerGap ?? 8}px;
      --tv-bottom-margin: ${theme.spacing.bottomMargin ?? 16}px;
      --tv-title-subtitle-gap: ${theme.spacing.titleSubtitleGap ?? 13}px;
      --tv-header-gap: ${theme.spacing.headerGap ?? 12}px;
      --tv-point-size: ${theme.plot.pointSize}px;
      --tv-line-width: ${theme.plot.lineWidth}px;
      /* Border widths — CSS border-style: double needs total width
         >= 3px to render two stripes visibly. When the user picks
         "double" we scale the effective width to max(3, thickness*3);
         single keeps the user's thickness as-is. */
      --tv-row-border-width: ${theme.borders.minor.style === "double" ? Math.max(3, theme.borders.minor.thickness * 3) : theme.borders.minor.thickness}px;
      --tv-header-border-width: ${theme.borders.major.style === "double" ? Math.max(3, theme.borders.major.thickness * 3) : Math.max(theme.borders.major.thickness, 2)}px;
      --tv-group-border-width: ${theme.borders.major.style === "double" ? Math.max(3, theme.borders.major.thickness * 3) : theme.borders.major.thickness}px;
      --tv-border-major-color: ${theme.borders.major.color};
      --tv-border-minor-color: ${theme.borders.minor.color};
      --tv-border-table-color: ${theme.borders.table.color};
      /* Border style encodes both layout (paints?) and the user's
         single/double choice. */
      --tv-border-row-style: ${theme.borders.layout === "horizontal" || theme.borders.layout === "grid" ? theme.borders.minor.style : "none"};
      --tv-border-col-style: ${theme.borders.layout === "vertical" || theme.borders.layout === "grid" ? theme.borders.minor.style : "none"};
      --tv-border-major-style: ${theme.borders.major.style};
      --tv-container-border: ${theme.borders.layout !== "none" && theme.borders.table.thickness > 0
        ? `${theme.borders.table.thickness}px solid var(--tv-border-table-color)`
        : theme.layout.containerBorder ? `1px solid var(--tv-border)` : "none"};
      --tv-container-border-radius: ${theme.layout.containerBorderRadius}px;
      ${generateCSSVariables()}
    `.trim();
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
