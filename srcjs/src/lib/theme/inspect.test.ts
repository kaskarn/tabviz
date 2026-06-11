// Tests for the inspect helpers (inspectToken + listComponentTokens).

import { describe, it, expect } from "bun:test";
import { inspectToken, formatTrace, listComponentTokens } from "./inspect";
import { resolveTheme } from "./resolve-theme";
import { createWire, setRoleBinding } from "./theme-wire";
import { inputsFromHex } from "./theme-presets-inputs";
import type { ThemeInputs } from "../../types/theme-inputs";

const COCHRANE: ThemeInputs = inputsFromHex({ brand: "#0099CC", accent: "#C8553D" });

describe("inspectToken — trace walk", () => {
  const resolved = resolveTheme(createWire(COCHRANE));

  it("returns the manifest entry for a known token", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.cssVar).toBe("--tv-row-base-bg");
    expect(r.token).not.toBeNull();
    expect(r.token!.kind).toBe("paint-fill");
  });

  it("accepts both the bare leaf and the full cssVar", () => {
    const a = inspectToken(resolved, "row-base-bg");
    const b = inspectToken(resolved, "--tv-row-base-bg");
    expect(a.token).toEqual(b.token);
    expect(a.resolved).toBe(b.resolved);
  });

  it("returns null token for unknown names", () => {
    const r = inspectToken(resolved, "totally-fake-token");
    expect(r.token).toBeNull();
    expect(r.trace).toEqual([]);
    expect(r.resolved).toBeNull();
  });

  it("trace includes Tier 3 (component) step first", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.trace[0]!.tier).toBe("component");
    if (r.trace[0]!.tier === "component") {
      expect(r.trace[0]!.cssVar).toBe("--tv-row-base-bg");
      expect(r.trace[0]!.value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("trace descends to Tier 2 role for role-sourced tokens", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.trace[1]!.tier).toBe("role");
    if (r.trace[1]!.tier === "role") {
      expect(r.trace[1]!.role).toBe("surface");
    }
  });

  it("trace descends to Tier 1 ramp-grade for role-sourced tokens", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.trace[2]!.tier).toBe("ramp-grade");
    if (r.trace[2]!.tier === "ramp-grade") {
      // 'surface' role defaults to neutral.1
      expect(r.trace[2]!.ramp).toBe("neutral");
      expect(r.trace[2]!.grade).toBe(1);
    }
  });

  it("highlight-bg trace marks alpha = true", () => {
    const r = inspectToken(resolved, "row-emphasis-bg");
    const rampGradeStep = r.trace.find((s) => s.tier === "ramp-grade");
    expect(rampGradeStep).toBeDefined();
    if (rampGradeStep?.tier === "ramp-grade") {
      expect(rampGradeStep.alpha).toBe(true);
    }
  });

  it("input-sourced tokens (spacing) trace to input tier", () => {
    const r = inspectToken(resolved, "spacing-row-height");
    expect(r.trace[1]!.tier).toBe("input");
    if (r.trace[1]!.tier === "input") {
      expect(r.trace[1]!.input).toBe("density");
      expect(r.trace[1]!.value).toBe("24px");
    }
  });

  it("const-sourced tokens trace to const tier", () => {
    // Earlier const exemplars (--tv-cell-bg, --tv-hc-caret-char) were
    // deleted in the 2026-06-10 dead-code passes; the reserved
    // --tv-spacing-cell-padding-y is the surviving const token.
    const r = inspectToken(resolved, "spacing-cell-padding-y");
    expect(r.trace[1]!.tier).toBe("const");
  });

  it("consumedBy reflects the manifest's declared consumers", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.consumedBy.length).toBeGreaterThan(0);
    expect(r.consumedBy).toContain("export/svg-generator.ts");
  });

  it("resolved value matches resolved.cssVars[cssVar]", () => {
    const r = inspectToken(resolved, "row-base-bg");
    expect(r.resolved).toBe(resolved.cssVars["--tv-row-base-bg"]!);
  });
});

describe("inspectToken — override reflection", () => {
  it("override changes the resolved value visible to inspect", () => {
    const base = resolveTheme(createWire(COCHRANE));
    const customized = resolveTheme(
      setRoleBinding(createWire(COCHRANE), "surface", "brand", 1),
    );
    const baseInsp = inspectToken(base, "row-base-bg");
    const customInsp = inspectToken(customized, "row-base-bg");
    expect(baseInsp.resolved).not.toBe(customInsp.resolved);
    // The ramp-grade step reflects the new binding
    const customRG = customInsp.trace.find((s) => s.tier === "ramp-grade");
    if (customRG?.tier === "ramp-grade") {
      expect(customRG.ramp).toBe("brand");
      expect(customRG.grade).toBe(1);
    }
  });
});

describe("formatTrace", () => {
  it("produces a readable string for a known token", () => {
    const resolved = resolveTheme(createWire(COCHRANE));
    const insp = inspectToken(resolved, "row-base-bg");
    const out = formatTrace(insp);
    expect(out).toContain("--tv-row-base-bg");
    expect(out).toContain("[Tier 3]");
    expect(out).toContain("[Tier 2]");
    expect(out).toContain("[Tier 1]");
  });

  it("produces a 'not found' message for unknown tokens", () => {
    const resolved = resolveTheme(createWire(COCHRANE));
    const insp = inspectToken(resolved, "totally-fake-token");
    const out = formatTrace(insp);
    expect(out).toContain("not in COMPONENT_TOKENS");
  });
});

describe("listComponentTokens", () => {
  it("returns one entry per COMPONENT_TOKENS entry", () => {
    const list = listComponentTokens();
    // 40 manifest entries currently
    expect(list.length).toBeGreaterThanOrEqual(40);
  });

  it("each entry has cssVar, kind, sourceTier, sourceLabel", () => {
    const list = listComponentTokens();
    for (const e of list) {
      expect(e.cssVar).toMatch(/^--tv-/);
      expect(e.kind).toBeTruthy();
      expect(e.sourceTier).toBeTruthy();
      expect(e.sourceLabel).toBeTruthy();
    }
  });

  it("without resolved theme, entries don't have resolved field", () => {
    const list = listComponentTokens();
    for (const e of list) {
      expect(e.resolved).toBeUndefined();
    }
  });

  it("with resolved theme, entries have resolved value", () => {
    const resolved = resolveTheme(createWire(COCHRANE));
    const list = listComponentTokens(resolved);
    for (const e of list) {
      expect(e.resolved).toBeDefined();
    }
  });
});
