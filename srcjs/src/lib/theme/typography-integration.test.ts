// Stage 2 — typography integration test.
// Verifies the resolver emits typography cssVars sourced from typography.ts.
//
// Rationalized in Coh.22: the manifest emits 9 roles × {family, size, weight}
// = 27 entries. lh/track/font props were dropped (no renderer reads them);
// the `heading` role was dropped (zero consumers, redundant with subtitle).

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";

describe("typography → cssVars integration", () => {
  it("emits all 27 typography tokens (9 roles × 3 props)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "test"));
    const roles = ["title", "subtitle", "body", "numeric",
                   "label", "caption", "footnote", "cell", "tick"];
    const props = ["family", "size", "weight"];
    for (const role of roles) {
      for (const prop of props) {
        const key = `--tv-text-${role}-${prop}`;
        expect(r.cssVars[key]).toBeDefined();
        expect(r.cssVars[key]).not.toMatch(/^<computed/);
      }
    }
  });

  it("does NOT emit dropped lh/track/font props or heading role", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "test"));
    expect(r.cssVars["--tv-text-title-lh"]).toBeUndefined();
    expect(r.cssVars["--tv-text-body-font"]).toBeUndefined();
    expect(r.cssVars["--tv-text-title-track"]).toBeUndefined();
    expect(r.cssVars["--tv-text-heading-family"]).toBeUndefined();
    expect(r.cssVars["--tv-text-heading-size"]).toBeUndefined();
  });

  it("title family = display font", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      fonts: { display: "Cinzel, serif", body: "Inter, sans-serif" },
    }), "test"));
    expect(r.cssVars["--tv-text-title-family"]).toContain("Cinzel");
    expect(r.cssVars["--tv-text-body-family"]).toContain("Inter");
  });

  it("numeric family = BODY font (not mono — 2026-06-08)", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      fonts: { body: "Lora, serif", mono: "JetBrains Mono, monospace" },
    }), "test"));
    // numbers follow the body font now; mono stays available for the
    // `mono`-family roles + a future dedicated `fonts.numeric` slot.
    expect(r.cssVars["--tv-text-numeric-family"]).toContain("Lora");
    expect(r.cssVars["--tv-text-numeric-family"]).not.toContain("JetBrains");
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
});
