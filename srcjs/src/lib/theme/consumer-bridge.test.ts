// Tests for the Phase 6 consumer-migration bridge.

import { describe, it, expect } from "bun:test";
import { getCssVars, readVar } from "./consumer-bridge";
import { buildTheme } from "./theme-adapter";
import { COCHRANE } from "./theme-presets-inputs";

describe("getCssVars", () => {
  it("returns the cssVars map when theme has authoringInputs", () => {
    const theme = buildTheme(COCHRANE, "cochrane");
    const cssVars = getCssVars(theme);
    expect(Object.keys(cssVars).length).toBeGreaterThan(0);
    expect(cssVars["--tv-row-base-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns empty map when theme is undefined", () => {
    expect(getCssVars(undefined)).toEqual({});
    expect(getCssVars(null)).toEqual({});
  });

  it("returns empty map when authoringInputs is missing", () => {
    const theme = buildTheme(COCHRANE, "cochrane");
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
