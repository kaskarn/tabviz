// Theme presets — 18 + 3 = 21 themes expressed as ThemeInputs.
//
// ═══════════════════════════════════════════════════════════════════
// Stage 4 (2026-06-04): preset reimagining
//
// Each preset showcases distinctive substrate features beyond the bare
// brand/accent. We thread typography (size + scale + weight axis),
// shell modes, surface textures, density factors, curves per ramp, and
// neutral-tint strength where they serve the preset's personality.
//
// Conventions:
//   - polarity DEFAULTS to "light"; only pin "dark" explicitly.
//   - density defaults to "comfortable" unless the preset's voice asks
//     for compact (academic) or spacious (editorial).
//   - shell_mode "flush" is the default; "raised" / "float" are
//     aesthetic statements per preset (Material card, executive
//     elevation, synthwave space, ...).
//   - shell_texture defaults to "none"; ruled / grid / dotted / grain
//     are used to signal paper / stone / screen substrate metaphors.
//   - curves shape the ramp's perceptual rhythm: "ease" for natural
//     gradation, "smooth" for cinematic gradients, "log" for deep
//     darks, "exp" for bright highs, "linear" for mathematical purity.
// ═══════════════════════════════════════════════════════════════════

import type { ThemeInputs } from "../../types/theme-inputs";

// ────────────────────────────────────────────────────────────────────
// Journals (mono-identity, restrained clinical authority)
// ────────────────────────────────────────────────────────────────────

/** Cochrane — the canonical clinical theme. Vanilla baseline. Cyan brand,
 *  warm orange accent for highlights. Ease curve smooths the neutral
 *  progression for readability. */
export const COCHRANE: ThemeInputs = {
  brand: "#0099CC",
  accent: "#C8553D",
  polarity: "light",
  categorical: "okabe_ito",
  fonts: {
    body: "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
  },
  curves: { neutral: "ease" },
};

/** Lancet — navy + gold editorial gravitas. Raised shell evokes the
 *  cover feel; serif typography with slightly elevated scale ratio
 *  gives the rhythm of long-form journal prose. */
export const LANCET: ThemeInputs = {
  brand: "#00407A",
  decorative: "#A6792A",
  accent: "#A6792A",
  polarity: "light",
  categorical: "okabe_ito",
  shell_mode: "raised",
  type_scale_ratio: 1.25,
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
    display: "Georgia, 'Times New Roman', serif",
  },
  curves: { neutral: "smooth" },
};

/** JAMA — minimalist academic. Black ink, monochrome palette, compact
 *  density, very tight type scale. The "footnote density" of dense
 *  scientific tables. */
export const JAMA: ThemeInputs = {
  brand: "#000000",
  accent: "#000000",
  polarity: "light",
  categorical: "brand_mono",
  density: "compact",
  type_base_size: 13,
  type_scale_ratio: 1.15,
  fonts: { body: "Arial, Helvetica, sans-serif" },
};

/** NEJM — classic medical serif. Crimson brand + slate accent. Type
 *  scale 1.25 gives the prose-like rhythm; smooth curve on the brand
 *  ramp for the velvet-red gradient feel. */
export const NEJM: ThemeInputs = {
  brand: "#BD2F2F",
  accent: "#1B5377",
  polarity: "light",
  categorical: "okabe_ito",
  type_scale_ratio: 1.25,
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
    display: "Georgia, 'Times New Roman', serif",
  },
  curves: { brand: "smooth", neutral: "ease" },
};

/** Nature — slick scientific. Raised shell + ruled texture (the paper-
 *  in-a-glossy-spread metaphor). Faint brand-tinted neutrals give the
 *  page a subtle teal cast. */
export const NATURE: ThemeInputs = {
  brand: "#005A6C",
  accent: "#E8A427",
  polarity: "light",
  categorical: "okabe_ito",
  shell_mode: "raised",
  shell_texture: "ruled",
  neutral_tint: "brand",
  neutral_tint_strength: 0.03,
  type_scale_ratio: 1.25,
  curves: { brand: "smooth" },
};

/** BMJ — clean clinical, blue + red accent. Standard everything,
 *  ease curve for legibility. */
