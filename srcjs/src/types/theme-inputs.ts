// Theme authoring-input types — the V4 cascade authoring surface.
//
// Layers (defined here):
//   T1 — ThemeInputs    (the entire user-authoring surface)
//   T0 — TokenRamps     (11-step ramps generated from T1 anchors)
//   T2 — token vocabulary (addressable names; resolved from T0)
//   T3+ — paint roles, clusters, data layer
//
// V4 vocabulary (vs v3): identity is four named OKLCH anchors —
// paper, ink, brand, and optional accent — instead of a brand hex
// plus neutral_tint knobs. Polarity reflection acts on each anchor's L.
// Muted is a grade position on the relevant ramp, not a separate anchor.
// See docs/dev/theme-cascade-stage-1-design.md §22.

// ────────────────────────────────────────────────────────────────────
// Primitive types
// ────────────────────────────────────────────────────────────────────

/** OKLCH triple — the wire format for every Tier 1 color anchor.
 *  L in [0, 1] (lightness), C in [0, ~0.4] (chroma), H in [0, 360) (hue). */
export interface OklchTriple {
  L: number;
  C: number;
  H: number;
}

/** Accessibility / display mode — independent of polarity (light/dark).
 *  Standard, high-contrast, and reduced-transparency are applied by
 *  the resolver via per-token `modes.{hc,rt}` behavior in the manifest. */
export type ThemeMode = "standard" | "high-contrast" | "reduced-transparency";

/** Name of a registered data palette scheme (categorical/sequential/diverging). */
export type SchemeName = string;

// ────────────────────────────────────────────────────────────────────
// T1 — Identity inputs (what the user authors)
// ────────────────────────────────────────────────────────────────────

/** The four Tier 1 color anchors that drive the entire cascade.
 *  - paper: the light-end neutral anchor; defines surface, paper_alt, paper_raised.
 *  - ink:   the dark-end neutral anchor; defines text, text-muted, text-subtle.
 *  - brand: the identity hue; powers brand_solid, brand_text, header_bg.
 *  - accent: optional engagement hue; powers hover/selected/callouts
 *    AND the rubrication channel (--tv-ink2: significance stars, caption
 *    chips). Defaults to brand when unset. (The former separate `ink2`
 *    anchor was merged into accent — it silently won the accent-ramp
 *    seed, so it was a redundant second engagement hue; rubrication that
 *    must differ from interaction is now a pin on `--tv-ink2`.) */
export interface ThemeAnchors {
  paper: OklchTriple;
  ink: OklchTriple;
  brand: OklchTriple;
  accent?: OklchTriple;
}

/** Optional status anchors (positive/negative/warning/info) as OKLCH
 *  triples so polarity reflection acts on them uniformly with the
 *  identity anchors. Defaults are curated semantic colors. */
export interface ThemeStatusAnchors {
  positive?: OklchTriple;
  negative?: OklchTriple;
  warning?: OklchTriple;
  info?: OklchTriple;
}

export interface ThemeInputs {
  /** The four Tier 1 anchors. Required; every preset declares them. */
  anchors: ThemeAnchors;

  /** Light or dark. Polarity reflection inverts every anchor's L around
   *  the midpoint. Default: "light". */
  polarity?: "light" | "dark";

  /** Accessibility mode. Polarity-orthogonal. Default: "standard". */
  mode?: ThemeMode;

  /** B8 (wire-audit 2b, D3): monochrome — the neutral ramp rides the
   *  brand hue with chroma shaped from brand C (lerp 0.18x -> 0.62x
   *  across the ramp; rgc_v4 engine.jsx:82-89). One toggle for
   *  Terminal-phosphor / sepia / cyanotype single-hue themes that are
   *  otherwise structurally hard to author. (rgc name:
   *  aliasNeutralToBrand; renamed for discoverability per D3.) */
  monochrome?: boolean;

  /** Data palette scheme references. */
  categorical?: SchemeName;
  sequential?: SchemeName;
  diverging?: SchemeName;

  /** Optional status anchor overrides. */
  status?: ThemeStatusAnchors;

