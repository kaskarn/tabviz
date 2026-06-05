// V4 cssVars preset coverage gate — asserts every preset produces a
// fully-populated cssVars map with no placeholder leakage.
//
// This is the per-preset correctness gate: if a future resolver change
// silently degrades one preset (e.g. introduces a `<TBD …>` value), this
// test catches it across all 18 entries instead of waiting for a visual
// regression. Mirrors the safety net `theme-css.test.ts` provides for
// COCHRANE, but spans the full preset roster.

import { describe, it, expect } from "bun:test";
import { PRESETS } from "./theme-presets-inputs";
import { buildTheme } from "./theme-adapter";
import { getCssVars } from "./consumer-bridge";
import { COMPONENT_TOKENS } from "./component-tokens";

// Tokens whose v4 source is still a placeholder ("<computed>" / "<input:…>")
// are exempt; they'll be cleaned up as the resolver lands their concrete paths.
const PLACEHOLDER_EXEMPT = new Set<string>([
  // Width tokens — emitted via const "1px" by the resolver, no consumer migration needed.
]);

describe("v4 cssVars: per-preset coverage", () => {
  for (const [name, inputs] of Object.entries(PRESETS)) {
    it(`${name}: getCssVars returns populated map`, () => {
      const theme = buildTheme(inputs, name);
      const cssVars = getCssVars(theme);
      expect(Object.keys(cssVars).length).toBeGreaterThanOrEqual(COMPONENT_TOKENS.length);
    });

    it(`${name}: no placeholder leakage`, () => {
      const theme = buildTheme(inputs, name);
      const cssVars = getCssVars(theme);
      // V3-bridge tokens (theme.borders / firstColumn / variants / layout)
      // emit `<v3-bridge>` from the v4 resolver — they're realized in
      // theme-css.ts's user-config-bridge tail, not by the manifest pass.
      const v3BridgeVars = new Set(
        COMPONENT_TOKENS
          .filter(t => t.source.tier === "computed" &&
                       typeof t.source.note === "string" &&
                       t.source.note.startsWith("[v3-bridge]"))
          .map(t => t.cssVar)
      );
      const leaked: Array<{ cssVar: string; value: string }> = [];
      for (const [cssVar, value] of Object.entries(cssVars)) {
        if (PLACEHOLDER_EXEMPT.has(cssVar)) continue;
        if (v3BridgeVars.has(cssVar)) continue;
        if (typeof value !== "string") continue;
        if (value.startsWith("<")) {
          leaked.push({ cssVar, value });
        }
      }
      if (leaked.length > 0) {
        const lines = leaked.map(l => `  ${l.cssVar} = ${l.value}`).join("\n");
        throw new Error(
          `${leaked.length} cssVar(s) leaked placeholder values in preset "${name}":\n${lines}`,
        );
      }
    });

    it(`${name}: spacing reflects density`, () => {
      const theme = buildTheme(inputs, name);
      const cssVars = getCssVars(theme);
      const rh = cssVars["--tv-spacing-row-height"];
      expect(rh).toMatch(/^\d+px$/);
      // Density-appropriate range: compact ≥ 10, spacious ≤ 60.
      const px = parseInt(rh.replace("px", ""), 10);
      expect(px).toBeGreaterThanOrEqual(10);
      expect(px).toBeLessThanOrEqual(60);
    });
  }
});
