// One-shot classifier for wire-audit Pass 0d-i.
// Replicates resolveTokenValue's EXACT waterfall order to derive each
// manifest entry's resolverGroup. Output: cssVar<TAB>group lines.
// Run: bun scripts/classify-resolver-groups.mjs

import {
  COMPONENT_TOKENS,
  isV3BridgeToken,
} from "../src/lib/theme/component-tokens.ts";
import { shellPaperKeyForCssVar } from "../src/lib/theme/shell-paper.ts";
import { elevationKeyForCssVar } from "../src/lib/theme/elevation.ts";
import { textureKeyForCssVar } from "../src/lib/theme/textures.ts";

const HC_FIDELITY = new Set([
  "--tv-hc-caret-char",
  "--tv-hc-ring-width",
  "--tv-hc-bar-width",
]);
const BROWSER_FX = new Set([
  "--tv-brand-gradient",
  "--tv-glow-brand-color",
  "--tv-glass-blur",
]);
const GEOMETRY = new Set([
  "--tv-radius-sm", "--tv-radius-md", "--tv-radius-lg", "--tv-radius-pill",
  "--tv-border-width-hair", "--tv-border-width-thin",
  "--tv-border-width-regular", "--tv-border-width-thick",
]);
const EFFECTS = new Set([
  "--tv-glow-color", "--tv-glow-blur", "--tv-glow-spread",
  "--tv-shell-gradient", "--tv-shadow-emphasis",
]);
const KNOCKOUT = new Set([
  "--tv-shell-text-knockout-bg",
  "--tv-paper-text-knockout-bg",
]);
const TYPO_RE = /^--tv-text-([a-z]+)-([a-z]+)$/;
const TYPO_ROLES = new Set([
  "title", "subtitle", "body", "numeric",
  "label", "caption", "footnote", "cell", "tick",
]);
const TYPO_PROPS = new Set(["family", "size", "weight"]);

function classify(token) {
  if (isV3BridgeToken(token)) return "v3-bridge";
  if (HC_FIDELITY.has(token.cssVar)) return "hc-fidelity";
  if (BROWSER_FX.has(token.cssVar)) return "browser-fx";
  if (GEOMETRY.has(token.cssVar)) return "geometry";
  if (EFFECTS.has(token.cssVar)) return "effects";
  if (token.source.tier === "computed") {
    const m = token.cssVar.match(TYPO_RE);
    if (m && TYPO_ROLES.has(m[1]) && TYPO_PROPS.has(m[2])) return "typography";
    if (shellPaperKeyForCssVar(token.cssVar) !== null) return "shell-paper";
    if (elevationKeyForCssVar(token.cssVar) !== null) return "elevation";
    if (textureKeyForCssVar(token.cssVar) !== null) return "texture";
    if (KNOCKOUT.has(token.cssVar)) return "knockout";
  }
  if (token.kind === "spacing-px" || token.kind === "border-width") return "density";
  switch (token.source.tier) {
    case "role": return "role";
    case "anchor": return "anchor";
    case "const": return "const";
    default: return `!!UNRESOLVED(tier=${token.source.tier})`;
  }
}

const counts = {};
for (const t of COMPONENT_TOKENS) {
  const g = classify(t);
  counts[g] = (counts[g] ?? 0) + 1;
  console.log(`${t.cssVar}\t${g}`);
}
console.error("---- group counts ----");
for (const [g, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.error(`${g}\t${n}`);
}
console.error(`TOTAL\t${COMPONENT_TOKENS.length}`);
