// Theme V3 types — the rationalized theme surface.
//
// Lives alongside the legacy V2 types during the rationalization arc
// (PRs A–I). PR I deletes V2 and drops the V3 suffix. See
// `~/.claude/plans/theme-rationalization.md`.
//
// Layers (defined here):
//   T1 — ThemeInputsV3       (the entire user-authoring surface)
//   T0 — TokenRampsV3        (12-step ramps generated from T1 inputs)
//   T2 — token vocabulary    (addressable names; resolved from T0)
//   T3+ — paint roles, clusters, data layer  (defined in later PRs)

// ────────────────────────────────────────────────────────────────────
// T1 — Identity inputs (what the user authors)
// ────────────────────────────────────────────────────────────────────

/** Mode toggle. Inverts the neutral ramp direction. T2 token names stay stable. */
export type ThemeMode = "light" | "dark";

/** Optional tint for the neutral ramp — blends a small fraction of a hue into low-chroma ends. */
export type NeutralTintV3 =
  | "untinted"        // pure achromatic ramp
  | "brand"           // tint with brand hue
  | "accent"          // tint with accent hue
  | "decorative"      // tint with decorative hue (if set)
  | { hex: string };  // explicit hex tint

/** Name of a registered data palette scheme. PR E adds the full registry. */
export type SchemeNameV3 = string;

export interface ThemeInputsV3 {
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
  neutral_tint?: NeutralTintV3;

  /** Data palette scheme references — PR E wires the registry. */
  categorical?: SchemeNameV3;
  sequential?: SchemeNameV3;
  diverging?: SchemeNameV3;

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

  /** Density preset (used for spacing). */
  density?: "compact" | "comfortable" | "spacious";
}

// ────────────────────────────────────────────────────────────────────
// T0 — Token ramps (generated from T1 inputs)
// ────────────────────────────────────────────────────────────────────
//
// Each ramp is a 12-element hex array. Index i = Radix step (i+1).
// Use `rampStep(ramp, n)` (from `lib/oklch`) for 1-indexed access.

export interface TokenRampsV3 {
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

export type TokenNameV3 =
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
export type RampStepRefV3 =
  | `neutral.${number}`
  | `brand.${number}`
  | `accent.${number}`
  | `decorative.${number}`;

/** Color reference. Tagged-object form is canonical; plain string accepted by resolvers. */
export type ColorRefV3 =
  | { ref: TokenNameV3 | RampStepRefV3; alpha?: number }
  | { hex: string; alpha?: number };

/** Convenience constructor — `ref("ink_muted")` or `ref("brand.9")`. */
export function ref(name: TokenNameV3 | RampStepRefV3, alpha?: number): ColorRefV3 {
  return alpha === undefined ? { ref: name } : { ref: name, alpha };
}

/** Hex literal as a tagged-object ref (rare — plain string usually works). */
export function lit(hex: string, alpha?: number): ColorRefV3 {
  return alpha === undefined ? { hex } : { hex, alpha };
}
