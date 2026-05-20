// v2 theme wire shape — mirrors `R/utils-serialize-resolved.R::serialize_theme`.
//
// This is what R emits on every WebSpec.theme today (since the cascade
// rework landed). The JS-side `WebTheme` type in `./index.ts` still
// carries the v1 shape (colors/typography/spacing/shapes/groupHeaders)
// with the v2 fields tacked on as optional — that mismatch is the
// source of ~212 tsc errors in svg-generator, theme-presets, etc.
//
// Phase 0c-C5 / Phase 1.x migration path:
//   1. Define the v2 shape here (this file). [DONE]
//   2. Update JS-side THEME_PRESETS to v2 shape (4 presets to rewrite).
//   3. Replace the v1 WebTheme in $types/index.ts with re-export of v2.
//   4. Migrate svg-generator + theme-presets + themes/default consumers
//      to read v2 fields.
//   5. Remove the v1 ColorPalette/Spacing/Shapes/GroupHeaderStyles types
//      once no consumer references them.
//
// Field naming follows the R serializer's camelCase output (rowGroupPadding
// from row_group_padding, etc.). Every required-on-the-wire field is
// declared as required here. NA-default R fields surface as `null` —
// the renderer fills defaults at consumption time, NOT here, so this
// type is "what the wire actually carries," not "what a fully-applied
// theme looks like."

// ────────────────────────────────────────────────────────────────────
// Atom types
// ────────────────────────────────────────────────────────────────────

/**
 * A single typographic role bundle (title, body, label, tick, etc.).
 *
 * R's `resolve_theme()` fills every TextRole field before serialization
 * (see `resolve_text` + `compose_text` in `R/utils-theme-resolve.R`).
 * The serializer's `na_to_null` is defensive but unreachable on resolved
 * themes — the JS consumer can treat every field as guaranteed.
 */
export interface TextRoleV2 {
  family: string;
  size: string;
  weight: number;
  /** "tabular" | "proportional" — figure-style for `font-feature-settings 'tnum'`. */
  figures: string;
  fg: string;
  italic: boolean;
}

/**
 * Series slot bundle — one entry per pooled effect "slot" used by the
 * forest, bar, box, violin, lollipop marks. R's `derive_slot_bundle` +
 * `fill_slot_bundle` ensure every color field is filled before
 * serialization. `shape` stays nullable — null means "renderer picks
 * a default from the 4-shape rotation."
 */
export interface SlotBundleV2 {
  fill: string;
  stroke: string;
  fillMuted: string;
  strokeMuted: string;
  fillEmphasis: string;
  strokeEmphasis: string;
  textFg: string;
  /** "square" | "circle" | "diamond" | "triangle" | null */
  shape: string | null;
}

/** Background + foreground pair for a row state (alt/hover/selected). */
export interface RowStateV2 {
  bg: string | null;
  fg: string | null;
}

/** Richer state for semantic rows — adds border, marker, font weight/style. */
export interface RowSemanticV2 {
  bg: string | null;
  fg: string | null;
  border: string | null;
  markerFill: string | null;
  markerStroke: string | null;
  fontWeight: number | null;
  /** "normal" | "italic" | null */
  fontStyle: string | null;
}

/** One variant of a header cluster (light/tint/bold). */
export interface HeaderVariantV2 {
  bg: string | null;
  fg: string | null;
  rule: string | null;
}

/** One variant of the first-column cluster (plain/bold). */
export interface FirstColumnVariantV2 {
  bg: string | null;
  fg: string | null;
  rule: string | null;
  weight: number | null;
}

/** Bindings for one row-group nesting level (L1/L2/L3). */
export interface RowGroupTierV2 {
  bg: string | null;
  fg: string | null;
  rule: string | null;
  text: TextRoleV2;
  borderBottom: boolean;
}

/** Per-mark-type slot-bundle field selectors. */
export interface MarkRecipeV2 {
  /** Slot-bundle key for the mark's body (e.g. "fill"). */
  body: string;
  /** Slot-bundle key for the mark's outline (e.g. "stroke"). */
  outline: string;
  /** Slot-bundle key for the mark's connecting line (e.g. "stroke"). */
  line: string;
}

