/**
 * Unit tests for axis calculation utilities
 */

import { describe, test, expect } from "bun:test";
import { computeAxisLimits, generateTicks, computeAxis } from "./axis-utils";
import type { Row, AxisConfig } from "$types";

// Helper to create mock rows with metadata
function createRows(data: Array<{ point: number; lower: number; upper: number }>): Row[] {
  return data.map((d, i) => ({
    id: `row_${i}`,
    label: `Study ${i}`,
    groupId: null,
    metadata: {
      point: d.point,
      lower: d.lower,
      upper: d.upper,
    },
  }));
}

// Default axis config for testing
const defaultConfig: AxisConfig = {
  rangeMin: null,
  rangeMax: null,
  tickCount: null,
  tickValues: null,
  gridlines: false,
  gridlineStyle: "dotted",
  ciClipFactor: 2.0,
  includeNull: true,
  symmetric: null,
  nullTick: true,
  markerMargin: true,
};

describe("computeAxisLimits", () => {
  describe("linear scale", () => {
    test("calculates range from point estimates", () => {
      const rows = createRows([
        { point: 0.5, lower: 0.3, upper: 0.7 },
        { point: 1.0, lower: 0.8, upper: 1.2 },
        { point: 1.5, lower: 1.2, upper: 1.8 },
      ]);

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "linear", 0, [], "point", "lower", "upper"
      );

      // Should include null (0) and extend to nice numbers
      expect(min).toBeLessThanOrEqual(0);
      expect(max).toBeGreaterThanOrEqual(1.5);
    });

    test("includes null value by default", () => {
      const rows = createRows([
        { point: 2.0, lower: 1.5, upper: 2.5 },
        { point: 3.0, lower: 2.5, upper: 3.5 },
      ]);

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "linear", 0, [], "point", "lower", "upper"
      );

      // Min should be 0 (null value) even though data starts at 2.0
      expect(min).toBeLessThanOrEqual(0);
    });

    test("excludes null value when includeNull=false", () => {
      const rows = createRows([
        { point: 2.0, lower: 1.5, upper: 2.5 },
        { point: 3.0, lower: 2.5, upper: 3.5 },
      ]);

      const config = { ...defaultConfig, includeNull: false };
      const [min, max] = computeAxisLimits(
        rows, config, "linear", 0, [], "point", "lower", "upper"
      );

      // Min should be based on data, not null
      expect(min).toBeGreaterThan(0);
    });

    test("respects explicit range limits", () => {
      const rows = createRows([
        { point: 0.5, lower: 0.3, upper: 0.7 },
      ]);

      const config = { ...defaultConfig, rangeMin: -2, rangeMax: 2 };
      const [min, max] = computeAxisLimits(
        rows, config, "linear", 0, [], "point", "lower", "upper"
      );

      expect(min).toBe(-2);
      expect(max).toBe(2);
    });

    test("clips wide CIs based on ciClipFactor", () => {
      const rows = createRows([
        { point: 1.0, lower: -10, upper: 12 }, // Very wide CI
      ]);

      const config = { ...defaultConfig, ciClipFactor: 2.0 };
      const [min, max] = computeAxisLimits(
        rows, config, "linear", 0, [], "point", "lower", "upper"
      );

      // Should not extend to -10 or 12; should be clipped
      expect(min).toBeGreaterThan(-10);
      expect(max).toBeLessThan(12);
    });

    test("handles negative effects correctly", () => {
      const rows = createRows([
        { point: -0.5, lower: -0.8, upper: -0.2 },
        { point: -1.0, lower: -1.3, upper: -0.7 },
      ]);

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "linear", 0, [], "point", "lower", "upper"
      );

      expect(min).toBeLessThan(-1.0);
      expect(max).toBeGreaterThanOrEqual(0); // includes null
    });

    test("returns fallback for empty data", () => {
      const [min, max] = computeAxisLimits(
        [], defaultConfig, "linear", 0, [], "point", "lower", "upper"
      );

      expect(min).toBe(-1);
      expect(max).toBe(1);
    });
  });

  describe("log scale", () => {
    test("calculates range from point estimates", () => {
      const rows = createRows([
        { point: 0.5, lower: 0.3, upper: 0.8 },
        { point: 1.0, lower: 0.7, upper: 1.4 },
        { point: 2.0, lower: 1.2, upper: 3.3 },
      ]);

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "log", 1, [], "point", "lower", "upper"
      );

      // Should include null (1) and span the data
      expect(min).toBeLessThanOrEqual(0.5);
      expect(max).toBeGreaterThanOrEqual(2.0);
    });

    test("includes null value (1) for log scale", () => {
      const rows = createRows([
        { point: 2.0, lower: 1.5, upper: 2.7 },
        { point: 3.0, lower: 2.2, upper: 4.1 },
      ]);

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "log", 1, [], "point", "lower", "upper"
      );

      // Should include 1 (null for log scale)
      expect(min).toBeLessThanOrEqual(1);
    });

    test("clips wide CIs using ratio for log scale", () => {
      const rows = createRows([
        { point: 1.0, lower: 0.01, upper: 100 }, // Very wide CI
      ]);

      const config = { ...defaultConfig, ciClipFactor: 2.0 };
      const [min, max] = computeAxisLimits(
        rows, config, "log", 1, [], "point", "lower", "upper"
      );

      // Should not extend to 0.01 or 100; should be clipped
      expect(min).toBeGreaterThan(0.01);
      expect(max).toBeLessThan(100);
    });

    test("returns fallback for empty log data", () => {
      const [min, max] = computeAxisLimits(
        [], defaultConfig, "log", 1, [], "point", "lower", "upper"
      );

      expect(min).toBe(0.1);
      expect(max).toBe(10);
    });
  });

  describe("custom column names", () => {
    test("reads from custom column names", () => {
      const rows: Row[] = [
        {
          id: "row_1",
          label: "Study 1",
          groupId: null,
          metadata: { hr: 0.65, hr_lower: 0.45, hr_upper: 0.85 },
        },
        {
          id: "row_2",
          label: "Study 2",
          groupId: null,
          metadata: { hr: 0.80, hr_lower: 0.62, hr_upper: 1.02 },
        },
      ];

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "log", 1, [], "hr", "hr_lower", "hr_upper"
      );

      // Should find the data using custom column names
      expect(min).toBeLessThanOrEqual(0.65);
      expect(max).toBeGreaterThanOrEqual(1); // includes null=1
    });

    test("falls back gracefully when column not found", () => {
      const rows: Row[] = [
        {
          id: "row_1",
          label: "Study 1",
          groupId: null,
          metadata: { other_field: 0.5 },
        },
      ];

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "linear", 0, [], "nonexistent", "lower", "upper"
      );

      // Should return fallback since no data found
      expect(min).toBe(-1);
      expect(max).toBe(1);
    });
  });

  describe("additional effects", () => {
    test("includes effects in range calculation", () => {
      const rows: Row[] = [
        {
          id: "row_1",
          label: "Study 1",
          groupId: null,
          metadata: {
            primary_point: 1.0,
            primary_lower: 0.8,
            primary_upper: 1.2,
            secondary_point: 2.5,
            secondary_lower: 2.0,
            secondary_upper: 3.0,
          },
        },
      ];

      const effects = [
        {
          id: "secondary",
          pointCol: "secondary_point",
          lowerCol: "secondary_lower",
          upperCol: "secondary_upper",
        },
      ];

      const [min, max] = computeAxisLimits(
        rows, defaultConfig, "linear", 0,
        effects as any,
        "primary_point", "primary_lower", "primary_upper"
      );

      // Should include both primary (1.0) and secondary (2.5) effects
      expect(max).toBeGreaterThanOrEqual(2.5);
    });
  });
});

