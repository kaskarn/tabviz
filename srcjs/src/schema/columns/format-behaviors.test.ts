// Tests for the formatValue behaviors registered in Phase 6.1.

import { describe, test, expect, beforeEach } from "bun:test";
import { dispatchForColumn } from "../dispatch";
import { bootBuiltinBehaviors } from "../init";
import type { ColumnSpec } from "../../types";
import "../init";

beforeEach(() => { bootBuiltinBehaviors(); });

function numericCol(opts: Record<string, unknown> = {}): ColumnSpec {
  return {
    id: "n", header: "N", field: "v", type: "numeric",
    align: "right", sortable: true, isGroup: false, width: "auto",
    options: { numeric: opts },
  } as unknown as ColumnSpec;
}

function pvalueCol(opts: Record<string, unknown> = {}): ColumnSpec {
  return {
    id: "p", header: "p", field: "p", type: "pvalue",
    align: "right", sortable: true, isGroup: false, width: "auto",
    options: { pvalue: opts },
  } as unknown as ColumnSpec;
}

function percentCol(opts: Record<string, unknown> = {}): ColumnSpec {
  return {
    id: "p", header: "%", field: "v", type: "numeric",
    align: "right", sortable: true, isGroup: false, width: "auto",
    options: { percent: opts },
  } as unknown as ColumnSpec;
}

describe("numeric.formatValue", () => {
  test("decimals option applies", () => {
    const fn = dispatchForColumn(numericCol({ decimals: 2 }), "formatValue");
    expect(fn).toBeDefined();
    expect(fn!(1.23456, { numeric: { decimals: 2 } }, { row: {} })).toBe("1.23");
  });

  test("thousands separator", () => {
    const fn = dispatchForColumn(numericCol({ thousandsSep: "," }), "formatValue");
    expect(fn!(12345, { numeric: { thousandsSep: "," } }, { row: {} })).toContain(",");
  });

  test("null → naText fallback", () => {
    const fn = dispatchForColumn(numericCol(), "formatValue");
    expect(fn!(null, { naText: "—" }, { row: {} })).toBe("—");
  });
});

describe("pvalue.formatValue", () => {
  test("formats simple decimal p-values", () => {
    const fn = dispatchForColumn(pvalueCol({ digits: 2 }), "formatValue");
    expect(fn).toBeDefined();
    expect(fn!(0.042, { pvalue: { digits: 2 } }, { row: {} })).toBe("0.042");
  });

  test("scientific notation below expThreshold", () => {
    const fn = dispatchForColumn(pvalueCol({ digits: 2, expThreshold: 0.001 }), "formatValue");
    const out = fn!(1e-5, { pvalue: { digits: 2, expThreshold: 0.001 } }, { row: {} });
    expect(out).toMatch(/^1\.0×10/);
  });
});

describe("percent.formatValue (delegates up via parents)", () => {
  test("percent inherits numeric formatting + applies %", () => {
    const fn = dispatchForColumn(percentCol({ decimals: 1 }), "formatValue");
    expect(fn).toBeDefined();
    expect(fn!(0.42, { percent: { decimals: 1 } }, { row: {} })).toBe("42.0%");
  });
});
