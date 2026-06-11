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

bootBuiltinBehaviors();

// Types whose svg output IS plain formatted text by design — the
// dispatch's text fallback is the correct renderer for them. Adding a
// type here is a DECISION (it means headless export shows text only);
// never add one to silence this gate without checking what the DOM does.
const TEXT_IS_CORRECT = new Set([
  "text", "numeric", "n", "currency", "percent", "date",
  "interval",   // interval has a registered text-composition renderer chain
  "events",     // composed text (n / N (%))
  "label",      // the label column is text
  "custom",     // user-registered: their responsibility, both targets
  // Overlay-rendered: forest/viz columns draw through the dedicated plot
  // overlay path in BOTH targets (svg-generator's forest/viz sections;
  // the DOM's <svg class="plot-overlay"> layers) — their grid CELLS are
  // intentionally empty, so no per-cell svg renderer exists or should.
  "viz_forest", "viz_bar", "viz_boxplot", "viz_violin",
]);

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
      if (TEXT_IS_CORRECT.has(key)) continue;
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