  /** Typography. `numeric` is a dedicated FIGURE font for the data columns
   *  (user feedback 2026-06-08: a theme should be able to set a number font
   *  separately from the monospace font — an elegant tabular/lining figure
   *  face when one exists). Falls back to `body` when unset, so numbers
   *  follow the body font by default (never the clashing mono). */
  fonts?: {
    body?: string;
    display?: string;
    mono?: string;
    numeric?: string;
  };

  /** Stage 2 §3 surface texture. Themeable background pattern applied to
   *  the shell or paper. Four textures plus none:
   *
   *    none    — no texture (default)
   *    ruled   — horizontal lines (notebook paper)
   *    grid    — orthogonal grid (graph paper)
   *    dotted  — dotted grid
   *    grain   — pseudo-random noise (subtle paper texture)
   *
   *  Drives `[data-shell-texture]` selectors + 3 texture color tokens. */
  shell_texture?: "none" | "ruled" | "grid" | "dotted" | "grain";

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
  /** Header chrome treatment — a STRUCTURAL VARIANT, not an effect
   *  (relocated out of effects.* per the R2 decision: it picks which
   *  header cluster paints, like shell_mode picks surfaces). One
   *  vocabulary everywhere: light / tint / bold. */
  header_style?: "light" | "tint" | "bold";

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

  /** Tier-2 TYPE-ROLE rebinds (theme-rework Wave 3 — the non-color
   *  scale-role keystone). Each of the 9 type roles
   *  (title/subtitle/body/numeric/label/caption/footnote/cell/tick)
   *  composes a `{family, size, weight}` recipe over the Tier-1 type
   *  knobs; this map overrides any subset of that recipe per role. Absent
   *  (or absent fields) → the role's `DEFAULT_TYPE_ROLES` recipe. This is
   *  the rebindable layer behind the studio/viewer "Text sizes" control
   *  and `set_role()` for type-domain roles. Lives on inputs (not a
   *  separate wire field) because a type recipe IS a composition of Tier-1
   *  knobs — it rides the existing inputs channel through wire/R/studio. */
  type_roles?: Partial<Record<
    "title" | "subtitle" | "body" | "numeric" | "label" | "caption" | "footnote" | "cell" | "tick",
    {
      family?: "display" | "body" | "mono";
      size?: "label" | "foot" | "body" | "head" | "subtitle" | "title" | "display";
      weight?: "regular" | "medium" | "semibold" | "bold";
    }
  >>;

  /** Density preset (the curated spacing baseline). */
  density?: "compact" | "comfortable" | "spacious";
  /** Continuous multiplier on the density preset's spacing tokens — a fine
   *  dial on top of the named profile (e.g. 0.9 = a touch tighter than
   *  comfortable). 1 = the profile unchanged. Clamped to [0.5, 2]. */
  density_factor?: number;

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

  /** Viz-mark identity (D12, wire-audit 1f) — per-theme defaults for
   *  plot marks. The cascade stays author-first: row markerStyle >
   *  effect.shape > THESE > renderer rotation.
   *    point_shape     — default marker glyph for every series slot.
   *    interval_weight — CI line weight: hair 1px / regular 1.5px /
   *                      thick 2.5px (theme.plot.lineWidth; read by both
   *                      the DOM renderer and SVG export). */
  marks?: {
    point_shape?: "circle" | "square" | "diamond" | "triangle";
    interval_weight?: "hair" | "regular" | "thick";
  };

  /** Series viz mark style. Drives how each series slot's fill / stroke
   *  pair derives from the slot's anchor color.
   *    fill_with_darker_stroke — saturated fill + darker stroke (default)
   *    flat_fill              — same color for fill and stroke
   *    outlined               — pale fill + saturated stroke
   *  Default: "fill_with_darker_stroke". */
  slot_style?: "fill_with_darker_stroke" | "flat_fill" | "outlined";

  /** Border treatment as a STRUCTURAL VARIANT input (settings-overhaul P0).
   *  A Tier-1 enum the resolver expands into the full T3 borders cluster —
   *  the `header_style` precedent. Replaces per-edge border editing in the
   *  settings panel (raw cluster pins remain studio/R territory).
   *    none     — no rules anywhere
   *    hairline — 1px horizontal rules, subtle minors (the default look)
   *    ruled    — heavier editorial horizontals (2px majors)
   *    frame    — journal top+bottom table frame, light interior
   *    boxed    — full grid + table outline
   *  Unset keeps the resolver's default cluster (≡ hairline). */
  border_preset?: "none" | "hairline" | "ruled" | "frame" | "boxed";

