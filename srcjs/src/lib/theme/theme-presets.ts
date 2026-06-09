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
// Resolved at module-load time via the theme adapter; the
// inputs in `theme-presets-inputs.ts` are the source of truth.

import type { WebTheme } from "$types";
import { PRESETS } from "./theme-presets-inputs";
import { buildTheme } from "./theme-adapter";

// The 9 committed identities (27→9 cull, 2026-06-09) — one per axis, in
// switcher display order. Must stay in lockstep with PRESETS in
// theme-presets-inputs.ts (and R's package_themes()).
export const THEME_NAMES = [
  "nejm",       // Clinical / restraint (default)
  "ledger",     // COLOR
  "brutalist",  // GEOMETRY
  "aurora",     // EFFECTS
  "terminal",   // ALIASING
  "newsprint",  // TEXTURE
  "blueprint",  // DRAFT / GRID
  "synthwave",  // NEON
  "dwarven",    // FANTASY / display-serif
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_PRESETS: Record<ThemeName, WebTheme> = Object.fromEntries(
  THEME_NAMES.map((name) => [name, buildTheme(PRESETS[name], name)]),
) as Record<ThemeName, WebTheme>;

// Human-readable theme labels for the in-widget switcher UI.
export const THEME_LABELS: Record<ThemeName, string> = {
  nejm:           "NEJM",
  ledger:         "Ledger",
  brutalist:      "Brutalist",
  aurora:         "Aurora",
  terminal:       "Terminal",
  newsprint:      "Newsprint",
  blueprint:      "Blueprint",
  synthwave:      "Synthwave",
  dwarven:        "Dwarven",
};