// ────────────────────────────────────────────────────────────────────
// Tier 1 — customer-facing inputs
// ────────────────────────────────────────────────────────────────────

export interface ThemeInputsV2 {
  /** 5-step neutral ramp, lightest to darkest. */
  neutral: string[];
  // Identity (2-tier mirror chain).
  primary: string;
  primaryDeep: string | null;
  secondary: string | null;
  secondaryDeep: string | null;
  // Engagement (orthogonal to identity).
  accent: string;
  accentDeep: string | null;
  // Status semantics.
  statusPositive: string;
  statusNegative: string;
  statusWarning: string;
  statusInfo: string | null;
  /** Series anchors — palette for pooled-effect slots. */
  seriesAnchors: string[];
  // Typography inputs.
  fontBody: string;
  fontDisplay: string | null;
  fontMono: string | null;
  /** "fill_with_darker_stroke" | "flat_fill" | "outlined" — viz mark style. */
  slotStyle: "fill_with_darker_stroke" | "flat_fill" | "outlined";
}

export interface ThemeVariantsV2 {
  /** "compact" | "comfortable" | "spacious" */
  density: "compact" | "comfortable" | "spacious";
  /** "light" | "tint" | "bold" */
  headerStyle: "light" | "tint" | "bold";
  /** "default" | "bold" */
  firstColumnStyle: "default" | "bold";
}

// ────────────────────────────────────────────────────────────────────
// Tier 2 — chrome roles
// ────────────────────────────────────────────────────────────────────

export interface SurfacesV2 {
  base: string;
  muted: string;
  raised: string;
}

export interface ContentV2 {
  primary: string;
  secondary: string;
  muted: string;
  inverse: string;
}

export interface DividersV2 {
  subtle: string;
  strong: string;
}

export interface AccentRolesV2 {
  default: string;
  muted: string;
  tintSubtle: string;
  tintMedium: string;
}

export interface StatusColorsV2 {
  positive: string;
  negative: string;
  warning: string;
  info: string;
}

export interface SemanticsV2 {
  fill: string;
}

// ────────────────────────────────────────────────────────────────────
// Tier 2 — typography roles
// ────────────────────────────────────────────────────────────────────

export interface TextRolesV2 {
  title: TextRoleV2;
  subtitle: TextRoleV2;
  body: TextRoleV2;
  cell: TextRoleV2;
  label: TextRoleV2;
  tick: TextRoleV2;
  footnote: TextRoleV2;
  caption: TextRoleV2;
}

// ────────────────────────────────────────────────────────────────────
// Tier 2 — spacing
// ────────────────────────────────────────────────────────────────────

export interface SpacingTokensV2 {
  rowHeight: number;
  headerHeight: number;
  padding: number;
  containerPadding: number;
  axisGap: number;
  columnGroupPadding: number;
  rowGroupPadding: number;
  cellPaddingX: number;
  /** @deprecated Legacy field; always emitted as 0 by the R serializer. */
  cellPaddingY: number;
  /** @deprecated Legacy alias for `columnGroupPadding`; kept for back-compat. */
  groupPadding: number;
  footerGap: number;
  titleSubtitleGap: number;
  headerGap: number;
  bottomMargin: number;
  indentPerLevel: number;
}

// ────────────────────────────────────────────────────────────────────
// Tier 3 — clusters
// ────────────────────────────────────────────────────────────────────

export interface AnnotationClusterV2 {
  title: TextRoleV2;
  subtitle: TextRoleV2;
  caption: TextRoleV2;
  footnote: TextRoleV2;
}

export interface HeaderClusterV2 {
  light: HeaderVariantV2;
  tint: HeaderVariantV2;
  bold: HeaderVariantV2;
  text: TextRoleV2;
}

export type ColumnGroupClusterV2 = HeaderClusterV2;

export interface RowGroupClusterV2 {
  L1: RowGroupTierV2;
  L2: RowGroupTierV2;
  L3: RowGroupTierV2;
  indentPerLevel: number | null;
}

