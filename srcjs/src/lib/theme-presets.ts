// Theme presets — the JS-side static table consumed when the in-widget
// theme switcher's `lookupTheme(name)` (which reads from the R-supplied
// `spec.interaction.enableThemes`) doesn't find a match. Also the source
// for:
//
//   * Non-R consumers of `@tabviz/core` who built a spec without
//     enableThemes and want to call `instance.setTheme("jama")`
//   * Dev paths where the switcher fires before enableThemes arrives
//   * Programmatic TS authoring: `tabviz({ theme: "lancet", ... })`
//
// Snapshot regenerated from the TS cascade resolver (`theme-resolve.ts`).
// TS is canonical for JS-side themes — the R-side resolver continues to
// run server-side for R-rendered widgets, but the snapshot here is the
// JS-only reference. Sub-perceptual divergence (~1-25 channels near gamut
// boundaries) between the two implementations is documented in
// `docs/dev/r-ts-parity-notes.md` and no longer matters: each runtime is
// canonical in its own context.
//
// To refresh after a cascade change:
//   cd srcjs && bun run scripts/regenerate-theme-presets.ts

import type { WebTheme } from "$types";
import presetsJson from "./theme-presets-v2.json";

// Preset names, grouped by category in declaration order. Categories
// mirror R's `package_themes()` 2-level list shape:
//   * journals: clinical / publication identities
//   * design:   design-movement interpretations (light + dark pairs
//               for solarized & tonal via WebThemeV2.lightDarkPair)
//   * lotr:     editorial easter-egg themes
export const THEME_NAMES = [
  "cochrane",
  "lancet",
  "jama",
  "nejm",
  "nature",
  "bmj",
  "dark",
  "bauhaus",
  "swiss",
  "tufte",
  "newsprint",
  "solarized",
  "solarized_dark",
  "tonal",
  "tonal_dark",
  "dwarven",
  "elvish",
  "hobbit",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_PRESETS = presetsJson as Record<ThemeName, WebTheme>;

// Human-readable theme labels for the in-widget switcher UI.
export const THEME_LABELS: Record<ThemeName, string> = {
  cochrane:       "Cochrane",
  lancet:         "Lancet",
  jama:           "JAMA",
  nejm:           "NEJM",
  nature:         "Nature",
  bmj:            "BMJ",
  dark:           "Dark",
  bauhaus:        "Bauhaus",
  swiss:          "Swiss",
  tufte:          "Tufte",
  newsprint:      "Newsprint",
  solarized:      "Solarized",
  solarized_dark: "Solarized Dark",
  tonal:          "Tonal",
  tonal_dark:     "Tonal Dark",
  dwarven:        "Dwarven",
  elvish:         "Elvish",
  hobbit:         "Hobbit",
};
