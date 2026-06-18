/**
 * Custom-annotation glyph geometry — the SHARED source for the polygon point
 * math used by BOTH the DOM (`TabvizPlot.svelte`) and the SVG export
 * (`svg-generator.ts`). Before this module the triangle/star geometry (incl. the
 * `1.2` / `0.5` star radii and the `π/2 + k·π/5` vertex angles) was duplicated
 * verbatim in both renderers — the exact "fix one, the other silently diverges"
 * fork-bug class D37 is about. First incremental step of the forest-mark
 * DOM↔export unification (see docs/dev/d37-forest-mark-unification.md).
 *
 * `cx`/`cy` = glyph center; `sz` = half-extent (the bounding radius). Circle and
 * square need no point math (cx/cy/r and x/y/w/h respectively), so only the two
 * polygon shapes live here. Pure — no DOM, V8-safe.
 */

/** 5-pointed star outer/inner radius ratios, as a multiple of `sz`. */
const STAR_OUTER_RATIO = 1.2;
const STAR_INNER_RATIO = 0.5;

/** Downward-pointing... actually upward-apex triangle inscribed in the ±sz box. */
export function trianglePoints(cx: number, cy: number, sz: number): string {
  return `${cx},${cy - sz} ${cx - sz},${cy + sz} ${cx + sz},${cy + sz}`;
}

/** 5-pointed star: 10 alternating outer/inner vertices, apex up. */
export function starPoints(cx: number, cy: number, sz: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? sz * STAR_OUTER_RATIO : sz * STAR_INNER_RATIO;
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`);
  }
  return pts.join(" ");
}