describe("generateTicks", () => {
  describe("linear scale", () => {
    test("generates ticks within bounds", () => {
      const ticks = generateTicks([0, 2], defaultConfig, "linear", 0);

      expect(ticks.length).toBeGreaterThan(0);
      expect(Math.min(...ticks)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ticks)).toBeLessThanOrEqual(2);
    });

    test("includes null tick when nullTick=true", () => {
      const config = { ...defaultConfig, nullTick: true };
      const ticks = generateTicks([-1, 1], config, "linear", 0);

      expect(ticks).toContain(0);
    });

    test("respects explicit tickValues", () => {
      const config = { ...defaultConfig, tickValues: [-1, 0, 0.5, 1] };
      const ticks = generateTicks([-1, 1], config, "linear", 0);

      expect(ticks).toEqual([-1, 0, 0.5, 1]);
    });

    test("generates nice tick values", () => {
      const ticks = generateTicks([0, 1.5], defaultConfig, "linear", 0);

      // Ticks should be nice round numbers
      for (const tick of ticks) {
        // Check that ticks are "nice" (multiples of 0.1, 0.2, 0.25, 0.5, 1, etc.)
        const isNice = [0.1, 0.2, 0.25, 0.5, 1].some(step =>
          Math.abs(tick % step) < 0.0001 || Math.abs((tick % step) - step) < 0.0001
        );
        expect(isNice).toBe(true);
      }
    });
  });

  describe("log scale", () => {
    test("generates log-appropriate ticks", () => {
      const ticks = generateTicks([0.1, 10], defaultConfig, "log", 1);

      expect(ticks.length).toBeGreaterThan(0);
      // Should include powers of 10 or nice log values
      expect(ticks.some(t => t === 1)).toBe(true); // null value
    });

    test("includes null tick (1) for log scale", () => {
      const config = { ...defaultConfig, nullTick: true };
      const ticks = generateTicks([0.5, 2], config, "log", 1);

      expect(ticks).toContain(1);
    });
  });
});

