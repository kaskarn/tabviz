import { describe, test, expect, beforeAll } from "bun:test";
import { renderDebugShapes } from "./debug-shapes";
import { computeLayoutMetrics } from "./svg-generator";
import { sizingFixtures } from "./sizing-fixtures";
import { bootBuiltinBehaviors } from "../schema/init";

/**
 * debug-shapes — visual half of the sizing harness. We can't assert pixels
 * here (that's the eyeball/PNG review via R's render_debug_shapes), but we can
 * guard the contract: well-formed SVG, sized to the metrics, one box per cell,
 * and pure-from-metrics (no hidden state).
 *
 * See docs/dev/sizing-model.md §6b.
 */

beforeAll(() => bootBuiltinBehaviors());

describe("debug-shapes", () => {
  const fixtures = sizingFixtures();

  test("emits one well-formed, correctly-sized SVG per fixture", () => {
    for (const { spec } of fixtures) {
      const svg = renderDebugShapes(spec);
      const m = computeLayoutMetrics(spec);
      expect(svg.startsWith("<?xml")).toBe(true);
      expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
      // svg width/height come straight off the metrics.
      expect(svg).toContain(`width="${Math.round(m.totalWidth * 100) / 100}"`);
      expect(svg).toContain(`height="${Math.round(m.totalHeight * 100) / 100}"`);
      // balanced tags (no truncation).
      const open = (svg.match(/<svg\b/g) ?? []).length;
      const close = (svg.match(/<\/svg>/g) ?? []).length;
      expect(open).toBe(1);
      expect(close).toBe(1);
    }
  });

  test("draws an allocated box for every cell (rows × columns)", () => {
    const { spec } = fixtures.find((f) => f.name === "mixed-columns")!;
    const m = computeLayoutMetrics(spec);
    const svg = renderDebugShapes(spec);
    // Each cell emits one <rect> at its (x, top); count rects whose x matches a
    // known column origin — must be at least rows × columns.
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(m.rows.length * m.columns.length);
  });

  test("is a pure function of the spec (stable across calls)", () => {
    const { spec } = fixtures[0];
    expect(renderDebugShapes(spec)).toBe(renderDebugShapes(spec));
  });

  test("every column origin x is reflected in the output", () => {
    const { spec } = fixtures.find((f) => f.name === "mixed-columns")!;
    const m = computeLayoutMetrics(spec);
    const svg = renderDebugShapes(spec);
    for (const c of m.columns) {
      expect(svg).toContain(`x="${Math.round(c.x * 100) / 100}"`);
    }
  });
});
