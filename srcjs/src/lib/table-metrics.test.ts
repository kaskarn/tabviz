import { describe, test, expect } from "bun:test";
import {
  computeRowLayout,
  computeRowPaddedAfter,
  computeHeaderHeight,
  type RowLayoutInput,
} from "./table-metrics";
import type { DisplayRow } from "$types";

/**
 * Shared table-metrics helpers — behavior-preservation guard. These encode the
 * formulas the DOM + SVG backends previously hand-mirrored; pin them so the
 * extraction can't drift either backend.
 */

const data = (id: string, style?: Record<string, unknown>): DisplayRow =>
  ({ type: "data", row: { id, style: style ?? {} }, depth: 0 } as unknown as DisplayRow);
const group = (depth = 0): DisplayRow =>
  ({ type: "group_header", depth } as unknown as DisplayRow);

const base = (over: Partial<RowLayoutInput> = {}): RowLayoutInput => ({
  displayRows: [],
  wrapLineCounts: {},
  rowHeight: 24,
  rowGroupPadding: 0,
  dataLineHeightPx: 21,
  ...over,
});

describe("computeRowLayout", () => {
  test("plain data rows: uniform height, cumulative positions, centered markers", () => {
    const r = computeRowLayout(base({ displayRows: [data("a"), data("b"), data("c")] }));
    expect(r.rowHeights).toEqual([24, 24, 24]);
    expect(r.rowPositions).toEqual([0, 24, 48]);
    expect(r.rowMarkerCenters).toEqual([12, 36, 60]);
    expect(r.rowsHeight).toBe(72);
  });

  test("spacer is half-height", () => {
    const r = computeRowLayout(base({ displayRows: [data("a"), data("s", { type: "spacer" }), data("b")] }));
    expect(r.rowHeights).toEqual([24, 12, 24]);
  });

  test("wrap inflation: max(rowHeight, lineHeightPx*lines + 6)", () => {
    const r = computeRowLayout(base({
      displayRows: [data("a"), data("b")],
      wrapLineCounts: { b: 3 }, // 21*3 + 6 = 69
    }));
    expect(r.rowHeights).toEqual([24, 69]);
  });

  test("wrap of 2 lines that fits under rowHeight stays at rowHeight", () => {
    // 21*1 + 6 = 27 > 24 only when lines>1; lines=1 → no inflation
    const r = computeRowLayout(base({ displayRows: [data("a")], wrapLineCounts: { a: 1 } }));
    expect(r.rowHeights).toEqual([24]);
  });

  test("rowGroupPadding inflates the data row before a top-level group; marker excludes it", () => {
    // rows: data(a), data(b), group(0), data(c) — b is padded-after
    const rows = [data("a"), data("b"), group(0), data("c")];
    const r = computeRowLayout(base({ displayRows: rows, rowGroupPadding: 8 }));
    expect(r.rowHeights).toEqual([24, 32, 24, 24]); // b: 24+8
    // b's marker centers on the 24 data portion, not the 32 track:
    // pos[1]=24, (32-8)/2 = 12 → 36
    expect(r.rowMarkerCenters[1]).toBe(36);
  });

  test("spacer is not treated as the padded-after data row", () => {
    const rows = [data("a"), data("s", { type: "spacer" }), group(0)];
    const flags = computeRowPaddedAfter(rows);
    expect(flags).toEqual([true, false, false]); // a is padded, spacer skipped
  });

  test("nested (non-top-level) group headers do not trigger padding", () => {
    const rows = [data("a"), group(1), data("b")];
    expect(computeRowPaddedAfter(rows)).toEqual([false, false, false]);
  });
});

describe("computeHeaderHeight", () => {
  test("font-derived min when larger than theme value", () => {
    // ceil(14 * 1.05 * 1.5) + 6 = ceil(22.05)+6 = 23+6 = 29
    expect(computeHeaderHeight({ bodyFontPx: 14, themeHeaderHeight: 26, headerDepth: 1 })).toBe(29);
  });
  test("theme value wins when larger", () => {
    expect(computeHeaderHeight({ bodyFontPx: 14, themeHeaderHeight: 40, headerDepth: 1 })).toBe(40);
  });
  test("two-tier header doubles the min row", () => {
    // 29 * 2 = 58 > 26
    expect(computeHeaderHeight({ bodyFontPx: 14, themeHeaderHeight: 26, headerDepth: 2 })).toBe(58);
  });
});
