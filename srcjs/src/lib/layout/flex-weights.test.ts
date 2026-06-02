// Tests for the schema-backed flex-weight accessors.

import { test, expect, describe } from "bun:test";
import { flexWeightForColumn, vizNaturalWidthForColumn, DEFAULT_FLEX_WEIGHT } from "./flex-weights";
import type { ColumnSpec } from "../../types";

const col = (type: string): ColumnSpec =>
  ({ id: "c", type, field: "f", options: {} } as unknown as ColumnSpec);

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
});

describe("vizNaturalWidthForColumn (reads ColumnSchema.naturalWidthPx)", () => {
  test("plot columns have a designed natural; content columns do not", () => {
    expect(vizNaturalWidthForColumn(col("forest"))).toBe(240);
    expect(vizNaturalWidthForColumn(col("viz_bar"))).toBe(200);
    expect(vizNaturalWidthForColumn(col("sparkline"))).toBe(80);
    expect(vizNaturalWidthForColumn(col("text"))).toBeNull();
  });
});
