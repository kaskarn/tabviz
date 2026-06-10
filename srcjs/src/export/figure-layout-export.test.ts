/**
 * figure-layout-export.test.ts (interactivity review pass)
 *
 * WYSIWYG gate for `spec.figureLayout` in the STATIC export path: the
 * widget honors row-kind height pins / column width pins / column order,
 * and `generateSVG` (save_plot, V8, the in-widget download via
 * exportSpec) must honor the same block — a pinned figure that exports
 * unpinned silently reverts the user's arrangement.
 *
 * Also pins the untrusted-ingress contract: garbage kinds and absurd
 * magnitudes are sanitized through the SAME gate the store hydration
 * uses (sanitizeRowKindPins).
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { tabviz } from "../authoring/tabviz";
import { colText, colNumeric } from "../authoring/columns";
import { generateSVG } from "./svg-generator";
import { bootBuiltinBehaviors } from "../schema/init";
import { sanitizeRowKindPins } from "../lib/layout/row-kind-heights";
import type { WebSpec, FigureLayoutState } from "../types";

beforeAll(() => bootBuiltinBehaviors());

const DATA = [
  { study: "A1", group: "G1", hr: 0.85, n: 12 },
  { study: "A2", group: "G1", hr: 0.91, n: 34 },
  { study: "B1", group: "G2", hr: 0.78, n: 56 },
];

function buildSpec(figureLayout?: FigureLayoutState): WebSpec {
  const spec = tabviz({
    data: DATA,
    label: "study",
    group: "group",
    columns: [
      colText({ field: "study", header: "Study" }),
      colNumeric({ field: "hr", header: "HR" }),
      colNumeric({ field: "n", header: "N" }),
    ],
  });
  return figureLayout ? { ...spec, figureLayout } : spec;
}

function svgHeight(svg: string): number {
  const m = /<svg[^>]*height="([\d.]+)"/.exec(svg);
  if (!m) throw new Error("no height attr");
  return Number(m[1]);
}

describe("generateSVG honors spec.figureLayout", () => {
  test("row-kind height pins grow the exported figure", () => {
    const base = svgHeight(generateSVG(buildSpec()));
    const pinned = svgHeight(generateSVG(buildSpec({
      rowKindHeights: { data: 80 },
    })));
    // 3 data rows pinned to 80px — the export must be markedly taller.
    expect(pinned).toBeGreaterThan(base + 3 * 20);
  });

  test("garbage pins are sanitized, not rendered (shared ingress gate)", () => {
    const base = svgHeight(generateSVG(buildSpec()));
    const garbage = svgHeight(generateSVG(buildSpec({
      rowKindHeights: {
        datas: 500,            // unknown kind — dropped
        data: 1e9,             // clamped to 2000, not a 1e9px figure
        spacer: Number.NaN,    // dropped
      } as FigureLayoutState["rowKindHeights"],
    })));
    expect(garbage).toBeLessThan(base + 3 * 2100); // clamped, not 1e9
    expect(garbage).toBeGreaterThan(base);          // but the clamp applied
  });

  test("column width pins reach the export when no web-view widths given", () => {
    const narrow = generateSVG(buildSpec({ columnWidths: { numeric_n: 60 } }));
    const wide = generateSVG(buildSpec({ columnWidths: { numeric_n: 320 } }));
    const widthOf = (svg: string) => {
      const m = /<svg[^>]*width="([\d.]+)"/.exec(svg);
      return m ? Number(m[1]) : 0;
    };
    expect(widthOf(wide)).toBeGreaterThan(widthOf(narrow) + 150);
  });

  test("column order block reorders exported headers", () => {
    // Header text x-positions: with n before hr, the "N" header must
    // render left of "HR".
    const svg = generateSVG(buildSpec({
      columnOrder: { topLevel: ["label", "numeric_n", "numeric_hr"] },
    }));
    const headerX = (label: string): number => {
      const re = new RegExp(`<text[^>]*x="([\\d.]+)"[^>]*>${label}</text>`);
      const m = re.exec(svg);
      if (!m) throw new Error(`header ${label} not found`);
      return Number(m[1]);
    };
    expect(headerX("N")).toBeLessThan(headerX("HR"));
  });
});

describe("sanitizeRowKindPins (shared ingress)", () => {
  test("vocabulary + clamp + panel exclusion", () => {
    expect(sanitizeRowKindPins({
      data: 44.4, panel: 50, ghost: 10, spacer: -1, summary: 1e9,
    })).toEqual({ data: 44, summary: 2000 });
    expect(sanitizeRowKindPins(null)).toBeUndefined();
    expect(sanitizeRowKindPins([1, 2])).toBeUndefined();
    expect(sanitizeRowKindPins({ data: "40" })).toBeUndefined();
  });
});
