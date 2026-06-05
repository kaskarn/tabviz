// Preset distinctness probe.
//
// For each of the "key visible" cssVars, list its value across all 22
// presets. Goal: detect presets that "look the same" because their key
// pigments are identical or near-identical.

import { PRESETS } from "../src/lib/theme/theme-presets-inputs.ts";
import { createWire } from "../src/lib/theme/theme-wire.ts";
import { resolveTheme } from "../src/lib/theme/resolve-theme.ts";

const presetNames = Object.keys(PRESETS);

// The cssVars an author would expect to differ per theme:
const KEY_VARS = [
  "--tv-surface-bg",
  "--tv-text",
  "--tv-accent",
  "--tv-header-fill-bg",
  "--tv-header-fill-fg",
  "--tv-text-body-family",
  "--tv-text-title-family",
  "--tv-spacing-row-height",
];

const cssVarsByPreset = {};
for (const name of presetNames) {
  const r = resolveTheme(createWire(PRESETS[name], name));
  cssVarsByPreset[name] = r.cssVars;
}

console.log("PRESET DISTINCTNESS — key cssVars across all 22 presets:\n");
for (const v of KEY_VARS) {
  console.log(`${v}`);
  const valueToPresets = new Map();
  for (const name of presetNames) {
    const val = cssVarsByPreset[name][v];
    if (!valueToPresets.has(val)) valueToPresets.set(val, []);
    valueToPresets.get(val).push(name);
  }
  const distinctCount = valueToPresets.size;
  console.log(`  ${distinctCount} distinct values across ${presetNames.length} presets`);
  for (const [val, presets] of valueToPresets) {
    if (presets.length > 1) {
      console.log(`  ⚠ ${String(val).slice(0, 50)} ← ${presets.join(", ")}`);
    }
  }
  console.log();
}

// Family/typography check — body font should vary
console.log("\n══ FONT DISTINCTNESS ══\n");
for (const fontVar of ["--tv-text-body-family", "--tv-text-title-family"]) {
  console.log(fontVar);
  for (const name of presetNames) {
    const v = cssVarsByPreset[name][fontVar];
    console.log(`  ${name.padEnd(18)} ${String(v).slice(0, 80)}`);
  }
  console.log();
}
