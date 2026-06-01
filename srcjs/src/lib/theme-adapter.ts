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

import type { ThemeInputs } from "../types/theme-inputs";
import { buildThemeStructure, resolveRef } from "./theme-resolve";
import { rampStep, oklchMix, oklchDarken } from "./oklch";
import type {
  WebTheme, Surfaces, Content, Dividers, AccentRoles,
  StatusColors, Semantics, SlotRole, TextRole, TextRoles,
  SpacingTokens, AnnotationCluster, HeaderCluster, RowGroupCluster,
  RowCluster, CellCluster, FirstColumnCluster, PlotScaffold,
  MarksRecipes, AxisConfig, Layout, ThemeBorders,
  ResolvedInputs, ThemeVariants,
} from "../types/theme-resolved";

const DENSITY_SPACING: Record<"compact" | "comfortable" | "spacious", SpacingTokens> = {
  compact: {
    rowHeight: 20, headerHeight: 26, padding: 8, containerPadding: 0,
    axisGap: 8, columnGroupPadding: 6, rowGroupPadding: 0,
    cellPaddingX: 8, cellPaddingY: 0, groupPadding: 6,
    footerGap: 6, titleSubtitleGap: 10,
    headerGap: 8, bottomMargin: 12, indentPerLevel: 14,
  },
  comfortable: {
    rowHeight: 24, headerHeight: 32, padding: 12, containerPadding: 0,
    axisGap: 12, columnGroupPadding: 8, rowGroupPadding: 0,
    cellPaddingX: 10, cellPaddingY: 0, groupPadding: 8,
    footerGap: 8, titleSubtitleGap: 13,
    headerGap: 12, bottomMargin: 16, indentPerLevel: 16,
  },
  spacious: {
    rowHeight: 30, headerHeight: 40, padding: 16, containerPadding: 0,
    axisGap: 16, columnGroupPadding: 12, rowGroupPadding: 0,
    cellPaddingX: 14, cellPaddingY: 0, groupPadding: 12,
    footerGap: 12, titleSubtitleGap: 18,
    headerGap: 16, bottomMargin: 22, indentPerLevel: 20,
  },
};

const DEFAULT_FONT_BODY = "system-ui, -apple-system, sans-serif";

function textRoleBody(family: string, fg: string): TextRole {
  return { family, size: "0.875rem", weight: 400, figures: "tabular", fg, italic: false };
}

function textRoleTitle(family: string, fg: string): TextRole {
  return { family, size: "1.25rem", weight: 600, figures: "proportional", fg, italic: false };
}

/** Build a resolved WebTheme from authoring inputs. */
export function buildTheme(
  inputs: ThemeInputs,
  name = "custom",
): WebTheme {
  const v3 = buildThemeStructure(inputs, name);
  const t = v3.tokens;
  const ramps = v3.ramps;

  const fontBody = inputs.fonts?.body ?? DEFAULT_FONT_BODY;
  const fontDisplay = inputs.fonts?.display ?? fontBody;
  const fontMono = inputs.fonts?.mono ?? "ui-monospace, monospace";

  // Resolved inputs block — Tier-1 values frozen alongside the resolved
  // theme so consumers can read brand/accent/etc. without re-derivation.
  const resolvedInputs: ResolvedInputs = {
    neutral: [
      rampStep(ramps.neutral, 1),
      rampStep(ramps.neutral, 2),
      rampStep(ramps.neutral, 3),
      rampStep(ramps.neutral, 7),
      rampStep(ramps.neutral, 12),
    ],
    primary: inputs.brand,
    primaryDeep: rampStep(ramps.brand, 11),
    secondary: inputs.decorative ?? inputs.brand,
    secondaryDeep: inputs.decorative
      ? rampStep(ramps.decorative!, 11)
      : rampStep(ramps.brand, 11),
    accent: inputs.accent ?? inputs.brand,
    accentDeep: rampStep(ramps.accent, 11),
    statusPositive: inputs.status?.positive ?? "#3F7D3F",
    statusNegative: inputs.status?.negative ?? "#B33A3A",
    statusWarning: inputs.status?.warning ?? "#C68A2E",
    statusInfo: inputs.status?.info ?? "#1F77B4",
    seriesAnchors: [
      rampStep(ramps.brand, 9),
      rampStep(ramps.accent, 9),
      rampStep(ramps.brand, 7),
      rampStep(ramps.accent, 7),
      rampStep(ramps.brand, 5),
    ],
    fontBody,
    fontDisplay,
    fontMono,
    slotStyle: "fill_with_darker_stroke",
  };

  const variants: ThemeVariants = {
    density: inputs.density ?? "comfortable",
    headerStyle: "light",
    firstColumnStyle: "default",
  };

  const surface: Surfaces = {
    base: t.paper,
    muted: t.paper_sunken,
    raised: t.paper_raised,
  };

  const content: Content = {
    primary: t.ink,
    secondary: t.ink_subtle,
    muted: t.ink_muted,
    inverse: t.brand_ink,
  };

  const divider: Dividers = {
    subtle: t.rule_subtle,
    strong: t.rule_strong,
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
  function slotRole(anchor: string): SlotRole {
    return {
      fill: anchor,
      stroke: oklchDarken(anchor, 0.10),
      fillDim: oklchMix(anchor, t.paper, 0.65),
      strokeDim: oklchDarken(oklchMix(anchor, t.paper, 0.65), 0.10),
      fillHot: oklchDarken(anchor, 0.05),
      strokeHot: oklchDarken(anchor, 0.20),
      textFg: t.ink,
      shape: null,
    };
  }
  const series: SlotRole[] = resolvedInputs.seriesAnchors.map(slotRole);

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

  const spacing = DENSITY_SPACING[variants.density];

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
    tint:  { bg: t.decorative_subtle, fg: t.ink, rule: t.rule_strong },
    bold:  { bg: t.decorative_chrome, fg: t.brand_ink, rule: t.rule_strong },
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
    lineWidth: 1.5,
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

  const borders: ThemeBorders = {
    layout: "horizontal",
    major: { thickness: 1, style: "single", color: t.rule_strong },
    minor: { thickness: 1, style: "single", color: t.rule_subtle },
    table: { thickness: 0, style: "single", color: t.rule_strong },
  };

  return {
    schemaVersion: 2,
    name,
    webFonts: [],
    lightDarkPair: null,
    variants: variants,
    inputs: resolvedInputs,
    authoringInputs: inputs,
    axis,
    layout,
    borders,
    surface,
    content,
    divider,
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
}
