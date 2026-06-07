// Theme adapter — projects authoring inputs into the resolved-theme blob.
//
// Authors hand the adapter a ThemeInputs (brand seed, accent, mode,
// density, ...); the adapter resolves the token structure and projects
// it into the resolved theme shape the renderer consumes. R-side
// `web_theme()` and JS-side `webTheme()` both route through `buildTheme`.
//
// T2 token → resolved-theme path:
//   paper             → surface.base
//   paper_alt         → row.alt.bg     (also row.base.bg derived)
//   paper_raised      → surface.raised
//   paper_sunken      → surface.muted
//   ink               → content.primary, cell.fg, text.body.fg
//   ink_muted         → content.muted
//   ink_subtle        → content.secondary
//   rule_subtle       → divider.subtle, cell.border, plot.gridline
//   rule_strong       → divider.strong, plot.axisLine, plot.tickMark, plot.reference
//   brand             → inputs.primary, header.bold.bg
//   brand_ink         → content.inverse, header.bold.fg
//   brand_subtle      → header.tint.bg, rowGroup.L1.bg
//   accent            → accent.default, inputs.accent
//   accent_subtle     → accent.muted, row.hover.bg, row.selected.bg
//   decorative_chrome → columnGroup.bold.bg (when set)

import type { ThemeInputs } from "../../types/theme-inputs";
import { buildThemeStructure } from "./theme-resolve";
import { applyPolarityToInputs } from "./resolve-theme";
import { validateResolvedTheme } from "./theme-validate";
import { rampStep, oklchMix, oklchDarken } from "../oklch";
import { resolveCategorical } from "../data-schemes";
import type {
  WebTheme, AccentRoles,
  StatusColors, Semantics, SlotRole, TextRole, TextRoles,
  SpacingTokens, AnnotationCluster, HeaderCluster, RowGroupCluster,
  RowCluster, CellCluster, FirstColumnCluster, PlotScaffold,
  MarksRecipes, AxisConfig, Layout, ThemeBorders,
  ThemeVariants,
} from "../../types/theme-resolved";

// Density px scales live in density-presets.ts as a single source of
// truth; both the v3 adapter (this file) and the v4 resolver
// (resolve-theme.ts) project from there so they can't drift.
import { densityPresetAsSpacingTokens, type DensityPreset } from "./density-presets";

const DENSITY_SPACING: Record<DensityPreset, SpacingTokens> = {
  compact:     densityPresetAsSpacingTokens("compact")     as unknown as SpacingTokens,
  comfortable: densityPresetAsSpacingTokens("comfortable") as unknown as SpacingTokens,
  spacious:    densityPresetAsSpacingTokens("spacious")    as unknown as SpacingTokens,
};

/** Scale every dimensional spacing token by the continuous density factor (a
 *  fine dial on top of the named profile). Clamped to [0.5, 2]; rounded to whole
 *  px to keep crisp geometry. `undefined`/1 is an identity passthrough. */
function scaleSpacing(s: SpacingTokens, factor: number | undefined): SpacingTokens {
  if (factor == null || factor === 1) return s;
  const f = Math.max(0.5, Math.min(2, factor));
  const m = (v: number): number => Math.round(v * f);
  return {
    rowHeight: m(s.rowHeight), headerHeight: m(s.headerHeight), padding: m(s.padding),
    containerPadding: m(s.containerPadding), axisGap: m(s.axisGap),
    columnGroupPadding: m(s.columnGroupPadding), rowGroupPadding: m(s.rowGroupPadding),
    cellPaddingX: m(s.cellPaddingX), cellPaddingY: m(s.cellPaddingY), groupPadding: m(s.groupPadding),
    footerGap: m(s.footerGap), titleSubtitleGap: m(s.titleSubtitleGap),
    headerGap: m(s.headerGap), bottomMargin: m(s.bottomMargin), indentPerLevel: m(s.indentPerLevel),
  };
}

const DEFAULT_FONT_BODY = "system-ui, -apple-system, sans-serif";

function textRoleBody(family: string, fg: string): TextRole {
  return { family, size: "0.875rem", weight: 400, figures: "tabular", fg, italic: false };
}

function textRoleTitle(family: string, fg: string): TextRole {
  return { family, size: "1.25rem", weight: 600, figures: "proportional", fg, italic: false };
}

/** Build a resolved WebTheme from authoring inputs.
 *
 *  `buildThemeStructure` (v3) populates the v3 chrome fields the
 *  remaining tail of theme-css.ts + TabvizPlot reads from (borders,
 *  firstColumn, headerVariant, semantic.row, etc.). Polarity is also
 *  re-applied locally to back-fill the small set of v3-shaped
 *  computations (series anchors, text-role fonts) that still need
 *  the reflected ramps. */
