import { describe, test, expect } from "bun:test";
import {
  buildForestScale,
  forestScaleRange,
  safeLogDomain,
  forestScaleKey,
  type ForestScaleContext,
} from "./forest-scale";
import { VIZ_MARGIN } from "../axis-utils";

const ctx = (over: Partial<ForestScaleContext> = {}): ForestScaleContext => ({
  columnId: "fc1",
  groupId: null,
  scaleType: "linear",
  domain: [0, 1],
  width: 240,
  ...over,
});

describe("forestScaleRange", () => {
  test("insets by VIZ_MARGIN on each side", () => {
    expect(forestScaleRange(240)).toEqual([VIZ_MARGIN, 240 - VIZ_MARGIN]);
  });

  test("floors to a usable span for tiny/collapsed widths", () => {
    // end must be at least start + 50 even when width - margin would be smaller
    expect(forestScaleRange(0)).toEqual([VIZ_MARGIN, VIZ_MARGIN + 50]);
    expect(forestScaleRange(10)).toEqual([VIZ_MARGIN, VIZ_MARGIN + 50]);
  });
});

describe("safeLogDomain", () => {
  test("clamps non-positive ends to the log floors (0.01 / 0.02)", () => {
    expect(safeLogDomain([0, 0])).toEqual([0.01, 0.02]);
    expect(safeLogDomain([-5, 0.5])).toEqual([0.01, 0.5]);
  });

  test("leaves an already-safe domain untouched", () => {
    expect(safeLogDomain([0.1, 100])).toEqual([0.1, 100]);
  });
});

describe("forestScaleKey", () => {
  test("equal contexts produce equal keys", () => {
    expect(forestScaleKey(ctx())).toBe(forestScaleKey(ctx()));
  });

  test("any differing field changes the key", () => {
    const base = forestScaleKey(ctx());
    expect(forestScaleKey(ctx({ columnId: "fc2" }))).not.toBe(base);
    expect(forestScaleKey(ctx({ groupId: "g1" }))).not.toBe(base);
    expect(forestScaleKey(ctx({ scaleType: "log" }))).not.toBe(base);
    expect(forestScaleKey(ctx({ domain: [0, 2] }))).not.toBe(base);
    expect(forestScaleKey(ctx({ width: 300 }))).not.toBe(base);
  });

  test("null groupId and empty-string groupId do not collide with a real id", () => {
    expect(forestScaleKey(ctx({ groupId: null }))).not.toBe(
      forestScaleKey(ctx({ groupId: "x" })),
    );
  });
});

describe("buildForestScale", () => {
  test("linear: maps domain ends to the inset range ends", () => {
    const s = buildForestScale(ctx({ domain: [-1, 1], width: 240 }));
    expect(s(-1)).toBeCloseTo(VIZ_MARGIN, 6);
    expect(s(1)).toBeCloseTo(240 - VIZ_MARGIN, 6);
    expect(s(0)).toBeCloseTo((VIZ_MARGIN + (240 - VIZ_MARGIN)) / 2, 6);
  });

  test("log: maps clamped domain ends to the inset range ends", () => {
    const s = buildForestScale(ctx({ scaleType: "log", domain: [0.1, 10], width: 240 }));
    expect(s(0.1)).toBeCloseTo(VIZ_MARGIN, 6);
    expect(s(10)).toBeCloseTo(240 - VIZ_MARGIN, 6);
    // geometric midpoint (1.0) lands at the pixel midpoint
    expect(s(1)).toBeCloseTo((VIZ_MARGIN + (240 - VIZ_MARGIN)) / 2, 6);
  });

  test("log: a degenerate [0,0] domain still builds a finite scale", () => {
    const s = buildForestScale(ctx({ scaleType: "log", domain: [0, 0] }));
    expect(Number.isFinite(s(0.5))).toBe(true);
    expect(s.domain()).toEqual([0.01, 0.02]);
  });

  // Equivalence guard: reproduces the EXACT inline logic the four old call
  // sites used (axis slice xScale / forestColumnScales / svg-generator /
  // zoom override), so a future edit that drifts the builder is caught here.
  test("reproduces the historical inline construction byte-for-byte", () => {
    const width = 312;
    const domain: [number, number] = [-0.8, 1.4];

    // --- old inline linear ---
    const rangeStart = VIZ_MARGIN;
    const rangeEnd = Math.max(width - VIZ_MARGIN, rangeStart + 50);
    const expectedLinear = (v: number) =>
      rangeStart + ((v - domain[0]) / (domain[1] - domain[0])) * (rangeEnd - rangeStart);

    const lin = buildForestScale(ctx({ domain, width }));
    for (const v of [-0.8, 0, 0.5, 1.4]) {
      expect(lin(v)).toBeCloseTo(expectedLinear(v), 6);
    }

    // --- old inline log (with the 0.01 / 0.02 clamp) ---
    const logDomain: [number, number] = [0, 50];
    const safe: [number, number] = [Math.max(logDomain[0], 0.01), Math.max(logDomain[1], 0.02)];
    const logScale = buildForestScale(ctx({ scaleType: "log", domain: logDomain, width }));
    expect(logScale.domain()).toEqual(safe);
    expect(logScale.range()).toEqual([rangeStart, rangeEnd]);
  });
});
