// Tests for the Phase 6 consumer-migration bridge.

import { describe, it, expect } from "bun:test";
import { getCssVars, readVar, readVarPx } from "./consumer-bridge";
import { buildTheme } from "./theme-adapter";
import { NEJM } from "./theme-presets-inputs";

describe("getCssVars", () => {
  it("returns the cssVars map when theme has authoringInputs", () => {
    const theme = buildTheme(NEJM, "nejm");
    const cssVars = getCssVars(theme);
    expect(Object.keys(cssVars).length).toBeGreaterThan(0);
    expect(cssVars["--tv-row-base-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns empty map when theme is undefined", () => {
    expect(getCssVars(undefined)).toEqual({});
    expect(getCssVars(null)).toEqual({});
  });

  it("returns empty map when authoringInputs is missing", () => {
    const theme = buildTheme(NEJM, "nejm");
    delete (theme as { authoringInputs?: unknown }).authoringInputs;
    expect(getCssVars(theme)).toEqual({});
  });
});

describe("readVar", () => {
  it("returns the cssVar value when present", () => {
    const cssVars = { "--tv-row-alt-bg": "#FAFAFA" };
    expect(readVar(cssVars, "--tv-row-alt-bg", "#FFFFFF")).toBe("#FAFAFA");
  });

  it("returns fallback when cssVar is missing", () => {
    const cssVars = {};
    expect(readVar(cssVars, "--tv-row-alt-bg", "#FFFFFF")).toBe("#FFFFFF");
  });

  it("returns fallback when cssVar is a TBD placeholder", () => {
    const cssVars = { "--tv-row-alt-bg": "<TBD role:surface-subtle>" };
    expect(readVar(cssVars, "--tv-row-alt-bg", "#FFFFFF")).toBe("#FFFFFF");
  });

  it("returns fallback when cssVar is any placeholder starting with <", () => {
    const cssVars = { "--tv-spacing-row-height": "<input:density>" };
    expect(readVar(cssVars, "--tv-spacing-row-height", "24px")).toBe("24px");
  });

  it("passes through null fallback", () => {
    expect(readVar({}, "--tv-row-alt-bg", null)).toBeNull();
  });

  it("passes through undefined fallback", () => {
    expect(readVar({}, "--tv-row-alt-bg", undefined)).toBeUndefined();
  });
});

describe("readVarPx", () => {
  it("parses `16px` into 16", () => {
    expect(readVarPx({ "--tv-spacing-row-height": "16px" }, "--tv-spacing-row-height", 12)).toBe(16);
  });

  it("parses bare numeric strings (`1.5`)", () => {
    expect(readVarPx({ "--tv-plot-line-width": "1.5" }, "--tv-plot-line-width", 1)).toBe(1.5);
  });

  it("parses floats with px suffix (`1.5px`)", () => {
    expect(readVarPx({ "--tv-plot-line-width": "1.5px" }, "--tv-plot-line-width", 1)).toBe(1.5);
  });

  it("returns fallback when missing", () => {
    expect(readVarPx({}, "--tv-spacing-row-height", 24)).toBe(24);
  });

  it("returns fallback for placeholder values", () => {
    expect(readVarPx({ "--tv-spacing-row-height": "<input:density>" }, "--tv-spacing-row-height", 24)).toBe(24);
  });

  it("returns fallback when value is unparseable", () => {
    expect(readVarPx({ "--tv-spacing-row-height": "auto" }, "--tv-spacing-row-height", 24)).toBe(24);
  });
});

describe("getCssVars — density + pin behavior", () => {
  it("returns density-correct spacing for each preset", () => {
    const compact = buildTheme({ ...NEJM, density: "compact" }, "t");
    const comfy = buildTheme({ ...NEJM, density: "comfortable" }, "t");
    const spacious = buildTheme({ ...NEJM, density: "spacious" }, "t");
    expect(getCssVars(compact)["--tv-spacing-row-height"]).toBe("20px");
    expect(getCssVars(comfy)["--tv-spacing-row-height"]).toBe("24px");
    expect(getCssVars(spacious)["--tv-spacing-row-height"]).toBe("30px");
  });

  it("honors mutated theme.spacing.X as a v3-compat pin", () => {
    const theme = buildTheme({ ...NEJM, density: "comfortable" }, "t");
    // v3-era mutation pattern: callers set spec.theme.spacing.X directly.
    theme.spacing.rowGroupPadding = 40;
    expect(getCssVars(theme)["--tv-spacing-row-group-padding"]).toBe("40px");
  });

  it("spacing is PER-THEME — mutating one theme never leaks to another", () => {
    // js-ci's maiden run caught this: scaleSpacing's identity path
    // returned the module-level DENSITY_SPACING entry by reference, so
    // the mutation test above poisoned every comfortable theme built in
    // the process (Linux file order surfaced it; macOS order hid it).
    const a = buildTheme({ ...NEJM, density: "comfortable" }, "a");
    const b = buildTheme({ ...NEJM, density: "comfortable" }, "b");
    expect(a.spacing).not.toBe(b.spacing);
    a.spacing.rowGroupPadding = 99;
    expect(b.spacing.rowGroupPadding).toBe(12);
    const c = buildTheme({ ...NEJM, density: "comfortable" }, "c");
    expect(c.spacing.rowGroupPadding).toBe(12);
  });

  it("applies density_factor scaling", () => {
    const theme = buildTheme({ ...NEJM, density: "comfortable", density_factor: 1.5 }, "t");
    // comfortable rowHeight 24 × 1.5 = 36
    expect(getCssVars(theme)["--tv-spacing-row-height"]).toBe("36px");
  });
});
