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
import { resolveBorders, type BorderWidths } from "./borders";
import {
  componentRoleOverride,
  componentChannelOverride,
  type ComponentBindings,
} from "./component-bindings";
import { getRoleBinding } from "./theme-wire";
import { buildRamps } from "./theme-resolve";
import { buildAlphaRamp } from "./alpha-ramp";
import { reflectL } from "./polarity";
import { pickInkOnBg, oklchToHex, contrastRatio, oklchMix, rampStep } from "../oklch";
import { BADGE_VARIANTS } from "../rendering-constants";

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
import { effectiveTypeRoles } from "./scale-roles";
import { resolveShellPaper, shellPaperKeyForCssVar } from "./shell-paper";
import { resolveTextureColors, textureKeyForCssVar, resolveTextureKnockoutBg } from "./textures";
import { validateThemeInputs } from "./theme-validate";
import {
  COMPONENT_TOKENS,
  isLiveConfigToken,
  type ComponentToken,
  type ResolverGroup,
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
    // Status anchors are NOT reflected: they're absolute semantic colors
    // the author picked FOR their surface. Reflecting them inverted
    // synthwave's dark-surface neons into mud — negative #FF2D55 became
    // #A1002D at 2.49:1, positive landed at 1.20:1 (adversarial color
    // review R2 #1).
    status: inputs.status,
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
 *   Layer C — RETIRED (decision D1, 2026-06-10): the HC-fidelity value-
 *     substitution tokens (caret/ring/bar) were designed but never wired
 *     to any markup, and were deleted with their resolver group. If a
 *     future token needs mode-dependent VALUES (not drop/swap), extend
 *     the token.modes schema rather than reviving the inline group.
 *
 *   Layer D — Phase D geometry hcBump (in resolveGeometryComputed):
 *     adds +1px to every border-width under HC. The token.modes
 *     schema doesn't support arithmetic transforms; keep inline.
 *
 * If a future schema gains `{value: string}` or `{add: number}`, layer
 * C + D become migratable; layer A stays as-is (it's at the wrong
 * abstraction for per-token declaration).
 *
 * AUDIT CLOSURE (wire-audit Pass 3a, 2026-06-05): B10's "migrate inline
 * HC logic to declarative token.modes" was verified ALREADY DONE for
 * Layer B — the pre-filter in resolveTokenValue has consumed token.modes
 * since Stage 1 §23, and the Pass-0d dispatch-parity test proved it
 * byte-identical across all presets × modes. Layers A/C/D stay inline
 * per the rationale above; no further migration is planned.
 */

/** Fallback palette when an optional status anchor isn't set on inputs.
 *  SINGLE SOURCE (wire-audit C48): derives from rendering-constants'
 *  BADGE_VARIANTS so the badge fallback, the --tv-status-* fallback, and
 *  the C9 high-contrast override can never drift apart. */
export const STATUS_ANCHOR_FALLBACK: Record<string, string> = {
  "status-positive": BADGE_VARIANTS.success,
  "status-negative": BADGE_VARIANTS.error,
  "status-warning":  BADGE_VARIANTS.warning,
  "status-info":     BADGE_VARIANTS.info,
};

/** Sentinel value emitted when a placeholder branch is hit in production.
 *  Empty string makes a `var(...)` reference fall through to its declared
 *  fallback if any, otherwise the property is invalid and the browser
 *  drops it (same effective behavior as the var being undeclared). This
 *  beats leaking the literal text `<computed>` into the cascade. */
const TOKEN_RESOLVE_BUG_SENTINEL = "";

/** Placeholder for live-config manifest entries (series slot 0, layout)
 *  realized by computeLiveConfigVars rather than the cascade. Emitters
 *  skip values starting with `<`; the live-config overlay supplies the
 *  real value on every read path. */
const LIVE_CONFIG_SENTINEL = "<live-config>";

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

/** The resolve context handed to every resolver. Built once per
 *  resolveTheme call (roles + ramps + reflected inputs). */
export interface ResolveCtx {
  roles: Record<RoleName, string>;
  ramps: TokenRamps;
  inputs: ThemeInputs;
  /** Component-model channel re-routes (W6). Consulted by the role +
   *  typography resolvers AFTER the HC/RT mode ratchet (ratchet beats
   *  re-route, same as it beats pins). */
  components?: ComponentBindings;
}

type ResolverFn = (token: ComponentToken, ctx: ResolveCtx) => string;

/** Wrap a `string | null` matcher-style resolver: a null return for a
 *  token explicitly tagged with that resolver's group is a manifest/
 *  resolver mismatch — dev-throw via tokenResolveBug. */
function requireMatch(
  value: string | null,
  token: ComponentToken,
  group: ResolverGroup,
): string {
  if (value !== null) return value;
  return tokenResolveBug(token.cssVar, token.source.tier,
    `resolverGroup=${group} resolver did not match this cssVar`);
}

/** Browser-additive effects group (Stage 2 §7). */
function resolveBrowserFxGroup(token: ComponentToken, ctx: ResolveCtx): string {
  if (token.cssVar === "--tv-brand-gradient") {
    // C36 (wire-audit 1c): lab-fidelity hue-shifted sweep — 135deg,
    // H-24 -> H+30, with the polarity branch on the first stop's L
    // (dark themes lift LIGHTER; rgc_v4 engine.jsx:215). The previous
    // 90deg two-ramp-stop emission lacked the hue sweep entirely.
    const brand = ctx.inputs.anchors.brand;
    const dark = derivePolarity(ctx.inputs) === "dark";
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const stopA = oklchToHex({
      L: clamp01(brand.L + (dark ? 0.06 : -0.02)),
      C: brand.C,
      H: (brand.H - 24 + 360) % 360,
    });
    const stopB = oklchToHex({ L: brand.L, C: brand.C, H: (brand.H + 30) % 360 });
    return `linear-gradient(135deg, ${stopA} 0%, ${stopB} 100%)`;
  }
  if (token.cssVar === "--tv-glow-brand-color") {
    // rgba from accent-solid at alpha 0.4.
    const brandHex = oklchToHex(ctx.inputs.anchors.brand);
    const accent = ctx.roles["accent-solid"] ?? brandHex;
    if (accent.startsWith("#")) {
      const h = accent.slice(1);
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }
    return accent;
  }
  return tokenResolveBug(token.cssVar, token.source.tier,
    "resolverGroup=browser-fx but cssVar has no browser-fx resolver");
}

/** Glass group (wire-audit 5a + 0d-iii) — every token is polarity- and
 *  paper-hue-aware (C59; flat constants make dark glass a grey smear).
 *  Ports the rgc_v4 engine.jsx:185-194 value table. Emits inert values
 *  when effects.glass is "none" so the CSS composes safely. */
function resolveGlassGroup(token: ComponentToken, ctx: ResolveCtx): string {
  const glass = ctx.inputs.effects?.glass ?? "none";
  const on = glass !== "none";
  const dark = derivePolarity(ctx.inputs) === "dark";
  const pH = Math.round(ctx.inputs.anchors.paper.H * 10) / 10;
  switch (token.cssVar) {
    case "--tv-glass-blur":
      // 0d-iii: input-driven (was a hardcoded 16px that silently defeated
      // intensity variation). Dark panes need a deeper blur to read lit.
      return !on ? "0px" : dark ? "30px" : "22px";
    case "--tv-glass-tint":
      return !on ? "transparent"
        : dark ? `oklch(0.30 0.02 ${pH} / 0.45)` : `oklch(0.98 0.01 ${pH} / 0.55)`;
    case "--tv-glass-faint":
      return !on ? "transparent"
        : dark ? "oklch(1 0 0 / 0.10)" : "oklch(1 0 0 / 0.60)";
    case "--tv-glass-edge-hi":
      return !on ? "transparent"
        : dark ? `oklch(0.98 0.03 ${pH} / 0.50)` : "oklch(1 0 0 / 0.85)";
    case "--tv-glass-edge-lo":
      return !on ? "transparent"
        : dark ? "oklch(0 0 0 / 0.35)" : `oklch(0.30 0.02 ${pH} / 0.18)`;
    case "--tv-glass-sheen":
      return !on ? "transparent"
        : dark ? "oklch(1 0 0 / 0.12)" : "oklch(1 0 0 / 0.55)";
    case "--tv-glass-shadow":
      // Composable no-op when off (the 1c shadow-list lesson).
      return !on ? "0 0 0 transparent"
        : dark ? "0 18px 40px oklch(0 0 0 / 0.50)"
               : `0 14px 34px oklch(0.25 0.03 ${pH} / 0.25)`;
    case "--tv-glass-backdrop-blobs": {
      // Borealis blob layer — aurora variant only. Brand/accent ramp
      // peaks at low alpha, three off-center radials (lab .glass-backdrop).
      if (glass !== "aurora") return "none";
      const b9 = ctx.ramps.brand[8] ?? "#888888";
      const a9 = ctx.ramps.accent[8] ?? b9;
      const b7 = ctx.ramps.brand[6] ?? b9;
      const blob = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      return (
        `radial-gradient(60% 50% at 18% 20%, ${blob(b9, 0.50)}, transparent 70%), ` +
        `radial-gradient(50% 45% at 82% 30%, ${blob(a9, 0.40)}, transparent 70%), ` +
        `radial-gradient(70% 60% at 50% 90%, ${blob(b7, 0.35)}, transparent 72%)`
      );
    }
  }
  return tokenResolveBug(token.cssVar, token.source.tier,
    "resolverGroup=glass but cssVar has no glass resolver");
}

/** Anchor group — direct anchor hex with status-palette fallback. */
function resolveAnchorGroup(token: ComponentToken, ctx: ResolveCtx): string {
  if (token.source.tier !== "anchor") {
    return tokenResolveBug(token.cssVar, token.source.tier,
      "resolverGroup=anchor but source.tier is not anchor");
  }
  // Component-model re-route (W6): redirects an anchor-sourced channel
  // to a Tier-2 role (e.g. cell emphasis ink → accent-text).
  const reroute = componentRoleOverride(token, ctx.components);
  if (reroute) return ctx.roles[reroute];
  const anchorHex = pickAnchorHex(token.source.anchor, ctx.inputs);
  if (anchorHex !== null) return anchorHex;
  // Status anchors are optional inputs. When the theme doesn't set
  // them, fall back to the BADGE_VARIANTS palette so badges/icons
  // render correctly. The mapping mirrors theme-css.ts's v3 emission.
  const statusFallback = STATUS_ANCHOR_FALLBACK[token.source.anchor];
  if (statusFallback !== undefined) return statusFallback;
  return tokenResolveBug(token.cssVar, token.source.tier,
    `anchor=${token.source.anchor} not resolvable from inputs`);
}

/**
 * The resolver table (wire-audit Pass 0d). One ResolverGroup = one
 * ResolverFn; `resolveTokenValue` dispatches with a single Map lookup
 * after the cross-cutting pre-filter (v3-bridge skip + token.modes
 * HC/RT drop/swap). Replaces the former 15-branch waterfall whose
 * by-cssVar / by-kind / by-tier interception order made the tier-switch
 * dev-throws unreachable and silently mis-routed mis-tagged tokens.
 */
const RESOLVERS: ReadonlyMap<ResolverGroup, ResolverFn> = new Map<ResolverGroup, ResolverFn>([
  ["live-config", () => LIVE_CONFIG_SENTINEL],
  ["browser-fx", resolveBrowserFxGroup],
  ["glass", resolveGlassGroup],
  ["geometry", (t, ctx) =>
    requireMatch(resolveGeometryComputed(t.cssVar, ctx.inputs), t, "geometry")],
  ["effects", (t, ctx) =>
    requireMatch(resolveEffectsComputed(t.cssVar, ctx), t, "effects")],
  ["typography", (t, ctx) =>
    requireMatch(
      resolveTypographyComputed(t.cssVar, ctx.inputs,
        componentChannelOverride(t, ctx.components)),
      t, "typography")],
  ["shell-paper", (t, ctx) =>
    requireMatch(resolveShellPaperComputed(t.cssVar, ctx), t, "shell-paper")],
  ["texture", (t, ctx) =>
    requireMatch(resolveTextureComputed(t.cssVar, ctx), t, "texture")],
  ["knockout", (t, ctx) =>
    requireMatch(resolveKnockoutComputed(t.cssVar, ctx), t, "knockout")],
  ["density", (t, ctx) =>
    tokenDensityPx(t.cssVar, ctx.inputs.density ?? "comfortable", ctx.inputs.density_factor)],
  ["role", (t, ctx) => {
    if (t.source.tier !== "role") {
      return tokenResolveBug(t.cssVar, t.source.tier,
        "resolverGroup=role but source.tier is not role");
    }
    // Component-model re-route (W6): a `components` override on this
    // token's (component, state, channel) redirects which Tier-2 role
    // the token reads — local to the component, cascade-coherent (the
    // role re-resolves under polarity / anchors / HC like any other).
    const reroute = componentRoleOverride(t, ctx.components);
    return ctx.roles[reroute ?? t.source.role];
  }],
  ["anchor", resolveAnchorGroup],
  // Borders cluster (W4 finale): the 11 border tokens derive from ONE
  // place — resolveBorders(border_preset, role border, role
  // border-subtle). Same derivation the SVG export consumes
  // (lib/theme/borders.ts), so DOM and export agree by construction.
  // The dbl() math (double style = 3x thickness floor) is the v3
  // bridge's exactly.
  ["borders", (t, ctx) => {
    const reroute = componentRoleOverride(t, ctx.components);
    if (reroute) return ctx.roles[reroute];
    const b = resolveBorders(ctx.inputs.border_preset,
      ctx.roles["border"], ctx.roles["border-subtle"], resolveBorderWidths(ctx.inputs));
    const dbl = (style: string | undefined, thickness: number, floor = 0): number =>
      style === "double" ? Math.max(3, thickness * 3) : Math.max(thickness, floor);
    switch (t.cssVar) {
      // Widths now come from the geometry slots via resolveBorders (header→
      // regular, group/row→thin) — the old header floor of 2 is the regular
      // slot's default, so it's gone (the slot IS the floor + is tunable).
      case "--tv-row-border-width":    return `${dbl(b.minor.style, b.minor.thickness)}px`;
      case "--tv-header-border-width": return `${dbl(b.major.style, b.major.thickness)}px`;
      case "--tv-group-border-width":  return `${dbl(b.group.style, b.group.thickness)}px`;
      case "--tv-border-major-color":  return b.major.color;
      case "--tv-border-minor-color":  return b.minor.color;
      case "--tv-border-table-color":  return b.table.color;
      case "--tv-border-row-style":
        return (b.layout === "horizontal" || b.layout === "grid")
          ? (b.minor.style === "double" ? "double" : "solid") : "none";
      case "--tv-border-col-style":
        return (b.layout === "vertical" || b.layout === "grid")
          ? (b.minor.style === "double" ? "double" : "solid") : "none";
      case "--tv-border-major-style":  return b.major.style === "double" ? "double" : "solid";
      case "--tv-table-border-width":
        return `${b.table.style === "double" ? Math.max(3, b.table.thickness * 3) : b.table.thickness}px`;
      case "--tv-table-border-style":
        return b.table.thickness > 0 ? (b.table.style === "double" ? "double" : "solid") : "none";
    }
    return tokenResolveBug(t.cssVar, t.source.tier,
      "resolverGroup=borders but cssVar is not a border token");
  }],
  // First-column treatment (W4 port) keyed by inputs.first_column_style.
  // Recipes are the v3 cluster's exactly: bold = {bg neutral[2],
  // fg ink anchor, weight 600, rule neutral[6]}; default = inert
  // (bg transparent / fg+weight inherit — .primary-cell falls through to
  // row styling). The RULE is the exception: a non-bold first column must
  // still show the SAME column divider as every other cell under a
  // grid/boxed layout, so its default is the resolved MINOR divider color,
  // NOT "transparent" (a transparent value defeated the consumer's
  // `var(--tv-first-col-rule, --tv-border-minor-color)` fallback — the
  // col1/col2 divider went silently missing under `boxed`; 2026-06-13).
  // Under hairline the column-border style is `none`, so this color is
  // never painted there — no visual change for horizontal layouts.
  ["first-col", (t, ctx) => {
    const reroute = componentRoleOverride(t, ctx.components);
    if (reroute) return ctx.roles[reroute];
    const bold = ctx.inputs.first_column_style === "bold";
    switch (t.cssVar) {
      case "--tv-first-col-bg":     return bold ? rampStep(ctx.ramps.neutral, 2) : "transparent";
      case "--tv-first-col-fg":     return bold ? pickAnchorHex("ink", ctx.inputs) ?? "inherit" : "inherit";
      case "--tv-first-col-weight": return bold ? "600" : "inherit";
      case "--tv-first-col-rule":   return bold
        ? rampStep(ctx.ramps.neutral, 6)
        : resolveBorders(ctx.inputs.border_preset,
            ctx.roles["border"], ctx.roles["border-subtle"], resolveBorderWidths(ctx.inputs)).minor.color;
    }
    return tokenResolveBug(t.cssVar, t.source.tier,
      "resolverGroup=first-col but cssVar is not a first-col token");
  }],
  // Active header trio (W4 port): picks the SAME role recipes the
  // per-variant tokens use, keyed by inputs.header_style — one source
  // of truth (the v3 bridge trio could disagree with the variant
  // tokens inside a single render). bold.rule ports the v3 mix.
  ["header-active", (t, ctx) => {
    const reroute = componentRoleOverride(t, ctx.components);
    if (reroute) return ctx.roles[reroute];
    const style = ctx.inputs.header_style ?? "light";
    const leaf = t.cssVar === "--tv-header-bg" ? "bg"
      : t.cssVar === "--tv-header-fg" ? "fg"
      : t.cssVar === "--tv-header-rule" ? "rule" : null;
    if (!leaf) {
      return tokenResolveBug(t.cssVar, t.source.tier,
        "resolverGroup=header-active but cssVar is not an active-header token");
    }
    if (leaf === "bg") {
      return style === "bold" ? ctx.roles["brand-solid"]
        : style === "tint" ? ctx.roles["fill"] : ctx.roles["surface"];
    }
    if (leaf === "fg") {
      return style === "bold" ? ctx.roles["text-onsolid"] : ctx.roles["text"];
    }
    return style === "bold"
      ? oklchMix(ctx.roles["text-onsolid"], rampStep(ctx.ramps.brand, 9), 0.4)
      : ctx.roles["border-strong"];
  }],
  // Direct (UNWALKED) ramp reads — W4 recipe ports. The role layer
  // contrast-walks text-subtle/muted; these tokens preserve the v3
  // pixel (e.g. tick labels read neutral grade 10 exactly). Source
  // note grammar: "ramp:<name>[<grade>]".
  ["ramp-direct", (t, ctx) => {
    // Component-model re-route (W6): a col-channel override redirects
    // the unwalked ramp read to a Tier-2 role.
    const reroute = componentRoleOverride(t, ctx.components);
    if (reroute) return ctx.roles[reroute];
    const m = t.source.tier === "computed"
      ? /^ramp:(neutral|brand|accent)\[(\d+)\]/.exec(t.source.note) : null;
    if (!m) {
      return tokenResolveBug(t.cssVar, t.source.tier,
        'resolverGroup=ramp-direct needs source note "ramp:<name>[<grade>]"');
    }
    const ramp = ctx.ramps[m[1] as "neutral" | "brand" | "accent"];
    return ramp[Number(m[2]) - 1] ?? ramp[ramp.length - 1]!;
  }],
  ["const", (t) => {
    if (t.source.tier === "const" && t.source.note?.includes("transparent")) {
      return "transparent";
    }
    return tokenResolveBug(t.cssVar, t.source.tier,
      `resolverGroup=const but note=${t.source.tier === "const" ? t.source.note : "(wrong tier)"}`);
  }],
]);

function resolveTokenValue(
  token: ComponentToken,
  resolved: ResolveCtx,
): string {
  // ── Cross-cutting pre-filter (order preserved from the waterfall) ──────
  // Live-config short-circuit: computeLiveConfigVars realizes these
  // (series slot 0, layout); emitters drop the sentinel so the overlay wins.
  if (isLiveConfigToken(token)) return LIVE_CONFIG_SENTINEL;

  // Layer B — declarative token.modes drop/swap. Runs BEFORE the group
  // dispatch for every token; a `drop`/`swap` replaces the base value.
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

  // ── Group dispatch ──────────────────────────────────────────────────────
  // resolverGroup is required on every manifest entry (Pass 0d-ii); a
  // group with no registered ResolverFn is a manifest bug and dev-throws.
  const fn = RESOLVERS.get(token.resolverGroup);
  if (!fn) {
    return tokenResolveBug(token.cssVar, token.source.tier,
      `resolverGroup=${token.resolverGroup} has no registered resolver`);
  }
  return fn(token, resolved);
}

// The legacy 15-branch waterfall (by-cssVar / by-kind / by-tier
// interception) was deleted in Pass 0d-ii after the dispatch-parity test
// proved the Map dispatch byte-identical across every token × 22 presets
// × 3 modes. Its tier-switch carried a false comment claiming no manifest
// entry used `tier: "input"` (there were 24, all intercepted upstream) —
// the structural bug that motivated this refactor: dev-throws that can
// never fire. Post-0d-ii every group's dev-throw is reachable.

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

/** The four T2 roles every shell/paper recipe consumes, with safe
 *  fallbacks. Extracted: this stanza was copy-pasted across the knockout /
 *  elevation / shell-paper resolvers (spacing-rework quality pass). */
function shellPaperRoles(
  resolved: { roles: Record<RoleName, string> },
): { surface: string; surfaceSubtle: string; border: string; borderSubtle: string } {
  return {
    surface:       resolved.roles.surface           ?? "#FFFFFF",
    surfaceSubtle: resolved.roles["surface-subtle"] ?? "#F0F0F0",
    border:        resolved.roles.border            ?? "#CCCCCC",
    borderSubtle:  resolved.roles["border-subtle"]  ?? "#E0E0E0",
  };
}

/** Stage 2 §4 texture knockout resolver. Premixes the surface bg at 78%
 *  opacity against white so both CSS and SVG paths consume a literal hex
 *  (avoiding the `color-mix()` librsvg compatibility wrinkle).
 *  Shell-side only: the paper-side twin died with the paper-texture
 *  fallthrough (spacing rework — caption/footer text sits on the shell). */
function resolveKnockoutComputed(
  cssVar: string,
  resolved: { roles: Record<RoleName, string>; inputs: ThemeInputs },
): string | null {
  if (cssVar !== "--tv-shell-text-knockout-bg") return null;
  const sp = resolveShellPaper(resolved.inputs, shellPaperRoles(resolved));
  // The pad IS the surface color, full strength: it hides texture lines
  // behind the glyphs while staying tonally invisible itself. The old
  // 78%-premix-on-white produced visible gray boxes behind titles on
  // near-white raised shells AND gray smears on dark themes (both
  // adversarial reviewers, independently). Transparent / glass shells
  // have no hex of their own — use the paper bg (≈ the page surface
  // showing through).
  const bg = sp.shellBg.startsWith("#") ? sp.shellBg : sp.paperBg;
  return bg.startsWith("#") ? bg : resolveTextureKnockoutBg(bg);
}

/** Stage 2 §2 shell/paper resolver. Matches the shell and paper
 *  cssVars and emits the corresponding value from resolveShellPaper().
 *  Returns null when the cssVar doesn't match. */
function resolveShellPaperComputed(
  cssVar: string,
  resolved: { roles: Record<RoleName, string>; inputs: ThemeInputs },
): string | null {
  const key = shellPaperKeyForCssVar(cssVar);
  if (key === null) return null;
  const sp = resolveShellPaper(resolved.inputs, shellPaperRoles(resolved));
  return sp[key];
}

function resolveTypographyComputed(
  cssVar: string,
  inputs: ThemeInputs,
  channelOverride?: string | null,
): string | null {
  // Pattern: --tv-text-{role}-{prop}
  const m = cssVar.match(/^--tv-text-([a-z]+)-([a-z]+)$/);
  if (!m) return null;
  const role = m[1] as TypeRoleName | "header";
  const prop = m[2];
  // "header" is a DERIVED role (W4 arc 2, 2026-06-11): column headers
  // ride the body recipe with the canonical ×1.05 size bump — replaces
  // the v3-bridge calc() emission AND svg-generator's inline mirror of
  // it (the WYSIWYG gate's header.fontSize budget watches this math).
  // Deriving from the BODY recipe keeps headers responsive to
  // type_roles body rebinds.
  if (role === "header") {
    if (!TYPOGRAPHY_PROPS.includes(prop as (typeof TYPOGRAPHY_PROPS)[number])) return null;
    const typoH = resolveTypographyInputs(inputs);
    const body = resolveTypeRole("body", typoH, effectiveTypeRoles(inputs));
    switch (prop) {
      case "family": return body.family;
      case "size":   return `${Math.round(body.size * 1.05 * 100) / 100}px`;
      case "weight": return String(body.weight);
      default:       return null;
    }
  }
  if (!TYPOGRAPHY_ROLE_NAMES.has(role)) return null;
  // `figures` (font-variant-numeric): no authoring surface yet — every
  // role resolves tabular, so emit the constant truthfully (W4: replaces
  // the v3-bridge row that read a blob field nothing could set). The
  // component model's Stage-3 figures channel turns this recipe-driven.
  if (prop === "figures") return "tnum";
  if (!TYPOGRAPHY_PROPS.includes(prop as (typeof TYPOGRAPHY_PROPS)[number])) return null;
  const typo = resolveTypographyInputs(inputs);
  // Tier-2 type-role overlay (Wave 3): inputs.type_roles rebinds any subset
  // of a role's {family,size,weight} recipe. No overrides → DEFAULT_TYPE_ROLES
  // (resolution byte-identical, so the resolver-dispatch snapshot is stable).
  let table = effectiveTypeRoles(inputs);
  // Component-model re-route (W6): a `components` override on this token's
  // channel replaces that ONE slot of the recipe — token-local, so it wins
  // over the role-level type_roles rebind (verb hierarchy: re-route is the
  // more specific edit).
  if (channelOverride) {
    table = { ...table, [role]: { ...table[role], [prop]: channelOverride } };
  }
  const r = resolveTypeRole(role, typo, table);
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
 *  presets pin smaller values per-key. EXPORTED so the settings panel's
 *  geometry sliders show the SAME default for an unset theme that the
 *  resolver applies (was 6 inline literals duplicating these — drift). */
export const DEFAULT_RADIUS: Required<NonNullable<NonNullable<ThemeInputs["geometry"]>["radius"]>> = {
  sm: 2, md: 6, lg: 10, pill: 999,
};

/** Default border-width scale (px). Newspaper-hairline baseline. Exported
 *  for the panel sliders (see DEFAULT_RADIUS). */
export const DEFAULT_BORDER_WIDTH: Required<NonNullable<NonNullable<ThemeInputs["geometry"]>["border_width"]>> = {
  // regular = the header-rule width (the prior hard floor was 2px; matching it
  // here keeps headers unchanged now that resolveBorders sources widths from
  // these slots — see borders.ts).
  hair: 0.5, thin: 1, regular: 2, thick: 2.5,
};

/** Merge a theme's geometry border-width pins over the defaults → the resolved
 *  slot widths resolveBorders consumes. */
export function resolveBorderWidths(inputs: ThemeInputs | undefined): BorderWidths {
  const g = inputs?.geometry?.border_width;
  return {
    hair:    g?.hair    ?? DEFAULT_BORDER_WIDTH.hair,
    thin:    g?.thin    ?? DEFAULT_BORDER_WIDTH.thin,
    regular: g?.regular ?? DEFAULT_BORDER_WIDTH.regular,
    thick:   g?.thick   ?? DEFAULT_BORDER_WIDTH.thick,
  };
}

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
    // "none", NOT "transparent": this token is consumed inside
    // background-image LISTS (the texture rules append it as their last
    // layer), and transparent is not a valid <image> — one invalid layer
    // voids the entire declaration, which silently killed ruled/grid/
    // dotted textures on every non-gradient preset (both round-2 visual
    // reviewers, independently; the screenshot harness caught it as 2
    // structural failures).
    if (intensity === "none") return "none";
    const angle = fx?.gradient_shell_angle ?? 90;
    // Both stops stay CHROMATIC. The old subtle recipe ended on accent
    // grade 3 — a neutralized fill step — so the "brand→accent" gradient
    // visibly died into gray (adversarial effects review M5). Subtle is
    // now the solid hues whispered toward the surface (a tint, never a
    // desaturation); vivid is the solids themselves.
    // Surface stand-in: neutral grade 1 (the paper end) — this resolver
    // group receives ramps+inputs, not roles.
    const surface = resolved.ramps.neutral[0] ?? "#FFFFFF";
    const brandSolid  = resolved.ramps.brand[8]  ?? "#000000";
    const accentSolid = resolved.ramps.accent[8] ?? "#FFFFFF";
    const from = intensity === "vivid" ? brandSolid  : oklchMix(surface, brandSolid, 0.30);
    const to   = intensity === "vivid" ? accentSolid : oklchMix(surface, accentSolid, 0.30);
    return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
  }

  // ── Emphasis shadow ───────────────────────────────────────────────────
  if (cssVar === "--tv-shadow-emphasis") {
    const elev = fx?.elevation ?? "none";
    // Composable no-op, NOT "none": this token participates in
    // multi-shadow lists ("none, 0 0 ..." is invalid CSS and silently
    // drops the whole declaration — the latent bug that kept row-glow
    // dead on non-elevation themes; wire-audit 1c).
    if (elev === "none") return "0 0 0 transparent";
    // Stack a near + far shadow per Stage 2 §6 convention. Near uses the
    // brand-peak hue at low alpha to keep colour identity in the elevation.
    const peak = resolved.ramps.brand[9] ?? "#1c1a17";
    const near = hexToRgba(peak, 0.15);
    const far  = hexToRgba(peak, 0.08);
    const k = elev === "high" ? 1.6 : elev === "medium" ? 1.2 : 0.8;
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
  if (base === undefined) {
    // A density-group token missing from the density table is a manifest/
    // table mismatch. Pre-0d this silently emitted "0px" (collapsed
    // spacing with no error anywhere); now it dev-throws. Prod keeps the
    // historical "0px" so a single bad token can't take down a render.
    if (isDev()) {
      throw new Error(
        `tokenDensityPx: ${cssVar} is resolverGroup="density" but has no ` +
        `entry in density-presets.ts (density=${density}). Add the px ` +
        `value to DENSITY_PX or move the token to the correct group.`,
      );
    }
    // eslint-disable-next-line no-console
    console.error(`tokenDensityPx: no density entry for ${cssVar}; emitting 0px`);
    return "0px";
  }
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
    // accent-anchor mirrors the accent-RAMP seed so anchor-sourced tokens
    // (e.g. --tv-ink2 rubrication) agree with ramp-sourced ones. Defaults
    // to accent (the former ink2 anchor was merged into accent).
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
/** Steps 1-4 of the cascade (validate → polarity → ramps → alphas →
 *  roles). Shared by resolveTheme and the dispatch-parity test. */
function runCascade(wire: ThemeWire) {
  // Inputs validation runs first so authoring mistakes (out-of-range
  // anchor triples, typo'd enum values, unknown effects intensity, ...)
  // surface as a structured error before the resolver wastes work or
  // silently produces a broken cssVars map. Mirrors R's S7 validator.
  validateThemeInputs(wire.inputs);
  const polarity = derivePolarity(wire.inputs);
  let reflected = applyPolarityToInputs(wire.inputs);

  // C9 (wire-audit 1b): under OS/user-forced high-contrast, theme-scoped
  // status palettes (D6) revert to the curated HC-safe fallback —
  // a preset's vermilion/neon semantics must not undermine contrast
  // guarantees. Stripping inputs.status here covers BOTH consumers in
  // one place: the status ramps (buildRamps) and the --tv-status-*
  // anchor tokens (pickAnchorHex falls through to the fallback).
  if (wire.inputs.mode === "high-contrast" && reflected.status) {
    reflected = { ...reflected, status: undefined };
  }

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

  // Minimum-contrast guarantee for the secondary text roles. A fixed
  // grade binding cannot guarantee legibility across arbitrary neutral
  // ramps (elvish's pale low-chroma neutrals, terminal's monochrome
  // phosphor ramp both failed AA at the bound grade — adversarial color
  // review H3). Walk the role toward the ink end until it clears WCAG AA
  // normal-text on the surface; `text` itself (grade 11, the ink end) is
  // the ceiling — if THAT fails it's an anchor problem the validator
  // reports separately. Pins via role-binding overrides are respected as
  // the STARTING grade, never weakened.
  const MIN_TEXT_CONTRAST = 4.5;
  // Walk subtle FIRST, then muted with a floor one grade above subtle's
  // landing spot: without the floor, low-chroma ramps walked subtle up
  // onto muted's exact grade and the de-emphasis hierarchy silently
  // flattened (elvish/terminal rendered subtle == muted byte-identical —
  // R2 color review #3). roleSource gets the walked grade WRITTEN BACK
  // so the Alt+click inspector's provenance matches the painted value
  // (R2 code-quality #1).
  const walkTextRole = (role: RoleName, minGrade: number): number => {
    const binding = roleSource[role];
    if (!binding || binding.ramp !== "neutral") return 0;
    let grade = Math.max(binding.grade, minGrade);
    if (grade !== binding.grade) {
      roles[role] = resolveRoleValue(
        role, { ...binding, grade }, ramps12, alphaRamps, offRamp, wire.inputs.mode,
      );
    }
    while (
      grade < 11 &&
      contrastRatio(roles[role], roles.surface) < MIN_TEXT_CONTRAST
    ) {
      grade += 1;
      roles[role] = resolveRoleValue(
        role, { ...binding, grade }, ramps12, alphaRamps, offRamp, wire.inputs.mode,
      );
    }
    if (grade !== binding.grade) roleSource[role] = { ...binding, grade };
    return grade;
  };
  const subtleGrade = walkTextRole("text-subtle" as RoleName, 0);
  walkTextRole("text-muted" as RoleName, subtleGrade + 1);

  return { polarity, reflected, ramps12, alphaRamps, roles, roleSource };
}

export function resolveTheme(wire: ThemeWire): ResolvedTheme {
  const { polarity, reflected, ramps12, alphaRamps, roles, roleSource } =
    runCascade(wire);

  // Emit the CSS-var map by walking the manifest.
  const cssVars = {} as Record<string, string>;
  for (const token of COMPONENT_TOKENS) {
    cssVars[token.cssVar] = resolveTokenValue(token, {
      roles,
      ramps: ramps12,
      inputs: reflected,
      components: wire.components,
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
