// Boot-coverage gate (2026-06-11). THE recurrence guard for the
// boot-split bug class: renderer registration is split across two boot
// files (init.ts = V8-safe, init-dom.ts = +Svelte), and for months six
// column types (pvalue/reference/range/img/bar/heatmap) had svg
// renderers that ONLY the dom boot registered — every headless export
// silently fell back to plain text, and nothing failed.
//
// This test boots ONLY init.ts (exactly what the V8 export bundle gets)
// and asserts every concrete schema type either resolves an svg
// renderer through its inheritance chain or is on the EXPLICIT
// text-is-correct allowlist. Adding a column type with an svg renderer
// registered only in init-dom fails here.

import { describe, it, expect } from "bun:test";
import { bootBuiltinBehaviors } from "./init"; // the V8 boot — NOT init-dom
import { SCHEMA_REGISTRY } from "./columns/index";
import { getRenderer } from "./extend";
import { resolveSchema } from "./resolve";
import { SVG_TEXT_IS_CORRECT, OVERLAY_RENDERED } from "./coverage-rosters";

bootBuiltinBehaviors();


function svgRendererFor(key: string): unknown {
  // Walk the inheritance chain the way dispatch.renderCell does.
  const chain = resolveSchema(SCHEMA_REGISTRY[key as keyof typeof SCHEMA_REGISTRY] as never) as { key?: string; type?: string }[];
  for (const link of chain) {
    const k = (link as { key?: string }).key;
    if (k && getRenderer(k, "svg")) return getRenderer(k, "svg");
  }
  return null;
}

describe("V8 boot renderer coverage (boot-split recurrence guard)", () => {
  const concrete = Object.entries(SCHEMA_REGISTRY)
    .filter(([, s]) => !(s as { abstract?: boolean }).abstract);

  it("covers every concrete type: svg renderer in the V8 boot, or allowlisted text", () => {
    const uncovered: string[] = [];
    for (const [key] of concrete) {
      if (SVG_TEXT_IS_CORRECT.has(key) || OVERLAY_RENDERED.has(key)) continue;
      if (!svgRendererFor(key)) uncovered.push(key);
    }
    expect(uncovered, `types with NO svg renderer in the V8 boot (export silently degrades to text): ${uncovered.join(", ")} — register the svg half from init.ts (see visual-svg-renderers.ts) or allowlist with justification`).toEqual([]);
  });

  it("the six 2026-06-11 casualties stay covered", () => {
    for (const key of ["pvalue", "reference", "range", "img", "bar", "heatmap"]) {
      expect(svgRendererFor(key), key).not.toBeNull();
    }
  });
});
