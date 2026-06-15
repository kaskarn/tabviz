// Tests for the five ramp-shape curve functions.

import { describe, it, expect } from "bun:test";
import { CURVES, curveFn, DEFAULT_RAMP_CURVES } from "./curves";
// Use the canonical roster (single source of truth) rather than a local copy.
import { ALL_CURVES } from "../../types/theme-roles";

describe("CURVES — five functions", () => {
  it("exports all five curve names", () => {
    for (const name of ALL_CURVES) {
      expect(CURVES[name]).toBeDefined();
      expect(typeof CURVES[name]).toBe("function");
    }
  });

  it("every curve satisfies f(0) ≈ 0 and f(1) ≈ 1 (endpoints fixed)", () => {
    for (const name of ALL_CURVES) {
      const f = CURVES[name];
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });

  it("every curve is monotonically non-decreasing on [0, 1]", () => {
    for (const name of ALL_CURVES) {
      const f = CURVES[name];
      const samples = 100;
      let prev = f(0);
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const cur = f(t);
        expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = cur;
      }
    }
  });

  it("every curve outputs are bounded in [0, 1]", () => {
    for (const name of ALL_CURVES) {
      const f = CURVES[name];
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const out = f(t);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("CURVES — specific curve characteristics", () => {
  it("linear is the identity", () => {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      expect(CURVES.linear(t)).toBeCloseTo(t, 9);
    }
  });

  it("ease at t=0.5 is exactly 0.5 (S-curve symmetry)", () => {
    expect(CURVES.ease(0.5)).toBeCloseTo(0.5, 9);
  });

  it("smoothstep at t=0.5 is exactly 0.5", () => {
    expect(CURVES.smooth(0.5)).toBeCloseTo(0.5, 9);
  });

  it("log packs the dark end (early grades have larger output)", () => {
    // At t=0.25 (a low grade), log(t) > linear(t) means more "ground covered"
    // toward the light end early — exactly what "packs the dark end" means.
    expect(CURVES.log(0.25)).toBeGreaterThan(CURVES.linear(0.25));
    expect(CURVES.log(0.5)).toBeGreaterThan(CURVES.linear(0.5));
  });

  it("exp packs the light end (early grades have smaller output)", () => {
    // Inverse of log: early grades stay closer to 0; the curve only rises
    // sharply near t=1 (the light end).
    expect(CURVES.exp(0.25)).toBeLessThan(CURVES.linear(0.25));
    expect(CURVES.exp(0.5)).toBeLessThan(CURVES.linear(0.5));
  });
});

describe("curveFn — lookup with fallback", () => {
  it("returns the named function", () => {
    expect(curveFn("linear")).toBe(CURVES.linear);
    expect(curveFn("log")).toBe(CURVES.log);
  });

  it("falls back to ease for undefined", () => {
    expect(curveFn(undefined)).toBe(CURVES.ease);
  });
});

describe("DEFAULT_RAMP_CURVES", () => {
  it("assigns per-ramp defaults per Stage 1 §25b", () => {
    expect(DEFAULT_RAMP_CURVES.neutral).toBe("ease");
    expect(DEFAULT_RAMP_CURVES.brand).toBe("linear");
    expect(DEFAULT_RAMP_CURVES.accent).toBe("linear");
  });
});
