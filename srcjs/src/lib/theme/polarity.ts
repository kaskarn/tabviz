/**
 * Polarity flip via anchor L-reflection (v4 substrate).
 *
 * A light theme and its dark counterpart are related by an **involutive
 * lightness reflection** on every anchor:
 *
 *     L → 1.1 − L   (clamped to [0.04, 0.99])
 *
 * Reflecting again recovers the original. Chroma and hue stay constant —
 * only L flips. The cascade then re-resolves from reflected anchors and
 * every downstream computation (ramps, roles, component tokens, modes)
 * re-derives correctly because everything keys off `paper.L < 0.5` to
 * decide direction.
 *
 * Per Decisions log Q-P4.1 closed 2026-06-02: this is an explicit first
 * step of the resolver pipeline. The Cascade Inspector treats the
 * polarity-applied inputs as a distinct stage so users can trace "this
 * dark value is the L-reflected version of the light anchor".
 *
 * Per Stage 1 §22:
 *   - Mathematically involutive (reflect(reflect(L)) === L within clamp).
 *   - Pure function: no mutation; inputs in, new inputs out.
 *   - Per-preset escape hatch via `anchor_overrides_dark` (applied AFTER
 *     reflection) for presets that don't reflect cleanly. Wiring up that
 *     escape hatch is part of the resolver rewrite (step 4 main commit);
 *     this module ships the math only.
 *
 * See `docs/dev/theme-cascade-stage-1-design.md` §22.
 */

import { hexToOklch, oklchToHex } from "../oklch";

/** Reflection pivot. Chosen so that mid-range anchors (L ≈ 0.55) reflect to
 *  themselves, and the extremes land in the opposite envelope. */
const POLARITY_PIVOT = 0.55;

/** Clamp range for reflected L. Keeps reflected anchors inside the
 *  valid OKLCH range. */
const L_MIN = 0.04;
const L_MAX = 0.99;

/** Reflect a single L value around the pivot, with clamp. */
export function reflectL(L: number): number {
  const reflected = 2 * POLARITY_PIVOT - L;
  return Math.min(L_MAX, Math.max(L_MIN, reflected));
}

/** Reflect a hex color: keep chroma + hue; flip lightness. */
export function reflectHex(hex: string): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ L: reflectL(lch.L), C: lch.C, H: lch.H });
}

/** Polarity of a theme — derived from the paper anchor's lightness.
 *  `"light"` when paper.L >= 0.5; `"dark"` otherwise. */
export type Polarity = "light" | "dark";

/** Resolve a hex color's polarity based on its lightness. */
export function polarityOf(hex: string): Polarity {
  const lch = hexToOklch(hex);
  return lch.L >= 0.5 ? "light" : "dark";
}

/** Reflect a record of anchor hex values. Each value is treated as an
 *  independent anchor; reflection is applied per-anchor.
 *
 *  Used during the resolver pipeline's polarity-application step.
 *  Returns a NEW object; does not mutate the input. */
export function reflectAnchors<T extends Record<string, string | null | undefined>>(
  anchors: T,
): T {
  const out = {} as Record<string, string | null | undefined>;
  for (const [k, v] of Object.entries(anchors)) {
    if (v == null) {
      out[k] = v;
    } else {
      out[k] = reflectHex(v);
    }
  }
  return out as T;
}
