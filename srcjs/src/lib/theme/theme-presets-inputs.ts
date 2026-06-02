// Theme presets — 18 themes expressed as ThemeInputs.
//
// Per the locked design:
//   - Single `brand` seed (no primary/secondary mirror chain)
//   - Optional `decorative` for two-color editorial themes
//   - `mode` toggle (light | dark)
//   - Categorical/sequential/diverging scheme refs from data-schemes
//
// Lossy mappings:
//   - Lancet:    primary -> brand; secondary (gold) -> decorative
//   - Dwarven:   primary (bronze) -> brand; secondary (gold) -> decorative;
//                accent (forge ember) -> accent
//   - JAMA:      primary (black) -> brand; uses brand_mono categorical
//   - Solarized Dark: brand pinned + mode "dark"
//
// PR G's migration consolidates 30 hand-written constructor LOC per
// preset into ~10-15 LOC at most.

import type { ThemeInputs } from "../../types/theme-inputs";

// ────────────────────────────────────────────────────────────────────
// Journals (mono-identity)
// ────────────────────────────────────────────────────────────────────

export const COCHRANE: ThemeInputs = {
  brand: "#0099CC",
  accent: "#C8553D",
  mode: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
  },
};

export const LANCET: ThemeInputs = {
  brand: "#00407A",        // navy
  decorative: "#A6792A",   // gold (chrome texture only)
  accent: "#A6792A",       // gold engagement
  mode: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
    display: "Georgia, 'Times New Roman', serif",
  },
};

export const JAMA: ThemeInputs = {
  brand: "#000000",
  accent: "#000000",
  mode: "light",
  categorical: "brand_mono",
  density: "compact",
  fonts: { body: "Arial, Helvetica, sans-serif" },
};

export const NEJM: ThemeInputs = {
  brand: "#BD2F2F",
  accent: "#1B5377",
  mode: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
    display: "Georgia, 'Times New Roman', serif",
  },
};

export const NATURE: ThemeInputs = {
  brand: "#005A6C",
  accent: "#E8A427",
  mode: "light",
  categorical: "okabe_ito",
};

export const BMJ: ThemeInputs = {
  brand: "#2A6EBB",
  accent: "#E33B3B",
  mode: "light",
  categorical: "okabe_ito",
};

// ────────────────────────────────────────────────────────────────────
// Modes
// ────────────────────────────────────────────────────────────────────

export const DARK: ThemeInputs = {
  brand: "#89B4FA",
  accent: "#F38BA8",
  mode: "dark",
  categorical: "okabe_ito",
};

// ────────────────────────────────────────────────────────────────────
// Design movements
// ────────────────────────────────────────────────────────────────────

export const BAUHAUS: ThemeInputs = {
  brand: "#D32023",
  decorative: "#2057A8",
  accent: "#FFCB05",
  mode: "light",
  categorical: "tableau10",
};

export const SWISS: ThemeInputs = {
  brand: "#E30613",
  accent: "#000000",
  mode: "light",
  categorical: "tableau10",
};

export const TUFTE: ThemeInputs = {
  brand: "#222222",
  accent: "#888888",
  mode: "light",
  categorical: "greys",
  density: "compact",
};

export const NEWSPRINT: ThemeInputs = {
  brand: "#2C2C2C",
  decorative: "#B17D5F",
  accent: "#5C8A3F",
  neutral_tint: "decorative",
  mode: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
  },
};

// ────────────────────────────────────────────────────────────────────
// Solarized (light + dark pair)
// ────────────────────────────────────────────────────────────────────

export const SOLARIZED: ThemeInputs = {
  brand: "#268BD2",
  accent: "#CB4B16",
  mode: "light",
  neutral_tint: "brand",
  categorical: "tableau10",
};

export const SOLARIZED_DARK: ThemeInputs = {
  brand: "#268BD2",
  accent: "#CB4B16",
  mode: "dark",
  neutral_tint: "brand",
  categorical: "tableau10",
};

// ────────────────────────────────────────────────────────────────────
// Tonal (light + dark pair)
// ────────────────────────────────────────────────────────────────────

export const TONAL: ThemeInputs = {
  brand: "#6750A4",
  accent: "#7D5260",
  mode: "light",
  categorical: "tableau10",
};

export const TONAL_DARK: ThemeInputs = {
  brand: "#D0BCFF",
  accent: "#EFB8C8",
  mode: "dark",
  categorical: "tableau10",
};

// ────────────────────────────────────────────────────────────────────
// LOTR editorial (two-color themes)
// ────────────────────────────────────────────────────────────────────

export const DWARVEN: ThemeInputs = {
  brand: "#7A4E22",        // hammered bronze
  decorative: "#D4A955",   // warm gold (structural)
  accent: "#C0B000",       // forge ember
  mode: "light",
  neutral_tint: "brand",
  categorical: "okabe_ito",
  fonts: {
    body: "'EB Garamond', Georgia, serif",
    display: "'UnifrakturMaguntia', 'EB Garamond', Georgia, serif",
  },
};

export const ELVISH: ThemeInputs = {
  brand: "#1F3A5F",
  decorative: "#B8C2D6",
  accent: "#F0CB8A",
  mode: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "'Cormorant Garamond', Georgia, serif",
    display: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  },
};

export const HOBBIT: ThemeInputs = {
  brand: "#A6633E",
  decorative: "#6B8E3D",
  accent: "#7A4527",
  mode: "light",
  neutral_tint: "decorative",
  categorical: "okabe_ito",
  fonts: {
    body: "'IM Fell English', Georgia, serif",
    display: "'IM Fell English SC', Georgia, serif",
  },
};

// ────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────

export const PRESETS: Readonly<Record<string, ThemeInputs>> = {
  cochrane:        COCHRANE,
  lancet:          LANCET,
  jama:            JAMA,
  nejm:            NEJM,
  nature:          NATURE,
  bmj:             BMJ,
  dark:            DARK,
  bauhaus:         BAUHAUS,
  swiss:           SWISS,
  tufte:           TUFTE,
  newsprint:       NEWSPRINT,
  solarized:       SOLARIZED,
  solarized_dark:  SOLARIZED_DARK,
  tonal:           TONAL,
  tonal_dark:      TONAL_DARK,
  dwarven:         DWARVEN,
  elvish:          ELVISH,
  hobbit:          HOBBIT,
};

/** Get a preset by name. Unknown name → cochrane (default). */
export function preset(name: string): ThemeInputs {
  return PRESETS[name] ?? COCHRANE;
}
