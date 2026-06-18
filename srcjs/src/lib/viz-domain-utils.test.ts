// Tests for the shared viz_* domain helpers (schema-sprint Phase 4d).
// Behavior must match the inlined implementations the helpers replace:
//   - TabvizPlot.svelte ~lines 1003-1130 (pre-refactor)
//   - svg-generator.ts computeVizBarScale / Boxplot / Violin
// Edge cases: empty data, axisRange pin, log scale (orthogonal — domain
// helper only returns numbers; log handling is at the scale layer).

import { describe, test, expect } from "bun:test";
import {
  computeVizBarDomain,
  computeVizBoxplotDomain,
  computeVizViolinDomain,
} from "./viz-domain-utils";
import type { Row, VizBarColumnOptions, VizBoxplotColumnOptions, VizViolinColumnOptions } from "../types";

function row(meta: Record<string, unknown>, id = "r"): Row {
  return { id, label: id, metadata: meta } as Row;
}

describe("computeVizBarDomain", () => {
  const opts = (over: Partial<VizBarColumnOptions> = {}): VizBarColumnOptions => ({
    effects: [{ value: "v" } as VizBarColumnOptions["effects"][number]],
    ...over,
  } as VizBarColumnOptions);

  test("empty rows → [0, 100]", () => {
    expect(computeVizBarDomain([], opts())).toEqual({ min: 0, max: 100 });
  });

  test("min anchors at 0 even when all values positive", () => {
    const d = computeVizBarDomain([row({ v: 5 }), row({ v: 10 })], opts());
    expect(d.min).toBe(0);
    // max with 10% padding
    expect(d.max).toBeCloseTo(11);
  });

  test("negative values lower the min", () => {
    const d = computeVizBarDomain([row({ v: -5 }), row({ v: 10 })], opts());
    expect(d.min).toBe(-5);
  });

  test("axisRange pins both ends and skips computation", () => {
    const d = computeVizBarDomain(
      [row({ v: 500 })],
      opts({ axisRange: [0, 50] }),
    );
    expect(d).toEqual({ min: 0, max: 50 });
  });

  test("partial axisRange (only min) lets max compute", () => {
    const d = computeVizBarDomain([row({ v: 8 })], opts({ axisRange: [-1, null as unknown as number] }));
    expect(d.min).toBe(-1);
    expect(d.max).toBeCloseTo(8.8);
  });

  test("skips non-numeric values", () => {
    const d = computeVizBarDomain([row({ v: "x" }), row({ v: 5 })], opts());
    expect(d.max).toBeCloseTo(5.5);
  });
});

describe("computeVizBoxplotDomain", () => {
  const opts = (over: Partial<VizBoxplotColumnOptions> = {}): VizBoxplotColumnOptions => ({
    effects: [{ data: "d" } as VizBoxplotColumnOptions["effects"][number]],
    showOutliers: true,
    ...over,
  } as VizBoxplotColumnOptions);

  test("array data mode: spans stats min/max with 5% padding", () => {
    const d = computeVizBoxplotDomain([row({ d: [1, 2, 3, 4, 5] })], opts());
    // Stats range covers data; ±5%
    expect(d.min).toBeLessThan(1);
    expect(d.max).toBeGreaterThan(5);
  });

  test("pre-computed stats mode: reads effect.min / effect.max", () => {
    const o = {
      effects: [{ min: "lo", max: "hi" } as VizBoxplotColumnOptions["effects"][number]],
    } as VizBoxplotColumnOptions;
    const d = computeVizBoxplotDomain([row({ lo: 2, hi: 8 })], o);
    expect(d.min).toBeCloseTo(2 - 0.3);
    expect(d.max).toBeCloseTo(8 + 0.3);
  });

  test("empty rows → [0, 100]", () => {
    expect(computeVizBoxplotDomain([], opts())).toEqual({ min: 0, max: 100 });
  });

  test("axisRange pins outright", () => {
    const d = computeVizBoxplotDomain(
      [row({ d: [1, 2, 3] })],
      opts({ axisRange: [-10, 10] }),
    );
    expect(d).toEqual({ min: -10, max: 10 });
  });
});

describe("computeVizViolinDomain", () => {
  const opts = (over: Partial<VizViolinColumnOptions> = {}): VizViolinColumnOptions => ({
    effects: [{ data: "d" } as VizViolinColumnOptions["effects"][number]],
    ...over,
  } as VizViolinColumnOptions);

  test("data array spread with 10% pad on both ends", () => {
    const d = computeVizViolinDomain([row({ d: [0, 10] })], opts());
    // range = 10; pad = 1 each side
    expect(d.min).toBe(-1);
    expect(d.max).toBe(11);
  });

  test("empty rows → [0, 100]", () => {
    expect(computeVizViolinDomain([], opts())).toEqual({ min: 0, max: 100 });
  });

  test("axisRange pins outright", () => {
    const d = computeVizViolinDomain(
      [row({ d: [0, 1, 2] })],
      opts({ axisRange: [-5, 5] }),
    );
    expect(d).toEqual({ min: -5, max: 5 });
  });

  test("filters non-finite values from data arrays (NaN AND ±Infinity)", () => {
    // Regression (2026-06-17): the filter was `!Number.isNaN` (caught NaN but
    // NOT ±Inf — an infinite sample poisoned the domain → scale collapse).
    // Now `Number.isFinite`, matching computeVizBar/BoxplotDomain. The old test
    // only passed NaN, so it never exercised the gap; ±Inf is the real guard.
    const d = computeVizViolinDomain([row({ d: [0, NaN, Infinity, -Infinity, 4] })], opts());
    expect(d.min).toBe(-0.4);
    expect(d.max).toBe(4.4);
  });
});
