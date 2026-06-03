// Tests for the polarity-flip math (anchor L-reflection).

import { describe, it, expect } from "bun:test";
import {
  reflectL,
  reflectHex,
  polarityOf,
  reflectAnchors,
} from "./polarity";
import { hexToOklch } from "../oklch";

describe("reflectL — single-value reflection", () => {
  it("reflects around the pivot at 0.55", () => {
    // L = 0.30 reflects to 1.1 - 0.30 = 0.80
    expect(reflectL(0.30)).toBeCloseTo(0.80, 6);
    // L = 0.80 reflects to 1.1 - 0.80 = 0.30
    expect(reflectL(0.80)).toBeCloseTo(0.30, 6);
  });

  it("is involutive on in-range values (reflect(reflect(L)) === L for L ∈ [0.11, 0.99])", () => {
    // The clamp at [0.04, 0.99] means values that reflect outside [0.11, 0.99]
    // (i.e., L < 0.11 or L > 0.99) lose involutivity. Within the safe range
    // reflection is exact.
    for (let i = 11; i <= 99; i += 5) {
      const L = i / 100;
      expect(reflectL(reflectL(L))).toBeCloseTo(L, 6);
    }
  });

  it("clamps low to 0.04", () => {
    // L = 1.10 reflects to 1.1 - 1.10 = 0.00 → clamped to 0.04
    expect(reflectL(1.10)).toBe(0.04);
  });

  it("clamps high to 0.99", () => {
    // L = -0.05 reflects to 1.1 - (-0.05) = 1.15 → clamped to 0.99
    expect(reflectL(-0.05)).toBe(0.99);
  });

  it("L = pivot (0.55) reflects to itself", () => {
    expect(reflectL(0.55)).toBeCloseTo(0.55, 6);
  });
});

describe("reflectHex — full color reflection", () => {
  it("flips lightness but keeps chroma + hue", () => {
    const light = "#F0F0F0";
    const lightLch = hexToOklch(light);
    const dark = reflectHex(light);
    const darkLch = hexToOklch(dark);
    // Lightness reflects:
    expect(darkLch.L).toBeCloseTo(reflectL(lightLch.L), 2);
    // Chroma + hue unchanged (within rounding):
    expect(darkLch.C).toBeCloseTo(lightLch.C, 2);
    if (lightLch.C > 0.01) {
      // Hue is only meaningful when chroma > 0
      expect(darkLch.H).toBeCloseTo(lightLch.H, 1);
    }
  });

  it("approximately involutive on mid-range colors", () => {
    // Round-trip should land near the original (a few-step OKLCH→hex
    // rounding accumulates).
    const original = "#0099CC";
    const reflected = reflectHex(original);
    const round_tripped = reflectHex(reflected);
    const oLch = hexToOklch(original);
    const rLch = hexToOklch(round_tripped);
    expect(rLch.L).toBeCloseTo(oLch.L, 1);
  });
});

describe("polarityOf", () => {
  it("recognizes light colors (L >= 0.5)", () => {
    expect(polarityOf("#FFFFFF")).toBe("light");
    expect(polarityOf("#E0E0E0")).toBe("light");
  });

  it("recognizes dark colors (L < 0.5)", () => {
    expect(polarityOf("#000000")).toBe("dark");
    expect(polarityOf("#2A2A2A")).toBe("dark");
  });
});

describe("reflectAnchors — per-anchor reflection", () => {
  it("reflects every hex value in a record", () => {
    const light = {
      paper: "#FAFAFA",
      ink: "#1A1A1A",
      brand: "#0099CC",
    };
    const dark = reflectAnchors(light);
    expect(polarityOf(dark.paper)).toBe("dark");
    expect(polarityOf(dark.ink)).toBe("light");
  });

  it("passes through null/undefined values unchanged", () => {
    const inputs = {
      paper: "#FAFAFA",
      decorative: null,
      accent: undefined,
    };
    const out = reflectAnchors(inputs);
    expect(out.decorative).toBeNull();
    expect(out.accent).toBeUndefined();
  });

  it("is approximately involutive", () => {
    const light = { paper: "#FAFAFA", ink: "#1A1A1A" };
    const round_tripped = reflectAnchors(reflectAnchors(light));
    // OKLCH ↔ hex round-trip rounding may introduce ~1 unit drift;
    // verify polarity matches.
    expect(polarityOf(round_tripped.paper)).toBe(polarityOf(light.paper));
    expect(polarityOf(round_tripped.ink)).toBe(polarityOf(light.ink));
  });
});
