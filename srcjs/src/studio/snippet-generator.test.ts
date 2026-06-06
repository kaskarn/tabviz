// Snippet-contract gate (R3 studio effectiveness F1/F2 closure).
//
// The studio's core contract is "forge a theme, walk away with working R
// code." Two breaks shipped: (a) the base-expression map went stale at
// 18/27 presets, so the 9 newest emitted the literal `your_theme` (an R
// error); (b) the diff generator silently dropped effects / geometry /
// ink2 / header_style edits — the chart changed, the snippet didn't.
// This gate pins both: full preset coverage, and a no-silent-drop
// battery over every editable input family.

import { describe, it, expect } from "bun:test";
import { buildSnippetSteps, buildBaseExpression, describeInputsEdit, formatSnippet } from "./snippet-generator";
import { PRESETS } from "../lib/theme/theme-presets-inputs";
import type { ThemeInputs } from "../types/theme-inputs";

const base: ThemeInputs = PRESETS["cochrane"]!;

describe("buildBaseExpression — preset coverage", () => {
  it("every shipped preset maps to its web_theme_*() constructor", () => {
    for (const name of Object.keys(PRESETS)) {
      const expr = buildBaseExpression(name);
      expect(expr).toBe(`web_theme_${name}()`);
    }
  });

  it("unknown names fall back without inventing a constructor", () => {
    expect(buildBaseExpression("not_a_preset")).toBe("your_theme");
  });
});

describe("buildSnippetSteps — no silent drops", () => {
  const cases: Array<[string, ThemeInputs, string]> = [
    ["brand anchor", { ...base, anchors: { ...base.anchors, brand: { L: 0.4, C: 0.12, H: 300 } } }, "set_brand"],
    ["ink2 anchor", { ...base, anchors: { ...base.anchors, ink2: { L: 0.45, C: 0.15, H: 25 } } }, "set_ink2"],
    ["header_style", { ...base, header_style: "bold" }, "set_header_style"],
    ["slot_style", { ...base, slot_style: "flat" as never }, "set_inputs"],
    ["geometry radius", { ...base, geometry: { ...base.geometry, radius: { ...(base.geometry?.radius ?? {}), md: 9 } } }, "set_geometry"],
    ["effects glow", { ...base, effects: { ...base.effects, glow_intensity: "subtle" } }, "set_effects"],
    ["effects elevation", { ...base, effects: { ...base.effects, elevation: "low" } }, "set_effects"],
    ["effects title_style", { ...base, effects: { ...base.effects, title_style: "bar" } }, "set_effects"],
    ["density", { ...base, density: "spacious" }, "set_density"],
    ["shell_mode", { ...base, shell_mode: "raised" }, "set_shell_mode"],
  ];
  for (const [label, edited, expectedSetter] of cases) {
    it(`${label} edit emits ${expectedSetter}`, () => {
      const steps = buildSnippetSteps(base, edited);
      expect(steps.map((s) => s.setter)).toContain(expectedSetter);
    });
  }

  it("anchors emit oklch() triples, not hex (LCH intent round-trips)", () => {
    const steps = buildSnippetSteps(base, {
      ...base,
      anchors: { ...base.anchors, brand: { L: 0.4, C: 0.12, H: 300 } },
    });
    const brand = steps.find((s) => s.setter === "set_brand")!;
    expect(brand.args).toMatch(/^oklch\(0\.4, 0\.12, 300\)$/);
  });

  it("formatSnippet chains base + steps", () => {
    const steps = buildSnippetSteps(base, { ...base, header_style: "bold" });
    const out = formatSnippet(buildBaseExpression("cochrane"), steps);
    expect(out).toBe('web_theme_cochrane() |> set_header_style("bold")');
  });
});

describe("describeInputsEdit — history labels", () => {
  it("names a single-setter edit by its setter", () => {
    expect(describeInputsEdit(base, { ...base, header_style: "bold" })).toBe("Header style");
    expect(describeInputsEdit(base, {
      ...base,
      anchors: { ...base.anchors, brand: { L: 0.4, C: 0.12, H: 300 } },
    })).toBe("Brand");
  });

  it("multi-setter edits report the first + a count", () => {
    const label = describeInputsEdit(base, {
      ...base,
      header_style: "bold",
      density: "spacious",
    });
    expect(label).toMatch(/\(\+\d+ more\)$/);
  });

  it("no-op edit falls back to the generic label", () => {
    expect(describeInputsEdit(base, { ...base })).toBe("Edit");
  });
});
