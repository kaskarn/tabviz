// Manifest coverage probe.
//
// For every preset, run resolveTheme(createWire(inputs, name)) and inspect
// the resulting cssVars map against the manifest. Print:
//   - per-preset undefined entries (manifest declared, resolver didn't emit)
//   - per-preset placeholder entries (resolver emitted "<...>" sentinel)
//   - cross-preset identical entries (same value across all 21 presets —
//     suggests a hardcoded default rather than a per-theme resolution)
//
// Run from srcjs/: bun run scripts/probe-manifest-coverage.mjs

import { PRESETS } from "../src/lib/theme/theme-presets-inputs.ts";
import { createWire } from "../src/lib/theme/theme-wire.ts";
import { resolveTheme } from "../src/lib/theme/resolve-theme.ts";
import { COMPONENT_TOKENS, isV3BridgeToken } from "../src/lib/theme/component-tokens.ts";

const presetNames = Object.keys(PRESETS);
const cssVarsByPreset = {};
for (const name of presetNames) {
  const wire = createWire(PRESETS[name], name);
  const r = resolveTheme(wire);
  cssVarsByPreset[name] = r.cssVars;
}

// ── 1. Per-preset undefined entries
console.log("\n═══ UNDEFINED ENTRIES (manifest declared, resolver omitted) ═══\n");
let totalUndef = 0;
for (const name of presetNames) {
  const cv = cssVarsByPreset[name];
  const undef = [];
  for (const token of COMPONENT_TOKENS) {
    if (cv[token.cssVar] === undefined) {
      undef.push(token.cssVar);
    }
  }
  if (undef.length > 0) {
    console.log(`${name}: ${undef.length} undefined`);
    for (const v of undef) console.log(`  ${v}`);
    totalUndef += undef.length;
  }
}
console.log(`\nTotal undefined cells: ${totalUndef}`);

// ── 2. Placeholder entries (started with "<")
console.log("\n═══ PLACEHOLDER ENTRIES (sentinel values, excl. v3-bridge) ═══\n");
const v3BridgeVars = new Set(COMPONENT_TOKENS.filter(isV3BridgeToken).map(t => t.cssVar));
let totalPlaceholder = 0;
for (const name of presetNames) {
  const cv = cssVarsByPreset[name];
  const ph = [];
  for (const [k, v] of Object.entries(cv)) {
    if (v3BridgeVars.has(k)) continue; // expected sentinel
    if (typeof v === "string" && v.startsWith("<")) {
      ph.push(`${k} = ${v}`);
    }
  }
  if (ph.length > 0) {
    console.log(`${name}: ${ph.length} placeholders`);
    for (const e of ph) console.log(`  ${e}`);
    totalPlaceholder += ph.length;
  }
}
console.log(`\nTotal placeholder cells: ${totalPlaceholder}`);

// ── 3. Cross-preset identical entries
// A token whose value is identical across all 21 presets is suspicious —
// might mean a hardcoded const, or it might be a structural/semantic
// constant ("transparent", "1px"). Manual review per row.
console.log("\n═══ CROSS-PRESET IDENTICAL VALUES (suspicious — should differ per theme) ═══\n");
const identicalVars = [];
for (const token of COMPONENT_TOKENS) {
  const values = new Set();
  for (const name of presetNames) {
    values.add(cssVarsByPreset[name][token.cssVar]);
  }
  if (values.size === 1) {
    const v = [...values][0];
    identicalVars.push({ cssVar: token.cssVar, value: v, tier: token.source.tier });
  }
}
// Categorize: const / transparent / spacing-px etc. are expected to be
// identical; role/anchor-based ones differing only by mode are suspect.
const sus = identicalVars.filter(e => {
  if (e.tier === "const") return false;
  if (e.value === "transparent") return false;
  if (typeof e.value === "string" && /^\d+(\.\d+)?(px|em|rem)?$/.test(e.value)) return false;
  if (typeof e.value === "string" && e.value === "normal") return false;
  if (typeof e.value === "string" && e.value === "italic") return false;
  if (typeof e.value === "string" && e.value === "tnum") return false;
  return true;
});
console.log(`${identicalVars.length} cssVars are identical across all ${presetNames.length} presets.`);
console.log(`Of those, ${sus.length} look suspicious (not const/transparent/spacing):`);
for (const e of sus) {
  console.log(`  ${e.cssVar.padEnd(40)} = ${String(e.value).slice(0, 60)}  (tier: ${e.tier})`);
}

// ── 4. Per-preset summary
console.log("\n═══ PER-PRESET SUMMARY ═══\n");
for (const name of presetNames) {
  const cv = cssVarsByPreset[name];
  const filled = Object.values(cv).filter(v => v !== undefined && !String(v).startsWith("<")).length;
  console.log(`${name.padEnd(20)} ${filled} / ${COMPONENT_TOKENS.length} cssVars filled`);
}

console.log("\nDone.\n");
