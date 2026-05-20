/**
 * Tier 1 inputs for every package preset — TS source of truth for theme
 * identity. Mirrors `R/themes.R` (cochrane / lancet / jama / dark) and
 * `R/themes-lotr.R` (dwarven / elvish / hobbit).
 *
 * Why this file:
 * - For programmatic TS construction (`themeLancet({ overrides: ... })`)
 *   the resolver needs Tier 1 inputs — it can't extract them from the
 *   R-resolved snapshot in `theme-presets-v2.json` (which has Tier 1 merged
 *   with all derived values).
 * - For runtime lookup by name (`{ theme: "lancet" }` in a WebSpec), the
 *   journal presets read from the R-resolved snapshot for byte-identical
 *   R↔JS rendering. LOTR themes (not in the snapshot) resolve from these
 *   inputs at module load.
 *
 * Keep this file in sync with R when preset identity changes — parity
 * tests in `theme-resolve.test.ts` pin the journal presets against the
 * R-resolved snapshot to catch drift.
 */

import type { ResolveDraft } from "./theme-resolve";

// Internal: shorthand for a Google-Fonts webfont entry.
const GF = (family: string, params: string) => ({
  family,
  url: `https://fonts.googleapis.com/css2?family=${params}&display=swap`,
});

// ────────────────────────────────────────────────────────────────────
// Journal presets — mirror R/themes.R
// ────────────────────────────────────────────────────────────────────

export const COCHRANE_DRAFT: ResolveDraft = {
  name: "cochrane",
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F2F4F7", "#5B6470", "#1F2937"],
    primary: "#0099CC",
    accent: "#C8553D",
    seriesAnchors: ["#0099CC", "#C8553D", "#5C8A3F", "#7E5A99", "#D49A3A"],
    fontBody: "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
  },
  variants: { density: "comfortable" },
};

export const LANCET_DRAFT: ResolveDraft = {
  name: "lancet",
  inputs: {
    neutral: ["#FDFCFB", "#FDFCFB", "#F8F7F5", "#3D5A80", "#1E3A5F"],
    primary: "#00407A",
    primaryDeep: "#002D54",
    accent: "#A6792A",
    seriesAnchors: ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F"],
    fontBody: "Georgia, 'Times New Roman', serif",
    fontDisplay: "Georgia, 'Times New Roman', serif",
  },
  variants: { density: "comfortable" },
};

export const JAMA_DRAFT: ResolveDraft = {
  name: "jama",
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F9FAFB", "#555555", "#000000"],
    primary: "#000000",
    primaryDeep: "#000000",
    accent: "#000000",
    seriesAnchors: ["#1A1A1A", "#4A4A4A", "#7A7A7A", "#9A9A9A", "#BABABA"],
    fontBody: "Arial, Helvetica, sans-serif",
  },
  variants: { density: "compact" },
  overrides: {
    divider: { subtle: "#000000", strong: "#000000" },
    spacing: {
      rowHeight: 18, headerHeight: 24, padding: 6, cellPaddingX: 8,
    },
  },
};

export const NEJM_DRAFT: ResolveDraft = {
  name: "nejm",
  webFonts: [
    GF("Source Serif Pro", "Source+Serif+Pro:wght@400;600;700"),
  ],
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F8F6F2", "#5A6470", "#1F2A3A"],
    primary: "#1F3D5F",
    primaryDeep: "#0F2640",
    accent: "#A52E2E",
    seriesAnchors: ["#1F3D5F", "#A52E2E", "#5F7A3F", "#7A5D8C", "#B88D3F"],
    fontBody: "'Source Serif Pro', Georgia, 'Times New Roman', serif",
    fontDisplay: "'Source Serif Pro', Georgia, 'Times New Roman', serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    row: { banding: "none" },
  },
};

