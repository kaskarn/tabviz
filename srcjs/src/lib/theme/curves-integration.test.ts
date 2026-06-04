// Integration tests verifying inputs.curves flows through buildRamps
// into oklchRamp's L progression.

import { describe, it, expect } from "bun:test";
import { buildRamps } from "./theme-resolve";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";
import { oklchRamp } from "../oklch";
import { CURVES } from "./curves";
import { hexToOklch } from "../oklch";
import type { ThemeInputs } from "../../types/theme-inputs";

describe("oklchRamp — curve option", () => {
  it("without curve, uses hand-tuned LIGHT_RAMP_L (v3 behavior)", () => {
    const default_ = oklchRamp("#0099CC", { mode: "light" });
    expect(default_.length).toBe(12);
    expect(default_[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("with curve, produces a different ramp than the hand-tuned default", () => {
    const default_ = oklchRamp("#0099CC", { mode: "light" });
    const linear = oklchRamp("#0099CC", { mode: "light", curve: CURVES.linear });
    // Linear curve interpolates between paper L (0.987) and ink L (0.180)
    // uniformly — different from the hand-tuned non-linear LIGHT_RAMP_L.
    // Middle steps should differ measurably.
    expect(default_[5]).not.toBe(linear[5]);
  });

  it("with linear curve, step 6 (index 5) lands near the midpoint L", () => {
    const linear = oklchRamp("#888888", { mode: "light", curve: CURVES.linear, chromaPeak: 0 });
    const lch = hexToOklch(linear[5]!);
    const Lmidpoint = 0.987 - (5 / 11) * (0.987 - 0.180);
    expect(lch.L).toBeCloseTo(Lmidpoint, 1);
  });

  it("log curve packs the dark end (lower L's earlier)", () => {
    const linear = oklchRamp("#888888", { mode: "light", curve: CURVES.linear, chromaPeak: 0 });
    const log = oklchRamp("#888888", { mode: "light", curve: CURVES.log, chromaPeak: 0 });
    // log pushes L lower (toward ink) faster — at middle steps, log L < linear L
    const linearMid = hexToOklch(linear[5]!).L;
    const logMid = hexToOklch(log[5]!).L;
    expect(logMid).toBeLessThan(linearMid);
  });

  it("exp curve packs the light end (higher L's earlier)", () => {
    const linear = oklchRamp("#888888", { mode: "light", curve: CURVES.linear, chromaPeak: 0 });
    const exp_ = oklchRamp("#888888", { mode: "light", curve: CURVES.exp, chromaPeak: 0 });
    const linearMid = hexToOklch(linear[5]!).L;
    const expMid = hexToOklch(exp_[5]!).L;
    expect(expMid).toBeGreaterThan(linearMid);
  });

  it("curve respects mode: dark mode reverses direction", () => {
    const light = oklchRamp("#888888", { mode: "light", curve: CURVES.linear, chromaPeak: 0 });
    const dark = oklchRamp("#888888", { mode: "dark", curve: CURVES.linear, chromaPeak: 0 });
    // light[0] is paper (lightest); dark[0] is ink (darkest)
    expect(hexToOklch(light[0]!).L).toBeGreaterThan(hexToOklch(dark[0]!).L);
    expect(hexToOklch(light[11]!).L).toBeLessThan(hexToOklch(dark[11]!).L);
  });

  it("curve endpoints match the L bounds (paper / ink)", () => {
    const linear = oklchRamp("#888888", { mode: "light", curve: CURVES.linear, chromaPeak: 0 });
    expect(hexToOklch(linear[0]!).L).toBeCloseTo(0.987, 1);
    expect(hexToOklch(linear[11]!).L).toBeCloseTo(0.180, 1);
  });
});

describe("buildRamps — inputs.curves wiring", () => {
  const baseInputs: ThemeInputs = inputsFromHex({ brand: "#0099CC", accent: "#C8553D" });

  it("ramps differ when inputs.curves.brand is set", () => {
    const base = buildRamps(baseInputs);
    const withLog = buildRamps({
      ...baseInputs,
      curves: { brand: "log" },
    });
    expect(base.brand[5]).not.toBe(withLog.brand[5]);
  });

  it("only the configured ramp is affected", () => {
    const base = buildRamps(baseInputs);
    const withBrandLog = buildRamps({
      ...baseInputs,
      curves: { brand: "log" },
    });
    // brand differs, neutral and accent stay the same
    expect(base.brand[5]).not.toBe(withBrandLog.brand[5]);
    expect(base.neutral[5]).toBe(withBrandLog.neutral[5]);
    expect(base.accent[5]).toBe(withBrandLog.accent[5]);
  });

  // v4 NOTE: the legacy `decorative` ramp/anchor is gone — every theme
  // now lives on neutral/brand/accent. The former
  // "decorative ramp shares the accent curve" assertion no longer has a
  // counterpart and was removed in A.6.
});

describe("resolveTheme — curves propagate through cssVars", () => {
  it("inputs.curves alters mid-ramp role values", () => {
    const base = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" })));
    const curved = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      curves: { neutral: "log" },
    })));
    // cell-border sources from role 'border-subtle' = neutral.6 (mid ramp);
    // the log curve shifts neutral L distribution most at the middle steps.
    expect(base.cssVars["--tv-cell-border"]).not.toBe(curved.cssVars["--tv-cell-border"]);
  });

  it("paper-end (grade 1) is stable across curves", () => {
    // Only grade 1 (= internal index 0 = Lpaper) is a true endpoint of the
    // curve. Higher grades land at interior L values and shift with curve.
    const base = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" })));
    const curved = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, {
      curves: { neutral: "log" },
    })));
    expect(base.cssVars["--tv-row-base-bg"]).toBe(curved.cssVars["--tv-row-base-bg"]);
  });
});
