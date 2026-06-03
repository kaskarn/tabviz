/**
 * v4 substrate resolver entry point.
 *
 * `resolveTheme(wire)` is the top-level resolver for the v4 cascade.
 * Pipeline per Stage 1 §10b:
 *
 *   ThemeWire
 *     → applyPolarity(inputs)           [Tier 1 reflection if polarity = dark]
 *     → buildRamps(inputs)              [Tier 0 ramps via existing resolver]
 *     → buildAlphaRamps(anchors)        [11-step alpha companions per ramp]
 *     → resolveRoles(ramps, overrides)  [Tier 2 — apply role bindings]
 *     → emitCssVars(manifest, ...)      [Tier 3 — wire emission]
 *     → ResolvedTheme
 *
 * SUBSTRATE SPRINT NOTE: Step 4 of Stage 1 §40 — first integration commit.
 *
 *   - polarity application IS wired (uses `inputs.polarity` from M4-extended
 *     ThemeInputs, falling back to `inputs.mode` for backward compat).
 *   - curves integration is NOT wired yet — the existing `buildRamps` uses
 *     fixed LIGHT_RAMP_L / DARK_RAMP_L arrays; a future commit will modify
 *     `oklchRamp` to accept a curve parameter.
 *   - HC + RT mode transforms are NOT wired yet — Stage 1 §23 work.
 *   - off-ramp role resolution (status, computed) is preliminary —
 *     placeholder values; the proper APCA + status-anchor computation
 *     lands in the resolver rewrite proper.
 *
 * This commit makes the wire emit MEANINGFUL values (real ramp hexes for
 * role-bound tokens, real density-scaled px for spacing) instead of the
 * TBD placeholders shipped in [M2]. Consumers can now adopt the new
 * `--tv-*` namespace and validate visual fidelity end-to-end.
 */

import type { ThemeInputs, TokenRamps } from "../../types/theme-inputs";
import type { RoleName } from "../../types/theme-roles";
import type { ThemeWire, RoleBinding } from "./theme-wire";
import { buildRamps } from "./theme-resolve";
import { buildAlphaRamp } from "./alpha-ramp";
import { reflectHex } from "./polarity";
import {
  COMPONENT_TOKENS,
  type ComponentToken,
  type TokenSource,
} from "./component-tokens";
import {
  DEFAULT_ROLE_BINDINGS,
  getRoleBinding,
} from "./theme-wire";

// ============================================================================
// TYPES
// ============================================================================

/** 11-step ramp (solid hex strings). Each ramp corresponds to its
 *  ramp-grade CSS variable family. Note: existing `buildRamps` produces
 *  12-step arrays internally for back-compat; we truncate the lightest
 *  extra step here. */
export type Ramp = readonly string[];

/** Alpha-companion ramp (`oklch(L C H / A)` strings). Generated per
 *  Stage 1 §24 from each ramp's anchor color. */
export type AlphaRamp = readonly string[];

/** The v4 resolved theme — what consumers and SVG export read.
 *
 *  The `cssVars` map IS the consumer interface. The remaining fields are
 *  inspector-facing (Cascade Inspector reads provenance and ramps; Spine
 *  UI reads roles); SVG export materializes `cssVars` into the embedded
 *  `<style>` block (per Stage 1 §18). */
export interface ResolvedTheme {
  /** Echo of the inputs that produced this resolution. */
  readonly inputs: ThemeInputs;
  /** Polarity actually applied (after deriving from inputs). */
  readonly polarity: "light" | "dark";
  /** Tier-1 ramps + alpha companions. */
  readonly ramps: {
    readonly neutral: Ramp;
    readonly brand: Ramp;
    readonly accent: Ramp;
    readonly neutralAlpha: AlphaRamp;
    readonly brandAlpha: AlphaRamp;
    readonly accentAlpha: AlphaRamp;
  };
  /** Per-role resolved hex (Tier-2 values). */
  readonly roles: Readonly<Record<RoleName, string>>;
  /** Per-role binding (default OR override) — provenance source. */
  readonly roleSource: Readonly<Record<RoleName, RoleBinding>>;
  /** The wire — what consumers actually read. */
  readonly cssVars: Readonly<Record<string, string>>;
}

// ============================================================================
// RESOLVER PIPELINE
// ============================================================================

/** Derive polarity from inputs. `polarity` field wins; falls back to `mode`. */
function derivePolarity(inputs: ThemeInputs): "light" | "dark" {
  if (inputs.polarity) return inputs.polarity;
  if (inputs.mode === "dark") return "dark";
  return "light";
}

