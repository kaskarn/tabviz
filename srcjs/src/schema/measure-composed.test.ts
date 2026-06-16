// Composed-cell width measurement — the structural replacement for the
// retired COMPOSED_TEXT_BUFFER. Locks: (1) composed columns return a tree
// width, plain columns return null (caller keeps the flat path), (2) the
// width reflects per-node sizing + variant chrome, (3) top-K ranks rows by
// the cheap estimate so the widest tree is the one measured.

import { describe, test, expect } from "bun:test";
import { measureComposedColumnWidth, makeMeasureResolver } from "./measure-composed";
import type { ComposedCandidate } from "./measure-composed";
import type { ColumnSpec } from "../types";
import "./init";

const intervalCol = (variant?: string): ColumnSpec =>
  ({
    id: "x", header: "X", field: "point", type: "interval",
    align: "left", sortable: false, isGroup: false, width: "auto",
    options: { interval: { point: "p", lower: "l", upper: "u", decimals: 2, ...(variant ? { variant } : {}) } },
  }) as unknown as ColumnSpec;

const textCol = (): ColumnSpec =>
  ({
    id: "t", header: "T", field: "name", type: "text",
    align: "left", sortable: false, isGroup: false, width: "auto", options: {},
  }) as unknown as ColumnSpec;

const cand = (p: number, l: number, u: number, text = `${p} (${l}, ${u})`): ComposedCandidate =>
  ({ text, metadata: { p, l, u }, bold: false });

// Estimator-backed resolver (no Canvas in bun) — matches the V8 export path.
const resolver = () => () => makeMeasureResolver({ major: 14, base: 14, minor: 10 });

describe("measureComposedColumnWidth", () => {
  test("interval column → non-null tree width", () => {
    const w = measureComposedColumnWidth(
      intervalCol(), [cand(0.85, 0.72, 0.99)], 14, resolver(), { target: "svg" },
    );
    expect(w).not.toBeNull();
    expect(w!).toBeGreaterThan(0);
  });

  test("plain text column → null (caller keeps the flat path)", () => {
    const cells: ComposedCandidate[] = [{ text: "hello world", metadata: { name: "hello world" }, bold: false }];
    const w = measureComposedColumnWidth(textCol(), cells, 14, resolver(), { target: "svg" });
    expect(w).toBeNull();
  });

  test("empty candidate set → null", () => {
    expect(measureComposedColumnWidth(intervalCol(), [], 14, resolver(), { target: "svg" })).toBeNull();
  });

  test("wider content yields wider measure (monotone in row content)", () => {
    const narrow = measureComposedColumnWidth(
      intervalCol(), [cand(0.1, 0.1, 0.2)], 14, resolver(), { target: "svg" },
    )!;
    const wide = measureComposedColumnWidth(
      intervalCol(), [cand(123.45, 100.11, 199.99)], 14, resolver(), { target: "svg" },
    )!;
    expect(wide).toBeGreaterThan(narrow);
  });

  test("measures the WIDEST row even when it is not first (top-K rank)", () => {
    const rows = [
      cand(0.1, 0.1, 0.2),
      cand(0.2, 0.1, 0.3),
      cand(1234.5, 1000.1, 1999.9), // widest, last
    ];
    const all = measureComposedColumnWidth(intervalCol(), rows, 14, resolver(), { target: "svg" })!;
    const justWide = measureComposedColumnWidth(
      intervalCol(), [rows[2]!], 14, resolver(), { target: "svg" },
    )!;
    expect(all).toBeCloseTo(justWide, 5);
  });

  test("plus_minus variant measures its ± chrome (variant-aware)", () => {
    // The plus_minus tree renders "0.85 ± 0.14" — a different string/width than
    // the traditional "(lower, upper)" tree for the same data.
    const trad = measureComposedColumnWidth(
      intervalCol("traditional"), [cand(0.85, 0.72, 0.99)], 14, resolver(), { target: "svg" },
    )!;
    const pm = measureComposedColumnWidth(
      intervalCol("plus_minus"), [cand(0.85, 0.72, 0.99)], 14, resolver(), { target: "svg" },
    )!;
    expect(trad).toBeGreaterThan(0);
    expect(pm).toBeGreaterThan(0);
    expect(pm).not.toBeCloseTo(trad, 0); // distinct layouts → distinct widths
  });
});
