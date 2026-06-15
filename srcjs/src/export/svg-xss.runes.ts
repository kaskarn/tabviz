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
    columns: [
      { id: "name", type: "text", field: "name", header: "Name", options: {} },
      { id: "val", type: "bar", field: "val", header: "Val", options: { bar: { color: PAYLOAD } } },
    ],
    data: {
      groups: [],
      summaries: [],
      rows: [
        {
          id: "r0", label: "A", metadata: { name: "A", val: 50 },
          // Row background injection (core renderer egress).
          style: { bg: PAYLOAD },
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
});
