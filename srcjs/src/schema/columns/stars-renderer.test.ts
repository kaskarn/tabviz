// Tests for the stars SVG renderer (schema-sprint Phase 4b.3).

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchRenderer } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import { __testing } from "./stars-renderer";
import type { RenderSvg, RenderContext } from "../render-types";
import "../init";

const { ratingFor, STAR_SIZE, STAR_GAP, DEFAULT_FILL, DEFAULT_EMPTY } = __testing;

beforeEach(() => {
  bootBuiltinBehaviors();
});

function callStars(value: unknown, options: Record<string, unknown> = {}): RenderSvg {
  const fn = dispatchRenderer("stars", "svg");
  if (!fn) throw new Error("stars svg renderer not registered");
  const ctx: RenderContext = { cellWidth: 100, rowHeight: 24, row: {}, target: "svg" };
  const node = fn(value, options, ctx);
  if (node.kind !== "svg") throw new Error(`expected svg, got ${node.kind}`);
  return node;
}

describe("stars renderer — rating", () => {
  test("raw numeric value (no domain) clamps to [0, maxStars]", () => {
    expect(ratingFor(3.5, {}, 5)).toBeCloseTo(3.5);
    expect(ratingFor(99, {}, 5)).toBe(5);
    expect(ratingFor(-1, {}, 5)).toBe(0);
  });

  test("domain re-maps to 0..maxStars", () => {
    // value=50 in [0, 100] → midpoint → maxStars/2 = 2.5
    expect(ratingFor(50, { domain: [0, 100] }, 5)).toBeCloseTo(2.5);
  });

  test("domain clamps inputs outside the range", () => {
    expect(ratingFor(200, { domain: [0, 100] }, 5)).toBe(5);
    expect(ratingFor(-5, { domain: [0, 100] }, 5)).toBe(0);
  });
});

describe("stars renderer — markup", () => {
  test("emits maxStars <path> elements", () => {
    const node = callStars(3, { stars: { maxGlyphs: 5 } });
    const pathCount = (node.markup.match(/<path/g) ?? []).length;
    expect(pathCount).toBe(5);
  });

  test("filled stars use color, empty stars use emptyColor", () => {
    const node = callStars(2, { stars: { maxGlyphs: 5 } });
    const filledMatches = node.markup.match(new RegExp(`fill="${DEFAULT_FILL}"`, "g")) ?? [];
    const emptyMatches = node.markup.match(new RegExp(`fill="${DEFAULT_EMPTY}"`, "g")) ?? [];
    expect(filledMatches.length).toBe(2);
    expect(emptyMatches.length).toBe(3);
  });

  test("half-star flag fills the floor+1 position", () => {
    // value=2.5 with halfStars → 2 filled + half on the 3rd
    const withHalf = callStars(2.5, { stars: { maxGlyphs: 5, halfGlyphs: true } });
    const filledHalf = withHalf.markup.match(new RegExp(`fill="${DEFAULT_FILL}"`, "g")) ?? [];
    expect(filledHalf.length).toBe(3);

    const withoutHalf = callStars(2.5, { stars: { maxGlyphs: 5, halfGlyphs: false } });
    const filledNoHalf = withoutHalf.markup.match(new RegExp(`fill="${DEFAULT_FILL}"`, "g")) ?? [];
    expect(filledNoHalf.length).toBe(2);
  });

  test("custom colors flow through", () => {
    const node = callStars(2, { stars: { maxGlyphs: 3, color: "#abc", emptyColor: "#def" } });
    expect(node.markup).toContain('fill="#abc"');
    expect(node.markup).toContain('fill="#def"');
  });

  test("maxStars clamped to [1, 20]", () => {
    const big = callStars(5, { stars: { maxGlyphs: 999 } });
    expect((big.markup.match(/<path/g) ?? []).length).toBe(20);
    const small = callStars(0, { stars: { maxGlyphs: -3 } });
    expect((small.markup.match(/<path/g) ?? []).length).toBe(1);
  });

  test("non-numeric returns empty", () => {
    const node = callStars(null);
    expect(node.markup).toBe("");
    expect(node.width).toBe(0);
  });

  test("width = maxStars * size + gaps", () => {
    const node = callStars(2, { stars: { maxGlyphs: 5 } });
    expect(node.width).toBe(5 * STAR_SIZE + 4 * STAR_GAP);
    expect(node.height).toBe(STAR_SIZE);
  });
});

describe("stars renderer — dispatch", () => {
  test("registered on the stars schema's svg slot", () => {
    expect(dispatchRenderer("stars", "svg")).toBeDefined();
  });
});
