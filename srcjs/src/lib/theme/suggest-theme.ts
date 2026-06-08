// suggest_theme — theme-rework Wave 4 (the LLM/brand flagship).
//
// Brand hex → a complete, contrast-safe ThemeInputs in one call. Derives
// paper / ink / accent from the brand hue and leans on the cascade's own
// guarantees (the min-contrast text walk, the validator) so the result is
// legible without the caller tuning anything. Cheap, deterministic, and the
// natural entry point for "make me a theme from our brand color".

import type { ThemeInputs, OklchTriple } from "../../types/theme-inputs";
import { hexToOklch, isValidHex } from "../oklch";

export interface SuggestThemeOptions {
  /** "light" (default) or "dark" starting polarity. */
  polarity?: "light" | "dark";
  /** Accent strategy: "complementary" (hue+180, default) or "analogous"
   *  (hue+30) or "mono" (reuse brand hue). */
  accent?: "complementary" | "analogous" | "mono";
  /** Theme name to stamp. */
  name?: string;
}

function clampC(c: number, max: number): number {
  return Math.max(0, Math.min(max, c));
}

/** Derive a contrast-safe ThemeInputs from a single brand hex. */
export function suggestTheme(brandHex: string, opts: SuggestThemeOptions = {}): ThemeInputs {
  if (!isValidHex(brandHex)) {
    throw new Error(`suggestTheme: "${brandHex}" is not a valid hex color (e.g. "#0066cc").`);
  }
  const brand = hexToOklch(brandHex);
  const polarity = opts.polarity ?? "light";

  // Paper: a barely-tinted near-white carrying a whisper of the brand hue —
  // enough to feel intentional, not enough to fight legibility. Ink: a deep
  // near-black with a trace of the same hue. (In dark polarity the resolver
  // reflects L, so we still author light→dark and let the cascade flip it.)
  const paper: OklchTriple = { L: 0.985, C: clampC(brand.C * 0.05, 0.008), H: brand.H };
  const ink: OklchTriple = { L: 0.22, C: clampC(brand.C * 0.25, 0.03), H: brand.H };

  const accentHue =
    opts.accent === "mono" ? brand.H
    : opts.accent === "analogous" ? (brand.H + 30) % 360
    : (brand.H + 180) % 360; // complementary (default)
  const accent: OklchTriple = { L: brand.L, C: brand.C, H: accentHue };

  return {
    anchors: { paper, ink, brand: { ...brand }, accent },
    polarity,
  } as ThemeInputs;
}
