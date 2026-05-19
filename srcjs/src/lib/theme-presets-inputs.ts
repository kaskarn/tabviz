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

const GF = (family: string, params: string) => ({
  family,
  url: `https://fonts.googleapis.com/css2?family=${params}&display=swap`,
});

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

export const PRESET_DRAFTS = {
  cochrane: COCHRANE_DRAFT,
  lancet:   LANCET_DRAFT,
  jama:     JAMA_DRAFT,
  dark:     DARK_DRAFT,
  dwarven:  DWARVEN_DRAFT,
  elvish:   ELVISH_DRAFT,
  hobbit:   HOBBIT_DRAFT,
} as const;

export type PresetName = keyof typeof PRESET_DRAFTS;
