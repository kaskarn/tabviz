// Tests for the theme-rationalization additions to oklch.ts:
//   - apcaContrast / apcaLc — APCA-Lc contrast metric
//   - pickInkOnBg — APCA-aware ink picker
//   - oklchRamp / rampStep — 12-step OKLCH-uniform ramp generator
//
// Pure-math unit tests; no theme/consumer integration here.

import { describe, it, expect } from "bun:test";
import {
  apcaContrast, apcaLc,
  pickInkOnBg,
  oklchRamp, rampStep,
  hexToOklch,
  contrastRatio,
} from "./oklch";

describe("apcaContrast — basic invariants", () => {
  it("returns 0 for identical colors", () => {
    expect(apcaContrast("#000000", "#000000")).toBe(0);
    expect(apcaContrast("#FFFFFF", "#FFFFFF")).toBe(0);
    expect(apcaContrast("#888888", "#888888")).toBe(0);
  });

  it("returns positive Lc for dark text on light bg", () => {
    expect(apcaContrast("#000000", "#FFFFFF")).toBeGreaterThan(100);
  });

  it("returns negative Lc for light text on dark bg", () => {
    expect(apcaContrast("#FFFFFF", "#000000")).toBeLessThan(-100);
  });

  it("magnitude is similar for inverted pairs (perceptually symmetric-ish)", () => {
    const a = Math.abs(apcaContrast("#000000", "#FFFFFF"));
    const b = Math.abs(apcaContrast("#FFFFFF", "#000000"));
    // APCA isn't perfectly symmetric (asymmetric exponents) but close.
    expect(Math.abs(a - b)).toBeLessThan(10);
  });
});

describe("apcaLc — magnitudes for representative pairs", () => {
  it("body-text threshold (≥75) is met for #333 on #fff", () => {
    expect(apcaLc("#333333", "#FFFFFF")).toBeGreaterThanOrEqual(75);
  });

  it("large-text threshold (≥60) is met for #555 on #fff", () => {
    expect(apcaLc("#555555", "#FFFFFF")).toBeGreaterThanOrEqual(60);
  });

  it("low-contrast pairs return low Lc (well under body-text floor)", () => {
    // Light gray on white: detectable but under large-text threshold.
    expect(apcaLc("#CCCCCC", "#FFFFFF")).toBeLessThan(40);
    // Very close lightness pair: minimal Lc.
    expect(apcaLc("#444444", "#222222")).toBeLessThan(30);
  });
});

describe("pickInkOnBg — APCA-aware ink selection", () => {
  it("picks dark ink for light bg", () => {
    const pick = pickInkOnBg("#FFFFFF", ["#000000", "#FFFFFF"]);
    expect(pick).toBe("#000000");
  });

  it("picks light ink for dark bg", () => {
    const pick = pickInkOnBg("#1A1A1A", ["#000000", "#FFFFFF"]);
    expect(pick).toBe("#FFFFFF");
  });

  it("from a 3-step ramp on a mid-saturation brand, picks the high-contrast end", () => {
    const lightBg = "#0099CC"; // brand bg
    const candidates = ["#FFFFFF", "#888888", "#000000"];
    const pick = pickInkOnBg(lightBg, candidates);
    // Either white or black depending on relative APCA; both work for this bg
    expect(["#FFFFFF", "#000000"]).toContain(pick);
    expect(apcaLc(pick, lightBg)).toBeGreaterThanOrEqual(60);
  });

  it("respects target Lc threshold", () => {
    // Force a low-contrast scenario; should still return least-bad option
    const candidates = ["#888888", "#999999"];
    const pick = pickInkOnBg("#FFFFFF", candidates, 60);
    expect(candidates).toContain(pick);
  });

  it("throws on empty candidates", () => {
    expect(() => pickInkOnBg("#FFFFFF", [])).toThrow();
  });
});

