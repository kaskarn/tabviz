// Theme presets — the JS-side static table consumed when the in-widget
// theme switcher's `lookupTheme(name)` (which reads from the R-supplied
// `spec.interaction.enableThemes`) doesn't find a match. The R-rendered
// path always supplies `enableThemes` in the wire, so this table is
// effectively the fallback for:
//
//   * Non-R consumers of `@tabviz/core` who built a spec without
//     enableThemes and want to call `instance.setTheme("jama")`
//   * Dev paths where the switcher fires before enableThemes arrives
//
// The four preset values below were captured from R's
// `serialize_theme(web_theme_X())` in 2026-05 — each is the resolved
// v2 wire shape (Tier 2/3 derivations from OKLCH math + density
// presets), embedded as static literals here so the JS package can
// reproduce R's 4 named looks without re-implementing the cascade.
//
// To refresh after a cascade change in R/utils-theme-resolve.R:
//   R -e 'library(tabviz); cat(jsonlite::toJSON(list(
//     cochrane = tabviz:::serialize_theme(web_theme_cochrane()),
//     lancet   = tabviz:::serialize_theme(web_theme_lancet()),
//     jama     = tabviz:::serialize_theme(web_theme_jama()),
//     dark     = tabviz:::serialize_theme(web_theme_dark())
//   ), auto_unbox=TRUE, pretty=TRUE, null="null"))' > srcjs/src/lib/theme-presets-v2.json

import type { WebTheme } from "$types";
import presetsJson from "./theme-presets-v2.json";

// Preset names. Round 2 trimmed to four canonical presets:
// the default (Cochrane), two journal identities (Lancet, JAMA),
// and a single dark-mode option. The five removed presets have
// migration paths documented in NEWS.md.
export const THEME_NAMES = [
  "cochrane",
  "lancet",
  "jama",
  "dark",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_PRESETS: Record<ThemeName, WebTheme> = presetsJson as Record<ThemeName, WebTheme>;

// Human-readable theme labels for the in-widget switcher UI.
export const THEME_LABELS: Record<ThemeName, string> = {
  cochrane: "Cochrane",
  lancet:   "Lancet",
  jama:     "JAMA",
  dark:     "Dark",
};
