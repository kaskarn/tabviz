// Theme authoring-input types — the rationalized theme surface.
//
// Layers (defined here):
//   T1 — ThemeInputs    (the entire user-authoring surface)
//   T0 — TokenRamps     (12-step ramps generated from T1 inputs)
//   T2 — token vocabulary (addressable names; resolved from T0)
//   T3+ — paint roles, clusters, data layer

// ────────────────────────────────────────────────────────────────────
// T1 — Identity inputs (what the user authors)
// ────────────────────────────────────────────────────────────────────

/** Display mode (Q-P4.5 closure 2026-06-02). Contrast variants applied
 *  by the resolver via per-token `modes.{hc,rt}` behavior in the manifest.
 *  Independent of polarity, which controls light/dark anchor reflection. */
export type ThemeMode = "standard" | "high-contrast" | "reduced-transparency";

/** Optional tint for the neutral ramp — blends a small fraction of a hue into low-chroma ends. */
export type NeutralTint =
  | "untinted"        // pure achromatic ramp
  | "brand"           // tint with brand hue
  | "accent"          // tint with accent hue
  | "decorative"      // tint with decorative hue (if set)
  | { hex: string };  // explicit hex tint

/** Name of a registered data palette scheme. PR E adds the full registry. */
export type SchemeName = string;

export interface ThemeInputs {
  /** Required. Brand color seed; powers the brand ramp and identity tokens. */
  brand: string;

  /** Engagement color seed; powers hover/selected/callouts. Default: brand. */
  accent?: string;

  /** Optional second color for two-color editorial themes (Lancet gold, Dwarven slate).
   *  Drives `decorative_subtle` and `decorative_chrome` (alt-row tint, divider hue,
   *  row-group L1 band). Does NOT drive text or marks. */
  decorative?: string | null;

  /** Light vs dark. Default `"light"`. */
  mode?: ThemeMode;

  /** Neutral ramp tinting. Default `"untinted"`. */
  neutral_tint?: NeutralTint;

  /** Strength of the neutral tint blend, in `[0, 1]`. Default `0.04`
   *  (subtle clinical-journal hint). `~1.0` makes the tint hex effectively
   *  the paper color (editorial-strong: literary cream, sepia, newsprint).
   *  Ignored when `neutral_tint = "untinted"`. */
  neutral_tint_strength?: number;

  /** Data palette scheme references — PR E wires the registry. */
  categorical?: SchemeName;
  sequential?: SchemeName;
  diverging?: SchemeName;

  /** Status palette seeds. Defaults curated semantic colors. */
  status?: {
    positive?: string;
    negative?: string;
    warning?: string;
    info?: string;
  };

  /** Typography. */
  fonts?: {
    body?: string;
    display?: string;
    mono?: string;
  };

  /** Stage 2 §2 shell/paper two-surface model. Controls the relationship
   *  between the outer chrome (shell) and the inner data card (paper):
   *
   *    flush       — shell + paper share fill; no visible separation.
   *    raised      — shell is a card; paper sits on it with elevation.
   *    float       — shell transparent; paper floats with its own shadow.
   *    transparent — shell transparent; no float shadow (minimal chrome).
   *
   *  Drives the `[data-shell-mode]` selectors in theme-runtime.css and the
   *  10 shell/paper Tier-3 tokens. Default: "flush". */
  shell_mode?: "flush" | "raised" | "float" | "transparent";

  /** Stage 2 typography Tier 1 — anchor of the modular size scale (px).
   *  Default 14. */
  type_base_size?: number;
  /** Stage 2 typography Tier 1 — exponential ratio between scale steps.
   *  Default 1.2 (Major Third minus a hair, editorial rhythm). */
  type_scale_ratio?: number;
  /** Stage 2 typography Tier 1 — weight axis. Each role binds to one of
   *  these four named weights. Defaults 400/500/600/700. */
  type_weights?: {
    regular?: number;
    medium?: number;
    semibold?: number;
    bold?: number;
  };

  /** Density preset (the curated spacing baseline). */
  density?: "compact" | "comfortable" | "spacious";
  /** Continuous multiplier on the density preset's spacing tokens — a fine
   *  dial on top of the named profile (e.g. 0.9 = a touch tighter than
   *  comfortable). 1 = the profile unchanged. Clamped to [0.5, 2]. */
  densityFactor?: number;

