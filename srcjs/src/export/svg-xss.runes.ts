// XSS egress wall for exported SVG. The wire is UNTRUSTED (any language / LLM
// drives it) and the export is STRING-CONCATENATED (no DOM auto-escaping) then
// embedded into HTML/Quarto — so any spec-data color that reaches a fill/stroke
// attribute is a stored-XSS vector unless neutralized. This locks the egress
// escape across both the core renderer (row bg, cell text) and a schema cell
// renderer (viz_bar). Vitest (not bun): buildTheme/generateSVG pull @stdlib.

import { describe, test, expect, beforeAll } from "vitest";
import { generateSVG } from "./svg-generator";
import { bootBuiltinBehaviors } from "../schema/init";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";

// A color value that breaks OUT of a double-quoted attribute and injects an
// event handler — the canonical attribute-injection payload.
const PAYLOAD = '#abc" onmouseover="alert(1)';
// The live-handler form that only appears in output if the quotes survived RAW.
const BREAKOUT = 'onmouseover="alert(1)"';

let theme: ReturnType<typeof buildTheme>;
beforeAll(() => {
  bootBuiltinBehaviors();
  theme = buildTheme(NEJM, "nejm");
});

function mk() {
  return {
    version: "1.0",
    theme,
    interaction: {},
    layout: {},
    // Watermark color injection (spec.watermarkColor egress).
    watermark: "DRAFT",
    watermarkColor: PAYLOAD,
    columns: [
      { id: "name", type: "text", field: "name", header: "Name", options: {} },
      { id: "val", type: "bar", field: "val", header: "Val", options: { bar: { color: PAYLOAD } } },
      // Multi-effect forest column → the legend glyph uses effect.color (lib/legend.ts egress).
      { id: "hr", type: "forest", field: "hr", header: "HR", options: { forest: {
        point: "hr", lower: "lo", upper: "hi",
        effects: [
          { point: "hr", lower: "lo", upper: "hi", label: "X", color: PAYLOAD },
          { point: "hr", lower: "lo", upper: "hi", label: "Y", color: PAYLOAD },
        ],
      } } },
    ],
    data: {
      groups: [],
      summaries: [],
      rows: [
        {
          id: "r0", label: "A", metadata: { name: "A", val: 50, hr: 1, lo: 0.5, hi: 1.5 },
          // Row background + row-LABEL color injection (core renderer egresses).
          style: { bg: PAYLOAD, color: PAYLOAD },
          // Cell-text color injection (core renderer cell path).
          cellStyles: { name: { color: PAYLOAD } },
        },
      ],
    },
  } as never;
}

describe("generateSVG — untrusted color values cannot inject attributes", () => {
  test("payload reaches the SVG but escaped, never as a live handler", () => {
    const svg = generateSVG(mk(), { width: 400 });
    // The payload IS present (proves the vectors are exercised, not silently dropped)…
    expect(svg).toContain("&quot;");
    // …but the quote never survives raw, so no attribute breakout is possible.
    expect(svg).not.toContain(BREAKOUT);
    // Belt-and-suspenders: the raw quote-then-handler sequence is absent anywhere.
    expect(svg).not.toContain('" onmouseover');
  });

  // `theme.series[].fill/stroke` is spec-DATA when a hand-built wire (JS/V8/LLM)
  // sets a PRE-RESOLVED theme that never passed buildTheme's isValidHex gate.
  // generateSVG reads spec.theme directly, so these colors reach the forest CI
  // line / summary diamond / clip arrow SVG attributes — must escape at egress.
  test("pre-resolved theme.series colors cannot inject (forest line/diamond/arrow)", () => {
    // Poison the series AFTER buildTheme (mimics a wire that supplies series
    // colors directly), then render a forest with a normal + a summary row.
    const poisoned = { ...theme, series: [{ fill: PAYLOAD, stroke: PAYLOAD, shape: "diamond" }] } as never;
    const spec = {
      version: "1.0", theme: poisoned, interaction: {}, layout: {},
      columns: [
        { id: "lab", type: "text", field: "lab", header: "L", options: {} },
        { id: "hr", type: "forest", field: "hr", header: "HR",
          options: { forest: { point: "hr", lower: "lo", upper: "hi" } } },
      ],
      data: { groups: [], summaries: [],
        rows: [
          { id: "r0", label: "A", metadata: { lab: "A", hr: 1, lo: 0.5, hi: 1.5 } },
          { id: "s0", label: "Overall", metadata: { lab: "Overall", hr: 1, lo: 0.8, hi: 1.2 }, style: { summary: true } },
        ] },
    } as never;
    const svg = generateSVG(spec, { width: 400 });
    expect(svg).not.toContain(BREAKOUT);
    expect(svg).not.toContain('" onmouseover');
  });

  // Viz distribution renderers resolve each effect's marker style from
  // `effect.color` (spec DATA) into fill/stroke SVG attributes. viz_boxplot
  // escaped via fillSafe/strokeSafe, but viz_violin emitted `stroke=` RAW
  // (ms.stroke ?? lineColor) — a hole in the wall. Poison the effect colors and
  // assert every viz renderer neutralizes them.
  test("viz_violin / viz_boxplot effect colors cannot inject (fill + stroke)", () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const mkViz = (type: string, optKey: string) => ({
      version: "1.0", theme, interaction: {}, layout: {},
      columns: [
        { id: "lab", type: "text", field: "lab", header: "L", options: {} },
        { id: "v", type, field: "v", header: "V",
          options: { [optKey]: { effects: [
            { data: "a", label: "A", color: PAYLOAD },
            { data: "b", label: "B", color: PAYLOAD },
          ] } } },
      ],
      data: { groups: [], summaries: [],
        rows: [{ id: "r0", label: "A", metadata: { lab: "A", a: vals, b: vals } }] },
    } as never);
    for (const [type, key] of [["viz_violin", "vizViolin"], ["viz_boxplot", "vizBoxplot"]] as const) {
      const svg = generateSVG(mkViz(type, key), { width: 400 });
      expect(svg, type).not.toContain(BREAKOUT);
      expect(svg, type).not.toContain('" onmouseover');
    }
  });
});
