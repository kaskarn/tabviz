// Preset web-font registry — the SINGLE source for which Google fonts
// each curated preset loads (2026-06-11, propagation-readiness flag #2).
//
// History: font URLs lived ONLY in R (R/font-urls.R) while the TS theme
// factories shipped `webFonts: []` — npm consumers' themeTerminal() never
// loaded Space Mono at all, and the R preset constructors were the sole
// carriers. With R presets now GENERATED from the TS literals, this table
// is the one place a preset's fonts are declared; R fetches it via the
// `presetWebFonts` V8 helper, and the TS factories attach it themselves.
//
// `gf()` mirrors the R helper of the same name: Google Fonts CSS2 URL
// with the family's standard weight axes + `display=swap`.

import type { WebFont } from "../../types/theme-resolved";
import type { PRESETS } from "./theme-presets-inputs";

type PresetName = keyof typeof PRESETS;

function gf(family: string, spec?: string): string {
  const familyQ = family.replace(/ /g, "+");
  return spec
    ? `https://fonts.googleapis.com/css2?family=${familyQ}:${spec}&display=swap`
    : `https://fonts.googleapis.com/css2?family=${familyQ}&display=swap`;
}

export const PRESET_WEB_FONTS: Readonly<Record<PresetName, readonly WebFont[]>> = {
  nejm: [
    { family: "Lora", url: gf("Lora", "ital,wght@0,400;0,500;0,600;1,400") },
  ],
  ledger: [
    { family: "Spectral", url: gf("Spectral", "ital,wght@0,400;0,500;0,600;1,400") },
    { family: "Spline Sans Mono", url: gf("Spline Sans Mono", "wght@400;500;600;700") },
  ],
  brutalist: [
    { family: "Archivo Black", url: gf("Archivo Black") },
    { family: "Darker Grotesque", url: gf("Darker Grotesque", "wght@700;800;900") },
  ],
  aurora: [
    { family: "Outfit", url: gf("Outfit", "wght@400;500;600;700") },
  ],
  terminal: [
    { family: "Space Mono", url: gf("Space Mono", "ital,wght@0,400;0,700;1,400") },
  ],
  newsprint: [
    { family: "Frank Ruhl Libre", url: gf("Frank Ruhl Libre", "wght@400;500;700") },
    { family: "Crimson Pro", url: gf("Crimson Pro", "wght@400;500;600;700") },
  ],
  blueprint: [
    { family: "Archivo", url: gf("Archivo", "wght@400;500;700;800") },
    { family: "IBM Plex Mono", url: gf("IBM Plex Mono", "wght@400;500;600;700") },
  ],
  synthwave: [
    { family: "JetBrains Mono", url: gf("JetBrains Mono", "wght@400;500;600;700") },
  ],
  dwarven: [
    { family: "EB Garamond", url: gf("EB Garamond", "ital,wght@0,400;0,500;0,600;0,700;1,400") },
    { family: "Cinzel", url: gf("Cinzel", "wght@400;500;600;700") },
    { family: "JetBrains Mono", url: gf("JetBrains Mono", "wght@400;500;600") },
  ],
};

/** The fonts a named preset loads (empty for unknown names). */
export function presetWebFonts(name: string): WebFont[] {
  return [...(PRESET_WEB_FONTS[name as PresetName] ?? [])];
}