  /** Per-row-kind theme defaults — currently only height ratio; Stage 2
   *  paint fields (bg, fg, border, weight) extend this shape per Q10
   *  closure. Layer 3 of the row-kind height cascade (Stage 1 §33). */
  row_kinds?: Partial<Record<
    "data" | "group_header" | "spacer" | "summary" | "header" | "panel",
    { heightRatio?: number }
  >>;

  /** Theme-as-house-style: per-column-TYPE default OPTIONS the theme suggests
   *  (2026-06-09; the maintainer's "a clinical theme makes p-value columns
   *  show stars by default" goal). Keyed by column type → a partial options
   *  object (e.g. `{ pvalue: { stars: true, significantStyle: "pill" } }`).
   *  Applied at spec construction UNDER each matching column's own options
   *  (author always wins — `default` mode), and KIND-GATED: only options whose
   *  schema `kind` is "styling" or "editor" are accepted; "core" (data/
   *  behavior) options are dropped, so a theme can never silently change what
   *  the data MEANS. See lib/theme/column-defaults.ts. */
  column_defaults?: Partial<Record<string, Record<string, unknown>>>;

  /** Theme-opinionated interaction defaults (interactivity-UX arc P1).
   *  Sparse map of boolean capability flags (snake_case or camelCase keys;
   *  e.g. `{ enable_axis_zoom: true }`) sitting BETWEEN the global tier and
   *  the author's explicit `interaction` settings in the resolution chain
   *  (`lib/interaction-resolve.ts`): a presentation theme can switch zoom
   *  affordances on; an editorial theme keeps chrome quiet; an explicit
   *  author setting always wins. UNTRUSTED ingress — unknown keys and
   *  non-boolean values are dropped at resolve time AND validated at both
   *  wire ingresses (TS `validateThemeInputs`, R `theme_inputs_from_wire`). */
  interaction_defaults?: Partial<Record<string, boolean>>;

  /** Phase D — GEOMETRY cascade axis.
   *
   *  Numeric scale tokens that drive corner softness + line weight across
   *  the widget. Tier 1 input → Tier 2 roles (radius-card, radius-pill,
   *  border-width-rule, border-width-emphasis) → Tier 3 component tokens
   *  (--tv-radius-{sm,md,lg,pill}, --tv-border-width-{hair,thin,regular,
   *  thick}).
   *
   *  In HC mode all border-widths bump (`+1px`) to compensate for the
   *  reduced colour cue; radius is unchanged. */
  geometry?: {
    radius?: {
      sm?: number;     // 2 px default — small chips, pill ornaments
      md?: number;     // 6 px default — buttons, controls
      lg?: number;     // 10 px default — panels, cards, paper
      pill?: number;   // 999 px default — chip pills, tags
    };
    border_width?: {
      hair?: number;    // 0.5 px — gridlines, alt-row dividers
      thin?: number;    // 1 px — default rules
      regular?: number; // 1.5 px — header rules
      thick?: number;   // 2.5 px — emphasis bars, callout borders
    };
  };