describe("oklchRamp — 12-step ramp generation", () => {
  it("returns 12 hex strings", () => {
    const ramp = oklchRamp("#0099CC");
    expect(ramp.length).toBe(12);
    for (const h of ramp) {
      expect(h).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("light-mode ramp goes from light (step 1) to dark (step 12)", () => {
    const ramp = oklchRamp("#0099CC", { mode: "light" });
    const L1 = hexToOklch(ramp[0]!).L;
    const L12 = hexToOklch(ramp[11]!).L;
    expect(L1).toBeGreaterThan(0.9);
    expect(L12).toBeLessThan(0.3);
  });

  it("dark-mode ramp goes from dark (step 1) to light (step 12)", () => {
    const ramp = oklchRamp("#0099CC", { mode: "dark" });
    const L1 = hexToOklch(ramp[0]!).L;
    const L12 = hexToOklch(ramp[11]!).L;
    expect(L1).toBeLessThan(0.3);
    expect(L12).toBeGreaterThan(0.9);
  });

  it("light + dark of the same seed are L-inversions of each other (same step labels)", () => {
    const light = oklchRamp("#0099CC", { mode: "light" });
    const dark = oklchRamp("#0099CC", { mode: "dark" });
    // step 1 light ↔ step 12 dark, both have similar L
    expect(Math.abs(hexToOklch(light[0]!).L - hexToOklch(dark[11]!).L)).toBeLessThan(0.05);
  });

  it("chroma peaks near step 9 (the solid step)", () => {
    const ramp = oklchRamp("#0099CC");
    const chromas = ramp.map((h) => hexToOklch(h).C);
    const peakIdx = chromas.indexOf(Math.max(...chromas));
    // Allow ±1 step from index 8 (= step 9) for gamut-clipping effects
    expect(peakIdx).toBeGreaterThanOrEqual(7);
    expect(peakIdx).toBeLessThanOrEqual(9);
  });

  it("step 9 of a brand ramp is recognizable as the seed-hue solid bg", () => {
    const brand = oklchRamp("#0099CC");
    const solid = rampStep(brand, 9);
    const solidH = hexToOklch(solid).H;
    const seedH = hexToOklch("#0099CC").H;
    expect(Math.abs(solidH - seedH)).toBeLessThan(15); // hue preserved
    // Solid step should be reasonably saturated
    expect(hexToOklch(solid).C).toBeGreaterThan(0.05);
  });

  it("neutral ramp (chromaPeak = 0) produces achromatic steps", () => {
    const neutral = oklchRamp("#888888", { chromaPeak: 0 });
    for (const h of neutral) {
      expect(hexToOklch(h).C).toBeLessThan(0.01);
    }
  });

  it("tint blends into low-chroma ends only", () => {
    const untinted = oklchRamp("#888888", { chromaPeak: 0 });
    const tinted = oklchRamp("#888888", {
      chromaPeak: 0,
      tintHex: "#0099CC",
      tintAmount: 0.05,
    });
    // Step 1 (lightest end) should pick up some hue toward the tint
    expect(hexToOklch(tinted[0]!).C).toBeGreaterThan(hexToOklch(untinted[0]!).C);
    // Step 9 (chroma peak) should not be substantially tinted
    expect(Math.abs(hexToOklch(tinted[8]!).C - hexToOklch(untinted[8]!).C))
      .toBeLessThan(0.005);
  });
});

describe("rampStep — 1-indexed access", () => {
  it("returns step 1..12", () => {
    const r = oklchRamp("#0099CC");
    expect(rampStep(r, 1)).toBe(r[0]!);
    expect(rampStep(r, 12)).toBe(r[11]!);
    expect(rampStep(r, 9)).toBe(r[8]!);
  });

  it("throws on out-of-range step", () => {
    const r = oklchRamp("#0099CC");
    expect(() => rampStep(r, 0)).toThrow();
    expect(() => rampStep(r, 13)).toThrow();
    expect(() => rampStep(r, 1.5)).toThrow();
  });
});

describe("contrast invariants — APCA + WCAG agree on directions", () => {
  it("APCA and WCAG agree dark-on-light is high contrast", () => {
    expect(apcaLc("#000000", "#FFFFFF")).toBeGreaterThan(75);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeGreaterThan(15);
  });

  it("APCA correctly flags dark-mode body text minimum", () => {
    // A common dark-mode pair: near-white on near-black
    const lc = apcaLc("#CDD6F4", "#1E1E2E");
    expect(lc).toBeGreaterThanOrEqual(75); // meets body text floor
  });

  it("APCA flags an insufficient dark-mode pair WCAG might pass", () => {
    // WCAG can incorrectly accept some low-Lc dark-mode pairs — APCA catches them
    const lc = apcaLc("#888888", "#2A2A2A");
    expect(lc).toBeLessThan(60); // below large-text threshold per APCA
  });
});