export const NATURE_DRAFT: ResolveDraft = {
  name: "nature",
  webFonts: [
    GF("PT Serif", "PT+Serif:wght@400;700"),
  ],
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F5F2EE", "#5C5550", "#1A1A1A"],
    primary: "#E64626",
    primaryDeep: "#A8311A",
    secondary: "#2C2C2C",
    accent: "#3B7FA9",
    seriesAnchors: ["#E64626", "#3B7FA9", "#5C8A3F", "#B88D3F", "#7A5D8C"],
    fontBody: "'PT Serif', Georgia, 'Times New Roman', serif",
    fontDisplay: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  variants: { density: "comfortable" },
};

export const BMJ_DRAFT: ResolveDraft = {
  name: "bmj",
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F4F6F8", "#5A6470", "#1F2937"],
    primary: "#2A6F97",
    secondary: "#7A7570",
    accent: "#E07A5F",
    seriesAnchors: ["#2A6F97", "#E07A5F", "#5C8A3F", "#B88D3F", "#7A5D8C"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', 'Roboto', sans-serif",
  },
  variants: { density: "comfortable" },
};

export const DARK_DRAFT: ResolveDraft = {
  name: "dark",
  inputs: {
    neutral: ["#1E1E2E", "#1E1E2E", "#232334", "#6C7086", "#CDD6F4"],
    primary: "#89B4FA",
    primaryDeep: "#2E5290",
    accent: "#F5C2E7",
    seriesAnchors: ["#89B4FA", "#A6E3A1", "#FAB387", "#F38BA8", "#CBA6F7"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    content: { inverse: "#CDD6F4" },
    divider: { subtle: "#313244", strong: "#45475A" },
  },
};

// ────────────────────────────────────────────────────────────────────
// LOTR easter-egg presets — mirror R/themes-lotr.R
// ────────────────────────────────────────────────────────────────────

export const DWARVEN_DRAFT: ResolveDraft = {
  name: "dwarven",
  webFonts: [
    GF("UnifrakturMaguntia", "UnifrakturMaguntia"),
    GF("EB Garamond", "EB+Garamond:wght@400;600;700"),
  ],
  inputs: {
    neutral: ["#1F1610", "#1F1610", "#2A1F17", "#988372", "#E8D9B5"],
    primary: "#7A4E22",
    primaryDeep: "#4A2D14",
    secondary: "#D4A955",
    secondaryDeep: "#8A6628",
    accent: "#E0673A",
    accentDeep: "#B04A20",
    statusPositive: "#8FA34A",
    statusNegative: "#C84638",
    statusWarning: "#E5B842",
    seriesAnchors: ["#D4A955", "#A8A8A0", "#B86C42", "#7A4E22", "#5C7AA0"],
    fontBody: "'EB Garamond', Georgia, 'Times New Roman', serif",
    fontDisplay: "'UnifrakturMaguntia', 'EB Garamond', Georgia, serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    text: {
      title: { fg: "#E8D9B5" },
      subtitle: { fg: "#C9A87C" },
    },
    content: { inverse: "#E8D9B5" },
    divider: { subtle: "#3A2A1A", strong: "#5A4232" },
  },
};

export const ELVISH_DRAFT: ResolveDraft = {
  name: "elvish",
  webFonts: [
    GF("Cinzel", "Cinzel:wght@400;600;700"),
    GF("Cormorant Garamond", "Cormorant+Garamond:wght@400;500;700"),
  ],
  inputs: {
    neutral: ["#0E1730", "#0E1730", "#172242", "#8090A8", "#EDEFF5"],
    primary: "#1F3A5F",
    primaryDeep: "#0F1F38",
    secondary: "#B8C2D6",
    secondaryDeep: "#7A88A0",
    accent: "#D4B26E",
    accentDeep: "#B89148",
    statusPositive: "#8AC18A",
    statusNegative: "#D67373",
    statusWarning: "#E5C375",
    seriesAnchors: ["#D4B26E", "#B8C2D6", "#8AC18A", "#A78BBF", "#E5A89A"],
    fontBody: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    fontDisplay: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    text: {
      title: { fg: "#F0CB8A" },
      subtitle: { fg: "#C8D4E8" },
    },
    content: { inverse: "#EDEFF5" },
    divider: { subtle: "#1F2D52", strong: "#3D4F75" },
  },
};

