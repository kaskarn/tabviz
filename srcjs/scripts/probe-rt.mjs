// Why does --tv-accent-default come back undefined when we feed
// resolveTheme via getCssVars(R-emitted blob), but exist when we feed
// resolveTheme(createWire(PRESETS[name], name))?

import { PRESETS } from "../src/lib/theme/theme-presets-inputs.ts";
import { createWire } from "../src/lib/theme/theme-wire.ts";
import { resolveTheme } from "../src/lib/theme/resolve-theme.ts";

// Path A — direct TS preset
const wireA = createWire(PRESETS["nejm"], "nejm");
const rA = resolveTheme(wireA);
console.log("Path A (TS preset) keys mentioning accent:");
for (const k of Object.keys(rA.cssVars)) if (k.includes("accent")) {
  console.log(`  ${k} = ${rA.cssVars[k]}`);
}

// Path B — simulate R wire shape
import { execSync } from "node:child_process";
const blobJson = execSync(
  "Rscript -e 'devtools::load_all(quiet=TRUE); t<-web_theme_nejm(); blob<-tabviz:::serialize_theme(t); cat(jsonlite::toJSON(blob$authoringInputs, auto_unbox=TRUE, null=\"null\", na=\"null\"))'",
  { cwd: "/Users/antoine/dev/r/forest", encoding: "utf8" }
);
const inputs = JSON.parse(blobJson);
console.log("\nR-emitted authoringInputs top-level:", Object.keys(inputs));
console.log("anchors:", inputs.anchors);

const wireB = createWire(inputs, "nejm");
const rB = resolveTheme(wireB);
console.log("\nPath B (R-emitted inputs) keys mentioning accent:");
for (const k of Object.keys(rB.cssVars)) if (k.includes("accent")) {
  console.log(`  ${k} = ${rB.cssVars[k]}`);
}

// Diff the two cssVars maps key-set
const keysA = new Set(Object.keys(rA.cssVars));
const keysB = new Set(Object.keys(rB.cssVars));
const inAnotB = [...keysA].filter(k => !keysB.has(k));
const inBnotA = [...keysB].filter(k => !keysA.has(k));
console.log(`\nKeys in A but not B: ${inAnotB.length}`);
for (const k of inAnotB.slice(0, 20)) console.log(`  ${k}`);
console.log(`Keys in B but not A: ${inBnotA.length}`);
for (const k of inBnotA.slice(0, 20)) console.log(`  ${k}`);

// Value diff
let valDiffs = 0;
for (const k of keysA) if (keysB.has(k) && rA.cssVars[k] !== rB.cssVars[k]) {
  if (valDiffs < 10) console.log(`  ${k}: A=${rA.cssVars[k]} | B=${rB.cssVars[k]}`);
  valDiffs++;
}
console.log(`\nTotal value mismatches between A and B: ${valDiffs}`);
