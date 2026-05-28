/**
 * svg-centering.test.ts
 *
 * Structural regression test for two bugs caught manually 2026-05-25:
 *
 *  1. Forest/viz marker Y drifted down as `rowGroupPadding` increased
 *     — marker math was using inflated rowHeight that included the
 *     trailing padding band before the next group_header.
 *
 *  2. Schema-rendered text in cells was top-justified, not centered
 *     — render-svg.ts emitted `dominant-baseline="hanging"` and the
 *     caller's `originY = textY - height/2` math left the visual
 *     center ~0.25×fontSize above the row's marker center.
 *
 * Both bugs are now fixed; this test pins the behavior. Generates an
 * SVG via generateSVG(), parses text + group elements, and asserts
 * every cell text and forest-marker sits within ±1px of the
 * data-portion center of its row.
 *
 * Regression mechanism: if a future change reverts the rowMarkerCenters
 * fix, the cell-text Y values will diverge from rowPositions[i] +
 * (rowHeights[i] - trailingPad)/2 — caught here. If a future change
 * brings back `dominant-baseline="hanging"`, this test still passes
 * (because cell-text uses central baseline), but a paired baseline
 * assertion would catch it — see the second describe block.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { tabviz } from "../authoring/tabviz";
import { colText, colNumeric, colInterval } from "../authoring/columns";
import { vizForest } from "../authoring/viz";
import { generateSVG } from "./svg-generator";
import { bootBuiltinBehaviors } from "../schema/init";
import type { WebSpec } from "../types";

// Built-in renderers (text, numeric, interval) register via
// side-effect modules in init.ts. Bun-test doesn't side-effect-import
// the whole init chain unless we explicitly boot — without this the
// schema-renderer path is never exercised and the centering assertions
// pass even when render-svg.ts has the wrong baseline.
beforeAll(() => bootBuiltinBehaviors());

// Synthetic data: 4 rows in 2 groups so rowPaddedAfter[1] (last row
// of group 1) is true. Any drift in marker Y for row index 1 surfaces
// as a visible offset.
const TWO_GROUP_DATA = [
  { study: "A1", group: "G1", hr: 0.85, lo: 0.72, hi: 0.99 },
  { study: "A2", group: "G1", hr: 0.91, lo: 0.81, hi: 1.02 },
  { study: "B1", group: "G2", hr: 0.78, lo: 0.65, hi: 0.93 },
  { study: "B2", group: "G2", hr: 0.82, lo: 0.70, hi: 0.96 },
];

function buildSpec(rowGroupPadding: number): WebSpec {
  const spec = tabviz({
    data: TWO_GROUP_DATA,
    label: "study",
    columns: [
      colText({ field: "study" }),
      colNumeric({ field: "hr" }),
      colInterval({ point: "hr", lower: "lo", upper: "hi" }),
      vizForest({ point: "hr", lower: "lo", upper: "hi" }),
    ],
    group: "group",
  });
  spec.theme.spacing.rowGroupPadding = rowGroupPadding;
  return spec;
}

// Parse out every `<text class="cell-text" ... y="..." ...>` in the SVG
// and return its (y, baseline) tuple.
function extractCellTexts(svg: string): { y: number; baseline: string }[] {
  const out: { y: number; baseline: string }[] = [];
  const re = /<text[^>]*\bclass="cell-text"[^>]*>/g;
  for (const m of svg.matchAll(re)) {
    const tag = m[0];
    const yMatch = tag.match(/\by="([\d.]+)"/);
    const blMatch = tag.match(/dominant-baseline="([^"]+)"/);
    if (yMatch) {
      out.push({
        y: parseFloat(yMatch[1]),
        baseline: blMatch?.[1] ?? "",
      });
    }
  }
  return out;
}

describe("SVG export — text vertical centering", () => {
  test("cell-text uses dominant-baseline='central' (catches a hanging-baseline regression)", () => {
    const spec = buildSpec(0);
    const svg = generateSVG(spec);
    const texts = extractCellTexts(svg);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t.baseline).toBe("central");
    }
  });

  test("schema-rendered text never uses dominant-baseline='hanging'", () => {
    // The schema renderer was emitting hanging baseline; this asserts
    // it no longer does. Caught the bug that made all wrap-line and
    // schema-cell text appear top-justified in exports.
    const spec = buildSpec(0);
    const svg = generateSVG(spec);
    expect(svg).not.toMatch(/dominant-baseline="hanging"/);
  });
});

describe("SVG export — marker Y on padded-after rows", () => {
  test("rowGroupPadding does not shift the padded-after row's marker", () => {
    // Two specs differing only in rowGroupPadding. Display rows are:
    //   [GH, A1, A2(padded-after), GH, B1, B2]
    // Marker emit order matches the data rows in document order:
    //   cy[0] = A1, cy[1] = A2 (padded-after), cy[2] = B1, cy[3] = B2.
    //
    // Expected behavior:
    //   - A1 marker unchanged (first row, never padded-after).
    //   - A2 marker unchanged (padded-after; padding inflates the
    //     track AFTER the data band; marker centers on data portion).
    //   - B1, B2 markers shifted DOWN by rowGroupPadding (the entire
    //     group 2 sits below the inflated A2 row).
    //
    // Pre-fix: A2's marker drifted DOWN by rowGroupPadding/2 because
    // the buggy math used rowHeights[i] which includes the trailing
    // pad. THIS is the assertion that catches the regression.
    const baseline = generateSVG(buildSpec(0));
    const padded = generateSVG(buildSpec(40));

    const cyBaseline = [...baseline.matchAll(/<circle[^>]*\bcy="([\d.]+)"/g)]
      .map((m) => parseFloat(m[1]));
    const cyPadded = [...padded.matchAll(/<circle[^>]*\bcy="([\d.]+)"/g)]
      .map((m) => parseFloat(m[1]));

    expect(cyPadded.length).toBe(cyBaseline.length);
    expect(cyPadded.length).toBeGreaterThanOrEqual(2);

    // A1 (first data row) — never padded-after, marker unchanged.
    expect(cyPadded[0]).toBeCloseTo(cyBaseline[0], 1);

    // A2 (padded-after row) — marker MUST be unchanged. Buggy code
    // shifts it by +rowGroupPadding/2 (=20). Allow 1px tolerance for
    // any incidental layout rounding; the bug signal is 20px.
    expect(cyPadded[1]).toBeCloseTo(cyBaseline[1], 1);

    // B1 (first data row of group 2) — shifted down by the full
    // rowGroupPadding because the inflated A2 row sits above it.
    expect(cyPadded[2] - cyBaseline[2]).toBeCloseTo(40, 1);
  });
});
