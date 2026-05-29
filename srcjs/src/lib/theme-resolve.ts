/**
 * Theme resolution pipeline — TS port of `R/utils-theme-resolve.R`.
 *
 * `resolveTheme(draft)` takes a draft WebTheme with Tier 1 inputs (and any
 * optional Tier 2/3 overrides) and returns a fully-resolved WebThemeV2 with
 * every leaf populated. Only null/missing fields are written, so user-set
 * overrides survive re-resolution. Idempotent and deterministic.
 *
 * Resolution order (mirrors R's `resolve_theme`):
 *   1. mirror Tier 1 NAs (primary→secondary, *_deep auto-derivation)
 *   2. derive spacing from density preset
 *   3. derive Tier 2 chrome (surface, content, divider, accent, semantic)
 *   4. derive Tier 2 data (series slot bundles + status)
 *   5. derive Tier 2 text roles
 *   6. fill Tier 3 component clusters from the resolved Tier 2 tokens
 *   7. run construction-time contrast validation (see `theme-validate.ts`)
 *
 * R-side counterpart: every function here maps 1:1 to a function in
 * `R/utils-theme-resolve.R` with the same name in snake_case. Parity is
 * verified by `tests/parity/test-theme-parity.R`.
 */

import { oklchLighten, oklchDarken, oklchMix, oklchChroma } from "./oklch";
import { parseBandingString } from "./banding";
import { validateResolvedTheme } from "./theme-validate";
import type {
  WebThemeV2,
  ThemeInputsV2,
  ThemeVariantsV2,
  WebFontV2,
  SurfacesV2,
  ContentV2,
  DividersV2,
  AccentRolesV2,
  StatusColorsV2,
  SemanticsV2,
  SlotRoleV2,
  TextRoleV2,
  TextRolesV2,
  SpacingTokensV2,
  AnnotationClusterV2,
  HeaderClusterV2,
  ColumnGroupClusterV2,
  RowGroupClusterV2,
  RowGroupTierV2,
  RowClusterV2,
  RowStateV2,
  RowSemanticV2,
  CellClusterV2,
  FirstColumnClusterV2,
  FirstColumnVariantV2,
  PlotScaffoldV2,
  MarksRecipesV2,
  HeaderVariantV2,
  AxisConfigV2,
  LayoutV2,
  BandingV2,
} from "../types/theme-v2";

// ────────────────────────────────────────────────────────────────────
// Draft input types — mirror R's "WebTheme with NA-default fields"
// ────────────────────────────────────────────────────────────────────

/** Theme inputs: every field optional except `primary` (Tier 1 seed). */
export type ThemeInputsDraft = Partial<ThemeInputsV2> & { primary: string };

/** Cluster overrides: per-cluster partial; leaves can be null to opt back into derivation. */
export interface ThemeOverrides {
  surface?: Partial<SurfacesV2>;
  content?: Partial<ContentV2>;
  divider?: Partial<DividersV2>;
  accent?: Partial<AccentRolesV2>;
  status?: Partial<StatusColorsV2>;
  semantic?: Partial<SemanticsV2>;
  series?: Partial<SlotRoleV2>[];
  text?: { [K in keyof TextRolesV2]?: Partial<TextRoleV2> };
  spacing?: Partial<SpacingTokensV2>;
  annotation?: { [K in keyof AnnotationClusterV2]?: Partial<TextRoleV2> };
  header?: HeaderClusterOverride;
  columnGroup?: HeaderClusterOverride;
  rowGroup?: {
    L1?: Partial<RowGroupTierV2>;
    L2?: Partial<RowGroupTierV2>;
    L3?: Partial<RowGroupTierV2>;
    indentPerLevel?: number | null;
  };
  row?: {
    base?: Partial<RowStateV2>;
    alt?: Partial<RowStateV2>;
    hover?: Partial<RowStateV2>;
    selected?: Partial<RowStateV2>;
    emphasis?: Partial<RowSemanticV2>;
    muted?: Partial<RowSemanticV2>;
    accent?: Partial<RowSemanticV2>;
    bold?: Partial<RowSemanticV2>;
    fill?: Partial<RowSemanticV2>;
    banding?: BandingV2 | string;
    selectedEdgeWidth?: number;
    borderWidth?: number;
  };
  cell?: {
    bg?: string | null;
    fg?: string | null;
    border?: string | null;
    text?: Partial<TextRoleV2>;
  };
  firstColumn?: {
    /** Default variant overrides. Legacy alias `plain` is accepted for
     *  one minor version after the Sprint 1 PR 3 rename. */
    default?: Partial<FirstColumnVariantV2>;
    plain?: Partial<FirstColumnVariantV2>;
    bold?: Partial<FirstColumnVariantV2>;
  };
  plot?: {
    bg?: string | null;
    axisLine?: string | null;
    tickMark?: string | null;
    gridline?: string | null;
    reference?: string | null;
    axisLabel?: Partial<TextRoleV2>;
    tickLabel?: Partial<TextRoleV2>;
    tickMarkLength?: number;
    lineWidth?: number;
    pointSize?: number;
  };
  marks?: Partial<MarksRecipesV2>;
}

