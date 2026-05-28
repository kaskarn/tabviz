/**
 * Unified text-width measurement.
 *
 * Two primitives serve every measurement need in the codebase:
 *
 *   - `estimateTextWidth` (re-exported from `width-utils.ts`): pure-JS
 *     character-class arithmetic. Cheap, no DOM. Used as a *cheap ranker*
 *     to pick which strings to measure exactly.
 *
 *   - `measureExact(text, font, fontSize)`: Canvas `ctx.measureText` when a
 *     DOM is available; otherwise returns null. Callers that need a
 *     guaranteed-non-null fall back to the estimator.
 *
 * The high-level pattern used by `measureAutoColumns` (the load-bearing
 * call site) is **rank then exact**: score every cell with `estimateTextWidth`,
 * pick the top-K widest by estimate, exact-measure those K. For a 5k × 10
 * fixture that's ~30 `ctx.measureText` calls instead of ~50 000, with
 * pixel-exact accuracy preserved.
 *
 * For V8 SVG export with custom fonts, R can call `systemfonts::shape_string`
 * on the K rank-winners per column and inject those widths into the spec
 * payload; the renderer reads them directly and bypasses `measureExact`.
 * Out of scope for this module; see the `R/save_plot.R` injection contract.
 */

import { estimateTextWidth } from "./width-utils";

// Re-export so callers have one import for "the measurement utilities."
export { estimateTextWidth };

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Identity of a font *style*. Family + weight + italic; size is passed
 * separately at measurement time (the V8 estimator scales linearly with
 * `fontSize` and Canvas `ctx.measureText` does too).
 */
export interface FontKey {
  family: string;
  weight: number;
  italic?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Exact measurement (browser only)
// ─────────────────────────────────────────────────────────────────────────

// One Canvas + context per (this) module — reused across calls so we don't
// re-create the rendering surface on every measurement.
let _ctx: CanvasRenderingContext2D | null | undefined;

function getCtx(): CanvasRenderingContext2D | null {
  if (_ctx !== undefined) return _ctx;
  if (typeof document === "undefined") {
    _ctx = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  _ctx = canvas.getContext("2d");
  return _ctx;
}

function fontShorthand(font: FontKey, fontSize: number): string {
  const italicPrefix = font.italic ? "italic " : "";
  return `${italicPrefix}${font.weight} ${fontSize}px ${font.family}`;
}

/**
 * Canvas-exact width of `text` at the given font and size. Returns `null`
 * in non-browser environments (e.g. V8 SVG export); callers should fall
 * back to `estimateTextWidth` (or to R-injected widths).
 */
export function measureExact(
  text: string,
  font: FontKey,
  fontSize: number
): number | null {
  const ctx = getCtx();
  if (!ctx) return null;
  ctx.font = fontShorthand(font, fontSize);
  return ctx.measureText(text).width;
}

// ─────────────────────────────────────────────────────────────────────────
// Rank + exact-top-K
// ─────────────────────────────────────────────────────────────────────────

/**
 * K for the rank+top-K selector. The character-class estimator can mis-rank
 * neighbors (a string of narrow `iii` vs a shorter string of wide `MMM`),
 * so we exact-measure several candidates and take the max. K=3 is a balance
 * between safety and Canvas-call count; raise if you observe column-width
 * drift after a string-set change.
 */
export const DEFAULT_TOP_K = 3;

/**
 * Pick the top-K widest strings from `candidates` by `estimateTextWidth`
 * score. Linear scan, no allocations for the rejected entries. Returns
 * fewer than K when fewer candidates are supplied.
 */
export function rankTopK(
  candidates: readonly string[],
  fontSize: number,
  weight: number,
  k: number = DEFAULT_TOP_K
): string[] {
  if (k <= 0) return [];
  if (candidates.length <= k) return candidates.slice();
  const top: { text: string; score: number }[] = [];
  for (const text of candidates) {
    if (!text) continue;
    const score = estimateTextWidth(text, fontSize, weight);
    if (top.length < k) {
      top.push({ text, score });
      // Keep smallest at index 0 for quick replace.
      top.sort((a, b) => a.score - b.score);
      continue;
    }
    if (score > top[0].score) {
      top[0] = { text, score };
      top.sort((a, b) => a.score - b.score);
    }
  }
  return top.map((t) => t.text);
}

/**
 * Maximum exact pixel width over a set of candidate strings, using the
 * rank+exact-top-K strategy.
 *
 *   - Rank every candidate by `estimateTextWidth` (arithmetic, no DOM).
 *   - Exact-measure the top-K via Canvas.
 *   - Return the largest exact width.
 *
 * When Canvas isn't available (V8), falls through to the estimator's
 * value for the top-1 — the rank is what matters, and the estimator is
 * what V8 export currently uses anyway.
 */
export function measureMaxWidth(
  candidates: readonly string[],
  font: FontKey,
  fontSize: number,
  k: number = DEFAULT_TOP_K
): number {
  if (candidates.length === 0) return 0;
  const winners = rankTopK(candidates, fontSize, font.weight, k);
  const ctx = getCtx();
  let max = 0;
  if (ctx) {
    ctx.font = fontShorthand(font, fontSize);
    for (const text of winners) {
      const w = ctx.measureText(text).width;
      if (w > max) max = w;
    }
    return max;
  }
  // V8 / no-DOM: estimator is the source of truth; the top-1 by estimate
  // is by definition the max under that metric.
  for (const text of winners) {
    const w = estimateTextWidth(text, fontSize, font.weight);
    if (w > max) max = w;
  }
  return max;
}
