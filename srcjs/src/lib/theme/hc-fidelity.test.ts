// Stage 2 §5 — HC encoding fidelity tests.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("HC encoding fidelity tokens", () => {
  it("standard mode → caret is empty string", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" }), "t"));
    expect(r.cssVars["--tv-hc-caret-char"]).toBe("");
  });

  it("high-contrast mode → caret is ▸", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" }), "t"));
    expect(r.cssVars["--tv-hc-caret-char"]).toBe("▸");
  });

  it("standard mode → bar width 3px", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" }), "t"));
    expect(r.cssVars["--tv-hc-bar-width"]).toBe("3px");
  });

  it("high-contrast mode → bar width 4px (thicker)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" }), "t"));
    expect(r.cssVars["--tv-hc-bar-width"]).toBe("4px");
  });

  it("ring width is mode-invariant 1.5px", () => {
    const std = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" }), "t"));
    const hc  = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" }), "t"));
    expect(std.cssVars["--tv-hc-ring-width"]).toBe("1.5px");
    expect(hc.cssVars["--tv-hc-ring-width"]).toBe("1.5px");
  });
});
