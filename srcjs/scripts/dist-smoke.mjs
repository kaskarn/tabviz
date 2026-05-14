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
