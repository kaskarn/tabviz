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

import type { ThemeInputs, OklchTriple, TokenRamps } from "../../types/theme-inputs";
import type { RoleName } from "../../types/theme-roles";
import type { ThemeWire } from "./theme-wire";
import { getRoleBinding } from "./theme-wire";
import { buildRamps } from "./theme-resolve";
import { buildAlphaRamp } from "./alpha-ramp";
import { reflectL } from "./polarity";
import { pickInkOnBg, oklchToHex } from "../oklch";

/** Reflect an OKLCH anchor across the polarity pivot. L flips, C and H stay. */
function reflectAnchor(a: OklchTriple): OklchTriple {
  return { L: reflectL(a.L), C: a.C, H: a.H };
}

/** Optional anchor — reflect if present, else pass through. */
function reflectAnchorMaybe(a: OklchTriple | undefined): OklchTriple | undefined {
  return a ? reflectAnchor(a) : undefined;
}
import {
  resolveTypographyInputs,
  resolveTypeRole,
  type TypeRoleName,
} from "./typography";
import { resolveShellPaper, shellPaperKeyForCssVar } from "./shell-paper";
import { resolveElevationShadows, elevationKeyForCssVar } from "./elevation";
import { resolveTextureColors, textureKeyForCssVar, resolveTextureKnockoutBg } from "./textures";
import { validateThemeInputs } from "./theme-validate";
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

/** Apply polarity reflection to the input anchors (Stage 1 §22). Returns
 *  a new ThemeInputs with `polarity` set and every anchor's L reflected
 *  around the polarity pivot when polarity is dark. C and H are unchanged. */
