// Filter + sort predicate coverage. This user-facing logic (funnel filters,
// column-header sort) had ZERO tests. Locks the predicate truth table + the
// missing/non-finite handling — including the NaN-in-`between` edge (NaN is
// typeof "number" but is in no range, so it must be EXCLUDED, matching gt/lt).

import { describe, test, expect } from "bun:test";
import { matchColumnFilter, applyFilters, applySort } from "./filter-sort-utils";
import type { Row, ColumnFilter, FiltersState, SortConfig } from "../types";

const row = (id: string, meta: Record<string, unknown>): Row =>
  ({ id, label: String(meta.name ?? id), metadata: meta }) as Row;

const f = (field: string, operator: string, value: unknown): ColumnFilter =>
  ({ field, operator, value }) as unknown as ColumnFilter;

describe("matchColumnFilter — predicate truth table", () => {
  test("contains: case-insensitive substring; null value never matches", () => {
    expect(matchColumnFilter(row("r", { s: "Semaglutide" }), f("s", "contains", "glut"))).toBe(true);
    expect(matchColumnFilter(row("r", { s: "Semaglutide" }), f("s", "contains", "XYZ"))).toBe(false);
    expect(matchColumnFilter(row("r", { s: null }), f("s", "contains", "a"))).toBe(false);
    // Numeric value coerces to string for contains.
    expect(matchColumnFilter(row("r", { n: 1234 }), f("n", "contains", "23"))).toBe(true);
  });

  test("eq / neq use strict equality", () => {
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "eq", 5))).toBe(true);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "eq", "5"))).toBe(false); // no coercion
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "neq", 6))).toBe(true);
  });

  test("gt / lt / gte / lte require both operands numeric; NaN excluded", () => {
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "gt", 3))).toBe(true);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "lt", 3))).toBe(false);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "gte", 5))).toBe(true);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "lte", 5))).toBe(true);
    // Non-numeric value or filter → false (never throws).
    expect(matchColumnFilter(row("r", { n: "x" }), f("n", "gt", 3))).toBe(false);
    expect(matchColumnFilter(row("r", { n: NaN }), f("n", "gt", 3))).toBe(false);
  });

  test("between: null bounds are open; NaN value is EXCLUDED (regression)", () => {
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "between", [1, 10]))).toBe(true);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "between", [6, 10]))).toBe(false);
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "between", [null, 10]))).toBe(true);  // open low
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "between", [1, null]))).toBe(true);   // open high
    expect(matchColumnFilter(row("r", { n: 5 }), f("n", "between", null))).toBe(true);        // no range → all
    // The bug: NaN passed because NaN<lo and NaN>hi are both false. Must exclude.
    expect(matchColumnFilter(row("r", { n: NaN }), f("n", "between", [1, 10]))).toBe(false);
  });

  test("in: membership; empty/absent array passes everything", () => {
    expect(matchColumnFilter(row("r", { s: "a" }), f("s", "in", ["a", "b"]))).toBe(true);
    expect(matchColumnFilter(row("r", { s: "c" }), f("s", "in", ["a", "b"]))).toBe(false);
    expect(matchColumnFilter(row("r", { s: "c" }), f("s", "in", []))).toBe(true);
  });

  test("empty / notEmpty treat null and '' as empty", () => {
    expect(matchColumnFilter(row("r", { s: "" }), f("s", "empty", null))).toBe(true);
    expect(matchColumnFilter(row("r", { s: null }), f("s", "empty", null))).toBe(true);
    expect(matchColumnFilter(row("r", { s: "x" }), f("s", "empty", null))).toBe(false);
    expect(matchColumnFilter(row("r", { s: "x" }), f("s", "notEmpty", null))).toBe(true);
    expect(matchColumnFilter(row("r", { s: 0 }), f("s", "notEmpty", null))).toBe(true); // 0 is not empty
  });
});

describe("applyFilters — AND across columns", () => {
  const rows = [
    row("0", { drug: "Sema", n: 100 }),
    row("1", { drug: "Lira", n: 50 }),
    row("2", { drug: "Sema", n: 30 }),
  ];
  test("no filters → all indices", () => {
    expect(applyFilters(rows, [0, 1, 2], {} as FiltersState)).toEqual([0, 1, 2]);
  });
  test("multiple filters AND together", () => {
    const state = { drug: f("drug", "eq", "Sema"), n: f("n", "gte", 50) } as unknown as FiltersState;
    expect(applyFilters(rows, [0, 1, 2], state)).toEqual([0]); // Sema AND n>=50 → only row 0
  });
});

describe("applySort — comparator ordering (col=undefined → bare field)", () => {
  const rows = [
    row("0", { n: 3 }),
    row("1", { n: 1 }),
    row("2", { n: NaN }),   // missing → end
    row("3", { n: 2 }),
    row("4", { n: null }),  // missing → end
  ];
  const cfg = (direction: "asc" | "desc"): SortConfig =>
    ({ column: "n", direction }) as unknown as SortConfig;

  test("ascending: numeric order, non-finite/null pushed to the END", () => {
    const out = applySort(rows, [0, 1, 2, 3, 4], cfg("asc"), undefined);
    // 1, 2, 3 then the two missing (order among missing is stable)
    expect(out.slice(0, 3)).toEqual([1, 3, 0]);
    expect(out.slice(3).sort()).toEqual([2, 4]);
  });

  test("descending flips finite order but missing STAY at the end", () => {
    const out = applySort(rows, [0, 1, 2, 3, 4], cfg("desc"), undefined);
    expect(out.slice(0, 3)).toEqual([0, 3, 1]); // 3, 2, 1
    expect(out.slice(3).sort()).toEqual([2, 4]); // missing still last
  });

  test("string columns sort via localeCompare", () => {
    const srows = [row("0", { s: "Charlie" }), row("1", { s: "alpha" }), row("2", { s: "Bravo" })];
    const out = applySort(srows, [0, 1, 2], { column: "s", direction: "asc" } as SortConfig, undefined);
    expect(out).toEqual([1, 2, 0]); // alpha, Bravo, Charlie (locale-aware, case-insensitive-ish)
  });
});
