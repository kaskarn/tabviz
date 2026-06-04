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
export interface TextRole {
  family: string;
  size: string;
  weight: number;
  /** "tabular" | "proportional" — figure-style for `font-feature-settings 'tnum'`. */
  figures: string;
  fg: string;
  italic: boolean;
}

/**
 * Per-series slot role — one entry per pooled effect "slot" used by the
 * forest, bar, box, violin, lollipop marks. `dim` is the de-emphasized
 * state (used by other-series during hover); `hot` is the boosted
 * interactive-highlight state. Both are derived from the slot anchor
 * via OKLCH math at resolve time. `shape` stays nullable — null means
 * "renderer picks a default from the 4-shape rotation."
 *
 * Renamed from `SlotBundle` (Sprint 1 PR 2): `muted` and `emphasis`
 * each carried 3+ meanings across the theme; `dim`/`hot` reserves
 * `muted` for the chrome/role layer and the paint token, and reserves
 * `emphasis` for the paint token + design intent.
 */
export interface SlotRole {
  fill: string;
  stroke: string;
  fillDim: string;
  strokeDim: string;
  fillHot: string;
  strokeHot: string;
  textFg: string;
  /** "square" | "circle" | "diamond" | "triangle" | null */
  shape: string | null;
}

/** Background + foreground pair for a row state (alt/hover/selected). */
export interface RowState {
  bg: string | null;
  fg: string | null;
}

