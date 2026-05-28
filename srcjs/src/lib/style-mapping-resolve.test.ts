// Tests for the shared styleMapping resolver (schema-sprint Phase 5).

import { describe, test, expect } from "bun:test";
import { resolveStyleMapping, __testing } from "./style-mapping-resolve";
import type { Row, ColumnSpec } from "../types";
import type { EffectiveBanks } from "../schema/banks";

const { resolveBool, resolveString } = __testing;

function row(meta: Record<string, unknown>, id = "r"): Row {
  return { id, label: id, metadata: meta } as Row;
}

function banks(conditions: { id: string; values: boolean[] }[]): EffectiveBanks {
  return {
    footnotes: [],
    axes: [],
    legends: [],
    conditions: conditions.map((c) => ({ id: c.id, kind: "boolean" as const, values: c.values })),
    custom: {},
  };
}

function col(styleMapping: Record<string, unknown>): ColumnSpec {
  return {
    id: "c", header: "C", field: "v", type: "text",
    align: "left", sortable: true, isGroup: false, width: "auto",
    styleMapping,
  } as unknown as ColumnSpec;
}

describe("resolveBool — per-kind", () => {
  test("theme mode → undefined", () => {
    expect(resolveBool({ kind: "theme" }, row({}), 0, null)).toBeUndefined();
  });
  test("static mode → value passes through", () => {
    expect(resolveBool({ kind: "static", value: true }, row({}), 0, null)).toBe(true);
  });
  test("field mode → metadata lookup, coerced", () => {
    expect(resolveBool({ kind: "field", field: "x" }, row({ x: 1 }), 0, null)).toBe(true);
    expect(resolveBool({ kind: "field", field: "x" }, row({ x: 0 }), 0, null)).toBeUndefined();
  });
  test("condition mode → banks lookup by rowIndex; falsy → undefined (additive)", () => {
    const b = banks([{ id: "sig", values: [false, true, false] }]);
    expect(resolveBool({ kind: "condition", name: "sig" }, row({}), 1, b)).toBe(true);
    // Falsy condition value means "no override" (CellStyle defaults to
    // all tokens absent); compress to undefined so callers don't set
    // explicit `false` on the cell.
    expect(resolveBool({ kind: "condition", name: "sig" }, row({}), 0, b)).toBeUndefined();
  });
  test("condition mode with missing condition → undefined", () => {
    expect(resolveBool({ kind: "condition", name: "?" }, row({}), 0, banks([]))).toBeUndefined();
  });
  test("legacy bare string → field lookup", () => {
    expect(resolveBool("x", row({ x: true }), 0, null)).toBe(true);
  });
});

describe("resolveString — per-kind", () => {
  test("field mode coerces to string", () => {
    expect(resolveString({ kind: "field", field: "c" }, row({ c: "#abc" }), 0, null)).toBe("#abc");
  });
  test("static mode passes through", () => {
    expect(resolveString({ kind: "static", value: "#abc" }, row({}), 0, null)).toBe("#abc");
  });
  test("condition mode is undefined (boolean → string not meaningful)", () => {
    const b = banks([{ id: "sig", values: [true] }]);
    expect(resolveString({ kind: "condition", name: "sig" }, row({}), 0, b)).toBeUndefined();
  });
});

describe("resolveStyleMapping — full column", () => {
  test("no styleMapping → undefined", () => {
    const c = { id: "c", header: "C", field: "v", type: "text", align: "left", sortable: true, isGroup: false, width: "auto" } as unknown as ColumnSpec;
    expect(resolveStyleMapping(row({}), 0, c, null)).toBeUndefined();
  });

  test("all-theme styleMapping → undefined (no fields touched)", () => {
    const c = col({ bold: { kind: "theme" }, color: { kind: "theme" } });
    expect(resolveStyleMapping(row({}), 0, c, null)).toBeUndefined();
  });

  test("bold via condition, color via field", () => {
    const c = col({
      bold: { kind: "condition", name: "sig" },
      color: { kind: "field", field: "rowColor" },
    });
    const b = banks([{ id: "sig", values: [false, true] }]);
    const out = resolveStyleMapping(row({ rowColor: "#900" }), 1, c, b);
    expect(out).toEqual({ bold: true, color: "#900" });
  });

  test("bare-string legacy form still works (back-compat)", () => {
    const c = col({ bold: "is_sig" });
    const out = resolveStyleMapping(row({ is_sig: true }), 0, c, null);
    expect(out).toEqual({ bold: true });
  });

  test("bold = condition without rowIndex returns undefined (defensive)", () => {
    const c = col({ bold: { kind: "condition", name: "sig" } });
    const b = banks([{ id: "sig", values: [true] }]);
    expect(resolveStyleMapping(row({}), undefined, c, b)).toBeUndefined();
  });

  test("sort scenario: condition follows original row identity", () => {
    // Two rows; condition[orig 0] = true. After "sorting" the
    // resolver is called with the canonical row index, so the
    // condition value still resolves correctly regardless of
    // display order.
    const c = col({ bold: { kind: "condition", name: "sig" } });
    const b = banks([{ id: "sig", values: [true, false] }]);
    expect(resolveStyleMapping(row({}, "a"), 0, c, b)).toEqual({ bold: true });
    expect(resolveStyleMapping(row({}, "b"), 1, c, b)).toBeUndefined();
  });
});
