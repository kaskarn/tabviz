// generateSVG robustness + validation contract. The "any language / LLM can
// drive it" vision means a degenerate-but-VALID wire spec must degrade
// gracefully (emit an SVG, never crash), while a STRUCTURALLY-INVALID spec must
// fail with a CLEAR, intentional error — not a cryptic deep-stack crash.
// Vitest (not bun): buildTheme pulls oklch → @stdlib.

import { describe, test, expect, beforeAll } from "vitest";
import { generateSVG } from "./svg-generator";
import { bootBuiltinBehaviors } from "../schema/init";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";

let theme: ReturnType<typeof buildTheme>;
beforeAll(() => {
  bootBuiltinBehaviors();
  theme = buildTheme(NEJM, "nejm");
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base = (over: any): any => ({
  version: "1.0", data: { rows: [], groups: [], summaries: [] },
  columns: [], theme, interaction: {}, layout: {}, ...over,
});

describe("generateSVG — degenerate-but-valid specs degrade gracefully", () => {
  const cases: [string, () => unknown][] = [
    ["empty data + no columns", () => base({})],
    ["data rows but zero columns", () => base({ data: { rows: [{ id: "r0", label: "A", metadata: { x: 1 } }], groups: [], summaries: [] } })],
    ["columns but zero rows", () => base({ columns: [{ id: "c", type: "text", field: "x", header: "X", options: {} }] })],
    ["row missing metadata", () => base({ columns: [{ id: "c", type: "text", field: "x", header: "X", options: {} }], data: { rows: [{ id: "r0", label: "A" }], groups: [], summaries: [] } })],
    ["forest column with no forest data", () => base({ columns: [{ id: "f", type: "forest", field: "hr", header: "HR", options: { forest: { point: "hr", lower: "lo", upper: "hi" } } }], data: { rows: [{ id: "r0", label: "A", metadata: {} }], groups: [], summaries: [] } })],
  ];
  for (const [name, mk] of cases) {
    test(name, () => {
      const svg = generateSVG(mk() as never, { width: 400 });
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(100);
    });
  }

  // Degenerate axis domain (rangeMin == rangeMax / xDomain [v,v]) once made the
  // pure-JS linear/log scale divide by zero → ±Infinity/NaN marker coordinates
  // (a blank/broken plot, no DOM fallback). The scale now collapses to the
  // range midpoint. Gate: no non-finite numbers reach the SVG attributes.
  test("zero-width axis domain emits finite coordinates (no NaN/Infinity)", () => {
    const spec = base({
      columns: [{ id: "f", type: "forest", field: "hr", header: "HR",
        options: { forest: { point: "hr", lower: "lo", upper: "hi" } } }],
      data: { rows: [
        { id: "r0", label: "A", metadata: { hr: 1, lo: 1, hi: 1 } },
        { id: "r1", label: "B", metadata: { hr: 1, lo: 1, hi: 1 } },
      ], groups: [], summaries: [] },
    });
    for (const scale of [undefined, "log" as const]) {
      const opts = { width: 400, xDomain: [1, 1] as [number, number],
        ...(scale ? { forestScale: scale } : {}) };
      const svg = generateSVG(spec as never, opts as never);
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe("generateSVG — structurally invalid specs throw a CLEAR error", () => {
  const cases: [string, () => unknown, RegExp][] = [
    ["null theme", () => base({ theme: null }), /theme/],
    ["missing data.rows", () => base({ data: { groups: [], summaries: [] } }), /data\.rows/],
    ["not an object", () => null, /expected an object/],
    ["missing data", () => base({ data: undefined }), /data/],
  ];
  for (const [name, mk, re] of cases) {
    test(name, () => {
      expect(() => generateSVG(mk() as never, { width: 400 })).toThrow(re);
    });
  }
});
