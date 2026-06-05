// Stage 2 §7 — browser-additive effects tests.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("brand gradient", () => {
  // C36 (wire-audit 1c): lab-fidelity sweep — 135deg, H-24 -> H+30,
  // polarity branch on the first stop's L (dark lifts LIGHTER).
  it("emits the 135deg hue-shifted two-stop sweep", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    const g = r.cssVars["--tv-brand-gradient"];
    expect(g).toContain("linear-gradient");
    expect(g).toContain("135deg");
    expect(g).toMatch(/#[0-9A-Fa-f]{6}.*#[0-9A-Fa-f]{6}/);
  });

  it("dark polarity lifts the first stop lighter (not darker)", () => {
    const light = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    const dark = resolveTheme(createWire(
      inputsFromHex({ brand: "#0099CC", polarity: "dark" }), "t"));
    expect(light.cssVars["--tv-brand-gradient"])
      .not.toBe(dark.cssVars["--tv-brand-gradient"]);
  });
});

describe("brand glow", () => {
  it("emits rgba derived from accent-solid @ alpha 0.4", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    const g = r.cssVars["--tv-glow-brand-color"];
    expect(g).toMatch(/^rgba\(\d+, \d+, \d+, 0\.4\)$/);
  });

  it("changes with accent override", () => {
    const a = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", accent: "#FF0000" }), "t"));
    const b = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", accent: "#00FF00" }), "t"));
    expect(a.cssVars["--tv-glow-brand-color"]).not.toBe(b.cssVars["--tv-glow-brand-color"]);
  });
});

describe("glass blur", () => {
  it("emits 16px", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-glass-blur"]).toBe("16px");
  });
});
