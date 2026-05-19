// Theme presets — the JS-side static table consumed when the in-widget
// theme switcher's `lookupTheme(name)` (which reads from the R-supplied
// `spec.interaction.enableThemes`) doesn't find a match. Also the
// fallback source for:
//
//   * Non-R consumers of `@tabviz/core` who built a spec without
//     enableThemes and want to call `instance.setTheme("jama")`
//   * Dev paths where the switcher fires before enableThemes arrives
//   * Programmatic TS authoring: `tabviz({ theme: "lancet", ... })`
//
// Journal presets (cochrane / lancet / jama / dark) read from R-resolved
// snapshots in `theme-presets-v2.json` for byte-identical R↔JS rendering.
// LOTR presets (dwarven / elvish / hobbit) aren't in the snapshot — they
// resolve at module load via the TS cascade resolver. The OKLab transform
// has ~1-25 channel of precision drift from R-side `farver`; see
// `docs/dev/r-ts-parity-notes.md`.
//
// To refresh the journal snapshots after an R-side cascade change:
//   R -e 'library(tabviz); cat(jsonlite::toJSON(list(
//     cochrane = tabviz:::serialize_theme(web_theme_cochrane()),
//     lancet   = tabviz:::serialize_theme(web_theme_lancet()),
//     jama     = tabviz:::serialize_theme(web_theme_jama()),
//     dark     = tabviz:::serialize_theme(web_theme_dark())
//   ), auto_unbox=TRUE, pretty=TRUE, null="null"))' > srcjs/src/lib/theme-presets-v2.json

import type { WebTheme } from "$types";
import presetsJson from "./theme-presets-v2.json";
import { themeDwarven, themeElvish, themeHobbit } from "./theme-api";

// Preset names. Journal presets first (clinical/publication), then LOTR
// (editorial easter-egg). The LOTR group is pre-release and may move to
// a separate package before CRAN submission.
export const THEME_NAMES = [
  "cochrane",
  "lancet",
  "jama",
  "dark",
  "dwarven",
  "elvish",
  "hobbit",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

const SNAPSHOT_PRESETS = presetsJson as Record<string, WebTheme>;

// Combine R-resolved snapshots (journals) with TS-resolved LOTR themes.
// LOTR themes resolve eagerly so the table is fully populated at module init.
export const THEME_PRESETS: Record<ThemeName, WebTheme> = {
  cochrane: SNAPSHOT_PRESETS.cochrane,
  lancet:   SNAPSHOT_PRESETS.lancet,
  jama:     SNAPSHOT_PRESETS.jama,
  dark:     SNAPSHOT_PRESETS.dark,
  dwarven:  themeDwarven() as unknown as WebTheme,
  elvish:   themeElvish() as unknown as WebTheme,
  hobbit:   themeHobbit() as unknown as WebTheme,
};

// Human-readable theme labels for the in-widget switcher UI.
export const THEME_LABELS: Record<ThemeName, string> = {
  cochrane: "Cochrane",
  lancet:   "Lancet",
  jama:     "JAMA",
  dark:     "Dark",
  dwarven:  "Dwarven",
  elvish:   "Elvish",
  hobbit:   "Hobbit",
};