  /** Phase D — EFFECTS cascade axis.
   *
   *  Optional visual layers that dramatise the cascade without being
   *  semantic-load-bearing. Mode-aware: HC drops every effect to "none";
   *  RT keeps glow but flattens gradient.
   *
   *  glow_anchor picks which ramp the glow draws its colour from (the
   *  resolver reads ramp[9] as the saturated peak). gradient_shell stops
   *  derive from brand+accent ramps at the requested intensity grade. */
  effects?: {
    glow_intensity?: "none" | "subtle" | "neon";
    glow_anchor?: "brand" | "accent";
    gradient_shell_intensity?: "none" | "subtle" | "vivid";
    gradient_shell_angle?: number;   // degrees; default 90 (left-to-right)
    /** Figure-wide depth (none / low / medium / high). Pure MAGNITUDE
     *  vocabulary — deliberately shares no words with shell_mode's
     *  raised/float (R2 decision: the two axes collided on those tokens
     *  with different meanings). Lands on the shell when raised, the
     *  paper otherwise. */
    elevation?: "none" | "low" | "medium" | "high";
    /** Glass material (B16, wire-audit 5a). "frosted" turns the shell
     *  into a translucent pane (backdrop blur + saturate + brightness,
     *  4-layer bevel, 148deg sheen); "aurora" adds the borealis backdrop
     *  blob layer behind the pane. Browser-additive (D11); SVG export
     *  renders the opaque shell. Every glass token is polarity- and
     *  paper-hue-aware (C59 — flat constants read as grey smear). */
    glass?: "none" | "frosted" | "aurora";
    /** B12 (wire-audit 2c-i): title treatment. "bar" paints a ::before
     *  accent stripe ahead of the title (lab.css:278); "underline" rules
     *  beneath it. */
    title_style?: "normal" | "bar" | "underline";
    /** Caption treatment above the paper (B17, wire-audit 1c). "chip"
     *  renders labels.tag as a boxed TABLE-N stamp on the shell;
     *  "stripe" shows the brand-gradient seam (the shell-strip element)
     *  even without a gradient_shell pin; "both" stacks chip over stripe
     *  (the lab Ledger look — chip and stripe deliberately source
     *  DIFFERENT anchors, oxblood chip on brand-gradient strip). */
    caption_style?: "none" | "chip" | "stripe" | "both";
  };
}

// ────────────────────────────────────────────────────────────────────
// T0 — Token ramps (generated from T1 anchors)
// ────────────────────────────────────────────────────────────────────
//
// Each ramp is a 12-element hex array. Index i = Radix step (i+1).
// Use `rampStep(ramp, n)` (from `lib/oklch`) for 1-indexed access.
//
// In V4 every ramp shares the same L progression — interpolated between
// `paper.L` (step 1) and `ink.L` (step 12) — and varies only in chroma
// and hue. Neutral takes paper/ink hue; brand takes brand hue at brand C
// peak; accent takes accent (or brand) hue at accent C peak. Muted is
// grade 4 (or wherever the role binds), not a separate ramp.

export interface TokenRamps {
  /** 12-step neutral ramp interpolated between paper and ink. */
  neutral: string[];
  /** 12-step brand ramp. */
  brand: string[];
  /** 12-step accent ramp (defaults to brand if no accent anchor). */
  accent: string[];
  /** 5-step status palettes. */
  status: {
    positive: string[];
    negative: string[];
    warning: string[];
    info: string[];
  };
}

// ════════════════════════════════════════════════════════════════════
// V3 LEGACY VOCABULARY — used ONLY by `theme-resolve.ts::buildThemeStructure`
// (still called from theme-adapter.ts to populate the v3 chrome fields
// theme-css.ts's user-config tail reads from).
//
// New code MUST NOT import from this section. The v4 substrate uses
// `lib/theme/component-tokens.ts` for the token manifest,
// `lib/theme/role-bindings.ts` for the role catalog, and
// `lib/theme/resolve-theme.ts` for the v4 resolver. The v3 types below
// stay alive because deleting them requires deleting buildThemeStructure
// (and migrating the borders/firstColumn/headerVariant/semantic.row
// clusters of theme-css.ts to v4 manifest entries — tasks #72-#74).
//
// When the v3 chrome clusters fully migrate, this entire section
// (TokenName through ClustersInputs) gets deleted along with
// theme-resolve.ts.
// ════════════════════════════════════════════════════════════════════

/** @deprecated v3 vocabulary — see V3 LEGACY VOCABULARY header above. */

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

/** Numeric ramp-step references (programmatic addressability): `neutral.3`, `brand.9`, etc.
 *  @deprecated v3 vocabulary. */
export type RampStepRef =
  | `neutral.${number}`
  | `brand.${number}`
  | `accent.${number}`;

/** Color reference. Tagged-object form is canonical; plain string accepted by resolvers.
 *  @deprecated v3 vocabulary. */
export type ColorRef =
  | { ref: TokenName | RampStepRef; alpha?: number }
  | { hex: string; alpha?: number };

