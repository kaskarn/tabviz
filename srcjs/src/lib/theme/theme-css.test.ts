// buildThemeCSS — v4 cssVars emission + small v3-vocabulary tail
// (status colors, font-weight constants, header variants — see
// theme-css.ts for the v3-only tail's full inventory).

import { describe, it, expect } from "bun:test";
import { buildThemeCSS } from "./theme-css";
import { buildTheme } from "./theme-adapter";
import { COCHRANE } from "./theme-presets-inputs";

describe("buildThemeCSS", () => {
  it("emits v4 manifest var names", () => {
    const css = buildThemeCSS(buildTheme(COCHRANE, "cochrane"));
    // v4 names — bg/fg/border/row-base/etc. live entirely in the v4 manifest.
    expect(css).toContain("--tv-surface-bg:");
    expect(css).toContain("--tv-text:");
    expect(css).toContain("--tv-border:");
    expect(css).toContain("--tv-row-base-bg:");
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
