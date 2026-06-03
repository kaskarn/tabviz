// buildThemeCSS — v3 stylesheet + v4 cssVars append (Phase 6).

import { describe, it, expect } from "bun:test";
import { buildThemeCSS } from "./theme-css";
import { buildTheme } from "./theme-adapter";
import { COCHRANE } from "./theme-presets-inputs";

describe("buildThemeCSS", () => {
  it("includes v3 names (DOM render path consumers)", () => {
    const css = buildThemeCSS(buildTheme(COCHRANE, "cochrane"));
    expect(css).toContain("--tv-fg:");
    expect(css).toContain("--tv-bg:");
    expect(css).toContain("--tv-row-bg:");
    expect(css).toContain("--tv-border:");
  });

  it("appends v4 cssVars from theme.authoringInputs", () => {
    const css = buildThemeCSS(buildTheme(COCHRANE, "cochrane"));
    // v4 substrate var names from the manifest:
    expect(css).toContain("--tv-row-base-bg:");
    expect(css).toContain("--tv-row-alt-bg:");
    expect(css).toContain("--tv-text:");
    expect(css).toContain("--tv-cell-border:");
  });

  it("skips placeholder values (<TBD …, <input:…) when emitting v4", () => {
    const css = buildThemeCSS(buildTheme(COCHRANE, "cochrane"));
    // No placeholder leakage into the stylesheet.
    expect(css).not.toContain(": <TBD");
    expect(css).not.toContain(": <input:");
    expect(css).not.toContain(": <computed:");
  });
});
