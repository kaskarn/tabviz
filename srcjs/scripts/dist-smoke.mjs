#!/usr/bin/env node
//
// dist-smoke.mjs — verify the built artifact's named exports are
// runtime-importable from outside the build context. Catches the
// case where the build succeeds but the .mjs bundles produce
// unexpected import shapes (missing re-exports, dynamic-import
// fallbacks that break in older runtimes, etc.).
//
// Runs after `npm run build:npm`. Not a substitute for the user's
// actual integration tests, but a fast canary that fires before
// publish on shape-level regressions.

import * as core from "../dist/index.mjs";
import * as svelte from "../dist/svelte.mjs";
import * as exporters from "../dist/export.mjs";
import * as spec from "../dist/spec.mjs";
import * as extend from "../dist/extend.mjs";

// Smoke-test the extension surface end-to-end: define a toy schema,
// register it, build a tree with the public composition helpers, and
// confirm the resulting RenderNode shape matches the documented contract
// (ARCHITECTURE.md §"Extension patterns"). This catches breakage where
// the imports succeed but the helpers don't produce the right node
// shapes (regressions in compose/tag/text or the registry).
const toySchema = extend.defineSchema({
  key: "__smoke_toy",
  label: "Smoke toy",
  inherits: "base",
  options: [],
});
extend.registerColumnType({
  schema: toySchema,
  renderer: () => extend.compose(
    extend.tag(extend.text("hello"), ["smoke-marker"]),
    extend.text("world"),
    { sep: " " },
  ),
});
const toyRenderer = extend.getRenderer("__smoke_toy");
const toyTree = toyRenderer?.(null, {}, /** @type {any} */ ({}), {});
extend.__resetRuntimeRegistries();

const checks = [
  ["core.createTabviz", typeof core.createTabviz === "function"],
  ["core.createSplitTabviz", typeof core.createSplitTabviz === "function"],
  ["svelte.ForestPlot", svelte.ForestPlot != null],
  ["svelte.SplitForestPlot", svelte.SplitForestPlot != null],
  ["svelte.createForestStore", typeof svelte.createForestStore === "function"],
  ["svelte.createSplitForestStore", typeof svelte.createSplitForestStore === "function"],
  ["export.exportToSVG", typeof exporters.exportToSVG === "function"],
  ["export.exportToPNG", typeof exporters.exportToPNG === "function"],
  ["spec.CURRENT_VERSION", typeof spec.CURRENT_VERSION === "string"],
  ["spec.validateSpecVersion", typeof spec.validateSpecVersion === "function"],
  ["extend.defineSchema", typeof extend.defineSchema === "function"],
  ["extend.registerColumnType", typeof extend.registerColumnType === "function"],
  ["extend.compose", typeof extend.compose === "function"],
  ["extend.tag", typeof extend.tag === "function"],
  ["extend.text", typeof extend.text === "function"],
  ["extend roundtrip → renderer registered", toyRenderer != null],
  ["extend roundtrip → tree is group", toyTree?.kind === "group"],
  ["extend roundtrip → tag survives compose", JSON.stringify(toyTree).includes("smoke-marker")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} import checks passed.`);
