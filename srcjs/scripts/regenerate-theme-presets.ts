/**
 * Regenerate `src/lib/theme/theme-presets-v2.json` from the TS cascade resolver.
 *
 * Run after any change to `src/lib/theme/theme-resolve.ts`, `src/lib/oklch.ts`,
 * `src/lib/theme/theme-presets-inputs.ts`, or `src/lib/theme/theme-validate.ts` that
 * affects resolved output. Output JSON is the runtime preset table; the
 * resolver tests in `theme-resolve.test.ts` use this same file as the
 * drift-detection baseline.
 *
 * Usage: `bun run scripts/regenerate-theme-presets.ts`
 *
 * Why TS-canonical (not R-canonical): TS is the published runtime
 * (`@tabviz/core`). Making TS authoritative for snapshots aligns the
 * npm consumer experience with the JS theme-switcher path. The R-side
 * resolver continues to run server-side for R-rendered widgets; the
 * snapshot is the JS-only reference. Sub-perceptual divergence (~1-25
 * channels near gamut boundaries) between the two implementations no
 * longer matters because each is canonical in its own runtime.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  COCHRANE_DRAFT, LANCET_DRAFT, JAMA_DRAFT, DARK_DRAFT,
  NEJM_DRAFT, NATURE_DRAFT, BMJ_DRAFT,
  BAUHAUS_DRAFT, SWISS_DRAFT, TUFTE_DRAFT, NEWSPRINT_DRAFT,
  SOLARIZED_DRAFT, SOLARIZED_DARK_DRAFT, TONAL_DRAFT, TONAL_DARK_DRAFT,
  DWARVEN_DRAFT, ELVISH_DRAFT, HOBBIT_DRAFT,
} from "../src/lib/theme/theme-presets-inputs";
import { resolveTheme } from "../src/lib/theme/theme-resolve";

const presets = {
  cochrane:       resolveTheme(COCHRANE_DRAFT),
  lancet:         resolveTheme(LANCET_DRAFT),
  jama:           resolveTheme(JAMA_DRAFT),
  nejm:           resolveTheme(NEJM_DRAFT),
  nature:         resolveTheme(NATURE_DRAFT),
  bmj:            resolveTheme(BMJ_DRAFT),
  dark:           resolveTheme(DARK_DRAFT),
  bauhaus:        resolveTheme(BAUHAUS_DRAFT),
  swiss:          resolveTheme(SWISS_DRAFT),
  tufte:          resolveTheme(TUFTE_DRAFT),
  newsprint:      resolveTheme(NEWSPRINT_DRAFT),
  solarized:      resolveTheme(SOLARIZED_DRAFT),
  solarized_dark: resolveTheme(SOLARIZED_DARK_DRAFT),
  tonal:          resolveTheme(TONAL_DRAFT),
  tonal_dark:     resolveTheme(TONAL_DARK_DRAFT),
  dwarven:        resolveTheme(DWARVEN_DRAFT),
  elvish:         resolveTheme(ELVISH_DRAFT),
  hobbit:         resolveTheme(HOBBIT_DRAFT),
};

const outPath = resolve(__dirname, "..", "src", "lib", "theme-presets-v2.json");
writeFileSync(outPath, JSON.stringify(presets, null, 2) + "\n");
console.log(`✓ Wrote ${Object.keys(presets).length} TS-resolved presets to ${outPath}`);
