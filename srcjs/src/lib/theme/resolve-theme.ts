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
import type { ThemeWire } from "./theme-wire";
import { getRoleBinding } from "./theme-wire";
import { buildRamps } from "./theme-resolve";
import { buildAlphaRamp } from "./alpha-ramp";
import { reflectHex } from "./polarity";
import { pickInkOnBg } from "../oklch";
import {
  resolveTypographyInputs,
  resolveTypeRole,
  type TypeRoleName,
} from "./typography";
import { resolveShellPaper, shellPaperKeyForCssVar } from "./shell-paper";
import {
  COMPONENT_TOKENS,
  type ComponentToken,
  type TokenSource,
} from "./component-tokens";
import {
  DEFAULT_ROLE_BINDINGS,
  type RoleBinding,
} from "./role-bindings";

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

/** Derive polarity from inputs. Polarity field is authoritative now; mode
 *  no longer encodes light/dark (post Q-P4.5 split). */
function derivePolarity(inputs: ThemeInputs): "light" | "dark" {
  return inputs.polarity ?? "light";
}

/** Apply polarity reflection to the input anchor hexes (Stage 1 §22).
 *  Returns a new ThemeInputs with `polarity` set and anchors reflected
 *  when polarity is dark. */
function applyPolarityToInputs(inputs: ThemeInputs): ThemeInputs {
  const polarity = derivePolarity(inputs);
  if (polarity === "light") return { ...inputs, polarity: "light" };
  return {
    ...inputs,
    polarity: "dark",
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

/** Pre-computed context for resolving off-ramp roles — status anchors,
 *  APCA-picked text-onsolid, etc. Built once per resolveTheme call. */
interface OffRampContext {
  /** APCA-picked text color against brand-solid (pickInkOnBg result). */
  readonly textOnSolid: string;
  /** The full TokenRamps.status object — each status has a 5-step ramp:
   *  slot 0 = subtle bg, slot 2 = solid, slot 4 = ink (text). */
  readonly status: TokenRamps["status"];
}

/** Apply HC mode's border-grade push. Per Stage 1 §23b: under
 *  high-contrast, border roles push by +2 grades so the dividers gain
 *  visual force. Other roles pass through unchanged. */
function applyHcGradePush(role: RoleName, binding: RoleBinding): RoleBinding {
  if (role === "border-subtle" || role === "border" || role === "border-strong"
      || role === "focus-ring" || role === "accent-border") {
    return { ramp: binding.ramp, grade: Math.min(11, binding.grade + 2) };
  }
  return binding;
}

/** Resolve a single role to its hex value. Routes off-ramp roles
 *  (status, text-onsolid) through dedicated paths; standard roles
 *  read from the bound ramp. Applies HC mode's border-grade push at
 *  this layer. */
function resolveRoleValue(
  role: RoleName,
  rawBinding: RoleBinding,
  ramps12: TokenRamps,
  alphaRamps: { neutralAlpha: AlphaRamp; brandAlpha: AlphaRamp; accentAlpha: AlphaRamp },
  offRamp: OffRampContext,
  mode: ThemeInputs["mode"],
): string {
  const binding = mode === "high-contrast"
    ? applyHcGradePush(role, rawBinding)
    : rawBinding;

  // Computed: text-onsolid is APCA-picked against the most-common solid
  // (brand-solid). Pre-computed in offRamp.
  if (role === "text-onsolid") {
    return offRamp.textOnSolid;
  }

  // Status roles read from the corresponding status 5-step ramp.
  // Slot layout per `buildStatusRamp` in theme-resolve.ts:
  //   [0] subtle bg, [1] subtle border, [2] solid, [3] solid-hover, [4] ink
  if (role.startsWith("pos-") || role.startsWith("neg-")
      || role.startsWith("warn-") || role.startsWith("info-")) {
    const key = role.startsWith("pos-")   ? "positive"
              : role.startsWith("neg-")   ? "negative"
              : role.startsWith("warn-")  ? "warning"
              : "info";
    const ramp = offRamp.status[key as keyof typeof offRamp.status];
    const suffix = role.split("-").slice(1).join("-"); // "fill" | "solid" | "text"
    if (suffix === "fill") return ramp[0]!;   // subtle background
    if (suffix === "solid") return ramp[2]!;  // solid (the seed)
    if (suffix === "text") return ramp[4]!;   // ink
    return ramp[2]!;  // fallback to solid
  }

  // Wash roles: read from alpha companions.
  if (role === "highlight-bg") {
    const r = binding.ramp === "neutral" ? alphaRamps.neutralAlpha
            : binding.ramp === "brand" ? alphaRamps.brandAlpha
            : alphaRamps.accentAlpha;
    return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
  }

  // Standard role + series slots: read from the bound solid ramp.
  const r = binding.ramp === "neutral" ? ramps12.neutral
          : binding.ramp === "brand" ? ramps12.brand
          : ramps12.accent;
  return r[Math.max(0, Math.min(10, binding.grade - 1))]!;
}

/** Resolve a single component token to a CSS-var value, applying any
 *  mode-specific transforms declared on the token's `modes` field.
 *
 *  Per Stage 1 §23 — mode transforms:
 *    - "drop" → emits `transparent`
 *    - { swap: roleName } → looks up `roles[roleName]` instead of the
 *      token's normal source
 *
 *  The mode comes from `inputs.mode` (Q-P4.5 split — mode now means
 *  contrast mode, not light/dark). */
function resolveTokenValue(
  token: ComponentToken,
  resolved: {
    roles: Record<RoleName, string>;
    ramps: TokenRamps;
    inputs: ThemeInputs;
  },
): string {
  // Mode-specific transforms — drop or swap based on the active mode.
  const mode = resolved.inputs.mode;
  if (mode === "high-contrast" && token.modes?.hc) {
    const beh = token.modes.hc;
    if (beh === "drop") return "transparent";
    // beh is { swap: roleName }
    return resolved.roles[beh.swap];
  }
  if (mode === "reduced-transparency" && token.modes?.rt) {
    const beh = token.modes.rt;
    if (beh === "drop") return "transparent";
    return resolved.roles[beh.swap];
  }

  // Stage 2 typography tokens always route through the typography resolver,
  // regardless of kind. (`lh` and `track` are tagged spacing-px / size, but
  // their values come from the type-role table, not density.)
  if (token.source.tier === "computed") {
    const typography = resolveTypographyComputed(token.cssVar, resolved.inputs);
    if (typography !== null) return typography;
    const shellPaper = resolveShellPaperComputed(token.cssVar, resolved);
    if (shellPaper !== null) return shellPaper;
  }

  // Spacing-px tokens are resolved via the density table regardless of
  // source.tier — many are tagged `computed` because they derive from a
  // density × kind formula. The density preset comes from inputs.density;
  // inputs.densityFactor multiplies it (clamped [0.5, 2]).
  if (token.kind === "spacing-px") {
    return tokenDensityPx(token.cssVar, resolved.inputs.density ?? "comfortable", resolved.inputs.densityFactor);
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
      // Typography computed tokens were handled above. Other computed
      // sources are token-specific; they fall through to placeholder.
      return "<computed>";
    case "const":
      // Const sources have hard-coded values; the most common is "transparent".
      if (source.note?.includes("transparent")) return "transparent";
      return "<const>";
  }
}

/** Stage 2 typography resolver. Matches `--tv-text-{role}-{prop}` and emits
 *  the typed value via `resolveTypeRole()`. Returns null when the cssVar
 *  doesn't match the typography pattern so the caller falls through to
 *  the placeholder path. */
const TYPOGRAPHY_PROPS = ["family", "size", "weight", "lh", "track", "font"] as const;
const TYPOGRAPHY_ROLE_NAMES = new Set<TypeRoleName>([
  "title", "subtitle", "heading", "body", "numeric",
  "label", "caption", "footnote", "cell", "tick",
]);

/** Stage 2 §2 shell/paper resolver. Matches `--tv-shell-*` and `--tv-paper-*`
 *  cssVars and emits the corresponding value from resolveShellPaper().
 *  Returns null when the cssVar doesn't match. */
function resolveShellPaperComputed(
  cssVar: string,
  resolved: { roles: Record<RoleName, string>; inputs: ThemeInputs },
): string | null {
  const key = shellPaperKeyForCssVar(cssVar);
  if (key === null) return null;
  const sp = resolveShellPaper(resolved.inputs, {
    surface:       resolved.roles.surface       ?? "#FFFFFF",
    surfaceSubtle: resolved.roles["surface-subtle"] ?? "#F0F0F0",
    border:        resolved.roles.border        ?? "#CCCCCC",
    borderSubtle:  resolved.roles["border-subtle"]  ?? "#E0E0E0",
  });
  return sp[key];
}

function resolveTypographyComputed(cssVar: string, inputs: ThemeInputs): string | null {
  // Pattern: --tv-text-{role}-{prop}
  const m = cssVar.match(/^--tv-text-([a-z]+)-([a-z]+)$/);
  if (!m) return null;
  const role = m[1] as TypeRoleName;
  const prop = m[2];
  if (!TYPOGRAPHY_ROLE_NAMES.has(role)) return null;
  if (!TYPOGRAPHY_PROPS.includes(prop as (typeof TYPOGRAPHY_PROPS)[number])) return null;
  const typo = resolveTypographyInputs(inputs);
  const r = resolveTypeRole(role, typo);
  switch (prop) {
    case "family": return r.family;
    case "size":   return `${r.size}px`;
    case "weight": return String(r.weight);
    case "lh":     return r.lh === null ? "normal" : String(r.lh);
    case "track":  return r.track;
    case "font":   return r.font;
    default:       return null;
  }
}

/** Per-token density-driven default px value. Looks up the density preset
 *  (compact / comfortable / spacious), then multiplies by densityFactor
 *  (clamped [0.5, 2]). Mirrors theme-adapter.ts's DENSITY_SPACING +
 *  scaleSpacing for parity with the v3 path. */
type DensityPreset = "compact" | "comfortable" | "spacious";

const DENSITY_PRESETS: Record<DensityPreset, Record<string, number>> = {
  compact: {
    "--tv-spacing-row-height": 20,
    "--tv-spacing-header-height": 26,
    "--tv-spacing-padding": 8,
    "--tv-spacing-cell-padding-x": 8,
    "--tv-spacing-cell-padding-y": 0,
    "--tv-spacing-axis-gap": 8,
    "--tv-spacing-column-group-padding": 6,
    "--tv-spacing-row-group-padding": 8,
    "--tv-spacing-header-gap": 8,
    "--tv-spacing-footer-gap": 6,
    "--tv-spacing-title-subtitle-gap": 10,
    "--tv-spacing-bottom-margin": 12,
    "--tv-spacing-indent-per-level": 14,
    "--tv-spacing-container-padding": 0,
  },
  comfortable: {
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
  },
  spacious: {
    "--tv-spacing-row-height": 30,
    "--tv-spacing-header-height": 40,
    "--tv-spacing-padding": 16,
    "--tv-spacing-cell-padding-x": 14,
    "--tv-spacing-cell-padding-y": 0,
    "--tv-spacing-axis-gap": 16,
    "--tv-spacing-column-group-padding": 12,
    "--tv-spacing-row-group-padding": 16,
    "--tv-spacing-header-gap": 16,
    "--tv-spacing-footer-gap": 12,
    "--tv-spacing-title-subtitle-gap": 18,
    "--tv-spacing-bottom-margin": 22,
    "--tv-spacing-indent-per-level": 20,
    "--tv-spacing-container-padding": 0,
  },
};

// Plot-dim tokens don't scale with density per v3 conventions.
const PLOT_DIMS: Record<string, number> = {
  "--tv-plot-tick-mark-length": 4,
  "--tv-plot-line-width": 1.5,
  "--tv-plot-point-size": 6,
};

function tokenDensityPx(
  cssVar: string,
  density: DensityPreset,
  factor: number | undefined,
): string {
  const plot = PLOT_DIMS[cssVar];
  if (plot !== undefined) return `${plot}px`;
  const base = DENSITY_PRESETS[density][cssVar];
  if (base === undefined) return "0px";
  if (factor == null || factor === 1) return `${base}px`;
  const f = Math.max(0.5, Math.min(2, factor));
  return `${Math.round(base * f)}px`;
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

  // Pre-compute off-ramp context:
  //   - text-onsolid: APCA pick between the lightest and darkest neutrals
  //     against the brand-solid (rgb 9) background. This is the most-common
  //     "text on a colored solid" surface in widget output.
  //   - status: lifted from the existing buildRamps output (5-step per
  //     status).
  const brandSolid = ramps12.brand[8] ?? wire.inputs.brand;
  const textOnSolidCandidates = [
    ramps12.neutral[0]!,
    ramps12.neutral[11]!,
  ];
  const offRamp: OffRampContext = {
    textOnSolid: pickInkOnBg(brandSolid, textOnSolidCandidates),
    status: ramps12.status,
  };

  // Resolve every role to its hex via its binding.
  const roleSource = {} as Record<RoleName, RoleBinding>;
  const roles = {} as Record<RoleName, string>;
  for (const role of Object.keys(DEFAULT_ROLE_BINDINGS) as RoleName[]) {
    const binding = getRoleBinding(wire, role);
    roleSource[role] = binding;
    roles[role] = resolveRoleValue(role, binding, ramps12, alphaRamps, offRamp, wire.inputs.mode);
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
