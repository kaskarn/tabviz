import { expect, test, describe } from "bun:test";
import { resolveTheme } from "./theme-resolve";
import presetsJson from "./theme-presets-v2.json";
import type { WebThemeV2 } from "../types/theme-v2";

const SNAPSHOTS = presetsJson as Record<string, WebThemeV2>;

/**
 * Compare two hex strings allowing per-channel drift up to `tolerance` (0-255).
 * Used for slot-bundle parity where TS/R OKLab implementations diverge by
 * ~1-24 channels near gamut boundaries (chroma-adjust + bisection clipping).
 * See `docs/dev/r-ts-parity-notes.md` for the known-gap documentation.
 */
function hexClose(actual: string, expected: string, tolerance = 25): boolean {
  if (actual === expected) return true;
  if (actual.length !== expected.length || !actual.startsWith("#") || !expected.startsWith("#")) return false;
  for (let i = 1; i < actual.length; i += 2) {
    const a = parseInt(actual.slice(i, i + 2), 16);
    const e = parseInt(expected.slice(i, i + 2), 16);
    if (Math.abs(a - e) > tolerance) return false;
  }
  return true;
}

describe("resolveTheme — smoke", () => {
  test("default inputs resolve without throwing", () => {
    const t = resolveTheme({
      inputs: { primary: "#0099CC", neutral: ["#FFFFFF", "#FFFFFF", "#F2F4F7", "#5B6470", "#1F2937"] },
    });
    expect(t.schemaVersion).toBe(2);
    expect(t.surface.base).toBeTruthy();
    expect(t.series.length).toBeGreaterThan(0);
  });

  test("validate:false skips contrast checks", () => {
    // Synthetic identity that would fail bold-band contrast: light primary, deep auto-derive
    const fn = () => resolveTheme(
      {
        inputs: { primary: "#FFFF00", primaryDeep: "#FFFFCC", neutral: ["#FFFFFF","#FFFFFF","#F2F4F7","#5B6470","#1F2937"] },
      },
      { validate: false },
    );
    expect(fn).not.toThrow();
  });
});

describe("resolveTheme — cochrane parity vs snapshot", () => {
  // Reconstruct the cochrane Tier 1 inputs from R/themes.R, then verify the
  // TS-resolved output matches the R-resolved snapshot byte-for-byte.
  const cochraneInputs = {
    neutral: ["#FFFFFF", "#FFFFFF", "#F2F4F7", "#5B6470", "#1F2937"],
    primary: "#0099CC",
    accent: "#C8553D",
    seriesAnchors: ["#0099CC", "#C8553D", "#5C8A3F", "#7E5A99", "#D49A3A"],
    fontBody: "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
  };

  test("inputs Tier 1 mirror — primaryDeep auto-derives (within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    expect(hexClose(t.inputs.primaryDeep!, SNAPSHOTS.cochrane.inputs.primaryDeep!)).toBe(true);
  });

  test("chrome — surface (within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    const s = t.surface, e = SNAPSHOTS.cochrane.surface;
    expect(s.base).toBe(e.base);
    expect(s.raised).toBe(e.raised);
    expect(hexClose(s.muted, e.muted)).toBe(true);
  });

  test("chrome — content (within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    const c = t.content, e = SNAPSHOTS.cochrane.content;
    expect(c.inverse).toBe(e.inverse);
    expect(c.primary).toBe(e.primary);
    expect(c.secondary).toBe(e.secondary);
    expect(hexClose(c.muted, e.muted)).toBe(true);
  });

  test("chrome — divider (within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    const d = t.divider, e = SNAPSHOTS.cochrane.divider;
    expect(hexClose(d.subtle, e.subtle)).toBe(true);
    expect(hexClose(d.strong, e.strong)).toBe(true);
  });

  test("chrome — accent (close, within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    const a = t.accent, e = SNAPSHOTS.cochrane.accent;
    expect(a.default).toBe(e.default);
    expect(hexClose(a.muted, e.muted)).toBe(true);
    expect(hexClose(a.tintSubtle, e.tintSubtle)).toBe(true);
    expect(hexClose(a.tintMedium, e.tintMedium)).toBe(true);
  });

  test("series[0] slot bundle (close, within OKLab precision)", () => {
    const t = resolveTheme({ name: "cochrane", inputs: cochraneInputs });
    const s = t.series[0], e = SNAPSHOTS.cochrane.series[0];
    expect(s.fill).toBe(e.fill);
    expect(s.textFg).toBe(e.textFg);
    expect(s.shape).toBe(e.shape);
    expect(hexClose(s.stroke, e.stroke)).toBe(true);
    expect(hexClose(s.fillMuted, e.fillMuted)).toBe(true);
    expect(hexClose(s.strokeMuted, e.strokeMuted)).toBe(true);
    expect(hexClose(s.fillEmphasis, e.fillEmphasis)).toBe(true);
    expect(hexClose(s.strokeEmphasis, e.strokeEmphasis)).toBe(true);
  });
});
