// Pure sparkline geometry helpers shared between the SVG export's
// per-column drawing branch and the schema's sparkline renderer.
//
// `computeSparklinePoints` maps a numeric series + a layout box into a
// sequence of (x, y) coordinates. `catmullRomPath` produces a smooth
// SVG `d` string between those points. Neither depends on theme or
// runtime context — pure geometry, easy to test, easy to share.

import { SPARKLINE } from "./rendering-constants";
import { arrayMin, arrayMax } from "./scale-utils";

export type SparklinePoint = [number, number];

/**
 * Map a numeric series onto an (x, y, width, height) layout box.
 * Returns the per-sample coordinate pair (top-left origin). Handles
 * the degenerate cases: empty data → []; single sample → centered
 * point.
 *
 * Vertical domain is auto-padded by 10% of the value range (or 1
 * when the range is zero), so flat series still emit a centered
 * line rather than collapsing onto the top edge.
 */
export function computeSparklinePoints(
  data: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = SPARKLINE.PADDING,
): SparklinePoint[] {
  const validData = data.filter((v) => Number.isFinite(v));
  if (validData.length === 0) return [];
  if (validData.length === 1) {
    return [[x + width / 2, y + height / 2]];
  }

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const min = arrayMin(validData);
  const max = arrayMax(validData);
  const yPad = (max - min) * 0.1 || 1;
  const domainMin = min - yPad;
  const domainMax = max + yPad;
  const yRange = domainMax - domainMin || 1;

  const N = validData.length;
  const out: SparklinePoint[] = [];
  for (let i = 0; i < N; i++) {
    const px = x + padding + (i / (N - 1)) * innerW;
    const py = y + padding + innerH - ((validData[i] - domainMin) / yRange) * innerH;
    out.push([px, py]);
  }
  return out;
}

/**
 * Centripetal Catmull-Rom path (alpha=0.5 by default), expressed as a
 * sequence of cubic-bezier `C` commands. Ports d3-shape's
 * `curveCatmullRom` so the SVG export matches the live widget.
 *
 * Endpoints duplicate the boundary point as the implicit neighbor
 * (same as d3's open variant).
 */
export function catmullRomPath(
  points: SparklinePoint[],
  alpha: number = SPARKLINE.CURVE_ALPHA,
): string {
  const fmt = (n: number) => n.toFixed(2);
  const N = points.length;
  if (N === 0) return "";
  if (N === 1) return `M${fmt(points[0][0])},${fmt(points[0][1])}`;
  if (N === 2) {
    return `M${fmt(points[0][0])},${fmt(points[0][1])}L${fmt(points[1][0])},${fmt(points[1][1])}`;
  }

  const eps = 1e-9;
  const segs: string[] = [`M${fmt(points[0][0])},${fmt(points[0][1])}`];
  for (let i = 0; i < N - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];

    const l01a = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), alpha);
    const l12a = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), alpha);
    const l23a = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), alpha);
    const l01_2a = l01a * l01a;
    const l12_2a = l12a * l12a;
    const l23_2a = l23a * l23a;

    let b1x: number;
    let b1y: number;
    if (l01a > eps) {
      const a = 2 * l01_2a + 3 * l01a * l12a + l12_2a;
      const n = 3 * l01a * (l01a + l12a);
      b1x = (a * p1[0] - l12_2a * p0[0] + l01_2a * p2[0]) / n;
      b1y = (a * p1[1] - l12_2a * p0[1] + l01_2a * p2[1]) / n;
    } else {
      b1x = p1[0];
      b1y = p1[1];
    }

    let b2x: number;
    let b2y: number;
    if (l23a > eps) {
      const b = 2 * l23_2a + 3 * l23a * l12a + l12_2a;
      const m = 3 * l23a * (l23a + l12a);
      b2x = (b * p2[0] + l23_2a * p1[0] - l12_2a * p3[0]) / m;
      b2y = (b * p2[1] + l23_2a * p1[1] - l12_2a * p3[1]) / m;
    } else {
      b2x = p2[0];
      b2y = p2[1];
    }

    segs.push(`C${fmt(b1x)},${fmt(b1y)} ${fmt(b2x)},${fmt(b2y)} ${fmt(p2[0])},${fmt(p2[1])}`);
  }
  return segs.join("");
}