export const BMJ: ThemeInputs = {
  brand: "#2A6EBB",
  accent: "#E33B3B",
  polarity: "light",
  categorical: "okabe_ito",
  fonts: { body: "Inter, -apple-system, system-ui, sans-serif" },
  curves: { neutral: "ease" },
};

// ────────────────────────────────────────────────────────────────────
// Modes
// ────────────────────────────────────────────────────────────────────

/** Dark — the canonical dark mode. Float shell removes chrome so the
 *  paper appears to drift on its own elevation shadow. Log curve on
 *  neutral deepens the darks; ease on brand/accent keeps callouts
 *  vivid against the deep background. */
export const DARK: ThemeInputs = {
  brand: "#89B4FA",
  accent: "#F38BA8",
  polarity: "dark",
  categorical: "okabe_ito",
  shell_mode: "float",
  curves: { neutral: "log", brand: "ease", accent: "ease" },
};

// ────────────────────────────────────────────────────────────────────
// Design movements
// ────────────────────────────────────────────────────────────────────

/** Bauhaus — geometric, primary colors, bold weights, raised shell +
 *  grid texture (the literal Bauhaus grid). Display font is Archivo
 *  Black; type scale 1.333 for the bold modular rhythm. */
export const BAUHAUS: ThemeInputs = {
  brand: "#D32023",
  decorative: "#2057A8",
  accent: "#FFCB05",
  polarity: "light",
  categorical: "tableau10",
  shell_mode: "raised",
  shell_texture: "grid",
  type_base_size: 15,
  type_scale_ratio: 1.333,
  type_weights: { regular: 400, medium: 500, semibold: 700, bold: 800 },
  fonts: {
    body: "'Archivo', Inter, -apple-system, system-ui, sans-serif",
    display: "'Archivo Black', 'Archivo', sans-serif",
  },
  curves: { neutral: "smooth", brand: "smooth", accent: "smooth" },
};

/** Swiss — International Typographic Style. Helvetica geometry, grid
 *  texture (showcasing the actual underlying grid), compact density,
 *  tight type. Red + black, the canonical Swiss palette. */
export const SWISS: ThemeInputs = {
  brand: "#E30613",
  accent: "#000000",
  polarity: "light",
  categorical: "tableau10",
  density: "compact",
  shell_texture: "grid",
  type_scale_ratio: 1.2,
  type_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  fonts: {
    body: "'Inter', -apple-system, system-ui, 'Helvetica Neue', sans-serif",
    display: "'Inter', -apple-system, system-ui, 'Helvetica Neue', sans-serif",
  },
  curves: { neutral: "linear" },
};

/** Tufte — data-ink minimum. Ruled texture (the notebook page), italic
 *  serif body (EB Garamond), very compact density × 0.9 factor. Log
 *  curve deepens the neutrals so chart marks read as ink-on-paper. */
export const TUFTE: ThemeInputs = {
  brand: "#222222",
  accent: "#888888",
  polarity: "light",
  categorical: "greys",
  density: "compact",
  densityFactor: 0.9,
  shell_texture: "ruled",
  type_base_size: 13,
  type_scale_ratio: 1.15,
  fonts: {
    body: "'EB Garamond', Georgia, serif",
    display: "'EB Garamond', Georgia, serif",
  },
  curves: { neutral: "log" },
};

/** Newsprint — actual newspaper. Grain texture (the paper grain),
 *  decorative-tinted off-white neutrals at noticeable strength, serif
 *  body with display Crimson. Smooth + log curves give the warm-paper +
 *  deep-ink contrast newspapers carry. */
export const NEWSPRINT: ThemeInputs = {
  brand: "#2C2C2C",
  decorative: "#B17D5F",
  accent: "#5C8A3F",
  polarity: "light",
  neutral_tint: "decorative",
  neutral_tint_strength: 0.08,
  categorical: "okabe_ito",
  shell_texture: "grain",
  type_scale_ratio: 1.2,
  fonts: {
    body: "Georgia, 'Times New Roman', serif",
    display: "'Crimson Pro', Georgia, 'Times New Roman', serif",
  },
  curves: { neutral: "smooth", brand: "log" },
};

// ────────────────────────────────────────────────────────────────────
// Solarized (light + dark pair)
// ────────────────────────────────────────────────────────────────────