export interface RowClusterV2 {
  base: RowStateV2;
  alt: RowStateV2;
  hover: RowStateV2;
  selected: RowStateV2;
  emphasis: RowSemanticV2;
  muted: RowSemanticV2;
  accent: RowSemanticV2;
  bold: RowSemanticV2;
  fill: RowSemanticV2;
  /** Parsed banding spec — R's `serialize_banding` emits `{mode, level}`. */
  banding: BandingV2;
  selectedEdgeWidth: number;
  borderWidth: number;
}

export interface CellClusterV2 {
  bg: string | null;
  fg: string | null;
  border: string | null;
  text: TextRoleV2;
}

export interface FirstColumnClusterV2 {
  plain: FirstColumnVariantV2;
  bold: FirstColumnVariantV2;
}

export interface PlotScaffoldV2 {
  bg: string | null;
  axisLine: string;
  tickMark: string;
  gridline: string;
  reference: string;
  axisLabel: TextRoleV2;
  tickLabel: TextRoleV2;
  tickMarkLength: number;
  lineWidth: number;
  pointSize: number;
}

export interface MarksRecipesV2 {
  forest: MarkRecipeV2;
  summary: MarkRecipeV2;
  bar: MarkRecipeV2;
  box: MarkRecipeV2;
  violin: MarkRecipeV2;
  lollipop: MarkRecipeV2;
}

// ────────────────────────────────────────────────────────────────────
// Axis + Layout config (sibling of the cascade, lives on the theme)
// ────────────────────────────────────────────────────────────────────

export interface AxisConfigV2 {
  rangeMin: number | null;
  rangeMax: number | null;
  tickCount: number | null;
  tickValues: number[] | null;
  gridlines: boolean;
  /** "solid" | "dashed" | "dotted" */
  gridlineStyle: "solid" | "dashed" | "dotted";
  ciClipFactor: number;
  includeNull: boolean;
  symmetric: boolean | null;
  nullTick: boolean;
  markerMargin: boolean;
}

/**
 * Banding wire shape — the parsed result of R's `parse_banding(string)`.
 * Mirrors `R/utils-serialize.R::serialize_banding`. Structurally
 * identical to `BandingSpec` in `./index.ts`; re-exported here so the
 * v2 theme types are self-contained.
 */
export type BandingV2 = import("./index").BandingSpec;

export interface LayoutV2 {
  plotWidth: number | "auto";
  containerBorder: boolean;
  containerBorderRadius: number;
  banding: BandingV2 | null;
}

// ────────────────────────────────────────────────────────────────────
// Top-level WebTheme (v2 wire shape)
// ────────────────────────────────────────────────────────────────────

/** Web font declaration injected into `document.head` on widget mount. */
export interface WebFontV2 {
  family: string;
  url: string;
}

/**
 * The v2 wire shape that R emits via `serialize_theme()`. Every field
 * here is what the renderer reads at consumption time — no resolution
 * happens JS-side; the R cascade (`resolve_theme`) fills NA-defaults
 * before serialization.
 */
export interface WebThemeV2 {
  /** Wire schema discriminator. R emits `2`. */
  schemaVersion: 2;
  name: string;
  webFonts: WebFontV2[];
  /**
   * Name of the sibling theme that flips this theme's light/dark mode,
   * or `null` if the theme stands alone. Wire-only convention — the
   * in-widget switcher's `prefers-color-scheme` auto-mode reads this
   * but doesn't auto-switch yet (deferred).
   */
  lightDarkPair: string | null;
  variants: ThemeVariantsV2;
  inputs: ThemeInputsV2;
  axis: AxisConfigV2;
  layout: LayoutV2;
  // Tier 2 — chrome
  surface: SurfacesV2;
  content: ContentV2;
  divider: DividersV2;
  accent: AccentRolesV2;
  status: StatusColorsV2;
  semantic: SemanticsV2;
  // Tier 2 — data
  series: SlotBundleV2[];
  // Tier 2 — typography + spacing
  text: TextRolesV2;
  spacing: SpacingTokensV2;
  // Tier 3 — component clusters
  annotation: AnnotationClusterV2;
  header: HeaderClusterV2;
  columnGroup: ColumnGroupClusterV2;
  rowGroup: RowGroupClusterV2;
  row: RowClusterV2;
  cell: CellClusterV2;
  firstColumn: FirstColumnClusterV2;
  plot: PlotScaffoldV2;
  marks: MarksRecipesV2;
}
