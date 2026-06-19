/**
 * Shared forest-mark geometry — pure point-math used by BOTH the DOM
 * (`components/forest/*`) and the SVG export (`svg-generator.ts`), so the two
 * renderers can't drift. Part of the D37 fork unification (steps 2+); see
 * docs/dev/d37-forest-mark-unification.md. V8-safe, no DOM.
 */

/**
 * Summary-diamond polygon points (left/top/right/bottom around `yCenter`).
 *
 * All three scaled x-positions are clamped to the visible range
 * `[clampMin, clampMax]` BEFORE the `xOffset` is applied — so the diamond
 * (including its top/bottom apex at the point estimate) can never escape the
 * plot. This is the CANONICAL behavior: it matches the export, and reconciles
 * the DOM, which previously skipped the point-clamp and clamped asymmetrically
 * (a real WYSIWYG divergence — the apex could stick out of the widget plot).
 *
 * @param xOffset added to every coordinate after clamping (the export passes
 *        `forestX`; the DOM works in local plot space and passes 0). Clamping
 *        before the offset is equivalent to clamping offset bounds, so the
 *        export output is byte-identical to its prior inline math.
 */
export function summaryDiamondPoints(
  xLower: number,
  xPoint: number,
  xUpper: number,
  yCenter: number,
  halfHeight: number,
  clampMin: number,
  clampMax: number,
  xOffset = 0,
): string {
  const clamp = (v: number) => xOffset + Math.max(clampMin, Math.min(clampMax, v));
  const xL = clamp(xLower);
  const xP = clamp(xPoint);
  const xU = clamp(xUpper);
  return `${xL},${yCenter} ${xP},${yCenter - halfHeight} ${xU},${yCenter} ${xP},${yCenter + halfHeight}`;
}

/**
 * Point-MARKER diamond (a small rhombus centered on the marker, ±`size` on each
 * axis) — distinct from the lower→upper-spanning summaryDiamondPoints. Shared by
 * the export `renderMarker` and the DOM `RowInterval.svelte`.
 */
export function markerDiamondPoints(cx: number, cy: number, size: number): string {
  return `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
}

/** Point-MARKER triangle (apex up, base at +size). Shared export ↔ DOM. */
export function markerTrianglePoints(cx: number, cy: number, size: number): string {
  return `${cx},${cy - size} ${cx + size},${cy + size} ${cx - size},${cy + size}`;
}
