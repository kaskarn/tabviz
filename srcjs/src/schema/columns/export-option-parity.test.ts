// EXPORT-OPTION PARITY gate (deep-review honesty pass, 2026-06-16).
//
// The drift gate (drift.test.ts) checks only that an option's `consumedBy`
// array is NON-EMPTY — it CANNOT tell a DOM-only `renderCell` option from a
// DOM+SVG one. That blind spot hid a class of DOM↔export divergences where the
// SVG renderer silently ignored an option the DOM honored (badge `size`, range
// `thousandsSep`/`abbreviate`, pvalue `starsColor`).
//
// THE ANTI-RECURRENCE NET: this gate auto-iterates every render-affecting option
// of every fixtured column type, renders an SVG cell at the option's default vs
// a perturbed value, and asserts the SVG output CHANGES — i.e. the export reads
// it. An option the export legitimately ignores (a documented gap, or one only
// observable at a specific value the generic perturbation can't synthesize)
// must be listed in EXPORT_OPTION_GAPS *with a reason* — the honest ledger. A
// NEW DOM-only option then FAILS CI instead of shipping a silent divergence.

import { describe, test, expect } from "bun:test";
import { SCHEMA_REGISTRY } from "./index";
import { renderCell } from "../dispatch";
import { THEME_PRESETS } from "../../lib/theme/theme-presets";
import { __testing } from "./badge-renderer";
import { rangeSvgRenderer } from "./visual-svg-renderers";
import type { ColumnSpec, WebTheme } from "../../types";
import type { RenderNode, RenderText, RenderGroup, RenderContext } from "../render-types";
import "../init";

const theme = THEME_PRESETS.nejm as unknown as WebTheme;

// ── Explicit regression locks for the three bugs this gate was born from ──
const { computeBadgeGeometry } = __testing;
function textOf(node: RenderNode | null): string {
  if (!node) return "";
  if (node.kind === "text") return (node as RenderText).value;
  if (node.kind === "group") return (node as RenderGroup).children.map(textOf).join("");
  return "";
}
const rangeCtx = (row: Record<string, unknown>): RenderContext =>
  ({ cellWidth: 200, rowHeight: 20, row, target: "svg" }) as RenderContext;

describe("export-option parity — explicit regression locks", () => {
  test("badge `size`: sm renders a SMALLER font than base", () => {
    expect(computeBadgeGeometry("AB", "pill", theme, "sm").fontSize)
      .toBeLessThan(computeBadgeGeometry("AB", "pill", theme, "base").fontSize);
  });
  test("range `thousandsSep` reaches the export output", () => {
    const opts = (sep: string | false) => ({ range: { minField: "lo", maxField: "hi", decimals: 0, thousandsSep: sep } });
    expect(textOf(rangeSvgRenderer(null, opts(","), rangeCtx({ lo: 12000, hi: 34000 }), {}))).toContain("12,000");
    expect(textOf(rangeSvgRenderer(null, opts(false), rangeCtx({ lo: 12000, hi: 34000 }), {}))).not.toContain("12,000");
  });
  test("range NA: either bound missing → naText (matches CellRange)", () => {
    const opts = { range: { minField: "lo", maxField: "hi", decimals: 0 } };
    expect(textOf(rangeSvgRenderer(null, opts, { cellWidth: 200, rowHeight: 20, row: { lo: 5, hi: null }, target: "svg", naText: "n/a" } as RenderContext, {}))).toBe("n/a");
  });
});

// ── Schema-driven net ─────────────────────────────────────────────────────

/** A value + row + base bucket-options that make `renderCell` produce a real
 *  (non-NA) SVG render. Keyed by REGISTRY KEY (percent/currency share
 *  type="numeric", so type is ambiguous). Pure-format types (text / numeric /
 *  percent / currency) are intentionally absent: their format options are
 *  covered by the explicit range lock above + the per-renderer tests, and the
 *  numeric SVG path is verified honest. This gate targets the type-specific
 *  LEAF options of the VISUAL/COMPOSED cells — where DOM-only divergences hide. */
interface Fixture { value: unknown; row: Record<string, unknown>; opts: Record<string, unknown>; columnSummary?: { min: number; max: number }; }
const FIXTURES: Record<string, Fixture> = {
  badge:     { value: "OK", row: {}, opts: {} },
  bar:       { value: 50, row: {}, opts: {}, columnSummary: { min: 0, max: 100 } },
  progress:  { value: 50, row: {}, opts: {} },
  heatmap:   { value: 0.5, row: {}, opts: {}, columnSummary: { min: 0, max: 1 } },
  icon:      { value: "up", row: {}, opts: { mapping: { up: "arrow-up" } } },
  sparkline: { value: [1, 3, 2, 5, 4], row: {}, opts: {} },
  ring:      { value: 0.6, row: {}, opts: {} },
  // stars + pictogram intentionally omitted: their SVG render needs the
  // registry-glyph PATHS, which the bun unit env doesn't load (empty markup
  // here), and their appearance options are inherited from the glyph-cell
  // parent (not leaf `options`). Covered DOM-vs-SVG by `glyph-cell-parity`.
  interval:  { value: 1.2, row: { p: 1.2, l: 0.8, u: 1.6 }, opts: { point: "p", lower: "l", upper: "u", decimals: 2 } },
  range:     { value: null, row: { lo: 1234, hi: 98765 }, opts: { minField: "lo", maxField: "hi", decimals: 0 } },
  pvalue:    { value: 0.03, row: {}, opts: {} },
};