export const HOBBIT_DRAFT: ResolveDraft = {
  name: "hobbit",
  webFonts: [
    GF("IM Fell English", "IM+Fell+English:ital@0;1"),
    GF("IM Fell English SC", "IM+Fell+English+SC"),
  ],
  inputs: {
    neutral: ["#FBF3DF", "#FBF3DF", "#F2E5C5", "#8A7456", "#3A2C20"],
    primary: "#A6633E",
    primaryDeep: "#7A4527",
    secondary: "#6B8E3D",
    secondaryDeep: "#4A6628",
    accent: "#D97757",
    accentDeep: "#B85A3D",
    statusPositive: "#6B8E3D",
    statusNegative: "#B33B2E",
    statusWarning: "#D4A24A",
    seriesAnchors: ["#D97757", "#6B8E3D", "#D4A24A", "#8B5E83", "#B86A48"],
    fontBody: "'IM Fell English', Georgia, 'Times New Roman', serif",
    fontDisplay: "'IM Fell English SC', 'IM Fell English', Georgia, serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    divider: { subtle: "#E2D2A8", strong: "#A6633E" },
  },
};

// ────────────────────────────────────────────────────────────────────
// Design-movement presets — mirror R/themes-design.R
// ────────────────────────────────────────────────────────────────────

export const BAUHAUS_DRAFT: ResolveDraft = {
  name: "bauhaus",
  webFonts: [
    GF("Jost", "Jost:wght@400;500;700"),
  ],
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F4F4F4", "#4A4A4A", "#111111"],
    primary: "#D32023",
    secondary: "#2057A8",
    accent: "#FFCB05",
    seriesAnchors: ["#D32023", "#2057A8", "#FFCB05", "#111111", "#7A7A7A"],
    fontBody: "'Jost', 'Futura', 'Helvetica Neue', sans-serif",
    fontDisplay: "'Jost', 'Futura', 'Helvetica Neue', sans-serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    spacing: { padding: 10, cellPaddingX: 12 },
  },
};

export const SWISS_DRAFT: ResolveDraft = {
  name: "swiss",
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#FAFAFA", "#666666", "#111111"],
    primary: "#111111",
    secondary: "#7A7A7A",
    accent: "#E2001A",
    seriesAnchors: ["#111111", "#666666", "#A0A0A0", "#E2001A", "#7A7A7A"],
    fontBody: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    row: { banding: "none" },
  },
};

export const TUFTE_DRAFT: ResolveDraft = {
  name: "tufte",
  webFonts: [
    GF("Crimson Pro", "Crimson+Pro:wght@400;600;700"),
  ],
  inputs: {
    neutral: ["#FBF9F2", "#FBF9F2", "#F2EDDF", "#807060", "#1F1F1F"],
    primary: "#1F1F1F",
    secondary: "#A89A82",
    accent: "#C09B7C",
    seriesAnchors: ["#1F1F1F", "#A89A82", "#5A6B7A", "#7A5D4A", "#C09B7C"],
    fontBody: "'Crimson Pro', Georgia, 'Times New Roman', serif",
    fontDisplay: "'Crimson Pro', Georgia, 'Times New Roman', serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    divider: { subtle: "#E3DBC8", strong: "#C9BFA8" },
    row: { banding: "none" },
  },
};

export const NEWSPRINT_DRAFT: ResolveDraft = {
  name: "newsprint",
  webFonts: [
    GF(
      "Roboto Serif",
      "Roboto+Serif:wght@400;500;700&family=Roboto+Serif:opsz,wdth,wght@8..144,75,400;8..144,75,700",
    ),
  ],
  inputs: {
    neutral: ["#FBFAF7", "#FBFAF7", "#EFEDE6", "#5A5550", "#1A1A1A"],
    primary: "#1A1A1A",
    secondary: "#000000",
    accent: "#B81A1A",
    seriesAnchors: ["#1A1A1A", "#8B5A2B", "#3E5C76", "#4A6B3F", "#7A6B5D"],
    fontBody: "'Roboto Serif', Georgia, 'Times New Roman', serif",
    fontDisplay: "'Roboto Serif', Georgia, 'Times New Roman', serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    row: { banding: "none" },
  },
};

