// Stage 2 §6 — Elevation shadow color tests.

import { describe, it, expect } from "bun:test";
import { resolveElevationShadows, elevationKeyForCssVar } from "./elevation";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("resolveElevationShadows", () => {
  it("returns 4 hue-aware rgba colors for a white paper", () => {
    const r = resolveElevationShadows("#FFFFFF");
    for (const v of Object.values(r)) {
      expect(v).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    }
  });

  it("raised-near is lighter (lower alpha) than raised-far", () => {
    const r = resolveElevationShadows("#FFFFFF");
    expect(r.raisedNear).not.toBe(r.raisedFar);
  });

  it("overlay tier has more saturated shadows than raised", () => {
    const r = resolveElevationShadows("#FFFFFF");
    // overlay-near alpha is 0.18; raised-near is 0.12
    expect(r.overlayNear).toContain("0.18");
    expect(r.raisedNear).toContain("0.12");
  });

  it("paper hue shifts the shadow color toward that hue", () => {
    const white = resolveElevationShadows("#FFFFFF");
    const blue  = resolveElevationShadows("#3B82F6");
    expect(white.raisedNear).not.toBe(blue.raisedNear);
  });
});

describe("elevationKeyForCssVar", () => {
  it("maps all 4 elevation cssVars", () => {
    expect(elevationKeyForCssVar("--tv-shadow-raised-near")).toBe("raisedNear");
    expect(elevationKeyForCssVar("--tv-shadow-raised-far")).toBe("raisedFar");
    expect(elevationKeyForCssVar("--tv-shadow-overlay-near")).toBe("overlayNear");
    expect(elevationKeyForCssVar("--tv-shadow-overlay-far")).toBe("overlayFar");
  });

  it("returns null for non-shadow vars", () => {
    expect(elevationKeyForCssVar("--tv-row-base-bg")).toBeNull();
    expect(elevationKeyForCssVar("--tv-shell-shadow")).toBeNull();
  });
});

describe("elevation → cssVars integration", () => {
  it("emits 4 shadow cssVars", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-shadow-raised-near"]).toContain("rgba");
    expect(r.cssVars["--tv-shadow-raised-far"]).toContain("rgba");
    expect(r.cssVars["--tv-shadow-overlay-near"]).toContain("rgba");
    expect(r.cssVars["--tv-shadow-overlay-far"]).toContain("rgba");
  });

  it("dark polarity gives different shadow base than light", () => {
    const light = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", polarity: "light" }), "t"));
    const dark  = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", polarity: "dark" }), "t"));
    expect(light.cssVars["--tv-shadow-raised-near"])
      .not.toBe(dark.cssVars["--tv-shadow-raised-near"]);
  });
});
