// D42 — proves the `spacing_overrides` authoring input reaches the resolved
// theme.spacing cluster AND the emitted cssVars (via the applySpacingPins
// overlay), and composes correctly with density × density_factor.

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { getCssVars, readVarPx } from "./consumer-bridge";
import { NEJM } from "./theme-presets-inputs";

describe("spacing_overrides resolution", () => {
  it("override reaches the resolved theme.spacing cluster", () => {
    const base = buildTheme({ ...NEJM, density: "comfortable" }, "t");
    const over = buildTheme(
      { ...NEJM, density: "comfortable", spacing_overrides: { rowHeight: 44 } },
      "t",
    );
    expect(base.spacing.rowHeight).not.toBe(44);
    expect(over.spacing.rowHeight).toBe(44);
    // untouched tokens keep their density-derived value
    expect(over.spacing.headerHeight).toBe(base.spacing.headerHeight);
  });

  it("override reaches the emitted cssVars (applySpacingPins overlay)", () => {
    const theme = buildTheme(
      { ...NEJM, spacing_overrides: { cellPaddingX: 3, footerGap: 21 } },
      "t",
    );
    const cssVars = getCssVars(theme);
    expect(readVarPx(cssVars, "--tv-spacing-cell-padding-x", -1)).toBe(3);
    expect(readVarPx(cssVars, "--tv-spacing-footer-gap", -1)).toBe(21);
  });

  it("groupPadding override flows via the object-path cluster (not cssVar-pinned)", () => {
    const theme = buildTheme({ ...NEJM, spacing_overrides: { groupPadding: 30 } }, "t");
    expect(theme.spacing.groupPadding).toBe(30);
  });

  it("indentPerLevel override flows to rowGroup.indentPerLevel (the DOM source)", () => {
    const theme = buildTheme({ ...NEJM, spacing_overrides: { indentPerLevel: 28 } }, "t");
    expect(theme.spacing.indentPerLevel).toBe(28);
    expect(theme.rowGroup.indentPerLevel).toBe(28);
  });

  it("composition: override is absolute px — wins over density_factor", () => {
    // factor would scale rowHeight; the override pins it regardless.
    const theme = buildTheme(
      { ...NEJM, density: "comfortable", density_factor: 1.5, spacing_overrides: { rowHeight: 44 } },
      "t",
    );
    expect(theme.spacing.rowHeight).toBe(44);
  });

  it("override survives a density change (rides inputs)", () => {
    const compact = buildTheme(
      { ...NEJM, density: "compact", spacing_overrides: { rowHeight: 44 } },
      "t",
    );
    const spacious = buildTheme(
      { ...NEJM, density: "spacious", spacing_overrides: { rowHeight: 44 } },
      "t",
    );
    expect(compact.spacing.rowHeight).toBe(44);
    expect(spacious.spacing.rowHeight).toBe(44);
    // non-overridden token still re-bases with density
    expect(compact.spacing.headerHeight).not.toBe(spacious.spacing.headerHeight);
  });

  it("non-finite override value is filtered (defense-in-depth)", () => {
    const base = buildTheme(NEJM, "t");
    const poisoned = buildTheme({ ...NEJM, spacing_overrides: { rowHeight: NaN as number } }, "t");
    expect(poisoned.spacing.rowHeight).toBe(base.spacing.rowHeight);
  });
});
