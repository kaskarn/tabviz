// Theme resolver — builds tokens/roles/clusters from V4 anchors.
//
// V4 anchor cascade:
//   inputs.anchors.{ paper, ink, brand, accent? } → TokenRamps:
//     neutral: OKLCH interpolation from paper → ink
//     brand:   oklchRamp seeded from brand anchor
//     accent:  oklchRamp seeded from accent (or brand) anchor
//     status:  5-step ramp per status anchor
//
//   resolveToken(name, ramps, mode) → hex (T2 layer — demo subset)
//   APCA-aware on-X pair derivation (brand_ink, accent_ink, *_ink)

import {
  oklchRamp, oklchInterpolateRamp, rampStep, pickInkOnBg,
  hexToOklch, oklchToHex,
} from "../oklch";
import { curveFn } from "./curves";
import { applyPolarityToInputs } from "./resolve-theme";
import type {
  ThemeInputs,
  OklchTriple,
  TokenRamps,
  TokenName,
  ColorRef,
  ThemeStructure,
  ThemeRoles,
  ClustersInputs,
} from "../../types/theme-inputs";
import { ref } from "../../types/theme-inputs";

// ────────────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────────────

/** Default status anchors as OKLCH triples (curated semantic colors). */
const DEFAULT_STATUS_ANCHORS: Record<
  "positive" | "negative" | "warning" | "info",
  OklchTriple
> = {
  positive: { L: 0.50, C: 0.13, H: 145 },  // ≈ #3F7D3F
  negative: { L: 0.50, C: 0.17, H: 25 },   // ≈ #B33A3A
  warning:  { L: 0.65, C: 0.13, H: 65 },   // ≈ #C68A2E
  info:     { L: 0.50, C: 0.13, H: 240 },  // ≈ #1F77B4
};

/** Resolve a possibly-undefined status anchor to a concrete triple. */
function statusAnchor(
  inputs: ThemeInputs,
  key: "positive" | "negative" | "warning" | "info",
): OklchTriple {
  return inputs.status?.[key] ?? DEFAULT_STATUS_ANCHORS[key];
}

// ────────────────────────────────────────────────────────────────────
// T0 — Ramp builder
// ────────────────────────────────────────────────────────────────────

/** Build a 5-step status palette (just lightness variations for now; PR E refines).
 *  Takes polarity (the L direction) rather than the v3 mode. */
function buildStatusRamp(seed: string, polarity: "light" | "dark"): string[] {
  // 5 steps. In light polarity: light→dark; in dark polarity: dark→light.
  // Steps: subtle bg, subtle border, solid, solid hover, ink.
  const seedLch = hexToOklch(seed);
  const Ls = polarity === "light"
    ? [0.95, 0.86, seedLch.L, Math.max(0.18, seedLch.L - 0.08), 0.30]
    : [0.30, 0.40, seedLch.L, Math.min(0.85, seedLch.L + 0.08), 0.90];
  const ramp: string[] = [];
  for (let i = 0; i < 5; i++) {
    const C = i === 2 || i === 3 ? seedLch.C : seedLch.C * (i < 2 ? 0.3 : 0.5);
    ramp.push(
      // Lazy import-cycle workaround: build via oklchRamp's single-step utility
      // by generating a tiny synthetic ramp. Simpler: use rampLch direct construction.
      // For now, use a 1-step approximation via oklchRamp scaled to our L.
      stepFromLCH(Ls[i]!, C, seedLch.H),
    );
  }
  return ramp;
}

/** Direct OKLCH → hex (with gamut bisection via the shared oklch.ts impl). */
function stepFromLCH(L: number, C: number, H: number): string {
  return oklchToHex({ L, C, H });
}