/** Solarized — Ethan Schoonover's editorial light palette. Brand-tinted
 *  neutrals at 0.06 strength give the trademark warm yellow paper feel.
 *  Smooth curves on neutrals for the gentle yellow gradient. */
export const SOLARIZED: ThemeInputs = {
  brand: "#268BD2",
  accent: "#CB4B16",
  polarity: "light",
  neutral_tint: "brand",
  neutral_tint_strength: 0.06,
  categorical: "tableau10",
  fonts: {
    body: "'Inter', -apple-system, system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  curves: { neutral: "smooth" },
};

/** Solarized Dark — same anchors, dark polarity. The L-reflection in
 *  resolve-theme flips the neutrals to a deep blue-grey paper. */
export const SOLARIZED_DARK: ThemeInputs = {
  brand: "#268BD2",
  accent: "#CB4B16",
  polarity: "dark",
  neutral_tint: "brand",
  neutral_tint_strength: 0.06,
  categorical: "tableau10",
  fonts: {
    body: "'Inter', -apple-system, system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  curves: { neutral: "smooth" },
};

// ────────────────────────────────────────────────────────────────────
// Tonal — Material You-style
// ────────────────────────────────────────────────────────────────────

/** Tonal — Material You-style. Raised shell + soft elevation shadow
 *  (the card metaphor). Type scale 1.25 + ease curves give the
 *  characteristic friendly Material rhythm. */
export const TONAL: ThemeInputs = {
  brand: "#6750A4",
  accent: "#7D5260",
  polarity: "light",
  categorical: "tableau10",
  shell_mode: "raised",
  type_scale_ratio: 1.25,
  fonts: {
    body: "'Roboto', -apple-system, system-ui, sans-serif",
    display: "'Roboto Flex', 'Roboto', sans-serif",
  },
  curves: { neutral: "ease", brand: "ease", accent: "ease" },
};

/** Tonal Dark — same anchors, dark polarity. Lavender brand on a deep
 *  card; the elevation shadow becomes a hue-aware near-black mix. */
export const TONAL_DARK: ThemeInputs = {
  brand: "#D0BCFF",
  accent: "#EFB8C8",
  polarity: "dark",
  categorical: "tableau10",
  shell_mode: "raised",
  type_scale_ratio: 1.25,
  fonts: {
    body: "'Roboto', -apple-system, system-ui, sans-serif",
    display: "'Roboto Flex', 'Roboto', sans-serif",
  },
  curves: { neutral: "ease", brand: "ease", accent: "ease" },
};

// ────────────────────────────────────────────────────────────────────
// LOTR — the storytelling showpieces
// ────────────────────────────────────────────────────────────────────

/** Dwarven — forge, stone, dark gold. DARK polarity (the deep mountain
 *  forge); raised shell (carved monolith); dotted texture (chiseled
 *  stone); log curves on neutral + brand (the rich dark gradient of
 *  cave-fire shadow). Cinzel display (carved capitals); EB Garamond
 *  body (formal script). */
export const DWARVEN: ThemeInputs = {
  brand: "#7A4E22",
  decorative: "#D4A955",
  accent: "#C0B000",
  polarity: "dark",
  neutral_tint: "brand",
  neutral_tint_strength: 0.06,
  categorical: "okabe_ito",
  shell_mode: "raised",
  shell_texture: "dotted",
  type_base_size: 14,
  type_scale_ratio: 1.25,
  type_weights: { regular: 400, medium: 500, semibold: 700, bold: 800 },
  fonts: {
    body: "'EB Garamond', Georgia, serif",
    display: "'Cinzel', 'EB Garamond', Georgia, serif",
    mono: "'JetBrains Mono', monospace",
  },
  curves: { neutral: "log", brand: "log" },
};

/** Elvish — ethereal, flowing, illuminated manuscript. Flush shell
 *  (no architecture); ruled texture (the lines of the manuscript page);
 *  exp curve on neutral (lighter highs — the radiant page); decorative-
 *  tinted neutrals (the soft mithril grey). Type scale 1.333 — the
 *  editorial rhythm of a poem in print. */
export const ELVISH: ThemeInputs = {
  brand: "#1F3A5F",
  decorative: "#B8C2D6",
  accent: "#F0CB8A",
  polarity: "light",
  neutral_tint: "decorative",
  neutral_tint_strength: 0.04,
  categorical: "okabe_ito",
  shell_texture: "ruled",
  type_base_size: 14,
  type_scale_ratio: 1.333,
  fonts: {
    body: "'Cormorant Garamond', Georgia, serif",
    display: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  },
  curves: { neutral: "exp", brand: "ease" },
};

/** Hobbit — warm hearth, paper, comfort. Flush shell; grain texture
 *  (paper-and-wool); high decorative-tint strength makes the neutrals
 *  noticeably cream. IM Fell English (Caslon-feel) for body. Type
 *  scale 1.333 for the storytelling rhythm. */
export const HOBBIT: ThemeInputs = {
  brand: "#A6633E",
  decorative: "#6B8E3D",
  accent: "#7A4527",
  polarity: "light",
  neutral_tint: "decorative",
  neutral_tint_strength: 0.10,
  categorical: "okabe_ito",
  shell_texture: "grain",
  type_base_size: 14,
  type_scale_ratio: 1.333,
  fonts: {
    body: "'IM Fell English', Georgia, serif",
    display: "'IM Fell English SC', Georgia, serif",
  },
  curves: { neutral: "smooth", brand: "ease" },
};

// ────────────────────────────────────────────────────────────────────
// Stage 4 additions — bold showcase themes
// ────────────────────────────────────────────────────────────────────

/** Synthwave — neon-on-deep-space. Dark polarity; float shell (no
 *  chrome — the chart drifts); grid texture (the perspective-rail
 *  retro look); monospace body (the terminal vibe); brand-tinted
 *  neutrals at noticeable strength (the magenta drift). Exp curves on
 *  brand + accent for saturated mids — the neon glow. */
export const SYNTHWAVE: ThemeInputs = {
  brand: "#FF00C8",
  decorative: "#00E5FF",
  accent: "#FAFF00",
  polarity: "dark",
  neutral_tint: "brand",
  neutral_tint_strength: 0.08,
  categorical: "tableau10",
  shell_mode: "float",
  shell_texture: "grid",
  type_base_size: 13,
  type_scale_ratio: 1.2,
  type_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  fonts: {
    body: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    display: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  curves: { neutral: "smooth", brand: "exp", accent: "exp" },
};

/** Atelier — artist's studio: warm parchment, ink, ruled. Compact ×
 *  0.92 density (the writer's working table); decorative-tinted
 *  neutrals at high strength (the warm parchment); ruled texture (the
 *  hand-ruled sketchbook lines); Italianno display (the calligraphic
 *  flourish). Log curve on neutral grounds the ink. */
export const ATELIER: ThemeInputs = {
  brand: "#2D2A26",
  decorative: "#A88B5C",
  accent: "#8B3A3A",
  polarity: "light",
  neutral_tint: "decorative",
  neutral_tint_strength: 0.12,
  categorical: "okabe_ito",
  density: "compact",
  densityFactor: 0.92,
  shell_texture: "ruled",
  type_base_size: 13.5,
  type_scale_ratio: 1.333,
  fonts: {
    body: "'EB Garamond', Georgia, serif",
    display: "'Italianno', 'EB Garamond', cursive, serif",
  },
  curves: { neutral: "log" },
};

/** Executive — slate + soft gold, raised. Material card meets the
 *  boardroom. Inter body, Cormorant Garamond display (serif title on
 *  sans body — the "executive summary" feel). Type scale 1.333 +
 *  smooth curves give the crisp, glassy rhythm. */
export const EXECUTIVE: ThemeInputs = {
  brand: "#1E3A5F",
  accent: "#C9A961",
  polarity: "light",
  categorical: "wong",
  shell_mode: "raised",
  type_base_size: 14,
  type_scale_ratio: 1.333,
  type_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  fonts: {
    body: "'Inter', -apple-system, system-ui, sans-serif",
    display: "'Cormorant Garamond', Georgia, serif",
  },
  curves: { neutral: "ease", brand: "smooth" },
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
  synthwave:       SYNTHWAVE,
  atelier:         ATELIER,
  executive:       EXECUTIVE,
};

/** Get a preset by name. Unknown name → cochrane (default). */
export function preset(name: string): ThemeInputs {
  return PRESETS[name] ?? COCHRANE;
}
