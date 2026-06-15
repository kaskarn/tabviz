/**
 * Theme role vocabulary (v4 substrate).
 *
 * This module defines the Tier-2 role vocabulary the substrate cascade
 * resolves to and the upstream input/ramp/anchor types the resolver
 * references. The vocabulary is shared between the resolver
 * (`srcjs/src/lib/theme/theme-resolve.ts`), the manifest
 * (`srcjs/src/lib/theme/component-tokens.ts`), the override schema
 * (`srcjs/src/lib/theme/theme-wire.ts`), the R-side classes, and the
 * Cascade Inspector.
 *
 * Centralized here per Decisions log (Q-P1.2 closed 2026-06-02): roles are
 * needed by multiple modules; circular imports are avoided by dedicating
 * one types module. Pattern mirrors `srcjs/src/types/theme-inputs.ts`.
 *
 * See `docs/dev/theme-cascade-stage-1-design.md` §2 (layer naming) and §10
 * (resolver pipeline) for the conceptual specification.
 */

/** Tier-1 ramp identifier. Three ramps drive the substrate's color cascade. */
export type RampName = "neutral" | "brand" | "accent";

/** Tier-1 anchor identifier — the OKLCH seed values from which ramps and
 *  roles derive. `paper` and `ink` are the polar neutrals; `brand` and
 *  `accent-anchor` seed the chromatic ramps; status anchors seed the
 *  semantic status roles independently. */
export type AnchorName =
  | "paper"
  | "ink"
  | "brand"
  | "accent-anchor"
  | "status-positive"
  | "status-negative"
  | "status-warning"
  | "status-info";

/** Ramp-shape curve. Reshapes the lightness progression across the 11
 *  ramp grades. See Stage 1 design doc §25 for aesthetic implications. */
export type CurveName = "linear" | "ease" | "smooth" | "log" | "exp";

/** Tier-2 role vocabulary. Each role is a semantic name the renderer thinks
 *  in; the resolver binds each role to a `(ramp, grade)` pair (or, for
 *  off-ramp roles, to an anchor/computed source). Component tokens in the
 *  manifest reference these by name. See Stage 1 design doc §10.
 *
 *  Off-ramp roles (`text-onsolid`, status roles) cannot be pinned via the
 *  `(ramp, grade)` override schema — see Stage 1 §26 + Q-P4.4 closure. */
export type RoleName =
  // Surface (Tier-2 derived from neutral)
  | "surface"
  | "surface-subtle"
  // Fill states
  | "fill"
  | "fill-hover"
  | "fill-active"
  // Border
  | "border-subtle"
  | "border"
  | "border-strong"
  // Brand
  | "brand-solid"
  | "brand-solid-hover"
  | "brand-text"
  // Text (foreground)
  | "text"
  | "text-muted"
  | "text-subtle"
  | "text-onsolid"          // off-ramp: computed contrast pick vs paired solid
  // Focus + highlight
  | "focus-ring"
  | "highlight-bg"          // wash role — reads from alpha companion (Stage 1 §24)
  | "highlight-bar"
  // Accent
  | "accent-fill"
  | "accent-border"
  | "accent-solid"
  | "accent-text"
  // Status (off-ramp: each is anchored at a Tier-1 status input)
  | "pos-fill"
  | "pos-solid"
  | "pos-text"
  | "neg-fill"
  | "neg-solid"
  | "neg-text"
  | "warn-fill"
  | "warn-text"
  | "info-fill"
  | "info-text"
  // Series slots — anchor the per-effect marks in forest plots. Five slots,
  // each with fill + stroke roles. Drawn from brand/accent ramps with
  // per-anchor offsets; resolution lives in the slot table.
  | "series-1-fill" | "series-1-stroke"
  | "series-2-fill" | "series-2-stroke"
  | "series-3-fill" | "series-3-stroke"
  | "series-4-fill" | "series-4-stroke"
  | "series-5-fill" | "series-5-stroke";

/** Role kind — drives Cascade Inspector grouping and Spine UI focus filter
 *  (Stage 3 §3, rgc_v4 spine.jsx pattern). */
export type RoleKind = "fill" | "border" | "text";

/** Classification of every role by its rendering kind. Used by the Spine UI
 *  to filter focus by kind (`all` / `fills` / `borders` / `text`). */
export const ROLE_KIND: Record<RoleName, RoleKind> = {
  // Fills (background + solid + highlight)
  surface:           "fill",
  "surface-subtle":  "fill",
  fill:              "fill",
  "fill-hover":      "fill",
  "fill-active":     "fill",
  "brand-solid":     "fill",
  "brand-solid-hover":"fill",
  "highlight-bg":    "fill",
  "highlight-bar":   "fill",
  "accent-fill":     "fill",
  "accent-solid":    "fill",
  "pos-fill":        "fill",
  "pos-solid":       "fill",
  "neg-fill":        "fill",
  "neg-solid":       "fill",
  "warn-fill":       "fill",
  "info-fill":       "fill",
  "series-1-fill":   "fill",
  "series-2-fill":   "fill",
  "series-3-fill":   "fill",
  "series-4-fill":   "fill",
  "series-5-fill":   "fill",

  // Borders (strokes)
  "border-subtle":   "border",
  border:            "border",
  "border-strong":   "border",
  "focus-ring":      "border",
  "accent-border":   "border",
  "series-1-stroke": "border",
  "series-2-stroke": "border",
  "series-3-stroke": "border",
  "series-4-stroke": "border",
  "series-5-stroke": "border",

  // Text (foregrounds)
  text:              "text",
  "text-muted":      "text",
  "text-subtle":     "text",
  "text-onsolid":    "text",
  "brand-text":      "text",
  "accent-text":     "text",
  "pos-text":        "text",
  "neg-text":        "text",
  "warn-text":       "text",
  "info-text":       "text",
};

/** Off-ramp roles — anchored at Tier-1 inputs or computed at resolve time,
 *  not derived from a `(ramp, grade)` binding. Cannot be overridden via
 *  `setRoleBinding()`; throw `RoleNotBindableError` per Q-P4.4 closure.
 *  The override path for these is either a Tier-1 input modifier
 *  (`setStatus()`) or, for `text-onsolid`, not user-overridable at all. */
export const OFF_RAMP_ROLES: ReadonlySet<RoleName> = new Set<RoleName>([
  "text-onsolid",
  "pos-fill", "pos-solid", "pos-text",
  "neg-fill", "neg-solid", "neg-text",
  "warn-fill", "warn-text",
  "info-fill", "info-text",
]);

/** All role names enumerated. Built from the union via runtime iteration of
 *  ROLE_KIND for the cases where TS can't enumerate a string union. */
export const ALL_ROLES: readonly RoleName[] =
  Object.keys(ROLE_KIND) as readonly RoleName[];

/** All ramp names enumerated. */
export const ALL_RAMPS: readonly RampName[] = ["neutral", "brand", "accent"];

/** All curve names enumerated (canonical roster; consumed by curves.test.ts). */
export const ALL_CURVES: readonly CurveName[] = [
  "linear", "ease", "smooth", "log", "exp",
];
