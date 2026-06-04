// Stage 2 — typography integration test.
// Verifies the resolver emits typography cssVars sourced from typography.ts.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("typography → cssVars integration", () => {
  it("emits all 60 typography tokens (10 roles × 6 props)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "test"));
    const roles = ["title", "subtitle", "heading", "body", "numeric",
                   "label", "caption", "footnote", "cell", "tick"];
    const props = ["family", "size", "weight", "lh", "track", "font"];
    for (const role of roles) {
      for (const prop of props) {
        const key = `--tv-text-${role}-${prop}`;
        expect(r.cssVars[key]).toBeDefined();
        expect(r.cssVars[key]).not.toMatch(/^<computed/);
      }
    }
  });

  it("title family = display font", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      fonts: { display: "Cinzel, serif", body: "Inter, sans-serif" },
    }), "test"));
    expect(r.cssVars["--tv-text-title-family"]).toContain("Cinzel");
    expect(r.cssVars["--tv-text-body-family"]).toContain("Inter");
  });

  it("numeric family = mono font", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      fonts: { mono: "JetBrains Mono, monospace" },
    }), "test"));
    expect(r.cssVars["--tv-text-numeric-family"]).toContain("JetBrains");
  });

  it("size reflects type_scale_ratio", () => {
    const r1 = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { type_base_size: 14, type_scale_ratio: 1.2 }), "t"));
    const r2 = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { type_base_size: 14, type_scale_ratio: 1.5 }), "t"));
    const t1 = parseFloat(r1.cssVars["--tv-text-title-size"]);
    const t2 = parseFloat(r2.cssVars["--tv-text-title-size"]);
    expect(t2).toBeGreaterThan(t1);  // larger ratio → larger title at same base
  });

  it("body size == type_base_size", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { type_base_size: 16 }), "t"));
    expect(r.cssVars["--tv-text-body-size"]).toBe("16px");
  });

  it("title weight reflects type_weights.semibold (default 600)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-text-title-weight"]).toBe("600");
  });

  it("custom weights propagate", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      type_weights: { semibold: 550 },
    }), "t"));
    expect(r.cssVars["--tv-text-title-weight"]).toBe("550");
  });

  it("font shorthand assembles weight size/lh family", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      fonts: { display: "Cinzel" },
      type_base_size: 14,
    }), "t"));
    const font = r.cssVars["--tv-text-title-font"];
    expect(font).toContain("600");      // semibold
    expect(font).toContain("Cinzel");
    expect(font).toMatch(/\d+px\/\d/);   // size/lh
  });

  it("body role omits lh from font shorthand (lh = null in default table)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    const bodyFont = r.cssVars["--tv-text-body-font"];
    expect(bodyFont).not.toContain("/");  // no /lh segment
    expect(bodyFont).toMatch(/^\d+ \d+(\.\d+)?px /);
  });

  it("body lh emits 'normal' (lh = null)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-text-body-lh"]).toBe("normal");
  });

  it("title lh emits the numeric value (1.12)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    expect(r.cssVars["--tv-text-title-lh"]).toBe("1.12");
  });
});