/** Apply polarity reflection to the input anchor hexes (Stage 1 §22).
 *  Returns a new ThemeInputs with reflected anchors when polarity is dark.
 *
 *  Only applies the reflection to the anchor hexes (brand, accent,
 *  decorative, status). The reflected inputs are then fed into the
 *  existing `buildRamps` which respects the mode/polarity for ramp
 *  direction.
 *
 *  NOTE: backward-compat caveat — `buildRamps` reads `inputs.mode` for L
 *  direction. We keep `mode` in sync with polarity to avoid breaking the
 *  existing resolver's mode-based ramp construction. */
function applyPolarityToInputs(inputs: ThemeInputs): ThemeInputs {
  const polarity = derivePolarity(inputs);
  if (polarity === "light") return { ...inputs, mode: "light" };
  return {
    ...inputs,
    mode: "dark",
    brand: reflectHex(inputs.brand),
    accent: inputs.accent ? reflectHex(inputs.accent) : undefined,
    decorative: inputs.decorative ? reflectHex(inputs.decorative) : null,
    status: inputs.status
      ? {
          positive: inputs.status.positive ? reflectHex(inputs.status.positive) : undefined,
          negative: inputs.status.negative ? reflectHex(inputs.status.negative) : undefined,
          warning: inputs.status.warning ? reflectHex(inputs.status.warning) : undefined,
          info: inputs.status.info ? reflectHex(inputs.status.info) : undefined,
        }
      : undefined,
  };
}

/** Take the first 11 steps of a 12-step ramp. The existing resolver
 *  produces 12-step ramps for backward compat; the v4 manifest references
 *  steps 1..11 (matching rgc_v4 convention). */
function trimRamp(ramp12: string[]): string[] {
  return ramp12.slice(0, 11);
}

/** Resolve a single role to its hex value. Off-ramp roles get placeholder
 *  values for now (proper computation lands in the resolver rewrite). */
function resolveRoleValue(
  role: RoleName,
  binding: RoleBinding,
  ramps12: TokenRamps,
  alphaRamps: { neutralAlpha: AlphaRamp; brandAlpha: AlphaRamp; accentAlpha: AlphaRamp },
): string {
  // Series slots fall through to placeholder for now (their full resolution
  // depends on the slot-anchor table not yet ported to v4).
  if (role.startsWith("series-")) {
    const r = binding.ramp === "neutral" ? ramps12.neutral
            : binding.ramp === "brand" ? ramps12.brand
            : ramps12.accent;
    return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
  }
  // Status + computed: placeholder values for now.
  if (role === "text-onsolid") {
    // Computed: pick neutral.1 (lightest) as a placeholder.
    return ramps12.neutral[0]!;
  }
  if (role.startsWith("pos-") || role.startsWith("neg-") || role.startsWith("warn-") || role.startsWith("info-")) {
    // Status: placeholder — read from neutral ramp at the placeholder grade.
    const r = ramps12.neutral;
    return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
  }
  // Wash roles: read from alpha companions.
  if (role === "highlight-bg") {
    const r = binding.ramp === "neutral" ? alphaRamps.neutralAlpha
            : binding.ramp === "brand" ? alphaRamps.brandAlpha
            : alphaRamps.accentAlpha;
    return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
  }
  // Standard role: read from the appropriate solid ramp at the bound grade.
  const r = binding.ramp === "neutral" ? ramps12.neutral
          : binding.ramp === "brand" ? ramps12.brand
          : ramps12.accent;
  return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
}

/** Resolve a single component token to a CSS-var value. */
function resolveTokenValue(
  token: ComponentToken,
  resolved: {
    roles: Record<RoleName, string>;
    ramps: TokenRamps;
    inputs: ThemeInputs;
  },
): string {
  // Spacing-px tokens are resolved via the density table regardless of
  // source.tier — many are tagged `computed` because they derive from a
  // density × kind formula. The full density-cascade integration lands
  // with the row-kind work (step 5).
  if (token.kind === "spacing-px") {
    return tokenDensityPx(token.cssVar);
  }
  if (token.kind === "border-width") {
    return "1px";
  }

  const source: TokenSource = token.source;
  switch (source.tier) {
    case "role":
      return resolved.roles[source.role];
    case "input":
      return `<input:${String(source.input)}>`;
    case "anchor": {
      const anchorHex = pickAnchorHex(source.anchor, resolved.inputs);
      return anchorHex ?? "<anchor-missing>";
    }
    case "computed":
      // Computed sources are token-specific; non-spacing computed tokens
      // get a placeholder until their per-token computation lands.
      return "<computed>";
    case "const":
      // Const sources have hard-coded values; the most common is "transparent".
      if (source.note?.includes("transparent")) return "transparent";
      return "<const>";
  }
}

/** Per-token density-driven default px value. Comfortable preset values
 *  used as the placeholder during step 4; full density-cascade integration
 *  lands with the row-kind work (step 5). */
