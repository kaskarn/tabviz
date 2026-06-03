/**
 * Ramp-shape curves (v4 substrate).
 *
 * Each curve remaps `t ∈ [0, 1]` to `[0, 1]`; applied during ramp
 * construction to reshape how the 11 grades distribute their lightness
 * progression. Curve choice meaningfully changes the *feel* of a theme:
 *
 *   - `linear` — uniform grade spacing.
 *   - `ease`   — smooth S-curve; standard well-distributed perceptual spacing.
 *   - `smooth` — smoothstep; soft acceleration around the midpoint.
 *   - `log`    — concave, packs the dark end → more light grades available
 *                → airier, more open feel. Editorial themes lean here.
 *   - `exp`    — convex, packs the light end → more dark grades → moodier,
 *                more saturated feel.
 *
 * Per Q-P4.3 closure (Stage 1 design): all five curves ship in the substrate.
 *
 * Authored by the user via the `inputs.curves: Partial<Record<RampName,
 * CurveName>>` Tier-1 input (added during the substrate sprint's resolver
 * rewrite step, not in this commit).
 *
 * See `docs/dev/theme-cascade-stage-1-design.md` §25.
 */

import type { CurveName } from "../../types/theme-roles";

/** A curve function maps `t ∈ [0, 1]` to a remapped value `∈ [0, 1]`. */
export type CurveFn = (t: number) => number;

/** The five curve functions, frozen at module load. */
export const CURVES: Readonly<Record<CurveName, CurveFn>> = Object.freeze({
  linear: (t: number) => t,
  /** Smooth S-curve. Per rgc_v4. */
  ease: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  /** Smoothstep, classic graphics curve. */
  smooth: (t: number) => t * t * (3 - 2 * t),
  /** Concave — packs the dark end. */
  log: (t: number) => Math.log(1 + t * (Math.E - 1)),
  /** Convex — packs the light end. */
  exp: (t: number) => (Math.exp(t) - 1) / (Math.E - 1),
});

/** Lookup a curve function by name. Unknown names fall back to `ease`. */
export function curveFn(name: CurveName | undefined): CurveFn {
  if (!name) return CURVES.ease;
  return CURVES[name] ?? CURVES.ease;
}

/** Per-ramp default curve choices. Per Stage 1 §25b. */
export const DEFAULT_RAMP_CURVES = Object.freeze({
  neutral: "ease" as CurveName,
  brand: "linear" as CurveName,
  accent: "linear" as CurveName,
});
