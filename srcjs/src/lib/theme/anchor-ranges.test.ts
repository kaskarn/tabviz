// Anchor L-envelope tests — the paper slider's domain (and the promise
// that a narrowed envelope never misreports a value it can't contain).

import { describe, it, expect } from "bun:test";
import { ANCHOR_L_RANGE, FULL_L_RANGE, anchorLRange, anchorLStep } from "./anchor-ranges";
import { reflectL } from "./polarity";
import { PRESETS } from "./theme-presets-inputs";

describe("anchorLRange", () => {
  it("narrows paper to the sheet-lightness sliver", () => {
    expect(anchorLRange("paper")).toEqual({ min: 0.9, max: 1 });
  });

  it("leaves un-tabled anchors on the full OKLCH domain", () => {
    for (const key of ["ink", "brand", "accent", "positive"]) {
      expect(anchorLRange(key)).toEqual({ ...FULL_L_RANGE });
    }
  });

  it("reflects the envelope in dark polarity (the editor shows reflected L)", () => {
    const dark = anchorLRange("paper", { dark: true });
    // reflectL is order-reversing, so the ends swap.
    expect(dark.min).toBeCloseTo(reflectL(1), 6);
    expect(dark.max).toBeCloseTo(reflectL(0.9), 6);
    expect(dark.min).toBeLessThan(dark.max);
  });

  it("widens rather than lies when the current value sits outside", () => {
    // A typed hex / imported theme with a mid-tone paper.
    expect(anchorLRange("paper", { currentL: 0.62 })).toEqual({ min: 0.62, max: 1 });
    // Inside the envelope: untouched.
    expect(anchorLRange("paper", { currentL: 0.95 })).toEqual({ min: 0.9, max: 1 });
    // Non-finite input can't poison the domain.
    expect(anchorLRange("paper", { currentL: NaN })).toEqual({ min: 0.9, max: 1 });
  });

  it("contains every shipped preset's paper anchor", () => {
    const { min, max } = ANCHOR_L_RANGE.paper!;
    for (const [name, inputs] of Object.entries(PRESETS)) {
      const L = inputs.anchors.paper.L;
      expect(`${name}:${L >= min && L <= max}`).toBe(`${name}:true`);
    }
  });
});

describe("anchorLStep", () => {
  it("steps finer on a narrowed envelope", () => {
    expect(anchorLStep({ min: 0.9, max: 1 })).toBeLessThan(anchorLStep(FULL_L_RANGE));
  });
});