/** Expand the Tier-1 `border_preset` enum into the T3 borders cluster.
 *  Five treatments over the theme's own rule colors; "hairline" is the
 *  named form of the historical default (so unset ≡ hairline byte-for-
 *  byte and no existing theme shifts). */
function expandBorderPreset(
  preset: ThemeInputs["border_preset"],
  ruleStrong: string,
  ruleSubtle: string,
): ThemeBorders {
  switch (preset) {
    case "none":
      return {
        layout: "none",
        major: { thickness: 0, style: "single", color: ruleStrong },
        minor: { thickness: 0, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
    case "ruled":
      return {
        layout: "horizontal",
        major: { thickness: 2, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
    case "frame":
      return {
        layout: "horizontal",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 2, style: "single", color: ruleStrong },
      };
    case "boxed":
      return {
        layout: "grid",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 1, style: "single", color: ruleStrong },
      };
    case "hairline":
    default:
      // The historical default cluster, now nameable.
      return {
        layout: "horizontal",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
  }
}

/** Options bag for buildTheme's second argument. A bare string remains
 *  accepted as shorthand for `{ name }` (every pre-P0 call site). */
export interface BuildThemeOpts {
  name?: string;
  /** Tier-2 role pins ({ramp, grade} per role) — stored on the built
   *  theme so `getCssVars` resolves with them (settings-overhaul P0:
   *  role overrides are part of the portable artifact, not
   *  studio-preview-only state). */
  roleOverrides?: NonNullable<WebTheme["roleOverrides"]>;
}

export function buildTheme(
  inputs: ThemeInputs,
  nameOrOpts: string | BuildThemeOpts = "custom",
): WebTheme {
  const opts: BuildThemeOpts =
    typeof nameOrOpts === "string" ? { name: nameOrOpts } : nameOrOpts;
  const name = opts.name ?? "custom";
  const roleOverrides = opts.roleOverrides ?? {};
  const reflected = applyPolarityToInputs(inputs);
  const v3 = buildThemeStructure(inputs, name);
  const t = v3.tokens;
  const ramps = v3.ramps;

  const fontBody = inputs.fonts?.body ?? DEFAULT_FONT_BODY;
  const fontDisplay = inputs.fonts?.display ?? fontBody;
  // Series anchor palette — drives the 5 SlotRole bundles below. The v3
  // ResolvedInputs.seriesAnchors field that mirrored this array was
  // deleted (consumers now derive via `readSeriesAnchors(theme)`).
  //
  // A pinned `categorical` scheme supplies the ADDITIONAL series (slots
  // 1+); slot 0 always keeps the theme's identity color (brand solid) so
  // single-effect forests stay branded — a full takeover turned
  // cochrane's blue markers okabe-black, killing the journal identity.
  // The scheme registry (data-schemes.ts) had ZERO consumers until the
  // R2 API review noticed set_categorical("viridis") and a typo produce
  // byte-identical output: 27 presets declared schemes nothing read.
  // Unset keeps the identity-derived brand/accent interleave.
  const schemeName = inputs.categorical;
  const scheme = schemeName ? resolveCategorical(schemeName, ramps) : null;
  const seriesAnchors: string[] = scheme && scheme.length >= 4
    ? [rampStep(ramps.brand, 9), ...(scheme.slice(0, 4) as string[])]
    : [
        rampStep(ramps.brand, 9),
        rampStep(ramps.accent, 9),
        rampStep(ramps.brand, 7),
        rampStep(ramps.accent, 7),
        rampStep(ramps.brand, 5),
      ];

  const variants: ThemeVariants = {
    density: inputs.density ?? "comfortable",
    // Mirrors the top-level header_style input (one vocabulary; the
    // variant slot stays on the wire as the v3 bridge's pick).
    headerStyle: inputs.header_style ?? "light",
    firstColumnStyle: "default",
  };

  const accentRoles: AccentRoles = {
    default: t.accent,
    muted: t.accent_subtle,
    tintSubtle: t.accent_subtle,
    tintMedium: oklchMix(t.accent, t.paper, 0.75),
  };

  const status: StatusColors = {
    positive: t.positive,
    negative: t.negative,
    warning: t.warning,
    info: t.info,
  };

  const semantic: Semantics = {
    fill: t.accent_subtle,
  };

  // Series slot bundles — derive 5 from brand + accent ramps
  // D12 (wire-audit 1f): theme-level mark identity. point_shape fills
  // every slot's shape (cascade: row markerStyle > effect.shape > slot
  // shape > renderer rotation); null keeps the rotation default.
  //
  // `slot_style` picks the fill/stroke pairing convention per slot
  // (studio C: the derivation lives HERE, in the canonical resolver —
  // it used to be reimplemented inside LayoutControl.svelte, which made
  // the settings panel the only place the input did anything).
  const themePointShape = inputs.marks?.point_shape ?? null;
  const slotStyle = inputs.slot_style ?? "fill_with_darker_stroke";
  function slotRole(anchor: string): SlotRole {
    const common = { textFg: t.ink, shape: themePointShape };
    const fillDim = oklchMix(anchor, t.paper, 0.65);
    if (slotStyle === "flat_fill") {
      // Monochrome marks: stroke ≡ fill, one shared "hot" emphasis.
      const hot = oklchDarken(anchor, 0.05);
      return {
        fill: anchor, stroke: anchor,
        fillDim, strokeDim: fillDim,
        fillHot: hot, strokeHot: hot,
        ...common,
      };
    }
    if (slotStyle === "outlined") {
      // Hollow marks: pale paper-mixed body, anchor-colored outline.
      return {
        fill: oklchMix(anchor, t.paper, 0.15),
        stroke: anchor,
        fillDim: oklchMix(anchor, t.paper, 0.08),
        strokeDim: oklchDarken(fillDim, 0.10),
        fillHot: oklchMix(anchor, t.paper, 0.30),
        strokeHot: oklchDarken(anchor, 0.20),
        ...common,
      };
    }
    // Default "fill_with_darker_stroke": solid body + deepened ring.
    return {
      fill: anchor,
      stroke: oklchDarken(anchor, 0.10),
      fillDim,
      strokeDim: oklchDarken(fillDim, 0.10),
      fillHot: oklchDarken(anchor, 0.05),
      strokeHot: oklchDarken(anchor, 0.20),
      ...common,
    };
  }
  const series: SlotRole[] = seriesAnchors.map(slotRole);

  const text: TextRoles = {
    title:    textRoleTitle(fontDisplay, t.ink),
    subtitle: textRoleBody(fontDisplay, t.ink_muted),
    body:     textRoleBody(fontBody, t.ink),
    cell:     textRoleBody(fontBody, t.ink),
    label:    { ...textRoleBody(fontBody, t.ink_muted), size: "0.8125rem" },
    tick:     { ...textRoleBody(fontBody, t.ink_subtle), size: "0.75rem" },
    footnote: { ...textRoleBody(fontBody, t.ink_subtle), size: "0.75rem", italic: true },
    caption:  { ...textRoleBody(fontBody, t.ink_muted), italic: true },
    numeric:  textRoleBody(fontBody, t.ink),
  };

  const spacing = scaleSpacing(DENSITY_SPACING[variants.density], inputs.density_factor);

  const annotation: AnnotationCluster = {
    title: text.title,
    subtitle: text.subtitle,
    caption: text.caption,
    footnote: text.footnote,
  };

  const header: HeaderCluster = {
    light: { bg: t.paper, fg: t.ink, rule: t.rule_strong },
    tint:  { bg: t.brand_subtle, fg: t.ink, rule: t.rule_strong },
    bold:  { bg: t.brand, fg: t.brand_ink, rule: oklchMix(t.brand_ink, t.brand, 0.4) },
    text:  text.body,
  };

  const columnGroup: HeaderCluster = {
    light: { bg: t.paper, fg: t.ink, rule: t.rule_strong },
    tint:  { bg: t.brand_subtle, fg: t.ink, rule: t.rule_strong },
    bold:  { bg: t.brand, fg: t.brand_ink, rule: t.rule_strong },
    text:  { ...text.body, weight: 500 },
  };

  const rowGroup: RowGroupCluster = {
    L1: {
      bg: t.brand_subtle, fg: t.ink, rule: t.rule_strong,
      text: { ...text.body, weight: 600 },
      borderBottom: false,
    },
    L2: {
      bg: t.paper_alt, fg: t.ink_muted, rule: t.rule_subtle,
      text: { ...text.body, weight: 500 },
      borderBottom: false,
    },
    L3: {
      bg: null, fg: t.ink_subtle, rule: null,
      text: { ...text.body, weight: 400 },
      borderBottom: false,
    },
    indentPerLevel: spacing.indentPerLevel,
  };

  const row: RowCluster = {
    base:     { bg: t.paper, fg: t.ink },
    alt:      { bg: t.paper_alt, fg: t.ink },
    hover:    { bg: t.accent_subtle, fg: t.ink },
    selected: { bg: t.accent_subtle, fg: t.ink },
    emphasis: {
      bg: null, fg: t.ink, border: null,
      markerFill: t.ink, markerStroke: t.ink,
      fontWeight: 600, fontStyle: null,
    },
    muted: {
      bg: null, fg: t.ink_muted, border: null,
      markerFill: t.ink_muted, markerStroke: oklchDarken(t.ink_muted, 0.10),
      fontWeight: null, fontStyle: null,
    },
    accent: {
      bg: null, fg: t.accent, border: null,
      markerFill: t.accent, markerStroke: t.accent,
      fontWeight: 600, fontStyle: null,
    },
    bold: {
      bg: null, fg: null, border: null,
      markerFill: null, markerStroke: null,
      fontWeight: 600, fontStyle: null,
    },
    fill: {
      bg: t.accent_subtle, fg: null, border: null,
      markerFill: null, markerStroke: null,
      fontWeight: 600, fontStyle: null,
    },
    banding: { mode: "group", level: null },
    selectedEdgeWidth: 2,
    borderWidth: 1,
  };

  const cell: CellCluster = {
    bg: null,
    fg: t.ink,
    border: t.rule_subtle,
    text: text.cell,
  };

  const firstColumn: FirstColumnCluster = {
    default: { bg: null, fg: null, rule: null, weight: null },
    bold:    { bg: t.paper_alt, fg: t.ink, rule: t.rule_subtle, weight: 600 },
  };

  const plot: PlotScaffold = {
    bg: null,
    axisLine: t.rule_strong,
    tickMark: t.rule_strong,
    gridline: t.rule_subtle,
    reference: t.rule_strong,
    axisLabel: { ...text.label },
    tickLabel: { ...text.tick },
    tickMarkLength: 4,
    // D12: interval_weight maps to the CI line weight (both DOM renderer
    // and SVG export read theme.plot.lineWidth).
    lineWidth: inputs.marks?.interval_weight === "hair" ? 1
             : inputs.marks?.interval_weight === "thick" ? 2.5
             : 1.5,
    pointSize: 6,
  };

  const marks: MarksRecipes = {
    forest:   { body: "fill", outline: "stroke", line: "stroke" },
    summary:  { body: "fill", outline: "stroke", line: "stroke" },
    bar:      { body: "fill", outline: "stroke", line: "stroke" },
    box:      { body: "fill", outline: "stroke", line: "stroke" },
    violin:   { body: "fill", outline: "stroke", line: "stroke" },
    lollipop: { body: "fill", outline: "stroke", line: "stroke" },
  };

  const axis: AxisConfig = {
    rangeMin: null, rangeMax: null, tickCount: null, tickValues: null,
    gridlines: false, gridlineStyle: "dotted",
    ciClipFactor: 2.0, includeNull: true,
    symmetric: null, nullTick: true, markerMargin: true,
  };

  const layout: Layout = {
    plotWidth: "auto",
    containerBorder: false,
    containerBorderRadius: 8,
    banding: { mode: "group", level: null },
  };

  // Border treatment — `border_preset` is a Tier-1 structural enum the
  // resolver expands into the full T3 cluster (settings-overhaul P0,
  // header_style precedent). Unset keeps the default cluster, which is
  // deliberately ≡ "hairline" so existing themes are byte-stable.
  const borders: ThemeBorders = expandBorderPreset(
    inputs.border_preset,
    t.rule_strong,
    t.rule_subtle,
  );

  const built: WebTheme = {
    schemaVersion: 4,
    name,
    webFonts: [],
    lightDarkPair: null,
    variants: variants,
    authoringInputs: inputs,
    roleOverrides,
    axis,
    layout,
    borders,
    accent: accentRoles,
    status,
    semantic,
    series,
    text,
    spacing,
    annotation,
    header,
    columnGroup,
    rowGroup,
    row,
    cell,
    firstColumn,
    plot,
    marks,
  };

  // Contrast guardrail — warn-only here (user themes with bad anchors
  // still build; they just complain), throw-mode in the CI preset gate
  // (theme-validate.test.ts). The validator was dead code until the
  // adversarial color review (H4) noticed nothing ever called it.
  if (typeof process === "undefined" || process.env?.NODE_ENV !== "production") {
    try {
      validateResolvedTheme(built);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[tabviz] theme "${name}" contrast check: ${(e as Error).message}`);
    }
  }

  return built;
}