/** Richer state for semantic rows — adds border, marker, font weight/style. */
export interface RowSemantic {
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
export interface HeaderVariant {
  bg: string | null;
  fg: string | null;
  rule: string | null;
}

/** One variant of the first-column cluster (plain/bold). */
export interface FirstColumnVariant {
  bg: string | null;
  fg: string | null;
  rule: string | null;
  weight: number | null;
}

/** Bindings for one row-group nesting level (L1/L2/L3). */
export interface RowGroupTier {
  bg: string | null;
  fg: string | null;
  rule: string | null;
  text: TextRole;
  borderBottom: boolean;
}

/** Per-mark-type slot-bundle field selectors. */
export interface MarkRecipe {
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

export interface ResolvedInputs {
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

export interface ThemeVariants {
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

export interface Surfaces {
  base: string;
  muted: string;
  raised: string;
}

export interface Content {
  primary: string;
  secondary: string;
  muted: string;
  inverse: string;
}

export interface Dividers {
  subtle: string;
  strong: string;
}

export interface AccentRoles {
  default: string;
  muted: string;
  tintSubtle: string;
  tintMedium: string;
}

export interface StatusColors {
  positive: string;
  negative: string;
  warning: string;
  info: string;
}

export interface Semantics {
  fill: string;
}

// ────────────────────────────────────────────────────────────────────
// Tier 2 — typography roles
// ────────────────────────────────────────────────────────────────────

export interface TextRoles {
  title: TextRole;
  subtitle: TextRole;
  body: TextRole;
  cell: TextRole;
  label: TextRole;
  tick: TextRole;
  footnote: TextRole;
  caption: TextRole;
  /**
   * Optional numeric-flavored text role. When set, the renderer picks
   * this role for numeric-category columns (numeric / percent /
   * currency / pvalue / interval / events / badge) instead of `body`.
   * Resolver fills it from `body` when omitted, so this is always a
   * fully-defined TextRole on the wire.
   */
  numeric: TextRole;
}

// ────────────────────────────────────────────────────────────────────
// Tier 2 — spacing
// ────────────────────────────────────────────────────────────────────

export interface SpacingTokens {
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

export interface AnnotationCluster {
  title: TextRole;
  subtitle: TextRole;
  caption: TextRole;
  footnote: TextRole;
}

export interface HeaderCluster {
  light: HeaderVariant;
  tint: HeaderVariant;
  bold: HeaderVariant;
  text: TextRole;
}

export type ColumnGroupCluster = HeaderCluster;

export interface RowGroupCluster {
  L1: RowGroupTier;
  L2: RowGroupTier;
  L3: RowGroupTier;
  indentPerLevel: number | null;
}

export interface RowCluster {
  base: RowState;
  alt: RowState;
  hover: RowState;
  selected: RowState;
  emphasis: RowSemantic;
  muted: RowSemantic;
  accent: RowSemantic;
  bold: RowSemantic;
  fill: RowSemantic;
  /** Parsed banding spec — R's `serialize_banding` emits `{mode, level}`. */
  banding: Banding;
  selectedEdgeWidth: number;
  borderWidth: number;
}

export interface CellCluster {
  bg: string | null;
  fg: string | null;
  border: string | null;
  text: TextRole;
}

export interface FirstColumnCluster {
  /**
   * Default (un-emphasized) first-column variant. Renamed from `plain`
   * to `default` in Sprint 1 PR 3 so the wire key matches the
   * `firstColumnStyle: "default" | "bold"` variant id.
   */
  default: FirstColumnVariant;
  bold: FirstColumnVariant;
}

export interface PlotScaffold {
  bg: string | null;
  axisLine: string;
  tickMark: string;
  gridline: string;
  reference: string;
  axisLabel: TextRole;
  tickLabel: TextRole;
  tickMarkLength: number;
  lineWidth: number;
  pointSize: number;
}

export interface MarksRecipes {
  forest: MarkRecipe;
  summary: MarkRecipe;
  bar: MarkRecipe;
  box: MarkRecipe;
  violin: MarkRecipe;
  lollipop: MarkRecipe;
}

// ────────────────────────────────────────────────────────────────────
// Axis + Layout config (sibling of the cascade, lives on the theme)
// ────────────────────────────────────────────────────────────────────

export interface AxisConfig {
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
export type Banding = import("./index").BandingSpec;

export interface Layout {
  plotWidth: number | "auto";
  containerBorder: boolean;
  containerBorderRadius: number;
  banding: Banding | null;
}

// ────────────────────────────────────────────────────────────────────
// Borders — layout × type model
// ────────────────────────────────────────────────────────────────────

/**
 * One named border type. `double` emits two parallel hairlines with a
 * `thickness`-sized gap between them; `single` emits one stroke at
 * `thickness` px.
 */
export interface BorderSpec {
  thickness: number;
  /** "single" | "double" */
  style: "single" | "double";
  color: string;
}

/**
 * `layout` controls *where* dividers appear; the three named types
 * (`major` / `minor` / `table`) control *how* they look.
 *
 * Mapping:
 *   - Row data dividers  → `minor` (layout ∈ {horizontal, grid})
 *   - Column dividers    → `minor` (layout ∈ {vertical,   grid})
 *   - Header bottom + group/summary breaks → `major`
 *   - Outer table edge   → `table` (always rendered when thickness > 0)
 */
export interface ThemeBorders {
  /** "horizontal" | "vertical" | "grid" | "none" */
  layout: "horizontal" | "vertical" | "grid" | "none";
  major: BorderSpec;
  minor: BorderSpec;
  table: BorderSpec;
}

// ────────────────────────────────────────────────────────────────────
// Top-level WebTheme (v2 wire shape)
// ────────────────────────────────────────────────────────────────────

/** Web font declaration injected into `document.head` on widget mount. */
export interface WebFont {
  family: string;
  url: string;
}

/**
 * Resolved theme blob — what the renderer reads at consumption time.
 * R emits this via `serialize_theme()`; TS authoring emits it via
 * `buildTheme()`. No further resolution happens JS-side; the R cascade
 * (`resolve_theme`) fills NA-defaults before serialization.
 *
 * `schemaVersion: 4` aligns with the V4 substrate (per Stage 1 §22).
 * Was at `2` through v3; bumped during the coherence pass to match
 * `ThemeStructure.schemaVersion` in `theme-inputs.ts`. The only
 * runtime consumer of this value is `isResolvedTheme` (the discriminator
 * used by `resolveThemeRef` to distinguish a resolved blob from a
 * preset-extend ref).
 */
export interface WebTheme {
  /** Wire schema discriminator. Renderer + R both emit `4` post-coherence. */
  schemaVersion: 4;
  name: string;
  webFonts: WebFont[];
  /**
   * Name of the sibling theme that flips this theme's light/dark mode,
   * or `null` if the theme stands alone. Wire-only convention — the
   * in-widget switcher's `prefers-color-scheme` auto-mode reads this
   * but doesn't auto-switch yet (deferred).
   */
  lightDarkPair: string | null;
  variants: ThemeVariants;
  inputs: ResolvedInputs;
  /**
   * The V3 authoring inputs that produced this theme (brand, accent,
   * decorative, mode, density, neutral_tint, neutral_tint_strength,
   * fonts, status, data schemes). Round-trips with the theme so the
   * settings panel can read them, edit, and rebuild via `buildTheme()`.
   * Optional for compat with hand-constructed wire blobs that skip it.
   */
  authoringInputs?: import("./theme-inputs").ThemeInputs;
  axis: AxisConfig;
  layout: Layout;
  borders: ThemeBorders;
  // Tier 2 — chrome
  surface: Surfaces;
  content: Content;
  divider: Dividers;
  accent: AccentRoles;
  status: StatusColors;
  semantic: Semantics;
  // Tier 2 — data
  series: SlotRole[];
  // Tier 2 — typography + spacing
  text: TextRoles;
  spacing: SpacingTokens;
  // Tier 3 — component clusters
  annotation: AnnotationCluster;
  header: HeaderCluster;
  columnGroup: ColumnGroupCluster;
  rowGroup: RowGroupCluster;
  row: RowCluster;
  cell: CellCluster;
  firstColumn: FirstColumnCluster;
  plot: PlotScaffold;
  marks: MarksRecipes;
  /**
   * Tag-driven node finalization rules. Renderers tag RenderNodes
   * with semantic labels (`"interval-range"`, `"footnote-marker"`,
   * etc.); themes declare what each tag looks like via this table.
   *
   * Optional — themes without nodeRules just let renderer-emitted
   * trees through unchanged. Phase 7 finalizes every cell + chrome
   * RenderNode tree via `applyTheme(tree, theme.nodeRules)`.
   *
   * See `$schema/theme-finalize` for the rule shape + the apply
   * pass.
   */
  nodeRules?: import("../schema/theme-finalize").NodeRules;
}