/** @deprecated v3 vocabulary — convenience constructor for ColorRef. */
export function ref(name: TokenName | RampStepRef, alpha?: number): ColorRef {
  return alpha === undefined ? { ref: name } : { ref: name, alpha };
}

/** @deprecated v3 vocabulary — hex literal as a tagged-object ref. */
export function lit(hex: string, alpha?: number): ColorRef {
  return alpha === undefined ? { hex } : { hex, alpha };
}

// ────────────────────────────────────────────────────────────────────
// V3 — Paint roles (fixed canonical recipes)
// ────────────────────────────────────────────────────────────────────

/** @deprecated v3 vocabulary — fixed canonical role vocabulary. Themes
 *  redefine recipes; cannot add roles. Distinct from the v4 `RoleName`
 *  in `types/theme-roles.ts` (which has a broader role catalog). */
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

/** @deprecated v3 vocabulary — paint-role recipe. */
export interface PaintRole {
  bg?: ColorRef | string | null;
  fg?: ColorRef | string | null;
  border?: ColorRef | string | null;
  markerFill?: ColorRef | string | null;
  markerStroke?: ColorRef | string | null;
  fontWeight?: number | null;
  fontStyle?: "normal" | "italic" | null;
}

/** @deprecated v3 vocabulary. */
export type ThemeRoles = Record<RoleName, PaintRole>;

// ────────────────────────────────────────────────────────────────────
// V3 — Component clusters (low-level bindings; reference T2 via refs)
// ────────────────────────────────────────────────────────────────────

/** @deprecated v3 cluster — see V3 LEGACY VOCABULARY header. */
export interface RowStateInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
}

/** @deprecated v3 cluster. */
export interface HeaderVariantInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
}

/** @deprecated v3 cluster. */
export interface HeaderClusterInputs {
  light: HeaderVariantInputs;
  tint: HeaderVariantInputs;
  bold: HeaderVariantInputs;
}

export type ColumnGroupClusterInputs = HeaderClusterInputs;

/** @deprecated v3 cluster. */
export interface RowGroupTierInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
  fontWeight: number | null;
}

/** @deprecated v3 cluster. */
export interface RowGroupClusterInputs {
  L1: RowGroupTierInputs;
  L2: RowGroupTierInputs;
  L3: RowGroupTierInputs;
}

/** @deprecated v3 cluster. */
export interface RowClusterInputs {
  base: RowStateInputs;
  alt: RowStateInputs;
  hover: RowStateInputs;
  selected: RowStateInputs;
  banding: "none" | "row" | "group" | string;
  selectedEdgeWidth: number;
  borderWidth: number;
}

/** @deprecated v3 cluster. */
export interface CellClusterInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  border: ColorRef | string | null;
}

/** @deprecated v3 cluster. */
export interface FirstColumnVariantInputs {
  bg: ColorRef | string | null;
  fg: ColorRef | string | null;
  rule: ColorRef | string | null;
  weight: number | null;
}

/** @deprecated v3 cluster. */
export interface FirstColumnClusterInputs {
  default: FirstColumnVariantInputs;
  bold: FirstColumnVariantInputs;
}

/** @deprecated v3 cluster. */
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

/** @deprecated v3 cluster. */
export interface MarkRecipeInputs {
  body: string;       // slot-bundle field name
  outline: string;
  line: string;
}

/** @deprecated v3 cluster. */
export interface MarksRecipesInputs {
  forest: MarkRecipeInputs;
  summary: MarkRecipeInputs;
  bar: MarkRecipeInputs;
  box: MarkRecipeInputs;
  violin: MarkRecipeInputs;
  lollipop: MarkRecipeInputs;
}

/** @deprecated v3 cluster. */
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
  /** V4 substrate intermediate-structure version (per Stage 1 §22).
   *  Aligns with `WebTheme.schemaVersion = 4` (theme-resolved.ts) post-
   *  coherence-pass — both track the V4 substrate together. Distinct
   *  from `CURRENT_VERSION` in `srcjs/src/spec/index.ts` (the wire-spec
   *  version, currently 1.2), which versions the *spec* shape, not the
   *  *theme* shape. */
  schemaVersion: 4;
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