  /** Polarity — light vs dark. (V4 substrate field; per Q-P4.5 closure
   *  polarity and `mode` will be split. During the sprint, when set,
   *  this takes precedence over `mode`'s interpretation as light/dark.) */
  polarity?: "light" | "dark";

  /** Per-ramp curve shape (linear / ease / smooth / log / exp). Reshapes
   *  the lightness progression across the 11 ramp grades. Defaults per
   *  `DEFAULT_RAMP_CURVES` in `lib/theme/curves.ts`:
   *    neutral=ease, brand=linear, accent=linear.
   *  Per Q-P4.3 closure (Stage 1 §25). */
  curves?: {
    neutral?: "linear" | "ease" | "smooth" | "log" | "exp";
    brand?: "linear" | "ease" | "smooth" | "log" | "exp";
    accent?: "linear" | "ease" | "smooth" | "log" | "exp";
  };

  /** Per-row-kind theme defaults — currently only height ratio; Stage 2
   *  paint fields (bg, fg, border, weight) extend this shape per Q10
   *  closure. Layer 3 of the row-kind height cascade (Stage 1 §33). */
  row_kinds?: Partial<Record<
    "data" | "group_header" | "spacer" | "summary" | "header" | "panel",
    { heightRatio?: number }
  >>;
}

// ────────────────────────────────────────────────────────────────────
// T0 — Token ramps (generated from T1 inputs)
// ────────────────────────────────────────────────────────────────────
//
// Each ramp is a 12-element hex array. Index i = Radix step (i+1).
// Use `rampStep(ramp, n)` (from `lib/oklch`) for 1-indexed access.

export interface TokenRamps {
  /** 12-step neutral ramp; optionally tinted. */
  neutral: string[];
  /** 12-step brand ramp. */
  brand: string[];
  /** 12-step accent ramp. */
  accent: string[];
  /** 12-step decorative ramp; present only when `inputs.decorative` is set. */
  decorative: string[] | null;
  /** 5-step status palettes. */
  status: {
    positive: string[];
    negative: string[];
    warning: string[];
    info: string[];
  };
}

// ────────────────────────────────────────────────────────────────────
// T2 — Semantic token vocabulary (addressable names)
// ────────────────────────────────────────────────────────────────────
//
// PR A defines the demo subset (paper / paper_alt / ink / ink_muted /
// brand / brand_ink) to prove the model. PR B expands to the full
// vocabulary listed in the rationalization plan.

export type TokenName =
  // Surfaces
  | "paper"
  | "paper_alt"
  | "paper_raised"
  | "paper_sunken"
  // Ink (foreground/text)
  | "ink"
  | "ink_muted"
  | "ink_subtle"
  | "ink_disabled"
  // Brand
  | "brand"
  | "brand_hover"
  | "brand_active"
  | "brand_subtle"
  | "brand_ink"
  | "brand_ink_muted"
  // Accent
  | "accent"
  | "accent_subtle"
  | "accent_ink"
  | "accent_ink_muted"
  // Decorative (resolves to brand if `inputs.decorative` is null)
  | "decorative_subtle"
  | "decorative_chrome"
  // Lines
  | "rule_subtle"
  | "rule_strong"
  // Status
  | "positive"
  | "positive_ink"
  | "negative"
  | "negative_ink"
  | "warning"
  | "warning_ink"
  | "info"
  | "info_ink";

/** Numeric ramp-step references (programmatic addressability): `neutral.3`, `brand.9`, etc. */
export type RampStepRef =
  | `neutral.${number}`
  | `brand.${number}`
  | `accent.${number}`
  | `decorative.${number}`;

/** Color reference. Tagged-object form is canonical; plain string accepted by resolvers. */
export type ColorRef =
  | { ref: TokenName | RampStepRef; alpha?: number }
  | { hex: string; alpha?: number };

/** Convenience constructor — `ref("ink_muted")` or `ref("brand.9")`. */
export function ref(name: TokenName | RampStepRef, alpha?: number): ColorRef {
  return alpha === undefined ? { ref: name } : { ref: name, alpha };
}

