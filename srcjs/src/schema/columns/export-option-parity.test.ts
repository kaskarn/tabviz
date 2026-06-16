// EXPORT-OPTION PARITY gate (deep-review honesty pass, 2026-06-16).
//
// The drift gate (drift.test.ts) checks only that an option's `consumedBy`
// array is NON-EMPTY — it CANNOT tell a DOM-only `renderCell` option from a
// DOM+SVG one. That blind spot hid a class of DOM↔export divergences where the
// SVG renderer silently ignored an option the DOM honored:
//   · badge `size` (sm/base) — export rendered every badge base-sized.
//   · range `thousandsSep` / `abbreviate` — export showed `12000` for `12,000`.
//   · range "either bound missing → NA" — export showed the single present bound.
// (pvalue `starsColor` / `significantStyle` are a KNOWN remaining export gap —
//  the export draws plain stars text, no color/pill; tracked in the register.)
//
// This gate asserts the SVG RENDERER OUTPUT actually CHANGES when each fixed
// option toggles — i.e. the export reads it. Extend with one case per option
// any time you wire a renderCell option that affects pixels into the export.

import { describe, test, expect } from "bun:test";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./badge-renderer";
import { rangeSvgRenderer } from "./visual-svg-renderers";
import type { RenderNode, RenderText, RenderGroup, RenderContext } from "../render-types";
import "../init";

const theme = THEME_PRESETS.nejm;
const { computeBadgeGeometry } = __testing;

function textOf(node: RenderNode | null): string {
  if (!node) return "";
  if (node.kind === "text") return (node as RenderText).value;
  if (node.kind === "group") return (node as RenderGroup).children.map(textOf).join("");
  return "";
}

const rangeCtx = (row: Record<string, unknown>): RenderContext =>
  ({ cellWidth: 200, rowHeight: 20, row, target: "svg" }) as RenderContext;

describe("export-option parity — SVG renderer reads the option (not DOM-only)", () => {
  test("badge `size`: sm renders a SMALLER font than base", () => {
    const sm = computeBadgeGeometry("AB", "pill", theme, "sm");
    const base = computeBadgeGeometry("AB", "pill", theme, "base");
    expect(sm.fontSize).toBeLessThan(base.fontSize);
  });

  test("range `thousandsSep`: separator reaches the export output", () => {
    const opts = (sep: string | false) => ({ range: { minField: "lo", maxField: "hi", decimals: 0, thousandsSep: sep } });
    const withSep = textOf(rangeSvgRenderer(null, opts(","), rangeCtx({ lo: 12000, hi: 34000 }), {}));
    const without = textOf(rangeSvgRenderer(null, opts(false), rangeCtx({ lo: 12000, hi: 34000 }), {}));
    expect(withSep).toContain("12,000");
    expect(without).not.toContain("12,000");
    expect(withSep).not.toBe(without);
  });

  test("range `abbreviate`: abbreviation reaches the export output", () => {
    const opts = (ab: boolean) => ({ range: { minField: "lo", maxField: "hi", abbreviate: ab } });
    const abbr = textOf(rangeSvgRenderer(null, opts(true), rangeCtx({ lo: 1200, hi: 3400000 }), {}));
    const plain = textOf(rangeSvgRenderer(null, opts(false), rangeCtx({ lo: 1200, hi: 3400000 }), {}));
    expect(abbr).not.toBe(plain);
    expect(abbr.toUpperCase()).toMatch(/[KM]/); // 3.4M / 1.2K
  });

  test("range NA: either bound missing → naText (matches CellRange), not a partial bound", () => {
    const opts = { range: { minField: "lo", maxField: "hi", decimals: 0 } };
    const out = textOf(rangeSvgRenderer(null, opts, { cellWidth: 200, rowHeight: 20, row: { lo: 5, hi: null }, target: "svg", naText: "n/a" } as RenderContext, {}));
    expect(out).toBe("n/a");
  });
});