interface HeaderClusterOverride {
  light?: Partial<HeaderVariantV2>;
  tint?: Partial<HeaderVariantV2>;
  bold?: Partial<HeaderVariantV2>;
  text?: Partial<TextRoleV2>;
}

export interface ResolveDraft {
  name?: string;
  inputs: ThemeInputsDraft;
  variants?: Partial<ThemeVariantsV2>;
  webFonts?: WebFontV2[];
  /** Name of the light/dark sibling theme, or null/undefined to stand alone. */
  lightDarkPair?: string | null;
  axis?: Partial<AxisConfigV2>;
  layout?: Partial<LayoutV2>;
  /**
   * Border layout + types. `layout`'s default is `"horizontal"`; each
   * type's `color` defaults to a divider role (minor → subtle, major +
   * table → strong).
   */
  borders?: {
    layout?: "horizontal" | "vertical" | "grid" | "none";
    major?: Partial<import("$types/theme-v2").BorderSpecV2>;
    minor?: Partial<import("$types/theme-v2").BorderSpecV2>;
    table?: Partial<import("$types/theme-v2").BorderSpecV2>;
  };
  overrides?: ThemeOverrides;
  /** Per-tag overlays applied to RenderNode trees during cell render
   *  finalization. See `WebThemeV2.nodeRules`. Themes can extend or
   *  override the default rules (e.g. `interval-range` → muted) here. */
  nodeRules?: import("../schema/theme-finalize").NodeRules;
}

