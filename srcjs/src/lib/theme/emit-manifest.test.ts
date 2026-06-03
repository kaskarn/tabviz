// Validates that emitCssVarsFromManifest walks COMPONENT_TOKENS and
// produces a one-entry-per-token map with correctly-shaped placeholder
// values. This is the substrate's manifest-dispatch validation; the
// actual values get plugged in by the resolver (step 4 of Stage 1 §40).

import { describe, it, expect } from "bun:test";
import { emitCssVarsFromManifest } from "./theme-css";
import { COMPONENT_TOKENS } from "./component-tokens";

describe("emitCssVarsFromManifest (stub)", () => {
  const cssVars = emitCssVarsFromManifest();

  it("produces one entry per COMPONENT_TOKENS entry", () => {
    expect(Object.keys(cssVars)).toHaveLength(COMPONENT_TOKENS.length);
  });

  it("uses the cssVar as the map key for each entry", () => {
    for (const token of COMPONENT_TOKENS) {
      expect(cssVars).toHaveProperty(token.cssVar);
    }
  });

  it("placeholder values follow the <TBD tier:detail> shape", () => {
    for (const value of Object.values(cssVars)) {
      expect(value).toMatch(/^<TBD (role|input|anchor|computed|const):/);
    }
  });

  it("role-sourced tokens reference their role name in the placeholder", () => {
    for (const token of COMPONENT_TOKENS) {
      if (token.source.tier !== "role") continue;
      expect(cssVars[token.cssVar]).toContain(`role:${token.source.role}`);
    }
  });

  it("input-sourced tokens reference their input field in the placeholder", () => {
    for (const token of COMPONENT_TOKENS) {
      if (token.source.tier !== "input") continue;
      expect(cssVars[token.cssVar]).toContain(`input:${token.source.input}`);
    }
  });
});
