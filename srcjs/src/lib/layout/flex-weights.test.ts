// Tests for the schema-backed flex-weight accessors.

import { test, expect, describe } from "bun:test";
import { flexWeightForColumn, vizNaturalWidthForColumn, columnFlexesForAspect, DEFAULT_FLEX_WEIGHT } from "./flex-weights";
import type { ColumnSpec } from "../../types";

const col = (type: string, flex?: boolean | number): ColumnSpec =>
  ({ id: "c", type, field: "f", options: {}, ...(flex !== undefined ? { flex } : {}) } as unknown as ColumnSpec);

describe("flexWeightForColumn (reads ColumnSchema.flexWeight)", () => {
  test("plots weigh more than text; penalized types weigh less", () => {
    expect(flexWeightForColumn(col("forest"))).toBeGreaterThan(flexWeightForColumn(col("text")));
    expect(flexWeightForColumn(col("viz_bar"))).toBeGreaterThan(flexWeightForColumn(col("sparkline")));
    expect(flexWeightForColumn(col("pvalue"))).toBeLessThan(DEFAULT_FLEX_WEIGHT);
  });

  test("types without a declared weight default to 1", () => {
    expect(flexWeightForColumn(col("text"))).toBe(DEFAULT_FLEX_WEIGHT);
    expect(flexWeightForColumn(col("numeric"))).toBe(DEFAULT_FLEX_WEIGHT);
  });

  test("forest carries the highest starter weight", () => {
    expect(flexWeightForColumn(col("forest"))).toBe(8);
  });

  test("numeric `flex` overrides the schema weight; clamped to ≥ 0", () => {
    expect(flexWeightForColumn(col("forest", 2))).toBe(2);   // override below default
    expect(flexWeightForColumn(col("text", 5))).toBe(5);     // override above default
    expect(flexWeightForColumn(col("forest", 0))).toBe(0);   // pinned
    expect(flexWeightForColumn(col("text", -3))).toBe(0);    // clamped
  });

  test("boolean `flex` does NOT change the weight (only aspect participation)", () => {
    expect(flexWeightForColumn(col("forest", true))).toBe(8);
    expect(flexWeightForColumn(col("forest", false))).toBe(8);
    expect(flexWeightForColumn(col("text", false))).toBe(DEFAULT_FLEX_WEIGHT);
  });
});

describe("columnFlexesForAspect", () => {
  test("true / positive number → participates; false / 0 / unset → not", () => {
    expect(columnFlexesForAspect(col("forest", true))).toBe(true);
    expect(columnFlexesForAspect(col("text", 3))).toBe(true);
    expect(columnFlexesForAspect(col("forest", false))).toBe(false);
    expect(columnFlexesForAspect(col("forest", 0))).toBe(false);
    expect(columnFlexesForAspect(col("forest"))).toBe(false); // unset (authoring sets the default)
  });
});

describe("vizNaturalWidthForColumn (reads ColumnSchema.naturalWidthPx)", () => {
  test("plot columns have a designed natural; content columns do not", () => {
    expect(vizNaturalWidthForColumn(col("forest"))).toBe(240);
    expect(vizNaturalWidthForColumn(col("viz_bar"))).toBe(200);
    expect(vizNaturalWidthForColumn(col("sparkline"))).toBe(80);
    expect(vizNaturalWidthForColumn(col("text"))).toBeNull();
  });
});
