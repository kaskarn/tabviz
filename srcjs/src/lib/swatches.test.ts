// Tests for resolveSwatches — the 8-color palette derived from a v2
// WebTheme for the in-widget color-picker quick palette.
//
// Re-authored against the v2 cascade (Phase 0c-C5). The v1 "explicit
// swatches array" concept retired; the resolver now always derives 8
// colors from the theme's inputs + chrome roles (primary, accent,
// content secondary/muted/primary, divider subtle, surface base,
// row base bg).

import { expect, test, describe } from "bun:test";
import { resolveSwatches } from "./swatches";
import { THEME_PRESETS } from "./theme/theme-presets";

describe("resolveSwatches", () => {
  test("returns [] when theme is null/undefined", () => {
    expect(resolveSwatches(null)).toEqual([]);
    expect(resolveSwatches(undefined)).toEqual([]);
  });

  test("returns 8 colors for any resolved v2 theme", () => {
    for (const name of ["cochrane", "lancet", "jama", "dark"] as const) {
      const sw = resolveSwatches(THEME_PRESETS[name]);
      expect(sw.length).toBe(8);
      // Every slot is a non-empty hex-ish string (we don't validate
      // hex syntax here; the v2 cascade guarantees concrete values).
      for (const s of sw) expect(typeof s === "string" && s.length > 0).toBe(true);
    }
  });

  test("first slot is a valid hex (V4: brand routes through accent)", () => {
    const sw = resolveSwatches(THEME_PRESETS.cochrane);
    expect(sw[0]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("themes have distinct first slots (different brands)", () => {
    const firsts = ["cochrane", "lancet", "jama", "dark"].map(
      (n) => resolveSwatches(THEME_PRESETS[n as keyof typeof THEME_PRESETS])[0],
    );
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });
});