export function applyPolarityToInputs(inputs: ThemeInputs): ThemeInputs {
  const polarity = derivePolarity(inputs);
  if (polarity === "light") return { ...inputs, polarity: "light" };
  return {
    ...inputs,
    polarity: "dark",
    anchors: {
      paper: reflectAnchor(inputs.anchors.paper),
      ink:   reflectAnchor(inputs.anchors.ink),
      brand: reflectAnchor(inputs.anchors.brand),
      accent: reflectAnchorMaybe(inputs.anchors.accent),
    },
    status: inputs.status
      ? {
          positive: reflectAnchorMaybe(inputs.status.positive),
          negative: reflectAnchorMaybe(inputs.status.negative),
          warning:  reflectAnchorMaybe(inputs.status.warning),
          info:     reflectAnchorMaybe(inputs.status.info),
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

/** Apply HC mode's border-grade push (Layer A of the HC behavior
 *  inventory in `resolveTokenValue`'s docstring). Under high-contrast,
 *  border roles push by +2 grades so dividers gain visual force; other
 *  roles pass through unchanged.
 *
 *  Operates on RoleBinding (not on a component token), because the
 *  conceptually-correct level is the role-to-grade binding — any
 *  consumer token reading the pushed role inherits the bumped value
 *  for free. Not migratable to per-token `token.modes` declarations
 *  without adding roles at grades 9 and 10. Per Stage 1 §23b. */
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
/**
 * HC mode behavior lives at FOUR layers, each operating on a distinct
 * scope. They don't compose into a single token.modes declaration
 * because they operate on different artifacts:
 *
 *   Layer A — role binding (applyHcGradePush, in resolveRoleValue):
 *     pushes border-* roles +2 grades so dividers gain force. Operates
 *     on RoleBinding before role-value resolution. Can't migrate to
 *     token.modes because the +2 push for `border` (g7→g9) and
 *     `border-strong` (g8→g10) would need roles at grades 9/10 that
 *     don't exist in the role catalog.
 *
 *   Layer B — declarative token.modes (this function, lines below):
 *     drop or swap a token's value under HC/RT. The general
 *     mechanism; new tokens prefer this. Examples: `--tv-row-alt-bg`
 *     drops under HC; `--tv-row-emphasis-bg` drops under HC and
 *     swaps to fill-hover under RT.
 *
 *   Layer C — HC fidelity tokens (the named constants below): the
 *     three `caret-char`, `ring-width`, and `bar-width` tokens in the
 *     hc-fidelity cluster, whose VALUE changes with mode (not just a
 *     drop-or-swap). The token.modes schema only carries drop/swap,
 *     not value substitution; keep inline until that schema extends.
 *
 *   Layer D — Phase D geometry hcBump (in resolveGeometryComputed):
 *     adds +1px to every border-width under HC. The token.modes
 *     schema doesn't support arithmetic transforms; keep inline.
 *
 * If a future schema gains `{value: string}` or `{add: number}`, layer
 * C + D become migratable; layer A stays as-is (it's at the wrong
 * abstraction for per-token declaration).
 */

// Layer-C HC fidelity values — pulled to named constants so each
// token's mode-dependent value is a one-line read rather than buried
// in if-chain text.
const HC_CARET_CHAR_VALUE = "▸";
const HC_BAR_WIDTH_HC     = "4px";
const HC_BAR_WIDTH_STD    = "3px";
const HC_RING_WIDTH_VALUE = "1.5px";

/** Fallback hex when an optional status anchor isn't set on inputs.
 *  Mirrors theme-css.ts's `BADGE_VARIANTS` fallback for the v3 emission. */
const STATUS_ANCHOR_FALLBACK: Record<string, string> = {
  "status-positive": "#16A34A",
  "status-negative": "#DC2626",
  "status-warning":  "#D97706",
  "status-info":     "#2563EB",
};

/** Sentinel value emitted when a placeholder branch is hit in production.
 *  Empty string makes a `var(...)` reference fall through to its declared
 *  fallback if any, otherwise the property is invalid and the browser
 *  drops it (same effective behavior as the var being undeclared). This
 *  beats leaking the literal text `<computed>` into the cascade. */
const TOKEN_RESOLVE_BUG_SENTINEL = "";

/** True under `vite dev`, vitest, bun:test, and any other non-PROD bundle.
 *  Vite inlines `import.meta.env.PROD` to a literal at build time; under
 *  bun/V8 / other runtimes that don't define `import.meta.env`, the
 *  optional chain returns undefined and we treat that as "not production"
 *  so the dev-throw fires there too (which is what we want for tests). */
function isDev(): boolean {
  try {
    return (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== true;
  } catch {
    return true;
  }
}

/** Called when resolveTokenValue's dispatch fell through to a placeholder
 *  branch — always a bug in the manifest, the resolver, or both. In dev
 *  we throw loudly so CI / the failing test makes the bug visible; in
 *  production we emit a console.error + an empty-string sentinel so a
 *  single resolver bug can't take down the whole render. */
function tokenResolveBug(
  cssVar: string,
  tier: TokenSource["tier"],
  detail: string,
): string {
  const msg =
    `resolveTokenValue: no resolver matched for ${cssVar} ` +
    `(tier=${tier}, ${detail}). ` +
    `Either the manifest entry's source.tier is wrong or a resolver is missing.`;
  if (isDev()) throw new Error(msg);
  // eslint-disable-next-line no-console
  console.error(msg);
  return TOKEN_RESOLVE_BUG_SENTINEL;
}

function resolveTokenValue(
  token: ComponentToken,
  resolved: {
    roles: Record<RoleName, string>;
    ramps: TokenRamps;
    inputs: ThemeInputs;
  },
): string {
  // Layer B — declarative token.modes drop/swap.
  const mode = resolved.inputs.mode;
  if (mode === "high-contrast" && token.modes?.hc) {
    const beh = token.modes.hc;
    if (beh === "drop") return "transparent";
    return resolved.roles[beh.swap];
  }
  if (mode === "reduced-transparency" && token.modes?.rt) {
    const beh = token.modes.rt;
    if (beh === "drop") return "transparent";
    return resolved.roles[beh.swap];
  }

  // Layer C — HC fidelity tokens. Short-circuit before kind dispatch
  // so density/border-width branches don't capture them.
  if (token.cssVar === "--tv-hc-caret-char") {
    return mode === "high-contrast" ? HC_CARET_CHAR_VALUE : "";
  }
  if (token.cssVar === "--tv-hc-ring-width") {
    return HC_RING_WIDTH_VALUE;
  }
  if (token.cssVar === "--tv-hc-bar-width") {
    return mode === "high-contrast" ? HC_BAR_WIDTH_HC : HC_BAR_WIDTH_STD;
  }

  // Stage 2 §7 browser-additive effects.
  if (token.cssVar === "--tv-brand-gradient") {
    const brandHex = oklchToHex(resolved.inputs.anchors.brand);
    const brandSolid = resolved.roles["brand-solid"] ?? brandHex;
    // Use ramp grade 8 (mid) and grade 10 (deep) for a subtle two-stop sweep.
    const brandRamp = resolved.ramps.brand;
    const a = brandRamp[7] ?? brandSolid;
    const b = brandRamp[9] ?? brandSolid;
    return `linear-gradient(90deg, ${a} 0%, ${b} 100%)`;
  }
  if (token.cssVar === "--tv-glow-brand-color") {
    // rgba from accent-solid at alpha 0.4.
    const brandHex = oklchToHex(resolved.inputs.anchors.brand);
    const accent = resolved.roles["accent-solid"] ?? brandHex;
    if (accent.startsWith("#")) {
      const h = accent.slice(1);
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }
    return accent;
  }
  if (token.cssVar === "--tv-glass-blur") {
    return "16px";
  }

  // ── Phase D — GEOMETRY (radius + border-width) ─────────────────────────
  // Direct projection from inputs.geometry with defaults baked here so
  // every preset gets sensible values without per-preset opt-in.
  {
    const g = resolveGeometryComputed(token.cssVar, resolved.inputs);
    if (g !== null) return g;
  }

  // ── Phase D — EFFECTS (glow + gradient + shadow) ───────────────────────
  // Derived from anchor ramps. Mode-aware behaviour rides on token.modes
  // (HC drops, RT swaps) so the dispatcher above already handled it.
  {
    const e = resolveEffectsComputed(token.cssVar, resolved);
    if (e !== null) return e;
  }

  // Stage 2 typography tokens always route through the typography resolver,
  // regardless of kind. (`lh` and `track` are tagged spacing-px / size, but
  // their values come from the type-role table, not density.)
  if (token.source.tier === "computed") {
    const typography = resolveTypographyComputed(token.cssVar, resolved.inputs);
    if (typography !== null) return typography;
    const shellPaper = resolveShellPaperComputed(token.cssVar, resolved);
    if (shellPaper !== null) return shellPaper;
    const elevation = resolveElevationComputed(token.cssVar, resolved);
    if (elevation !== null) return elevation;
    const texture = resolveTextureComputed(token.cssVar, resolved);
    if (texture !== null) return texture;
    const knockout = resolveKnockoutComputed(token.cssVar, resolved);
    if (knockout !== null) return knockout;
  }

  // Spacing-px tokens are resolved via the density table regardless of
  // source.tier — many are tagged `computed` because they derive from a
  // density × kind formula. The density preset comes from inputs.density;
  // inputs.density_factor multiplies it (clamped [0.5, 2]).
  if (token.kind === "spacing-px") {
    return tokenDensityPx(token.cssVar, resolved.inputs.density ?? "comfortable", resolved.inputs.density_factor);
  }
  if (token.kind === "border-width") {
    // Density-table lookup mirrors the spacing-px branch above — PLOT_DIMS
    // contains plot-line-width / hc-ring-width etc. Without this lookup
    // every border-width token returned "1px" regardless of the table.
    return tokenDensityPx(token.cssVar, resolved.inputs.density ?? "comfortable", resolved.inputs.density_factor);
  }

  const source: TokenSource = token.source;
  switch (source.tier) {
    case "role":
      return resolved.roles[source.role];
    case "input":
      // No manifest entry currently uses `tier: "input"` — a direct read
      // from Tier-1 inputs goes through `tier: "anchor"` (for ramps) or a
      // computed resolver (for typography/density). If a manifest entry
      // ever declares `tier: "input"`, add an explicit dispatch above.
      return tokenResolveBug(token.cssVar, source.tier,
        `input=${String(source.input)}`);
    case "anchor": {
      const anchorHex = pickAnchorHex(source.anchor, resolved.inputs);
      if (anchorHex !== null) return anchorHex;
      // Status anchors are optional inputs. When the theme doesn't set
      // them, fall back to the BADGE_VARIANTS palette so badges/icons
      // render correctly. The mapping mirrors theme-css.ts's v3 emission.
      const statusFallback = STATUS_ANCHOR_FALLBACK[source.anchor];
      if (statusFallback !== undefined) return statusFallback;
      return tokenResolveBug(token.cssVar, source.tier,
        `anchor=${source.anchor} not resolvable from inputs`);
    }
    case "computed":
      // Typography / shellPaper / elevation / texture / knockout / Phase D
      // geometry + effects all handled above. Falling through means a
      // computed token has no resolver wired — add one or change tier.
      return tokenResolveBug(token.cssVar, source.tier,
        `note=${source.note ?? "(none)"}`);
    case "const":
      // HC-fidelity tokens (caret-char, ring-width, bar-width) are
      // intercepted in the HC-fidelity short-circuit earlier in
      // resolveTokenValue; the duplicate block that used to live here
      // was dead code.
      if (source.note?.includes("transparent")) return "transparent";
      return tokenResolveBug(token.cssVar, source.tier,
        `note=${source.note ?? "(none)"}`);
  }
}

/** Stage 2 typography resolver. Matches `--tv-text-{role}-{prop}` and emits
 *  the typed value via `resolveTypeRole()`. Returns null when the cssVar
 *  doesn't match the typography pattern so the caller falls through to
 *  the placeholder path. */
const TYPOGRAPHY_PROPS = ["family", "size", "weight"] as const;
const TYPOGRAPHY_ROLE_NAMES = new Set<TypeRoleName>([
  "title", "subtitle", "body", "numeric",
  "label", "caption", "footnote", "cell", "tick",
]);

/** Stage 2 §3 texture color resolver. Matches `--tv-{surface}-texture-{line|dot}`
 *  cssVars and emits the neutral-grade-derived value. Returns null when
 *  the cssVar doesn't match. */
function resolveTextureComputed(
  cssVar: string,
  resolved: { ramps: TokenRamps },
): string | null {
  const key = textureKeyForCssVar(cssVar);
  if (key === null) return null;
  return resolveTextureColors(resolved.ramps.neutral)[key];
}

/** Stage 2 §4 texture knockout resolver. Premixes the surface bg at 78%
 *  opacity against white so both CSS and SVG paths consume a literal hex
 *  (avoiding the `color-mix()` librsvg compatibility wrinkle). */
function resolveKnockoutComputed(
  cssVar: string,
  resolved: { roles: Record<RoleName, string>; inputs: ThemeInputs },
): string | null {
  let surfaceBg: string | null = null;
  if (cssVar === "--tv-shell-text-knockout-bg") {
    const sp = resolveShellPaper(resolved.inputs, {
      surface:       resolved.roles.surface       ?? "#FFFFFF",
      surfaceSubtle: resolved.roles["surface-subtle"] ?? "#F0F0F0",
      border:        resolved.roles.border        ?? "#CCCCCC",
      borderSubtle:  resolved.roles["border-subtle"]  ?? "#E0E0E0",
    });
    surfaceBg = sp.shellBg;
  } else if (cssVar === "--tv-paper-text-knockout-bg") {
    const sp = resolveShellPaper(resolved.inputs, {
      surface:       resolved.roles.surface       ?? "#FFFFFF",
      surfaceSubtle: resolved.roles["surface-subtle"] ?? "#F0F0F0",
      border:        resolved.roles.border        ?? "#CCCCCC",
      borderSubtle:  resolved.roles["border-subtle"]  ?? "#E0E0E0",
    });
    surfaceBg = sp.paperBg;
  }
  if (surfaceBg === null) return null;
  return resolveTextureKnockoutBg(surfaceBg);
}

/** Stage 2 §6 elevation shadow resolver. Matches `--tv-shadow-{tier}-{kind}`
 *  cssVars and emits hue-aware shadow colors mixed from the paper bg.
 *  Returns null when the cssVar doesn't match. */
function resolveElevationComputed(
  cssVar: string,
  resolved: { roles: Record<RoleName, string>; inputs: ThemeInputs },
): string | null {
  const key = elevationKeyForCssVar(cssVar);
  if (key === null) return null;
  const sp = resolveShellPaper(resolved.inputs, {
    surface:       resolved.roles.surface       ?? "#FFFFFF",
    surfaceSubtle: resolved.roles["surface-subtle"] ?? "#F0F0F0",
    border:        resolved.roles.border        ?? "#CCCCCC",
    borderSubtle:  resolved.roles["border-subtle"]  ?? "#E0E0E0",
  });
  const paperBg = sp.paperBg.startsWith("#") ? sp.paperBg : "#FFFFFF";
  return resolveElevationShadows(paperBg)[key];
}

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
    default:       return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Phase D — geometry + effects resolvers
// ────────────────────────────────────────────────────────────────────────────

/** Default radius scale (px). Editorial-soft baseline; brutalist-style
 *  presets pin smaller values per-key. */
const DEFAULT_RADIUS: Required<NonNullable<NonNullable<ThemeInputs["geometry"]>["radius"]>> = {
  sm: 2, md: 6, lg: 10, pill: 999,
};

/** Default border-width scale (px). Newspaper-hairline baseline. */
const DEFAULT_BORDER_WIDTH: Required<NonNullable<NonNullable<ThemeInputs["geometry"]>["border_width"]>> = {
  hair: 0.5, thin: 1, regular: 1.5, thick: 2.5,
};

/** Direct projection of inputs.geometry into the four radius + four
 *  border-width cssVars.
 *
 *  HC behavior here is Layer D of the HC inventory in `resolveTokenValue`'s
 *  docstring: border-width gets +1px under HC to compensate for the reduced
 *  colour cue. Not migratable to `token.modes` declarations because the
 *  current schema only carries drop/swap, not arithmetic transforms. The
 *  +1px bump is uniform across hair/thin/regular/thick so a single
 *  per-token declaration wouldn't even be cleaner than the centralized
 *  `hcBump` here. */
function resolveGeometryComputed(cssVar: string, inputs: ThemeInputs): string | null {
  const g = inputs.geometry;
  const isHc = inputs.mode === "high-contrast";

  // Radius
  if (cssVar === "--tv-radius-sm")   return `${g?.radius?.sm   ?? DEFAULT_RADIUS.sm}px`;
  if (cssVar === "--tv-radius-md")   return `${g?.radius?.md   ?? DEFAULT_RADIUS.md}px`;
  if (cssVar === "--tv-radius-lg")   return `${g?.radius?.lg   ?? DEFAULT_RADIUS.lg}px`;
  if (cssVar === "--tv-radius-pill") return `${g?.radius?.pill ?? DEFAULT_RADIUS.pill}px`;

  // Border-width — `hair` is also special-cased by the manifest entry's
  // `modes.hc: { swap: "border-strong" }` so under HC the token swaps to
  // a stronger role instead of just bumping; the +1px here applies for
  // the brief moment before the dispatcher's drop/swap fires. The rest
  // just thicken under HC.
  const hcBump = isHc ? 1 : 0;
  if (cssVar === "--tv-border-width-hair")
    return `${(g?.border_width?.hair    ?? DEFAULT_BORDER_WIDTH.hair)    + hcBump}px`;
  if (cssVar === "--tv-border-width-thin")
    return `${(g?.border_width?.thin    ?? DEFAULT_BORDER_WIDTH.thin)    + hcBump}px`;
  if (cssVar === "--tv-border-width-regular")
    return `${(g?.border_width?.regular ?? DEFAULT_BORDER_WIDTH.regular) + hcBump}px`;
  if (cssVar === "--tv-border-width-thick")
    return `${(g?.border_width?.thick   ?? DEFAULT_BORDER_WIDTH.thick)   + hcBump}px`;

  return null;
}

/** Convert a hex `#rrggbb` to an `rgba(...)` string at the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Phase D effects projection. Glow + gradient + emphasis-shadow derive
 *  from anchor ramps with mode-aware behaviour delegated to the
 *  dispatcher (token.modes.hc / .rt). */
function resolveEffectsComputed(
  cssVar: string,
  resolved: { ramps: TokenRamps; inputs: ThemeInputs },
): string | null {
  const fx = resolved.inputs.effects;
  const polarity = derivePolarity(resolved.inputs);

  // ── Glow ──────────────────────────────────────────────────────────────
  if (cssVar === "--tv-glow-color") {
    const intensity = fx?.glow_intensity ?? "none";
    if (intensity === "none") return "transparent";
    const anchor = fx?.glow_anchor ?? "brand";
    const ramp = anchor === "accent" ? resolved.ramps.accent : resolved.ramps.brand;
    // Peak-chroma grade 9 (index 8) reads as the saturated mid hue.
    const peak = ramp[8] ?? ramp[ramp.length - 1] ?? "#000000";
    // Dark polarity reads neon-bright at higher alpha; light reads softer.
    const alpha = intensity === "neon"
      ? (polarity === "dark" ? 0.85 : 0.55)
      : (polarity === "dark" ? 0.50 : 0.30);
    return hexToRgba(peak, alpha);
  }
  if (cssVar === "--tv-glow-blur") {
    const intensity = fx?.glow_intensity ?? "none";
    return intensity === "neon" ? "18px"
         : intensity === "subtle" ? "8px"
         : "0px";
  }
  if (cssVar === "--tv-glow-spread") {
    const intensity = fx?.glow_intensity ?? "none";
    return intensity === "neon" ? "3px"
         : intensity === "subtle" ? "1px"
         : "0px";
  }

  // ── Gradient shell ────────────────────────────────────────────────────
  if (cssVar === "--tv-shell-gradient") {
    const intensity = fx?.gradient_shell_intensity ?? "none";
    if (intensity === "none") return "transparent";
    const angle = fx?.gradient_shell_angle ?? 90;
    const fromIdx = intensity === "vivid" ? 8 : 5;   // brand chroma peak / mid
    const toIdx   = intensity === "vivid" ? 8 : 3;   // accent chroma peak / soft
    const from = resolved.ramps.brand[fromIdx]  ?? resolved.ramps.brand[8]  ?? "#000000";
    const to   = resolved.ramps.accent[toIdx]   ?? resolved.ramps.accent[8] ?? "#FFFFFF";
    return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
  }

  // ── Emphasis shadow ───────────────────────────────────────────────────
  if (cssVar === "--tv-shadow-emphasis") {
    const elev = fx?.elevation ?? "none";
    if (elev === "none") return "none";
    // Stack a near + far shadow per Stage 2 §6 convention. Near uses the
    // brand-peak hue at low alpha to keep colour identity in the elevation.
    const peak = resolved.ramps.brand[9] ?? "#1c1a17";
    const near = hexToRgba(peak, 0.15);
    const far  = hexToRgba(peak, 0.08);
    const k = elev === "float" ? 1.6 : elev === "raised" ? 1.2 : 0.8;
    return `0 ${k * 1}px ${k * 3}px ${near}, 0 ${k * 4}px ${k * 12}px ${far}`;
  }

  return null;
}

/** Per-token density-driven default px value. Looks up the density preset
 *  (compact / comfortable / spacious), then multiplies by density_factor
 *  (clamped [0.5, 2]). Mirrors theme-adapter.ts's DENSITY_SPACING +
 *  scaleSpacing for parity with the v3 path. */
// Density px scales live in density-presets.ts as a single source of
// truth; both the v3 adapter (theme-adapter.ts) and this v4 resolver
// project from there so they can't drift.
import { densityPresetAsCssVars, type DensityPreset } from "./density-presets";

const DENSITY_PRESETS: Record<DensityPreset, Record<string, number>> = {
  compact:     densityPresetAsCssVars("compact"),
  comfortable: densityPresetAsCssVars("comfortable"),
  spacious:    densityPresetAsCssVars("spacious"),
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

/** Resolve an anchor name to its hex value from V4 inputs. */
function pickAnchorHex(
  anchor: string,
  inputs: ThemeInputs,
): string | null {
  const a = inputs.anchors;
  switch (anchor) {
    case "paper":  return oklchToHex(a.paper);
    case "ink":    return oklchToHex(a.ink);
    case "brand":  return oklchToHex(a.brand);
    case "accent": return a.accent ? oklchToHex(a.accent) : null;
    case "accent-anchor": return oklchToHex(a.accent ?? a.brand);
    case "status-positive": return inputs.status?.positive ? oklchToHex(inputs.status.positive) : null;
    case "status-negative": return inputs.status?.negative ? oklchToHex(inputs.status.negative) : null;
    case "status-warning":  return inputs.status?.warning  ? oklchToHex(inputs.status.warning)  : null;
    case "status-info":     return inputs.status?.info     ? oklchToHex(inputs.status.info)     : null;
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
  // Inputs validation runs first so authoring mistakes (out-of-range
  // anchor triples, typo'd enum values, unknown effects intensity, ...)
  // surface as a structured error before the resolver wastes work or
  // silently produces a broken cssVars map. Mirrors R's S7 validator.
  validateThemeInputs(wire.inputs);
  const polarity = derivePolarity(wire.inputs);
  const reflected = applyPolarityToInputs(wire.inputs);

  // Build Tier-0 ramps via the existing resolver.
  const ramps12 = buildRamps(reflected);

  // Build alpha companions from each ramp's anchor (grade 9 ≈ the "solid"
  // step). The alpha builder takes a hex; we feed it the ramp's step-9 hex.
  const brandHex = oklchToHex(reflected.anchors.brand);
  const accentHex = oklchToHex(reflected.anchors.accent ?? reflected.anchors.brand);
  const alphaRamps = {
    neutralAlpha: buildAlphaRamp(ramps12.neutral[8] ?? "#888888"),
    brandAlpha: buildAlphaRamp(ramps12.brand[8] ?? brandHex),
    accentAlpha: buildAlphaRamp(ramps12.accent[8] ?? accentHex),
  };

  // Pre-compute off-ramp context:
  //   - text-onsolid: APCA pick between the lightest and darkest neutrals
  //     against the brand-solid (rgb 9) background. This is the most-common
  //     "text on a colored solid" surface in widget output.
  //   - status: lifted from the existing buildRamps output (5-step per
  //     status).
  const brandSolid = ramps12.brand[8] ?? brandHex;
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
