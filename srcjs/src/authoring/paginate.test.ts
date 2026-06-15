// TS↔R parity for pagination breakpoints. Each case MIRRORS a fixture in
// tests/testthat/test-paginate.R — same input, same expected pages — so the
// TS port (computePageBreaks) and R's compute_page_breaks() can't drift.

import { describe, test, expect } from "bun:test";
import { computePageBreaks } from "./paginate";
import { tabviz } from "./tabviz";
import { colText } from "./columns";

const ungrouped = (n: number): (string | null)[] => Array.from({ length: n }, () => null);
const grouped = (spec: [string, number][]): (string | null)[] =>
  spec.flatMap(([id, count]) => Array.from({ length: count }, () => id));
const sizes = (r: ReturnType<typeof computePageBreaks>): number[] =>
  r.pages.map((p) => p.endIdx - p.startIdx + 1);

describe("computePageBreaks — R parity (test-paginate.R fixtures)", () => {
  test("ungrouped even splits: 60 rows / 20 → 3 pages", () => {
    const r = computePageBreaks(ungrouped(60), { rows: 20, keepGroups: true, orphanMin: 0 });
    expect(r.nPages).toBe(3);
    expect(r.pages).toEqual([
      { startIdx: 0, endIdx: 19 },
      { startIdx: 20, endIdx: 39 },
      { startIdx: 40, endIdx: 59 },
    ]);
  });

  test("group integrity by default: A20/B25/C18/D10, rows 30 → [20,25,28]", () => {
    const r = computePageBreaks(
      grouped([["A", 20], ["B", 25], ["C", 18], ["D", 10]]),
      { rows: 30, keepGroups: true, orphanMin: 0 },
    );
    expect(r.nPages).toBe(3);
    expect(sizes(r)).toEqual([20, 25, 28]);
  });

  test("keep_groups=false splits across rows: all-but-last = 30, sum 73", () => {
    const r = computePageBreaks(
      grouped([["A", 20], ["B", 25], ["C", 18], ["D", 10]]),
      { rows: 30, keepGroups: false, orphanMin: 0 },
    );
    const s = sizes(r);
    expect(s.reduce((a, b) => a + b, 0)).toBe(73);
    expect(s.slice(0, -1).every((x) => x === 30)).toBe(true);
  });

  test("oversized group on its own page: A35/B15, rows 20 → [35,15]", () => {
    const r = computePageBreaks(
      grouped([["A", 35], ["B", 15]]),
      { rows: 20, keepGroups: true, orphanMin: 0 },
    );
    expect(sizes(r)).toEqual([35, 15]);
    expect(r.oversized).toEqual(["A"]);
  });

  test("orphan_min pulls rows back: 61 rows / 30, orphan 3 → [30,28,3]", () => {
    const r = computePageBreaks(ungrouped(61), { rows: 30, keepGroups: true, orphanMin: 3 });
    expect(sizes(r)).toEqual([30, 28, 3]);
  });

  test("orphan merge fallback: 14 rows / 12, orphan 10 → one 14-row page", () => {
    const r = computePageBreaks(ungrouped(14), { rows: 12, keepGroups: true, orphanMin: 10 });
    expect(r.nPages).toBe(1);
    expect(sizes(r)).toEqual([14]);
  });

  test("empty data → 0 pages", () => {
    expect(computePageBreaks([], { rows: 30, keepGroups: true, orphanMin: 3 }))
      .toEqual({ pages: [], nPages: 0, oversized: [] });
  });
});

describe("tabviz({ paginate }) integration", () => {
  const data = Array.from({ length: 60 }, (_, i) => ({ study: `s${i}` }));

  test("number shorthand precomputes the wire pages + defaults", () => {
    const spec = tabviz({ data, label: "study", columns: [colText({ field: "study" })], paginate: 20 });
    expect(spec.paginate?.rows).toBe(20);
    expect(spec.paginate?.keepGroups).toBe(true);   // default
    expect(spec.paginate?.orphanMin).toBe(3);       // default
    expect(spec.paginate?.pageLabel).toBe("x_of_y");
    expect(spec.paginate?.nPages).toBe(3);
    expect(spec.paginate?.pages).toEqual([
      { startIdx: 0, endIdx: 19 },
      { startIdx: 20, endIdx: 39 },
      { startIdx: 40, endIdx: 59 },
    ]);
  });

  test("options form honors overrides; no paginate arg → no paginate block", () => {
    const spec = tabviz({ data, label: "study", columns: [colText({ field: "study" })], paginate: { rows: 25, orphanMin: 0 } });
    expect(spec.paginate?.rows).toBe(25);
    expect(spec.paginate?.orphanMin).toBe(0);
    const plain = tabviz({ data, label: "study", columns: [colText({ field: "study" })] });
    expect(plain.paginate).toBeUndefined();
  });
});