export interface ResolveOptions {
  /** When `false`, skip construction-time contrast validation. Default `true`. */
  validate?: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Static defaults
// ────────────────────────────────────────────────────────────────────

// Density presets — each entry maps every SpacingTokensV2 field to a numeric.
// Mirrors `DENSITY_PRESETS` in R/utils-theme-resolve.R.
const DENSITY_PRESETS: Record<
  "compact" | "comfortable" | "spacious",
  Omit<SpacingTokensV2, "cellPaddingY" | "groupPadding">
> = {
  compact: {
    rowHeight: 20, headerHeight: 26, padding: 8, containerPadding: 0,
    axisGap: 8, columnGroupPadding: 6, rowGroupPadding: 0,
    cellPaddingX: 8, footerGap: 6, titleSubtitleGap: 10,
    headerGap: 8, bottomMargin: 12, indentPerLevel: 14,
  },
  comfortable: {
    rowHeight: 24, headerHeight: 32, padding: 12, containerPadding: 0,
    axisGap: 12, columnGroupPadding: 8, rowGroupPadding: 0,
    cellPaddingX: 10, footerGap: 8, titleSubtitleGap: 13,
    headerGap: 12, bottomMargin: 16, indentPerLevel: 16,
  },
  spacious: {
    rowHeight: 30, headerHeight: 40, padding: 16, containerPadding: 0,
    axisGap: 16, columnGroupPadding: 12, rowGroupPadding: 0,
    cellPaddingX: 14, footerGap: 12, titleSubtitleGap: 18,
    headerGap: 16, bottomMargin: 22, indentPerLevel: 20,
  },
};

const INPUTS_DEFAULTS: ThemeInputsV2 = {
  neutral: ["#FFFFFF", "#F7F8FA", "#EDEFF3", "#A8AEB8", "#2A2F38"],
  primary: "#0891b2",
  primaryDeep: null,
  secondary: null,
  secondaryDeep: null,
  accent: "#0891b2",
  accentDeep: null,
  statusPositive: "#3F7D3F",
  statusNegative: "#B33A3A",
  statusWarning: "#C68A2E",
  statusInfo: null,
  seriesAnchors: ["#0891b2", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"],
  fontBody: "system-ui, -apple-system, sans-serif",
  fontDisplay: null,
  fontMono: null,
  slotStyle: "fill_with_darker_stroke",
};

const VARIANTS_DEFAULTS: ThemeVariantsV2 = {
  density: "comfortable",
  headerStyle: "light",
  firstColumnStyle: "default",
};

const AXIS_DEFAULTS: AxisConfigV2 = {
  rangeMin: null,
  rangeMax: null,
  tickCount: null,
  tickValues: null,
  gridlines: false,
  gridlineStyle: "dotted",
  ciClipFactor: 2.0,
  includeNull: true,
  symmetric: null,
  nullTick: true,
  markerMargin: true,
};

const LAYOUT_DEFAULTS: LayoutV2 = {
  plotWidth: "auto",
  containerBorder: false,
  containerBorderRadius: 8,
  banding: null,
};

/**
 * Resolve a Borders draft against divider roles. `layout` defaults to
 * `"horizontal"`; each border type's `color` falls back to a divider
 * role (minor → subtle, major + table → strong). Mirrors R's
 * `fill_border` step in `resolve_theme()`.
 */
function resolveBorders(
  draft: ResolveDraft["borders"],
  divider: DividersV2,
): import("$types/theme-v2").ThemeBordersV2 {
  const d = draft ?? {};
  // Per-type default thickness: minor + major default to 1 (the divider
  // role is the default editorial rhythm), table defaults to 0 (users
  // typically don't want a frame around the chart container — that's a
  // separate stylistic choice they opt in to).
  const fill = (
    over: Partial<import("$types/theme-v2").BorderSpecV2> | undefined,
    defaultColor: string,
    defaultThickness: number,
  ): import("$types/theme-v2").BorderSpecV2 => ({
    thickness: over?.thickness ?? defaultThickness,
    style: over?.style ?? "single",
    color: over?.color ?? defaultColor,
  });
  return {
    layout: d.layout ?? "horizontal",
    major: fill(d.major, divider.strong, 1),
    minor: fill(d.minor, divider.subtle, 1),
    table: fill(d.table, divider.strong, 0),
  };
}

const MARKS_DEFAULTS: MarksRecipesV2 = {
  forest:   { body: "fill", outline: "stroke", line: "stroke" },
  summary:  { body: "fill", outline: "stroke", line: "stroke" },
  bar:      { body: "fill", outline: "stroke", line: "stroke" },
  box:      { body: "fill", outline: "stroke", line: "stroke" },
  violin:   { body: "fill", outline: "stroke", line: "stroke" },
  lollipop: { body: "fill", outline: "stroke", line: "stroke" },
};

// ────────────────────────────────────────────────────────────────────
// Small helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Compose `target`'s non-null fields over `defaults`. Mirrors R's `fill_na`
 * and `compose_text` (same null-fallback semantics for both).
 */
function fillNull<T extends object>(target: Partial<T>, defaults: T): T {
  const out = { ...defaults } as T;
  for (const k of Object.keys(target) as (keyof T)[]) {
    const v = target[k];
    if (v !== null && v !== undefined) out[k] = v as T[keyof T];
  }
  return out;
}

/** Compose a TextRole: prefer `over`'s non-null fields, fall back to `under`. */
function composeText(over: Partial<TextRoleV2>, under: TextRoleV2): TextRoleV2 {
  return fillNull(over, under);
}

/** Apply named overrides to a TextRole; skip null/undefined entries. Mirrors `override_text`. */
function overrideText(role: TextRoleV2, over: Partial<TextRoleV2>): TextRoleV2 {
  return fillNull(over, role);
}

const EMPTY_TEXT_ROLE: TextRoleV2 = {
  family: null as unknown as string,
  size: null as unknown as string,
  weight: null as unknown as number,
  figures: null as unknown as string,
  fg: null as unknown as string,
  italic: null as unknown as boolean,
};

function emptyTextRole(over: Partial<TextRoleV2> = {}): TextRoleV2 {
  return { ...EMPTY_TEXT_ROLE, ...over };
}

// ────────────────────────────────────────────────────────────────────
// Tier 1: mirror chains
// ────────────────────────────────────────────────────────────────────

/**
 * Mirror Tier 1 NA fields through the identity chain and to engagement.
 *
 * Identity rule: null secondary mirrors primary. When secondary mirrors,
 * its `_deep` companion also mirrors `primary_deep` (so a pinned
 * primary_deep propagates through mono themes instead of being silently
 * re-darkened from the seed). When secondary is pinned, its `_deep`
 * auto-derives via oklch_darken(secondary, 0.15) unless explicitly set.
 *
 * Engagement: accent_deep auto-derives from accent; status.info falls back
 * to accent; font_display falls back to font_body.
 */
function resolveInputsMirrors(inputs: ThemeInputsV2): ThemeInputsV2 {
  const secondaryWasNull = inputs.secondary == null;
  const out: ThemeInputsV2 = { ...inputs };

  if (out.primaryDeep == null) out.primaryDeep = oklchDarken(out.primary, 0.15);

  if (secondaryWasNull) {
    out.secondary = out.primary;
    if (out.secondaryDeep == null) out.secondaryDeep = out.primaryDeep;
  } else if (out.secondaryDeep == null) {
    out.secondaryDeep = oklchDarken(out.secondary!, 0.15);
  }

  if (out.accentDeep == null) out.accentDeep = oklchDarken(out.accent, 0.15);
  if (out.fontDisplay == null) out.fontDisplay = out.fontBody;
  if (out.statusInfo == null) out.statusInfo = out.accent;

  return out;
}

// ────────────────────────────────────────────────────────────────────
// Tier 2: chrome
// ────────────────────────────────────────────────────────────────────

interface ChromeRoles {
  surface: SurfacesV2;
  content: ContentV2;
  divider: DividersV2;
  accent: AccentRolesV2;
  semantic: SemanticsV2;
}

/**
 * Derive chrome Tier 2 roles from resolved inputs. Mirrors `resolve_chrome`.
 * Assumes `resolveInputsMirrors` has already run.
 */
function resolveChrome(inputs: ThemeInputsV2): ChromeRoles {
  const n = inputs.neutral;
  const chromeTint = inputs.secondaryDeep!; // guaranteed non-null after mirror

  const surface: SurfacesV2 = {
    base: n[1],
    muted: oklchMix(n[2], chromeTint, 0.04),
    raised: n[0],
  };

  const content: ContentV2 = {
    primary: n[4],
    secondary: n[3],
    muted: oklchLighten(n[3], 0.10),
    inverse: n[0],
  };

  // subtle: cell hairlines + gridlines — must read against base AND muted.
  // 30% pull toward n[3] for neutral baseline, then ~10% chromeTint.
  // strong: header rules, axis line, ticks — stay close to neutral, faint hue.
  const dividerNeutral = oklchMix(n[2], n[3], 0.30);
  const divider: DividersV2 = {
    subtle: oklchMix(dividerNeutral, chromeTint, 0.10),
    strong: oklchMix(n[3], chromeTint, 0.05),
  };

  const accent: AccentRolesV2 = {
    default: inputs.accent,
    muted: oklchMix(inputs.accent, surface.base, 0.88),
    tintSubtle: oklchMix(inputs.accent, surface.base, 0.90),
    tintMedium: oklchMix(inputs.accent, surface.base, 0.75),
  };

  // Semantic fill: pale "filled-in" row tint derived from accent.
  const semantic: SemanticsV2 = {
    fill: oklchMix(inputs.accent, n[0], 0.80),
  };

  return { surface, content, divider, accent, semantic };
}

// ────────────────────────────────────────────────────────────────────
// Tier 2: data (series + status)
// ────────────────────────────────────────────────────────────────────

/** Migration shim: accept legacy fillMuted/etc. on input, normalize to
 * the new fillDim/etc. shape. Sprint 1 PR 2 renamed the SlotRole field
 * names; this absorbs old wire input for one minor version. */
function normalizeLegacySlotRole(s: Partial<SlotRoleV2> & Record<string, unknown>): Partial<SlotRoleV2> {
  const out: Partial<SlotRoleV2> & Record<string, unknown> = { ...s };
  if (out.fillDim   == null && typeof out.fillMuted     === "string") out.fillDim   = out.fillMuted as string;
  if (out.strokeDim == null && typeof out.strokeMuted   === "string") out.strokeDim = out.strokeMuted as string;
  if (out.fillHot   == null && typeof out.fillEmphasis  === "string") out.fillHot   = out.fillEmphasis as string;
  if (out.strokeHot == null && typeof out.strokeEmphasis === "string") out.strokeHot = out.strokeEmphasis as string;
  delete out.fillMuted; delete out.strokeMuted;
  delete out.fillEmphasis; delete out.strokeEmphasis;
  return out as Partial<SlotRoleV2>;
}

/** Derive a SlotRole from an anchor color. */
function deriveSlotRole(
  anchor: string,
  surfaceBase: string,
  contentPrimary: string,
  slotStyle: ThemeInputsV2["slotStyle"],
): SlotRoleV2 {
  const fillDim = oklchMix(anchor, surfaceBase, 0.65);

  if (slotStyle === "flat_fill") {
    const hot = oklchChroma(oklchDarken(anchor, 0.05), 0.04);
    return {
      fill: anchor,
      stroke: anchor,
      fillDim: fillDim,
      strokeDim: fillDim,
      fillHot: hot,
      strokeHot: hot,
      textFg: contentPrimary,
      shape: null,
    };
  }
  if (slotStyle === "outlined") {
    const outlineFill = oklchMix(anchor, surfaceBase, 0.15);
    const outlineFillDim = oklchMix(anchor, surfaceBase, 0.08);
    return {
      fill: outlineFill,
      stroke: anchor,
      fillDim: outlineFillDim,
      strokeDim: oklchDarken(fillDim, 0.10),
      fillHot: oklchMix(anchor, surfaceBase, 0.30),
      strokeHot: oklchDarken(anchor, 0.20),
      textFg: contentPrimary,
      shape: null,
    };
  }
  // Default: "fill_with_darker_stroke"
  return {
    fill: anchor,
    stroke: oklchDarken(anchor, 0.10),
    fillDim: fillDim,
    strokeDim: oklchDarken(fillDim, 0.10),
    fillHot: oklchChroma(oklchDarken(anchor, 0.05), 0.04),
    strokeHot: oklchDarken(anchor, 0.20),
    textFg: contentPrimary,
    shape: null,
  };
}

function fillSlotRole(existing: Partial<SlotRoleV2>, derived: SlotRoleV2): SlotRoleV2 {
  return fillNull(existing, derived);
}

function resolveData(
  inputs: ThemeInputsV2,
  surfaceBase: string,
  contentPrimary: string,
  existingSeries: Partial<SlotRoleV2>[] | undefined,
): { series: SlotRoleV2[]; status: StatusColorsV2 } {
  const anchors = inputs.seriesAnchors;
  const series: SlotRoleV2[] = anchors.map((anchor, i) => {
    const derived = deriveSlotRole(anchor, surfaceBase, contentPrimary, inputs.slotStyle);
    const raw = existingSeries?.[i] ?? {};
    const existing = normalizeLegacySlotRole(raw as Partial<SlotRoleV2> & Record<string, unknown>);
    return fillSlotRole(existing, derived);
  });
  const status: StatusColorsV2 = {
    positive: inputs.statusPositive,
    negative: inputs.statusNegative,
    warning: inputs.statusWarning,
    info: inputs.statusInfo!, // mirrored to accent in resolveInputsMirrors
  };
  return { series, status };
}

// ────────────────────────────────────────────────────────────────────
// Tier 2: text roles
// ────────────────────────────────────────────────────────────────────

/**
 * Derive typography Tier 2 from Tier 1 fonts + chrome content tier.
 * Mirrors `resolve_text`.
 */
function resolveText(inputs: ThemeInputsV2, content: ContentV2): TextRolesV2 {
  const body = inputs.fontBody;
  const display = inputs.fontDisplay!;
  const primaryDeep = inputs.primaryDeep!;
  const secondaryDeep = inputs.secondaryDeep!;

  const subtitleFg = oklchMix(content.secondary, secondaryDeep, 0.30);
  const labelFg    = oklchMix(content.secondary, secondaryDeep, 0.20);
  const captionFg  = oklchMix(content.secondary, secondaryDeep, 0.30);
  const tickFg     = oklchMix(content.muted,     secondaryDeep, 0.10);
  const footnoteFg = oklchMix(content.muted,     secondaryDeep, 0.20);

  return {
    title:    { family: display, size: "1.25rem",  weight: 600, figures: "proportional", fg: primaryDeep,    italic: false },
    subtitle: { family: body,    size: "1rem",     weight: 400, figures: "proportional", fg: subtitleFg,     italic: false },
    body:     { family: body,    size: "0.875rem", weight: 400, figures: "tabular",      fg: content.primary, italic: false },
    cell:     { family: body,    size: "0.875rem", weight: 400, figures: "tabular",      fg: content.primary, italic: false },
    label:    { family: body,    size: "0.75rem",  weight: 400, figures: "tabular",      fg: labelFg,        italic: false },
    tick:     { family: body,    size: "0.75rem",  weight: 400, figures: "tabular",      fg: tickFg,         italic: false },
    footnote: { family: body,    size: "0.75rem",  weight: 400, figures: "proportional", fg: footnoteFg,     italic: false },
    caption:  { family: body,    size: "0.75rem",  weight: 400, figures: "proportional", fg: captionFg,      italic: true },
    // Phase 12: numeric defaults to body. Overriding `numeric.family`
    // gives numbers a different family without affecting text columns.
    numeric:  { family: body,    size: "0.875rem", weight: 400, figures: "tabular",      fg: content.primary, italic: false },
  };
}

// ────────────────────────────────────────────────────────────────────
// Tier 2: spacing
// ────────────────────────────────────────────────────────────────────

function resolveSpacing(
  variants: ThemeVariantsV2,
  existing: Partial<SpacingTokensV2> = {},
): SpacingTokensV2 {
  const preset = DENSITY_PRESETS[variants.density];
  return {
    rowHeight:          existing.rowHeight          ?? preset.rowHeight,
    headerHeight:       existing.headerHeight       ?? preset.headerHeight,
    padding:            existing.padding            ?? preset.padding,
    containerPadding:   existing.containerPadding   ?? preset.containerPadding,
    axisGap:            existing.axisGap            ?? preset.axisGap,
    columnGroupPadding: existing.columnGroupPadding ?? preset.columnGroupPadding,
    rowGroupPadding:    existing.rowGroupPadding    ?? preset.rowGroupPadding,
    cellPaddingX:       existing.cellPaddingX       ?? preset.cellPaddingX,
    cellPaddingY:       existing.cellPaddingY       ?? 0,                          // legacy
    groupPadding:       existing.groupPadding       ?? preset.columnGroupPadding,  // legacy alias
    footerGap:          existing.footerGap          ?? preset.footerGap,
    titleSubtitleGap:   existing.titleSubtitleGap   ?? preset.titleSubtitleGap,
    headerGap:          existing.headerGap          ?? preset.headerGap,
    bottomMargin:       existing.bottomMargin       ?? preset.bottomMargin,
    indentPerLevel:     existing.indentPerLevel     ?? preset.indentPerLevel,
  };
}

// ────────────────────────────────────────────────────────────────────
// Tier 3: component clusters
// ────────────────────────────────────────────────────────────────────

interface ResolveComponentsArgs {
  inputs: ThemeInputsV2;
  variants: ThemeVariantsV2;
  surface: SurfacesV2;
  content: ContentV2;
  divider: DividersV2;
  accent: AccentRolesV2;
  text: TextRolesV2;
  semantic: SemanticsV2;
  spacing: SpacingTokensV2;
  overrides: ThemeOverrides;
}

function resolveAnnotation(args: ResolveComponentsArgs): AnnotationClusterV2 {
  const o = args.overrides.annotation ?? {};
  return {
    title:    composeText(o.title ?? {},    args.text.title),
    subtitle: composeText(o.subtitle ?? {}, args.text.subtitle),
    caption:  composeText(o.caption ?? {},  args.text.caption),
    footnote: composeText(o.footnote ?? {}, args.text.footnote),
  };
}

function resolveHeaderCluster(
  o: HeaderClusterOverride | undefined,
  args: ResolveComponentsArgs,
  bandSource: string,         // primaryDeep (header) | secondaryDeep (columnGroup)
  textWeight: number,         // 600 for header, 500 for columnGroup
): HeaderClusterV2 {
  const { surface, content, divider, text } = args;
  const oo = o ?? {};
  return {
    light: fillNull(oo.light ?? {}, {
      bg: surface.base,
      fg: content.primary,
      rule: divider.strong,
    }),
    tint: fillNull(oo.tint ?? {}, {
      bg: oklchMix(surface.base, bandSource, 0.12),
      fg: content.primary,
      rule: divider.strong,
    }),
    bold: fillNull(oo.bold ?? {}, {
      bg: bandSource,
      fg: content.inverse,
      rule: oklchMix(content.inverse, bandSource, 0.40),
    }),
    text: composeText(oo.text ?? {}, overrideText(text.body, { weight: textWeight })),
  };
}

function resolveRowGroup(args: ResolveComponentsArgs): RowGroupClusterV2 {
  const { surface, content, divider, inputs, variants, spacing, text } = args;
  const o = args.overrides.rowGroup ?? {};

  // header_style "light" → 16% mix (subtle), else "tint"/"bold" → 24% (strong)
  const l1Strength = variants.headerStyle === "light" ? 0.16 : 0.24;
  const l1DefaultBg = oklchMix(surface.base, inputs.secondaryDeep!, l1Strength);

  const o1 = o.L1 ?? {};
  const L1: RowGroupTierV2 = {
    bg:   o1.bg   ?? l1DefaultBg,
    fg:   o1.fg   ?? content.primary,
    rule: o1.rule ?? divider.strong,
    text: composeText(o1.text ?? {}, overrideText(text.body, { weight: 600 })),
    borderBottom: o1.borderBottom ?? false,
  };

  const o2 = o.L2 ?? {};
  const L2: RowGroupTierV2 = {
    bg:   o2.bg   ?? L1.bg,
    fg:   o2.fg   ?? content.secondary,
    rule: o2.rule ?? divider.subtle,
    text: composeText(o2.text ?? {}, overrideText(text.body, { weight: 500 })),
    borderBottom: o2.borderBottom ?? false,
  };

  const o3 = o.L3 ?? {};
  const L3: RowGroupTierV2 = {
    bg:   o3.bg   ?? L1.bg,
    fg:   o3.fg   ?? content.secondary,
    rule: o3.rule ?? null,
    text: composeText(o3.text ?? {}, text.body),
    borderBottom: o3.borderBottom ?? false,
  };

  return {
    L1, L2, L3,
    indentPerLevel: o.indentPerLevel ?? spacing.indentPerLevel,
  };
}

function resolveRow(args: ResolveComponentsArgs): RowClusterV2 {
  const { surface, content, accent, semantic, inputs } = args;
  const o = args.overrides.row ?? {};

  const bandingRaw = o.banding ?? "group";
  const banding: BandingV2 = typeof bandingRaw === "string"
    ? parseBandingString(bandingRaw)
    : bandingRaw;

  const altDefaultBg = oklchMix(surface.base, surface.muted, 0.5);

  const base: RowStateV2 = {
    bg: o.base?.bg ?? surface.base,
    fg: o.base?.fg ?? content.primary,
  };
  const alt: RowStateV2 = {
    bg: o.alt?.bg ?? altDefaultBg,
    fg: o.alt?.fg ?? content.primary,
  };
  const hover: RowStateV2 = {
    bg: o.hover?.bg ?? accent.muted,
    fg: o.hover?.fg ?? content.primary,
  };
  const selected: RowStateV2 = {
    bg: o.selected?.bg ?? accent.muted,
    fg: o.selected?.fg ?? content.primary,
  };

  const emphasis: RowSemanticV2 = fillNull(o.emphasis ?? {}, {
    bg: null,
    fg: content.primary,
    border: null,
    markerFill: content.primary,
    markerStroke: content.primary,
    fontWeight: 600,
    fontStyle: null,
  });

  const muted: RowSemanticV2 = fillNull(o.muted ?? {}, {
    bg: null,
    fg: content.muted,
    border: null,
    markerFill: content.muted,
    markerStroke: oklchDarken(content.muted, 0.10),
    fontWeight: null,
    fontStyle: null,
  });

  const accentRow: RowSemanticV2 = fillNull(o.accent ?? {}, {
    bg: null,
    fg: accent.default,
    border: null,
    markerFill: accent.default,
    markerStroke: inputs.accentDeep!,
    fontWeight: 600,
    fontStyle: null,
  });

  const bold: RowSemanticV2 = fillNull(o.bold ?? {}, {
    bg: null,
    fg: null,
    border: null,
    markerFill: null,
    markerStroke: null,
    fontWeight: 600,
    fontStyle: null,
  });

  const fill: RowSemanticV2 = fillNull(o.fill ?? {}, {
    bg: semantic.fill,
    fg: null,
    border: null,
    markerFill: null,
    markerStroke: null,
    fontWeight: 600,
    fontStyle: null,
  });

  return {
    base, alt, hover, selected,
    emphasis, muted, accent: accentRow, bold, fill,
    banding,
    selectedEdgeWidth: o.selectedEdgeWidth ?? 2,
    borderWidth: o.borderWidth ?? 1,
  };
}

function resolveCell(args: ResolveComponentsArgs): CellClusterV2 {
  const { content, divider, text } = args;
  const o = args.overrides.cell ?? {};
  return {
    bg: o.bg ?? null,
    fg: o.fg ?? content.primary,
    border: o.border ?? divider.subtle,
    text: composeText(o.text ?? {}, text.cell),
  };
}

function resolveFirstColumn(args: ResolveComponentsArgs): FirstColumnClusterV2 {
  const { surface, content, divider } = args;
  const o = args.overrides.firstColumn ?? {};
  // Migration shim: legacy `plain` key feeds the new `default` variant.
  const def = o.default ?? o.plain ?? {};
  return {
    default: {
      bg:     def.bg     ?? null,
      fg:     def.fg     ?? null,
      rule:   def.rule   ?? null,
      weight: def.weight ?? null,
    },
    bold: {
      bg:     o.bold?.bg     ?? surface.muted,
      fg:     o.bold?.fg     ?? content.primary,
      rule:   o.bold?.rule   ?? divider.subtle,
      weight: o.bold?.weight ?? 600,
    },
  };
}

function resolvePlot(args: ResolveComponentsArgs): PlotScaffoldV2 {
  const { divider, content, text, inputs } = args;
  const o = args.overrides.plot ?? {};

  // Axis + tick labels: faint secondary lean (10% mix of secondaryDeep into content.muted).
  const secondaryDeep = inputs.secondaryDeep!;
  const axisTickLabelFg = oklchMix(content.muted, secondaryDeep, 0.10);

  // Pre-fill axisLabel.fg / tickLabel.fg BEFORE composing the role so the
  // axis-specific tint blocks role-default inheritance.
  const axisLabel = composeText(
    { ...(o.axisLabel ?? {}), fg: o.axisLabel?.fg ?? axisTickLabelFg },
    text.label,
  );
  const tickLabel = composeText(
    { ...(o.tickLabel ?? {}), fg: o.tickLabel?.fg ?? axisTickLabelFg },
    text.tick,
  );

  return {
    bg:        o.bg        ?? null,
    axisLine:  o.axisLine  ?? divider.strong,
    tickMark:  o.tickMark  ?? divider.strong,
    gridline:  o.gridline  ?? divider.subtle,
    reference: o.reference ?? divider.strong,
    axisLabel,
    tickLabel,
    tickMarkLength: o.tickMarkLength ?? 4,
    lineWidth:      o.lineWidth      ?? 1.5,
    pointSize:      o.pointSize      ?? 6,
  };
}

// ────────────────────────────────────────────────────────────────────
// Top-level resolver
// ────────────────────────────────────────────────────────────────────

/**
 * Resolve a draft theme into a fully-populated WebThemeV2.
 *
 * The draft accepts Tier 1 inputs (required), optional variants, and an
 * `overrides` bag for any Tier 2/3 customization. Every leaf the user
 * doesn't pin is derived by the cascade. Idempotent — re-running on an
 * already-resolved theme produces the same shape.
 *
 * Set `options.validate = false` to skip construction-time contrast
 * validation; production callers should leave it on.
 */
export function resolveTheme(draft: ResolveDraft, options: ResolveOptions = {}): WebThemeV2 {
  // ----- Tier 1: inputs + variants ------------------------------------
  const inputs = resolveInputsMirrors({ ...INPUTS_DEFAULTS, ...draft.inputs });
  const variants: ThemeVariantsV2 = { ...VARIANTS_DEFAULTS, ...(draft.variants ?? {}) };
  const overrides = draft.overrides ?? {};

  // ----- Tier 2: spacing from density --------------------------------
  const spacing = resolveSpacing(variants, overrides.spacing);

  // ----- Tier 2: chrome -----------------------------------------------
  const chrome = resolveChrome(inputs);
  const surface  = fillNull(overrides.surface  ?? {}, chrome.surface);
  const content  = fillNull(overrides.content  ?? {}, chrome.content);
  const divider  = fillNull(overrides.divider  ?? {}, chrome.divider);
  const accent   = fillNull(overrides.accent   ?? {}, chrome.accent);
  const semantic = fillNull(overrides.semantic ?? {}, chrome.semantic);

  // ----- Tier 2: data --------------------------------------------------
  const data = resolveData(inputs, surface.base, content.primary, overrides.series);
  const series = data.series;
  const status = fillNull(overrides.status ?? {}, data.status);

  // ----- Tier 2: typography -------------------------------------------
  const derivedText = resolveText(inputs, content);
  const textRoles = (Object.keys(derivedText) as (keyof TextRolesV2)[]).reduce(
    (acc, key) => {
      acc[key] = composeText(overrides.text?.[key] ?? {}, derivedText[key]);
      return acc;
    },
    {} as TextRolesV2,
  );

  // ----- Tier 3: clusters ---------------------------------------------
  const compArgs: ResolveComponentsArgs = {
    inputs, variants, surface, content, divider, accent, semantic,
    text: textRoles, spacing, overrides,
  };

  const annotation = resolveAnnotation(compArgs);
  const header = resolveHeaderCluster(overrides.header, compArgs, inputs.primaryDeep!, 600);
  const columnGroup: ColumnGroupClusterV2 = resolveHeaderCluster(
    overrides.columnGroup, compArgs, inputs.secondaryDeep!, 500,
  );
  const rowGroup = resolveRowGroup(compArgs);
  const row = resolveRow(compArgs);
  const cell = resolveCell(compArgs);
  const firstColumn = resolveFirstColumn(compArgs);
  const plot = resolvePlot(compArgs);

  // ----- Assemble -----------------------------------------------------
  const theme: WebThemeV2 = {
    schemaVersion: 2,
    name: draft.name ?? "custom",
    webFonts: draft.webFonts ?? [],
    lightDarkPair: draft.lightDarkPair ?? null,
    variants,
    inputs,
    axis: { ...AXIS_DEFAULTS, ...(draft.axis ?? {}) },
    layout: { ...LAYOUT_DEFAULTS, ...(draft.layout ?? {}) },
    borders: resolveBorders(draft.borders, divider),
    surface, content, divider, accent, status, semantic,
    series,
    text: textRoles,
    spacing,
    // nodeRules: themes can opt in via draft.nodeRules; otherwise
    // `applyTheme()` falls back to DEFAULT_NODE_RULES from
    // schema/theme-finalize.ts. Keep the field present (even if
    // undefined) for wire stability with snapshots that explicitly
    // override.
    nodeRules: draft.nodeRules,
    annotation,
    header,
    columnGroup,
    rowGroup,
    row,
    cell,
    firstColumn,
    plot,
    marks: { ...MARKS_DEFAULTS, ...(overrides.marks ?? {}) },
  };

  // ----- Validation ----------------------------------------------------
  if (options.validate !== false) {
    validateResolvedTheme(theme);
  }

  return theme;
}

// Re-export for parity tests / tooling.
export {
  resolveInputsMirrors,
  resolveChrome,
  resolveData,
  resolveText,
  resolveSpacing,
  DENSITY_PRESETS,
  emptyTextRole,
};
