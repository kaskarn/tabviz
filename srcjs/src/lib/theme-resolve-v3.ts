// Theme V3 resolver — rationalized theme surface.
//
// Lives alongside the legacy V2 resolver (theme-resolve.ts) during PRs A–I.
// PR I deletes V2 and renames this to theme-resolve.ts. See
// `~/.claude/plans/theme-rationalization.md`.
//
// PR A scope (this file):
//   - buildRamps(inputs) → TokenRampsV3 (T0 layer)
//   - resolveToken(name, ramps, mode) → hex string (T2 layer — demo subset)
//   - APCA-aware on-X pair derivation (brand_ink, accent_ink, *_ink)
//
// PR B will expand the T2 token map to the full vocabulary, add the ref()
// resolver path (tagged object → hex), and ship cluster + role types.

import { oklchRamp, rampStep, pickInkOnBg, hexToOklch, oklchToHex } from "./oklch";
import type {
  ThemeInputsV3,
  TokenRampsV3,
  TokenNameV3,
  ThemeMode,
} from "../types/theme-v3";

// ────────────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────────────

const DEFAULT_STATUS = {
  positive: "#3F7D3F",
  negative: "#B33A3A",
  warning: "#C68A2E",
  info: "#1F77B4",
} as const;

const NEUTRAL_SEED = "#888888"; // achromatic seed; tinting drives hue if any

// ────────────────────────────────────────────────────────────────────
// T0 — Ramp builder
// ────────────────────────────────────────────────────────────────────

/** Resolve a neutral tint setting against the inputs into a concrete hex (or null). */
function resolveNeutralTintHex(
  inputs: ThemeInputsV3,
  accent: string,
  decorative: string | null,
): string | null {
  const tint = inputs.neutral_tint ?? "untinted";
  if (tint === "untinted") return null;
  if (tint === "brand") return inputs.brand;
  if (tint === "accent") return accent;
  if (tint === "decorative") return decorative ?? inputs.brand;
  if (typeof tint === "object" && "hex" in tint) return tint.hex;
  return null;
}

/** Build a 5-step status palette (just lightness variations for now; PR E refines). */
function buildStatusRamp(seed: string, mode: ThemeMode): string[] {
  // 5 steps. In light mode: light→dark; in dark mode: dark→light.
  // Steps: subtle bg, subtle border, solid, solid hover, ink.
  const seedLch = hexToOklch(seed);
  const Ls = mode === "light"
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

/** Build T0 ramps from T1 inputs. */
export function buildRamps(inputs: ThemeInputsV3): TokenRampsV3 {
  const mode: ThemeMode = inputs.mode ?? "light";
  const accent = inputs.accent ?? inputs.brand;
  const decorative = inputs.decorative ?? null;

  const tintHex = resolveNeutralTintHex(inputs, accent, decorative);
  const tintAmount = tintHex !== null ? 0.04 : 0;

  const neutral = oklchRamp(NEUTRAL_SEED, {
    mode,
    chromaPeak: 0, // achromatic seed
    tintHex: tintHex ?? undefined,
    tintAmount,
  });

  const brand = oklchRamp(inputs.brand, { mode });
  const accentRamp = oklchRamp(accent, { mode });
  const decorativeRamp = decorative !== null
    ? oklchRamp(decorative, { mode })
    : null;

  const statusSeeds = {
    positive: inputs.status?.positive ?? DEFAULT_STATUS.positive,
    negative: inputs.status?.negative ?? DEFAULT_STATUS.negative,
    warning: inputs.status?.warning ?? DEFAULT_STATUS.warning,
    info: inputs.status?.info ?? DEFAULT_STATUS.info,
  };

  return {
    neutral,
    brand,
    accent: accentRamp,
    decorative: decorativeRamp,
    status: {
      positive: buildStatusRamp(statusSeeds.positive, mode),
      negative: buildStatusRamp(statusSeeds.negative, mode),
      warning: buildStatusRamp(statusSeeds.warning, mode),
      info: buildStatusRamp(statusSeeds.info, mode),
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
  name: TokenNameV3,
  ramps: TokenRampsV3,
): string {
  switch (name) {
    // Surfaces — map to neutral ramp steps
    case "paper_raised":   return rampStep(ramps.neutral, 1);
    case "paper":          return rampStep(ramps.neutral, 2);
    case "paper_alt":      return rampStep(ramps.neutral, 3);
    case "paper_sunken":   return rampStep(ramps.neutral, 4);

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

    // Decorative — falls back to brand subtle when not set
    case "decorative_subtle":
      return ramps.decorative !== null
        ? rampStep(ramps.decorative, 2)
        : rampStep(ramps.brand, 2);
    case "decorative_chrome":
      return ramps.decorative !== null
        ? rampStep(ramps.decorative, 6)
        : rampStep(ramps.brand, 6);

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
  ramps: TokenRampsV3,
): Record<TokenNameV3, string> {
  const names: TokenNameV3[] = [
    "paper", "paper_alt", "paper_raised", "paper_sunken",
    "ink", "ink_muted", "ink_subtle", "ink_disabled",
    "brand", "brand_hover", "brand_active", "brand_subtle", "brand_ink", "brand_ink_muted",
    "accent", "accent_subtle", "accent_ink", "accent_ink_muted",
    "decorative_subtle", "decorative_chrome",
    "rule_subtle", "rule_strong",
    "positive", "positive_ink",
    "negative", "negative_ink",
    "warning", "warning_ink",
    "info", "info_ink",
  ];
  const out = {} as Record<TokenNameV3, string>;
  for (const n of names) out[n] = resolveToken(n, ramps);
  return out;
}
