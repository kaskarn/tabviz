/**
 * Alpha companion ramps (v4 substrate).
 *
 * Every solid ramp (neutral / brand / accent) has an alpha-progression
 * sibling: the same hue at rising opacity. Composited over `paper`, the
 * alpha companion approximates the solid ramp at the corresponding grade,
 * but it preserves the background behind it (a translucent wash).
 *
 * Wash roles consume alpha companions:
 *   - `highlight-bg` → brand-alpha-3  (translucent row highlight)
 *   - `accent-fill`  → accent-alpha-2
 *   - status `*-fill` → respective status-color alpha
 *
 * Per Q-P4.2 closure (Stage 1 design §24): emitted as separate CSS
 * variables (one per ramp × grade pair), not computed via `color-mix()`
 * at consumption. Pre-computed values guarantee portability across
 * librsvg versions.
 *
 * See `docs/dev/theme-cascade-stage-1-design.md` §24.
 */

import { hexToOklch } from "../oklch";

/** An 11-step alpha-progression: same anchor hue, rising opacity. Each
 *  step is an `oklch(L C H / A)` string. */
export type AlphaRamp = readonly string[];

/** Build the 11-step alpha progression for the given anchor hex.
 *
 *  Alpha curve: `α = 0.03 + (t^1.25) * 0.9`, where `t = i/(N-1)`.
 *  This rises from near-invisible (~0.03) to nearly-opaque (~0.93) with
 *  a slight concavity matching how the solid ramp packs grades at the
 *  dark end. Per rgc_v4 / Stage 1 §24a.
 */
export function buildAlphaRamp(anchorHex: string): AlphaRamp {
  const anchor = hexToOklch(anchorHex);
  const out: string[] = [];
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const a = clamp(0.03 + Math.pow(t, 1.25) * 0.9, 0, 0.95);
    out.push(formatOklchWithAlpha(anchor.L, anchor.C, anchor.H, round(a, 3)));
  }
  return out;
}

/** Format an OKLCH triple plus alpha as a CSS `oklch(...)` string. */
function formatOklchWithAlpha(L: number, C: number, H: number, A: number): string {
  return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)} / ${A})`;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function round(x: number, n: number): number {
  const k = Math.pow(10, n);
  return Math.round(x * k) / k;
}