/** Build T0 ramps from V4 anchors.
 *
 *  L direction (light vs dark) is driven by `inputs.polarity`. The
 *  resolver pipeline applies polarity reflection (anchor L flip) BEFORE
 *  calling buildRamps, so by the time we arrive here paper.L > ink.L in
 *  light mode and paper.L < ink.L in dark mode. The neutral ramp
 *  interpolates paper → ink directly; chromatic ramps still use
 *  oklchRamp's hand-tuned L progression seeded at the anchor's hex.
 *
 *  Per-ramp curves come from `inputs.curves` (Q-P4.3 closure). When set,
 *  the L progression for that ramp is curve-derived; when unset, falls
 *  back to the hand-tuned LIGHT_RAMP_L (chromatic) or linear (neutral).
 *
 *  `inputs.mode` is the accessibility axis (standard/HC/RT), polarity-
 *  orthogonal. */
export function buildRamps(inputs: ThemeInputs): TokenRamps {
  const polarity: "light" | "dark" = inputs.polarity ?? "light";

  // Tier 1 anchors as OKLCH triples + their hex projections for the
  // chromatic ramp builder (which expects a hex seed).
  const paper = inputs.anchors.paper;
  const ink = inputs.anchors.ink;
  const brand = inputs.anchors.brand;
  const accent = inputs.anchors.accent ?? brand;
  const brandHex = oklchToHex(brand);
  const accentHex = oklchToHex(accent);

  // Per-ramp curves; undefined = use hand-tuned LIGHT_RAMP_L (chromatic)
  // or linear (neutral).
  const cN = inputs.curves?.neutral ? curveFn(inputs.curves.neutral) : undefined;
  const cB = inputs.curves?.brand ? curveFn(inputs.curves.brand) : undefined;
  const cA = inputs.curves?.accent ? curveFn(inputs.curves.accent) : undefined;

  // Neutral ramp: OKLCH interpolation paper → ink. Every step lies on
  // the line between the two neutral anchors.
  const neutral = oklchInterpolateRamp(paper, ink, { curve: cN });

  // Chromatic ramps still ride the hand-tuned chromatic L progression
  // (LIGHT_RAMP_L / DARK_RAMP_L) so the chroma peak lands at step 9.
  // A future revision (Phase D) can rebase these on paper.L → ink.L too.
  const brandRamp = oklchRamp(brandHex, { mode: polarity, curve: cB });
  const accentRamp = oklchRamp(accentHex, { mode: polarity, curve: cA });

  return {
    neutral,
    brand: brandRamp,
    accent: accentRamp,
    status: {
      positive: buildStatusRamp(oklchToHex(statusAnchor(inputs, "positive")), polarity),
      negative: buildStatusRamp(oklchToHex(statusAnchor(inputs, "negative")), polarity),
      warning:  buildStatusRamp(oklchToHex(statusAnchor(inputs, "warning")),  polarity),
      info:     buildStatusRamp(oklchToHex(statusAnchor(inputs, "info")),     polarity),
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// T2 — Token resolution (demo subset; PR B expands to full vocabulary)
// ────────────────────────────────────────────────────────────────────

/** APCA target Lc for body text on a colored bg. */
const APCA_BODY_FLOOR = 75;
/** APCA target Lc for large/header text on a colored bg. */
const APCA_LARGE_FLOOR = 60;

/**
 * Resolve a T2 token name to a concrete hex against the given ramps.
 *
 * PR A subset (proves the model end-to-end). PR B expands to the full
 * T2 vocabulary including on-X pairs for all status tokens.
 */
export function resolveToken(
  name: TokenName,
  ramps: TokenRamps,
): string {
  switch (name) {
    // Surfaces — map to neutral ramp steps. paper sits on step 1 (the
    // lightest in light mode / darkest in dark mode) because most themes
    // want the body bg to be the brightest possible page surface. The
    // older `paper_raised` concept folded into paper — both resolve to
    // step 1. Themes that want a more "off-white" paper override the
    // step assignment via T2 pinning.
    case "paper_raised":   return rampStep(ramps.neutral, 1);
    case "paper":          return rampStep(ramps.neutral, 1);
    case "paper_alt":      return rampStep(ramps.neutral, 2);
    case "paper_sunken":   return rampStep(ramps.neutral, 3);

    // Ink — high end of the neutral ramp
    case "ink":            return rampStep(ramps.neutral, 12);
    case "ink_muted":      return rampStep(ramps.neutral, 11);
    case "ink_subtle":     return rampStep(ramps.neutral, 10);
    case "ink_disabled":   return rampStep(ramps.neutral, 8);

    // Brand
    case "brand":          return rampStep(ramps.brand, 9);
    case "brand_hover":    return rampStep(ramps.brand, 10);
    case "brand_active":   return rampStep(ramps.brand, 11);
    case "brand_subtle":   return rampStep(ramps.brand, 2);
    case "brand_ink": {
      // APCA pick: from {neutral step 1 (lightest), neutral step 12 (darkest)}
      // choose the one with best contrast on brand.
      const bg = rampStep(ramps.brand, 9);
      return pickInkOnBg(
        bg,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );
    }
    case "brand_ink_muted": {
      const bg = rampStep(ramps.brand, 9);
      // Use step 2 / 11 (slightly muted versions of brand_ink)
      return pickInkOnBg(
        bg,
        [rampStep(ramps.neutral, 2), rampStep(ramps.neutral, 11)],
        APCA_LARGE_FLOOR,
      );
    }

    // Accent
    case "accent":         return rampStep(ramps.accent, 9);
    case "accent_subtle":  return rampStep(ramps.accent, 2);
    case "accent_ink": {
      const bg = rampStep(ramps.accent, 9);
      return pickInkOnBg(
        bg,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );
    }
    case "accent_ink_muted": {
      const bg = rampStep(ramps.accent, 9);
      return pickInkOnBg(
        bg,
        [rampStep(ramps.neutral, 2), rampStep(ramps.neutral, 11)],
        APCA_LARGE_FLOOR,
      );
    }

    // Lines
    case "rule_subtle":    return rampStep(ramps.neutral, 6);
    case "rule_strong":    return rampStep(ramps.neutral, 7);

    // Status — solid is step 2 (the seed-derived solid bg, used as fg on paper
    // in Tufte-minimal default). on-X pair via APCA: when a theme uses status
    // as a bg, the ink is picked from neutral ramp endpoints (same logic as
    // brand_ink) so contrast holds across mode and palette choice.
    case "positive":       return ramps.status.positive[2]!;
    case "negative":       return ramps.status.negative[2]!;
    case "warning":        return ramps.status.warning[2]!;
    case "info":           return ramps.status.info[2]!;
    case "positive_ink":
      return pickInkOnBg(
        ramps.status.positive[2]!,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );
    case "negative_ink":
      return pickInkOnBg(
        ramps.status.negative[2]!,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );
    case "warning_ink":
      return pickInkOnBg(
        ramps.status.warning[2]!,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );
    case "info_ink":
      return pickInkOnBg(
        ramps.status.info[2]!,
        [rampStep(ramps.neutral, 1), rampStep(ramps.neutral, 12)],
        APCA_LARGE_FLOOR,
      );

    default: {
      // Exhaustiveness check
      const _exhaustive: never = name;
      void _exhaustive;
      throw new Error(`resolveToken: unknown token ${String(name)}`);
    }
  }
}

/** Convenience: resolve all T2 tokens at once. Useful for CSS variable emission. */
export function resolveAllTokens(
  ramps: TokenRamps,
): Record<TokenName, string> {
  const names: TokenName[] = [
    "paper", "paper_alt", "paper_raised", "paper_sunken",
    "ink", "ink_muted", "ink_subtle", "ink_disabled",
    "brand", "brand_hover", "brand_active", "brand_subtle", "brand_ink", "brand_ink_muted",
    "accent", "accent_subtle", "accent_ink", "accent_ink_muted",
    "rule_subtle", "rule_strong",
    "positive", "positive_ink",
    "negative", "negative_ink",
    "warning", "warning_ink",
    "info", "info_ink",
  ];
  const out = {} as Record<TokenName, string>;
  for (const n of names) out[n] = resolveToken(n, ramps);
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Ref resolver — string / tagged-object / hex literal → hex
// ────────────────────────────────────────────────────────────────────

const HEX_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/** Match `ramp.NN` form: brand.9, neutral.3, accent.2. */
const RAMP_STEP_RE = /^(neutral|brand|accent)\.(\d+)$/;

function isHex(s: string): boolean {
  return HEX_PATTERN.test(s);
}

function resolveRampStepRef(refStr: string, ramps: TokenRamps): string | null {
  const m = RAMP_STEP_RE.exec(refStr);
  if (!m) return null;
  const ramp = m[1] as "neutral" | "brand" | "accent";
  const step = parseInt(m[2]!, 10);
  const r = ramp === "neutral" ? ramps.neutral
          : ramp === "brand"   ? ramps.brand
          : ramps.accent;
  return rampStep(r, step);
}

/**
 * Resolve a ColorRef (or plain string, or null) to a hex string.
 *
 * Accepted forms:
 *   - `null` / `undefined` — returns `null` (let consumer pick fallback)
 *   - hex string `"#aabbcc"` — returned as-is
 *   - token name string `"ink_muted"` — resolved via resolveToken
 *   - ramp-step ref string `"brand.9"`, `"neutral.3"` — resolved via rampStep
 *   - tagged `{ ref: "ink_muted" }` — resolved
 *   - tagged `{ hex: "#aabbcc" }` — hex
 *   - either tagged form with optional `alpha` — TBD per PR (CSS rgba/hex8 wrap)
 */
export function resolveRef(
  refOrHex: ColorRef | string | null | undefined,
  ramps: TokenRamps,
): string | null {
  if (refOrHex == null) return null;
  if (typeof refOrHex === "string") {
    if (isHex(refOrHex)) return refOrHex;
    const rampStepHex = resolveRampStepRef(refOrHex, ramps);
    if (rampStepHex !== null) return rampStepHex;
    // Assume it's a T2 token name
    return resolveToken(refOrHex as TokenName, ramps);
  }
  if ("hex" in refOrHex) {
    return applyAlpha(refOrHex.hex, refOrHex.alpha);
  }
  // tagged object with ref
  const refStr = refOrHex.ref;
  const rampStepHex = resolveRampStepRef(refStr, ramps);
  const baseHex = rampStepHex !== null
    ? rampStepHex
    : resolveToken(refStr as TokenName, ramps);
  return applyAlpha(baseHex, refOrHex.alpha);
}

/** Wrap an alpha into hex8 form (e.g. "#aabbccCC" for alpha 0.8). */
function applyAlpha(hex: string, alpha: number | undefined): string {
  if (alpha === undefined || alpha === 1) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase();
  // Strip existing alpha if 8-digit; keep just RGB
  const rgb = hex.length === 9 ? hex.slice(0, 7) : hex;
  return rgb + alphaHex;
}

// ────────────────────────────────────────────────────────────────────
// Default cluster + role bindings
// ────────────────────────────────────────────────────────────────────

/** Default role recipes per locked design. Themes override. */
export function defaultRoles(): ThemeRoles {
  return {
    emphasis: {
      fg: ref("ink"),
      markerFill: ref("ink"),
      fontWeight: 600,
    },
    muted: {
      fg: ref("ink_subtle"),
      markerFill: ref("ink_muted"),
      markerStroke: ref("ink_subtle"),
    },
    accent: {
      fg: ref("accent"),
      markerFill: ref("accent"),
      markerStroke: ref("accent"),
      fontWeight: 600,
    },
    bold: {
      fontWeight: 600,
    },
    fill: {
      bg: ref("accent_subtle"),
      fontWeight: 600,
    },
    positive: {
      fg: ref("positive"),
      markerFill: ref("positive"),
    },
    negative: {
      fg: ref("negative"),
      markerFill: ref("negative"),
    },
    warning: {
      fg: ref("warning"),
      markerFill: ref("warning"),
    },
    info: {
      fg: ref("info"),
      markerFill: ref("info"),
    },
  };
}

/** Default cluster bindings. Themes override. */
export function defaultClusters(): ClustersInputs {
  return {
    header: {
      light: { bg: ref("paper"),         fg: ref("ink"),       rule: ref("rule_strong") },
      tint:  { bg: ref("brand_subtle"),  fg: ref("ink"),       rule: ref("rule_strong") },
      bold:  { bg: ref("brand"),         fg: ref("brand_ink"), rule: ref("brand_active") },
    },
    columnGroup: {
      light: { bg: ref("paper"),               fg: ref("ink"),            rule: ref("rule_strong") },
      tint:  { bg: ref("brand_subtle"),  fg: ref("ink"),       rule: ref("rule_strong") },
      bold:  { bg: ref("brand"),         fg: ref("brand_ink"), rule: ref("rule_strong") },
    },
    rowGroup: {
      L1: { bg: ref("brand_subtle"),  fg: ref("ink"),       rule: ref("rule_strong"), fontWeight: 600 },
      L2: { bg: ref("paper_alt"),     fg: ref("ink_muted"), rule: ref("rule_subtle"), fontWeight: 500 },
      L3: { bg: null,                 fg: ref("ink_subtle"),rule: null,               fontWeight: 400 },
    },
    row: {
      base:     { bg: ref("paper"),         fg: ref("ink") },
      alt:      { bg: ref("paper_alt"),     fg: ref("ink") },
      hover:    { bg: ref("accent_subtle"), fg: ref("ink") },
      selected: { bg: ref("accent_subtle"), fg: ref("ink") },
      banding: "group",
      selectedEdgeWidth: 2,
      borderWidth: 1,
    },
    cell: {
      bg: ref("paper"),
      fg: ref("ink"),
      border: ref("rule_subtle"),
    },
    firstColumn: {
      default: { bg: null,                fg: null,        rule: null,                weight: null },
      bold:    { bg: ref("paper_alt"),    fg: ref("ink"),  rule: ref("rule_subtle"),  weight: 600 },
    },
    plot: {
      bg: null,
      axisLine:  ref("rule_strong"),
      tickMark:  ref("rule_strong"),
      gridline:  ref("rule_subtle"),
      reference: ref("rule_strong"),
      tickMarkLength: 4,
      lineWidth: 1.5,
      pointSize: 6,
    },
    marks: {
      forest:   { body: "fill", outline: "stroke", line: "stroke" },
      summary:  { body: "fill", outline: "stroke", line: "stroke" },
      bar:      { body: "fill", outline: "stroke", line: "stroke" },
      box:      { body: "fill", outline: "stroke", line: "stroke" },
      violin:   { body: "fill", outline: "stroke", line: "stroke" },
      lollipop: { body: "fill", outline: "stroke", line: "stroke" },
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Full theme builder
// ────────────────────────────────────────────────────────────────────

/**
 * Build a fully-resolved ThemeStructure from inputs.
 *
 * Resolved theme carries the T0 ramps + T2 token map (hex) + role
 * recipes (refs not yet dereferenced — rendering picks per role) +
 * cluster bindings (refs not yet dereferenced — CSS emission picks).
 *
 * @param inputs T1 inputs (`ThemeInputs`)
 * @param name   Optional theme name (default `"custom"`)
 */
export function buildThemeStructure(
  inputs: ThemeInputs,
  name = "custom",
): ThemeStructure {
  // Apply polarity reflection (Stage 1 §22) up front so every consumer
  // of buildThemeStructure — buildTheme adapter, resolveWire, direct
  // callers — sees the reflected anchors before ramp generation.
  const reflected = applyPolarityToInputs(inputs);
  const ramps = buildRamps(reflected);
  const tokens = resolveAllTokens(ramps);
  return {
    schemaVersion: 4,
    name,
    inputs: reflected,
    ramps,
    tokens,
    roles: defaultRoles(),
    clusters: defaultClusters(),
  };
}
