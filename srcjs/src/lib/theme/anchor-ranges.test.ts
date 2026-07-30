// Anchor L-envelope tests — the paper slider's domain (and the promise
// that a narrowed envelope never misreports a value it can't contain).

import { describe, it, expect } from "bun:test";
import { ANCHOR_L_RANGE, FULL_L_RANGE, anchorLRange, anchorLStep, HUE_MAX, HUE_STEP } from "./anchor-ranges";
import { validateThemeInputs } from "./theme-validate";
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

describe("HUE_MAX — the H slider's domain vs the validator's contract", () => {
  // Regression (2026-07-28): the hue track ran to 360 while
  // validateThemeInputs accepts only the half-open [0, 360). Dragging any
  // anchor's hue to the end of the track emitted an out-of-contract theme,
  // the resolver threw from the widget's paint path mid-effect-flush, and
  // the whole widget (figure + settings panel) froze until reload.
  //
  // Assert against the VALIDATOR, not a copied literal — if the contract
  // ever widens to 360, this test tells us the slider may follow.
  const withBrandHue = (H: number) => ({
    ...PRESETS["nejm"]!,
    anchors: { ...PRESETS["nejm"]!.anchors, brand: { L: 0.5, C: 0.1, H } },
  });

  it("every value the slider can emit passes validation", () => {
    for (let H = 0; H <= HUE_MAX; H += HUE_STEP) {
      expect(() => validateThemeInputs(withBrandHue(H))).not.toThrow();
    }
  });

  it("360 is genuinely rejected — the bug was real, not a phantom", () => {
    expect(() => validateThemeInputs(withBrandHue(360))).toThrow();
  });

  it("stops exactly one step short of the excluded endpoint", () => {
    // No usable hue is unreachable: HUE_MAX + HUE_STEP is precisely 360,
    // which is the same wheel position as 0.
    expect(HUE_MAX + HUE_STEP).toBe(360);
  });
});
