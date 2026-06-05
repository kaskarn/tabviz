// Contrast-validator CI gate (adversarial color review H3/H4 closure).
//
// validateResolvedTheme existed but was DEAD CODE — nothing called it, so
// its contrast invariants never ran and a systemic text-subtle AA failure
// shipped across all presets. This gate runs the validator in throw-mode
// over every preset; buildTheme additionally runs it warn-only on every
// theme build (dev only).

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { PRESETS } from "./theme-presets-inputs";
import { validateResolvedTheme, ThemeValidationError, validateThemeInputs } from "./theme-validate";

describe("validateResolvedTheme — preset contrast gate", () => {
  for (const [name, inputs] of Object.entries(PRESETS)) {
    it(`${name}: all contrast invariants pass`, () => {
      const theme = buildTheme(inputs, name);
      // Throws ThemeValidationError listing every failing invariant.
      validateResolvedTheme(theme);
    });
  }

  it("a zero-contrast theme fails with a ThemeValidationError", () => {
    // Paper and ink at the same lightness — text on surface is unreadable.
    const theme = buildTheme(
      {
        anchors: {
          paper: { L: 0.5, C: 0.01, H: 250 },
          ink:   { L: 0.5, C: 0.01, H: 250 },
          brand: { L: 0.5, C: 0.1,  H: 250 },
        },
      },
      "zero-contrast",
    );
    expect(() => validateResolvedTheme(theme)).toThrow(ThemeValidationError);
  });
});

describe("validateThemeInputs — construction-time checks", () => {
  it("rejects an out-of-range anchor L", () => {
    expect(() =>
      validateThemeInputs({
        anchors: { paper: { L: 1.5, C: 0, H: 0 } },
      } as never),
    ).toThrow();
  });

  it("rejects a bad enum", () => {
    expect(() =>
      validateThemeInputs({ shell_mode: "levitating" } as never),
    ).toThrow();
  });

  it("accepts every shipped preset's inputs", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      try {
        validateThemeInputs(inputs);
      } catch (e) {
        throw new Error(`preset ${name}: ${(e as Error).message}`);
      }
    }
  });
});