function tokenDensityPx(cssVar: string): string {
  // Match the inventory values from Stage 1 §1.
  const COMFORTABLE: Record<string, number> = {
    "--tv-spacing-row-height": 24,
    "--tv-spacing-header-height": 32,
    "--tv-spacing-padding": 12,
    "--tv-spacing-cell-padding-x": 10,
    "--tv-spacing-cell-padding-y": 0,
    "--tv-spacing-axis-gap": 12,
    "--tv-spacing-column-group-padding": 8,
    "--tv-spacing-row-group-padding": 12,
    "--tv-spacing-header-gap": 12,
    "--tv-spacing-footer-gap": 8,
    "--tv-spacing-title-subtitle-gap": 13,
    "--tv-spacing-bottom-margin": 16,
    "--tv-spacing-indent-per-level": 16,
    "--tv-spacing-container-padding": 0,
    "--tv-plot-tick-mark-length": 4,
    "--tv-plot-line-width": 1.5,
    "--tv-plot-point-size": 6,
  };
  const v = COMFORTABLE[cssVar];
  return v !== undefined ? `${v}px` : "0px";
}

/** Resolve an anchor name to its hex value from inputs. */
function pickAnchorHex(
  anchor: string,
  inputs: ThemeInputs,
): string | null {
  switch (anchor) {
    case "brand": return inputs.brand;
    case "accent": return inputs.accent ?? null;
    case "decorative": return inputs.decorative ?? null;
    case "accent-anchor": return inputs.accent ?? inputs.brand;
    case "status-positive": return inputs.status?.positive ?? null;
    case "status-negative": return inputs.status?.negative ?? null;
    case "status-warning": return inputs.status?.warning ?? null;
    case "status-info": return inputs.status?.info ?? null;
    // paper / ink anchors come from the neutral ramp after polarity; not
    // directly accessible from inputs.
    case "paper":
    case "ink":
      return null;
    default:
      return null;
  }
}

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

/**
 * Resolve a ThemeWire into a v4 ResolvedTheme.
 *
 * Composes the v4 substrate pipeline:
 *   1. Apply polarity (anchor L-reflection) per Stage 1 §22.
 *   2. Build Tier-0 ramps via the existing resolver.
 *   3. Build alpha-companion ramps for each Tier-0 ramp.
 *   4. Resolve every role to its bound (ramp, grade) hex.
 *   5. Walk the manifest, emit the CSS-var map.
 *
 * The CSS-var map is the consumer interface (per Stage 1 §10b). Inspector-
 * facing fields (ramps, roles, roleSource) are exposed for the Cascade
 * Inspector + Spine UI.
 */
export function resolveTheme(wire: ThemeWire): ResolvedTheme {
  const polarity = derivePolarity(wire.inputs);
  const reflected = applyPolarityToInputs(wire.inputs);

  // Build Tier-0 ramps via the existing resolver.
  const ramps12 = buildRamps(reflected);

  // Build alpha companions from each ramp's anchor (grade 9 ≈ the "solid"
  // step). The alpha builder takes a hex; we feed it the ramp's step-9 hex.
  const alphaRamps = {
    neutralAlpha: buildAlphaRamp(ramps12.neutral[8] ?? "#888888"),
    brandAlpha: buildAlphaRamp(ramps12.brand[8] ?? wire.inputs.brand),
    accentAlpha: buildAlphaRamp(ramps12.accent[8] ?? wire.inputs.accent ?? wire.inputs.brand),
  };

  // Resolve every role to its hex via its binding.
  const roleSource = {} as Record<RoleName, RoleBinding>;
  const roles = {} as Record<RoleName, string>;
  for (const role of Object.keys(DEFAULT_ROLE_BINDINGS) as RoleName[]) {
    const binding = getRoleBinding(wire, role);
    roleSource[role] = binding;
    roles[role] = resolveRoleValue(role, binding, ramps12, alphaRamps);
  }

  // Emit the CSS-var map by walking the manifest.
  const cssVars = {} as Record<string, string>;
  for (const token of COMPONENT_TOKENS) {
    cssVars[token.cssVar] = resolveTokenValue(token, {
      roles,
      ramps: ramps12,
      inputs: reflected,
    });
  }

  return {
    inputs: wire.inputs,
    polarity,
    ramps: {
      neutral: trimRamp(ramps12.neutral),
      brand: trimRamp(ramps12.brand),
      accent: trimRamp(ramps12.accent),
      neutralAlpha: alphaRamps.neutralAlpha,
      brandAlpha: alphaRamps.brandAlpha,
      accentAlpha: alphaRamps.accentAlpha,
    },
    roles,
    roleSource,
    cssVars,
  };
}