describe("computeAxis (integration)", () => {
  test("returns consistent axis computation", () => {
    const rows = createRows([
      { point: 0.5, lower: 0.3, upper: 0.7 },
      { point: 1.0, lower: 0.8, upper: 1.2 },
    ]);

    const result = computeAxis({
      rows,
      config: defaultConfig,
      scale: "linear",
      nullValue: 0,
      forestWidth: 300,
      pointSize: 8,
      pointCol: "point",
      lowerCol: "lower",
      upperCol: "upper",
    });

    expect(result.axisLimits).toHaveLength(2);
    expect(result.plotRegion).toHaveLength(2);
    expect(result.ticks.length).toBeGreaterThan(0);

    // Plot region should be at least as wide as axis limits
    expect(result.plotRegion[0]).toBeLessThanOrEqual(result.axisLimits[0]);
    expect(result.plotRegion[1]).toBeGreaterThanOrEqual(result.axisLimits[1]);
  });

  test("works with log scale hazard ratios", () => {
    const rows: Row[] = [
      { id: "1", label: "Study A", groupId: null, metadata: { hr: 0.65, lower: 0.45, upper: 0.85 } },
      { id: "2", label: "Study B", groupId: null, metadata: { hr: 0.80, lower: 0.62, upper: 1.02 } },
      { id: "3", label: "Study C", groupId: null, metadata: { hr: 0.92, lower: 0.78, upper: 1.08 } },
      { id: "4", label: "Study D", groupId: null, metadata: { hr: 1.15, lower: 0.89, upper: 1.48 } },
    ];

    const result = computeAxis({
      rows,
      config: defaultConfig,
      scale: "log",
      nullValue: 1,
      forestWidth: 300,
      pointSize: 8,
      pointCol: "hr",
      lowerCol: "lower",
      upperCol: "upper",
    });

    // Should have sensible range for HR data (roughly 0.4-1.5)
    expect(result.axisLimits[0]).toBeLessThan(1); // Below null
    expect(result.axisLimits[1]).toBeGreaterThan(1); // Above null
    expect(result.axisLimits[0]).toBeGreaterThan(0.1); // Not the fallback
    expect(result.axisLimits[1]).toBeLessThan(10); // Not the fallback

    // Ticks should include 1 (null for HR)
    expect(result.ticks).toContain(1);
  });
});
