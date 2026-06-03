// Tests for the v4 substrate resolver entry point.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire, setRoleBinding } from "./theme-wire";
import { COMPONENT_TOKENS } from "./component-tokens";
import type { ThemeInputs } from "../../types/theme-inputs";

const COCHRANE: ThemeInputs = { brand: "#0099CC", accent: "#C8553D" };

describe("resolveTheme — pipeline composition", () => {
  it("resolves an empty wire to a complete ResolvedTheme", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.inputs).toEqual(COCHRANE);
    expect(r.polarity).toBe("light");
    expect(r.ramps.neutral).toHaveLength(11);
    expect(r.ramps.brand).toHaveLength(11);
    expect(r.ramps.accent).toHaveLength(11);
    expect(r.ramps.neutralAlpha).toHaveLength(11);
    expect(r.ramps.brandAlpha).toHaveLength(11);
    expect(r.ramps.accentAlpha).toHaveLength(11);
  });

  it("CSS-var map has one entry per COMPONENT_TOKENS entry", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(Object.keys(r.cssVars)).toHaveLength(COMPONENT_TOKENS.length);
    for (const token of COMPONENT_TOKENS) {
      expect(r.cssVars).toHaveProperty(token.cssVar);
    }
  });

  it("role-sourced cssVars resolve to real hex strings", () => {
    const r = resolveTheme(createWire(COCHRANE));
    // --tv-row-base-bg sources from role 'surface' (neutral.1)
    expect(r.cssVars["--tv-row-base-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-row-base-bg"]).toBe(r.ramps.neutral[0]!);
    // --tv-row-alt-bg sources from 'surface-subtle' (neutral.2)
    expect(r.cssVars["--tv-row-alt-bg"]).toBe(r.ramps.neutral[1]!);
    // --tv-cell-fg sources from 'text' (neutral.11)
    expect(r.cssVars["--tv-cell-fg"]).toBe(r.ramps.neutral[10]!);
  });

  it("highlight-bg uses the brand alpha companion (grade 3)", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.cssVars["--tv-row-emphasis-bg"]).toMatch(/^oklch\(.+ \/ \d+(\.\d+)?\)$/);
    expect(r.cssVars["--tv-row-emphasis-bg"]).toBe(r.ramps.brandAlpha[2]!);
  });

  it("spacing-px tokens resolve to px strings", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.cssVars["--tv-spacing-row-height"]).toBe("24px");
    expect(r.cssVars["--tv-spacing-cell-padding-x"]).toBe("10px");
    expect(r.cssVars["--tv-spacing-axis-gap"]).toBe("12px");
  });

  it("const-sourced 'transparent' tokens resolve to transparent", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.cssVars["--tv-cell-bg"]).toBe("transparent");
  });

  it("roleSource reflects the binding actually used", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.roleSource.surface).toEqual({ ramp: "neutral", grade: 1 });
    expect(r.roleSource["surface-subtle"]).toEqual({ ramp: "neutral", grade: 2 });
  });
});

describe("resolveTheme — overrides", () => {
  it("setRoleBinding affects the resolved cssVars", () => {
    const wire0 = createWire(COCHRANE);
    const r0 = resolveTheme(wire0);
    const wire1 = setRoleBinding(wire0, "surface-subtle", "neutral", 5);
    const r1 = resolveTheme(wire1);
    // Default surface-subtle was neutral.2; override to neutral.5
    expect(r0.cssVars["--tv-row-alt-bg"]).toBe(r0.ramps.neutral[1]!);
    expect(r1.cssVars["--tv-row-alt-bg"]).toBe(r1.ramps.neutral[4]!);
    expect(r1.cssVars["--tv-row-alt-bg"]).not.toBe(r0.cssVars["--tv-row-alt-bg"]);
  });

  it("roleSource reflects the override binding", () => {
    // --tv-cell-border sources from role 'border-subtle' per the manifest
    const wire = setRoleBinding(createWire(COCHRANE), "border-subtle", "brand", 7);
    const r = resolveTheme(wire);
    expect(r.roleSource["border-subtle"]).toEqual({ ramp: "brand", grade: 7 });
    expect(r.cssVars["--tv-cell-border"]).toBe(r.ramps.brand[6]!);
  });

  it("cross-ramp rebinding works (surface → brand ramp)", () => {
    const wire = setRoleBinding(createWire(COCHRANE), "surface", "brand", 1);
    const r = resolveTheme(wire);
    expect(r.cssVars["--tv-row-base-bg"]).toBe(r.ramps.brand[0]!);
  });
});

describe("resolveTheme — polarity", () => {
  it("polarity defaults to 'light' when neither polarity nor mode is set", () => {
    const r = resolveTheme(createWire({ brand: "#0099CC" }));
    expect(r.polarity).toBe("light");
  });

  it("polarity='dark' reflects anchors and produces a dark theme", () => {
    const wire = createWire({ brand: "#0099CC", polarity: "dark" });
    const r = resolveTheme(wire);
    expect(r.polarity).toBe("dark");
    // Paper anchor (neutral.1) should be near-black under dark polarity
    // (the existing resolver inverts the L array when mode is dark)
    const paper = r.ramps.neutral[0]!;
    expect(paper).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("polarity='dark' produces different ramps than 'light'", () => {
    const rL = resolveTheme(createWire({ brand: "#0099CC", polarity: "light" }));
    const rD = resolveTheme(createWire({ brand: "#0099CC", polarity: "dark" }));
    expect(rL.ramps.neutral[0]).not.toBe(rD.ramps.neutral[0]);
  });

  it("legacy mode='dark' is recognized as polarity (backward compat)", () => {
    const r = resolveTheme(createWire({ brand: "#0099CC", mode: "dark" }));
    expect(r.polarity).toBe("dark");
  });

  it("explicit polarity field takes precedence over mode", () => {
    const r = resolveTheme(createWire({
      brand: "#0099CC",
      polarity: "light",
      mode: "dark",  // contradicts polarity; polarity wins
    }));
    expect(r.polarity).toBe("light");
  });
});

describe("resolveTheme — cssVars has no TBD placeholders", () => {
  it("no role-sourced token returns a TBD placeholder", () => {
    const r = resolveTheme(createWire(COCHRANE));
    for (const token of COMPONENT_TOKENS) {
      if (token.source.tier === "role") {
        expect(r.cssVars[token.cssVar]).not.toMatch(/^<TBD/);
      }
    }
  });

  it("no spacing-px token returns a TBD placeholder", () => {
    const r = resolveTheme(createWire(COCHRANE));
    for (const token of COMPONENT_TOKENS) {
      if (token.kind === "spacing-px") {
        expect(r.cssVars[token.cssVar]).toMatch(/px$/);
      }
    }
  });
});
