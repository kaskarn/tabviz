// Regression guard for the theme-switcher "Cannot read properties of
// undefined (reading 'rowHeight')" crash (2026-06-14).
//
// ROOT: the D13 theme roster carries SLIM envelopes — `{name, authoringInputs,
// roleOverrides?, components?, pins?, webFonts?}`, ~10x lighter than a resolved
// WebTheme (no spacing/layout/row cluster). The theme switcher's dropdown
// previews (`themeColors`/`fontFor`) fed these straight into `getCssVars`,
// whose `applySpacingPins` read `theme.spacing.rowHeight` off an undefined
// `spacing` → uncaught TypeError on dropdown OPEN. Same partial-theme class as
// the B1 containerBorder crash, one read deeper.
//
// TWO layers now protect this, both asserted here:
//   1. ThemeSwitcher resolves slim envelopes via buildTheme before any
//      getCssVars consumer touches them (resolveSlim — not unit-testable in
//      isolation; covered structurally by layer 2 + the buildTheme roundtrip).
//   2. applySpacingPins skips the spacing pins when `theme.spacing` is absent,
//      so getCssVars NEVER throws on a slim envelope regardless of caller.
//
// Uses vitest (not bun): buildTheme pulls oklch → @stdlib, which bun's runner
// can't resolve (see CLAUDE.md runner-split note).

import { describe, expect, test } from "vitest";
import { buildTheme } from "$lib/theme/theme-adapter";
import { getCssVars, readAccentDefault } from "$lib/theme/consumer-bridge";
import { PRESETS } from "$lib/theme/theme-presets-inputs";
import type { WebTheme } from "$types";

// Construct a D13 slim envelope exactly as the wire roster carries it: the
// authoring inputs + name, but NONE of the resolved cluster fields.
function slimEnvelope(name: string): WebTheme {
  return { name, authoringInputs: PRESETS[name]! } as unknown as WebTheme;
}

describe("slim-envelope resolution (theme-switch rowHeight crash)", () => {
  test("getCssVars does NOT throw on a slim envelope (layer 2)", () => {
    const slim = slimEnvelope("nejm");
    expect(slim.spacing).toBeUndefined(); // precondition: it IS the crash shape
    // Before the fix this threw "Cannot read properties of undefined
    // (reading 'rowHeight')". Now it degrades gracefully (no spacing pins).
    expect(() => getCssVars(slim)).not.toThrow();
  });

  test("resolving the slim envelope via buildTheme yields a working theme", () => {
    const slim = slimEnvelope("nejm");
    const resolved = buildTheme(slim.authoringInputs!, { name: "nejm" }) as WebTheme;
    // Resolution materializes the clusters the renderers + consumer bridge read.
    expect(resolved.spacing).toBeDefined();
    expect(typeof resolved.spacing.rowHeight).toBe("number");
    expect((resolved as { row?: unknown }).row).toBeDefined();
    // getCssVars on the RESOLVED theme emits the spacing pin (the value the
    // dropdown swatches/figure actually consume).
    const vars = getCssVars(resolved);
    expect(vars["--tv-spacing-row-height"]).toBe(`${resolved.spacing.rowHeight}px`);
  });

  test("distinct presets resolve to distinct accent vars (no cross-contamination)", () => {
    // Guards the switcher's by-name memoization: each name must resolve from
    // its OWN inputs, never alias another theme's resolved blob.
    const names = ["nejm", "synthwave", "terminal"].filter((n) => PRESETS[n]);
    const accents = names.map((n) => {
      const resolved = buildTheme(PRESETS[n]!, { name: n }) as WebTheme;
      return readAccentDefault(getCssVars(resolved));
    });
    expect(new Set(accents).size).toBe(accents.length);
  });
});