export const SOLARIZED_DRAFT: ResolveDraft = {
  name: "solarized",
  lightDarkPair: "solarized_dark",
  inputs: {
    neutral: ["#FDF6E3", "#FDF6E3", "#EEE8D5", "#657B83", "#586E75"],
    primary: "#B58900",
    secondary: "#CB4B16",
    accent: "#D33682",
    seriesAnchors: ["#B58900", "#CB4B16", "#268BD2", "#859900", "#6C71C4"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  variants: { density: "comfortable" },
};

export const SOLARIZED_DARK_DRAFT: ResolveDraft = {
  name: "solarized_dark",
  lightDarkPair: "solarized",
  inputs: {
    neutral: ["#002B36", "#002B36", "#073642", "#586E75", "#93A1A1"],
    primary: "#B58900",
    primaryDeep: "#073642",
    secondary: "#CB4B16",
    accent: "#D33682",
    seriesAnchors: ["#B58900", "#CB4B16", "#268BD2", "#859900", "#6C71C4"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    content: { inverse: "#FDF6E3" },
    // Title fg defaults to primary_deep (base02 = canvas-color); pin
    // to base1 (light slate) so titles are visible on the dark canvas.
    text: {
      title:    { fg: "#93A1A1" },
      subtitle: { fg: "#839496" },
    },
    divider: { subtle: "#073642", strong: "#586E75" },
  },
};

export const TONAL_DRAFT: ResolveDraft = {
  name: "tonal",
  lightDarkPair: "tonal_dark",
  inputs: {
    neutral: ["#FFFFFF", "#FFFFFF", "#F5F2F8", "#5F5868", "#1C1B1F"],
    primary: "#6750A4",
    accent: "#7D5260",
    seriesAnchors: ["#6750A4", "#7D5260", "#625B71", "#79747E", "#B69DF8"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  variants: { density: "comfortable" },
};

export const TONAL_DARK_DRAFT: ResolveDraft = {
  name: "tonal_dark",
  lightDarkPair: "tonal",
  inputs: {
    neutral: ["#1C1B1F", "#1C1B1F", "#2B2930", "#938F99", "#E6E1E5"],
    primary: "#D0BCFF",
    primaryDeep: "#4F378B",
    accent: "#EFB8C8",
    seriesAnchors: ["#D0BCFF", "#EFB8C8", "#CCC2DC", "#B69DF8", "#79747E"],
    fontBody: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  variants: { density: "comfortable" },
  overrides: {
    content: { inverse: "#E6E1E5" },
    divider: { subtle: "#36343B", strong: "#49454F" },
  },
};

export const PRESET_DRAFTS = {
  cochrane:       COCHRANE_DRAFT,
  lancet:         LANCET_DRAFT,
  jama:           JAMA_DRAFT,
  nejm:           NEJM_DRAFT,
  nature:         NATURE_DRAFT,
  bmj:            BMJ_DRAFT,
  dark:           DARK_DRAFT,
  bauhaus:        BAUHAUS_DRAFT,
  swiss:          SWISS_DRAFT,
  tufte:          TUFTE_DRAFT,
  newsprint:      NEWSPRINT_DRAFT,
  solarized:      SOLARIZED_DRAFT,
  solarized_dark: SOLARIZED_DARK_DRAFT,
  tonal:          TONAL_DRAFT,
  tonal_dark:     TONAL_DARK_DRAFT,
  dwarven:        DWARVEN_DRAFT,
  elvish:         ELVISH_DRAFT,
  hobbit:         HOBBIT_DRAFT,
} as const;

export type PresetName = keyof typeof PRESET_DRAFTS;
