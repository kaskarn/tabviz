// Tests for the alpha companion ramp builder.

import { describe, it, expect } from "bun:test";
import { buildAlphaRamp } from "./alpha-ramp";

describe("buildAlphaRamp", () => {
  const ramp = buildAlphaRamp("#0099CC");

  it("produces 11 steps", () => {
    expect(ramp).toHaveLength(11);
  });

  it("every step is an oklch(...) string with alpha", () => {
    const pattern = /^oklch\(\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \/ \d+(\.\d+)?\)$/;
    for (const step of ramp) {
      expect(step).toMatch(pattern);
    }
  });

  it("alpha is monotonically non-decreasing", () => {
    const alphas = ramp.map((s) => {
      const m = s.match(/\/ ([\d.]+)\)$/);
      if (!m) throw new Error(`couldn't parse alpha from ${s}`);
      return parseFloat(m[1]!);
    });
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]!);
    }
  });

  it("first step is near-transparent (alpha ≈ 0.03)", () => {
    const m = ramp[0]!.match(/\/ ([\d.]+)\)$/);
    expect(parseFloat(m![1]!)).toBeCloseTo(0.03, 2);
  });

  it("last step is mostly opaque (alpha ≈ 0.93)", () => {
    const m = ramp[10]!.match(/\/ ([\d.]+)\)$/);
    const a = parseFloat(m![1]!);
    expect(a).toBeGreaterThan(0.85);
    expect(a).toBeLessThanOrEqual(0.95);
  });

  it("all steps preserve the same L / C / H (only alpha changes)", () => {
    const triples = ramp.map((s) => {
      const m = s.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+) \//);
      if (!m) throw new Error(`couldn't parse ${s}`);
      return { L: m[1]!, C: m[2]!, H: m[3]! };
    });
    for (let i = 1; i < triples.length; i++) {
      expect(triples[i]).toEqual(triples[0]!);
    }
  });

  it("different anchors produce different L/C/H triples", () => {
    const r1 = buildAlphaRamp("#FFFFFF");
    const r2 = buildAlphaRamp("#0099CC");
    // Strip alpha and compare LCH triples — should differ
    const stripAlpha = (s: string) => s.replace(/ \/ [\d.]+\)$/, ")");
    expect(stripAlpha(r1[5]!)).not.toBe(stripAlpha(r2[5]!));
  });
});
