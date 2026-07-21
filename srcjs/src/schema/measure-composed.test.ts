// Composed-cell width measurement — the structural replacement for the
// retired COMPOSED_TEXT_BUFFER. Locks: (1) composed columns return a tree
// width, plain columns return null (caller keeps the flat path), (2) the
// width reflects per-node sizing + variant chrome, (3) top-K ranks rows by
// the cheap estimate so the widest tree is the one measured.

import { describe, test, expect } from "bun:test";
import { measureComposedColumnWidth, makeMeasureResolver } from "./measure-composed";
import { estimateTextWidth } from "../lib/width-utils";
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

  test("DOM component-cell column (pvalue → CellPvalue) → null, NOT 0 (regression)", () => {
    // pvalue's DOM renderer returns `component("CellPvalue")`; renderNodeToSvg
    // can't size a RenderComponent (width 0). Before the fix this returned 0
    // (not null), so the caller skipped the flat measure and the column fell to
    // the MIN floor → CLIPPED (the hero "P" column: 6.0×10⁻⁴*** truncated).
    const pvalueCol = {
      id: "p", header: "P", field: "p", type: "pvalue",
      align: "right", sortable: false, isGroup: false, width: "auto",
      options: { pvalue: { stars: true } },
    } as unknown as ColumnSpec;
    const cells: ComposedCandidate[] = [{ text: "6.0×10⁻⁴***", metadata: { p: 0.0006 }, bold: false }];
    const w = measureComposedColumnWidth(pvalueCol, cells, 14, resolver(), { target: "dom" });
    expect(w).toBeNull(); // bail to the flat path — never 0
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

  test("bold row measures WIDER when resolverFor is weight-aware (hero overall-summary overlap)", () => {
    // The export's overall-summary interval renders at BOLD_CELL_WEIGHT; its
    // glyphs are ~10-15% wider than regular. If resolverFor ignores `bold` the
    // tree is laid out at weight-400 advances but painted bold → spans overrun
    // and overlap (the reported hero bug). Assert the plumbing: a weight-aware
    // resolverFor (mirroring svg-generator's, family = serif) yields a strictly
    // wider measure for the SAME data when the row is bold.
    const boldAware = (bold: boolean) =>
      makeMeasureResolver(
        { major: 14, base: 14, minor: 10 },
        (text, px) => estimateTextWidth(text, px, bold ? 600 : 400, "serif"),
      );
    const data = { p: 0.86, l: 0.81, u: 0.91 };
    const regular = measureComposedColumnWidth(
      intervalCol(), [{ text: "0.86 (0.81, 0.91)", metadata: data, bold: false }],
      14, boldAware, { target: "svg" },
    )!;
    const bold = measureComposedColumnWidth(
      intervalCol(), [{ text: "0.86 (0.81, 0.91)", metadata: data, bold: true }],
      14, boldAware, { target: "svg" },
    )!;
    expect(bold).toBeGreaterThan(regular);
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