/** Hex literal as a tagged-object ref (rare — plain string usually works). */
export function lit(hex: string, alpha?: number): ColorRef {
  return alpha === undefined ? { hex } : { hex, alpha };
}

// ────────────────────────────────────────────────────────────────────
// T3 — Paint roles (fixed canonical recipes)
// ────────────────────────────────────────────────────────────────────

/** Fixed canonical role vocabulary. Themes redefine recipes; cannot add roles. */
export type RoleName =
  | "emphasis"
  | "muted"
  | "accent"
  | "bold"
  | "fill"
  | "positive"
  | "negative"
  | "warning"
  | "info";

/** A paint-role recipe — how a role looks when applied to a target. */
export interface PaintRole {
  bg?: ColorRef | string | null;
  fg?: ColorRef | string | null;
  border?: ColorRef | string | null;
  markerFill?: ColorRef | string | null;
  markerStroke?: ColorRef | string | null;
  fontWeight?: number | null;
  fontStyle?: "normal" | "italic" | null;
}

export type ThemeRoles = Record<RoleName, PaintRole>;

// ────────────────────────────────────────────────────────────────────
// T4 — Component clusters (low-level bindings; reference T2 via refs)
// ────────────────────────────────────────────────────────────────────

export interface RowStateInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
}

export interface HeaderVariantInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
}

export interface HeaderClusterInputs {
  light: HeaderVariantInputs;
  tint: HeaderVariantInputs;
  bold: HeaderVariantInputs;
}

export type ColumnGroupClusterInputs = HeaderClusterInputs;

export interface RowGroupTierInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
  fontWeight: number | null;
}

export interface RowGroupClusterInputs {
  L1: RowGroupTierInputs;
  L2: RowGroupTierInputs;
  L3: RowGroupTierInputs;
}

export interface RowClusterInputs {
  base: RowStateInputs;
  alt: RowStateInputs;
  hover: RowStateInputs;
  selected: RowStateInputs;
  banding: "none" | "row" | "group" | string;
  selectedEdgeWidth: number;
  borderWidth: number;
}

export interface CellClusterInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  border: ColorRef | string | null;
}

export interface FirstColumnVariantInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
  weight: number | null;
}

export interface FirstColumnClusterInputs {
  default: FirstColumnVariantInputs;
  bold: FirstColumnVariantInputs;
}

export interface PlotScaffoldInputs {
  bg: ColorRef | string | null;
  axisLine: ColorRef | string | null;
  tickMark: ColorRef | string | null;
  gridline: ColorRef | string | null;
  reference: ColorRef | string | null;
  tickMarkLength: number;
  lineWidth: number;
  pointSize: number;
}

export interface MarkRecipeInputs {
  body: string;       // slot-bundle field name
  outline: string;
  line: string;
}

export interface MarksRecipesInputs {
  forest: MarkRecipeInputs;
  summary: MarkRecipeInputs;
  bar: MarkRecipeInputs;
  box: MarkRecipeInputs;
  violin: MarkRecipeInputs;
  lollipop: MarkRecipeInputs;
}

export interface ClustersInputs {
  header: HeaderClusterInputs;
  columnGroup: ColumnGroupClusterInputs;
  rowGroup: RowGroupClusterInputs;
  row: RowClusterInputs;
  cell: CellClusterInputs;
  firstColumn: FirstColumnClusterInputs;
  plot: PlotScaffoldInputs;
  marks: MarksRecipesInputs;
}

// ────────────────────────────────────────────────────────────────────
// Resolved theme — what render-time consumers see
// ────────────────────────────────────────────────────────────────────

export interface ThemeStructure {
  schemaVersion: 3;
  name: string;
  inputs: ThemeInputs;
  /** Resolved T0 ramps. */
  ramps: TokenRamps;
  /** Resolved T2 token map (every token name → hex). */
  tokens: Record<TokenName, string>;
  /** Paint role recipes (refs not yet dereferenced — render-time picks per role). */
  roles: ThemeRoles;
  /** Component cluster bindings (refs not yet dereferenced). */
  clusters: ClustersInputs;
}
