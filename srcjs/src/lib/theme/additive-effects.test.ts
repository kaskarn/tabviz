// Stage 2 §7 — browser-additive effects tests.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("brand gradient", () => {
  it("emits a two-stop linear-gradient", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    const g = r.cssVars["--tv-brand-gradient"];
    expect(g).toContain("linear-gradient");
    expect(g).toContain("90deg");
    expect(g).toMatch(/#[0-9A-Fa-f]{6}.*#[0-9A-Fa-f]{6}/);
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