/** Options the SVG export legitimately does NOT reflect in a single isolated
 *  cell render. Each needs a reason. `<type>:<optKey>`. */
const EXPORT_OPTION_GAPS = new Set<string>([
  // Tracked export GAPS (DOM honors, export doesn't — arc-history 2026-06-16):
  "pvalue:starsColor",        // export draws plain stars, no rubrication color
  "pvalue:significantStyle",  // export draws no significance pill
  // VALUE-DEPENDENT — the render IS correct but the generic two-value
  // perturbation can't exercise it at the fixture value (covered by the type's
  // own renderer tests):
  "bar:maxValue",                // the fixture value saturates the bar at small maxValues
]);

// Column-level CHROME / LAYOUT / value-dependent options that don't change an
// isolated non-NA cell-CONTENT render tree (they affect the header, the cell
// wrapper's align/width, or only fire on NA / overflow). The gate measures the
// content tree, so these are out of scope — not divergences.
const CHROME_KEYS = new Set([
  "header", "headerAlign", "align", "width", "sortable", "wrap", "showHeader",
  "naText", "maxChars",
]);

// Two genuinely-DISTINCT explicit values for an option — render base at [0] vs
// perturbed at [1]. Two explicit values sidesteps the "unset == effective
// default" trap (a segmented option with a null declared default whose recipe
// resolves to segments[0] would otherwise perturb to a no-op). null ⇒ skip.
function twoValues(opt: { key: string; control?: string; default?: unknown; segments?: { value: unknown }[]; choices?: unknown[] }, fieldKeys: Set<string>): [unknown, unknown] | null {
  if (fieldKeys.has(opt.key) || CHROME_KEYS.has(opt.key) || /(^|[a-z])(Field|Col)$/.test(opt.key)) return null; // chrome / plumbing
  switch (opt.control) {
    case "toggle":  return [false, true];
    case "number":  { const a = typeof opt.default === "number" ? opt.default : 1; return [a, a + 13]; }
    case "text":    return ["Aa", "Zz"];
    case "segmented":
    case "select": {
      const vals = (opt.segments?.map((s) => s.value) ?? opt.choices ?? []);
      return vals.length >= 2 ? [vals[0], vals[vals.length - 1]] : null;
    }
    default: return null; // custom / field / color — not auto-perturbable
  }
}

const mkCol = (type: string, bucket: string, opts: Record<string, unknown>): ColumnSpec =>
  ({ id: "c", header: "H", field: "v", type, align: "left", sortable: false, isGroup: false, width: "auto",
     options: { [bucket]: opts } }) as unknown as ColumnSpec;

describe("export-option parity — schema-driven (every render option reaches the SVG)", () => {
  const cases: { handle: string; type: string; bucket: string; opt: { key: string; control?: string; default?: unknown; segments?: { value: unknown }[] }; fx: Fixture }[] = [];

  for (const [key, schema] of Object.entries(SCHEMA_REGISTRY)) {
    if (schema.abstract) continue;
    const fx = FIXTURES[key];
    if (!fx) continue; // pure-format / non-fixtured types — out of this gate's scope
    const fieldKeys = new Set((schema.slots ?? []).map((s) => s.key));
    // LEAF options only (the type's own appearance surface) — inherited
    // numeric-format options are covered by the explicit range lock.
    for (const opt of schema.options ?? []) {
      const cb = opt.consumedBy ?? [];
      if (!cb.includes("renderCell") && !cb.includes("formatValue")) continue;
      if (twoValues(opt as never, fieldKeys) === null) continue;
      cases.push({ handle: `${key}:${opt.key}`, type: schema.type ?? key, bucket: schema.bucket ?? key, opt: opt as never, fx });
    }
  }

  for (const c of cases) {
    const [a, b] = twoValues(c.opt as never, new Set())!;
    test(`${c.handle} (${c.opt.control}) changes the SVG render`, () => {
      const ctx = { cellWidth: 120, rowHeight: 24, row: { ...c.fx.row, v: c.fx.value }, target: "svg",
        theme, columnSummary: c.fx.columnSummary ?? null, naText: "" } as RenderContext;
      const render = (val: unknown) => JSON.stringify(renderCell(mkCol(c.type, c.bucket, { ...c.fx.opts, [c.opt.key]: val }), c.fx.value, ctx, theme.nodeRules, "svg"));
      const base = render(a);
      const pert = render(b);
      if (EXPORT_OPTION_GAPS.has(c.handle)) {
        // Documented gap: assert it DOESN'T change (so when the export DOES start
        // honoring it, this flips red and the stale gap entry is removed).
        expect(pert).toBe(base);
      } else {
        expect(pert, `SVG render ignores ${c.handle} — DOM↔export divergence, or add to EXPORT_OPTION_GAPS with a reason`).not.toBe(base);
      }
    });
  }

  test("fixture coverage: every visual/composed type has a fixture + cases", () => {
    const expected = ["badge", "bar", "progress", "heatmap", "icon", "sparkline", "ring", "interval", "range", "pvalue"];
    const covered = new Set(cases.map((c) => c.handle.split(":")[0]));
    const uncovered = expected.filter((t) => !covered.has(t));
    expect(uncovered, `visual types with no tested render options: ${uncovered.join(", ")}`).toEqual([]);
  });
});
