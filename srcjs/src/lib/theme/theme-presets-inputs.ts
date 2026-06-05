// Theme presets — 18 + 3 = 21 themes expressed as V4 ThemeInputs.
//
// ═══════════════════════════════════════════════════════════════════
// V4 (2026-06-04): anchors vocabulary
//
// Each preset declares four OKLCH anchors via the `defineInputs` helper:
// paper, ink, brand, accent. The helper takes v3-style hex shortcuts +
// optional paper/ink hue & chroma derivations (the spiritual successor
// to the old neutral_tint + neutral_tint_strength knobs) and emits the
// fully-resolved anchors object.
//
// Conventions:
//   - Light polarity is the default. Dark presets pin polarity = "dark".
//     The resolver's L-reflection step makes a dark preset's paper and
//     ink swap places via reflectL on each.
//   - paperTint and inkTint default to the brand hue (subtle warm/cool
//     cast on neutral surfaces). Override to "decorative" or a literal
//     hex for editorial themes.
//   - paperC default is 0.005 (clinical-clean); set higher for warm-paper
//     themes (Newsprint, Atelier, Hobbit).
//   - Each preset also threads its full Stage 2/3 personality:
//     typography (size + scale + weights), shell modes, surface textures,
//     density factors, per-ramp curves.
// ═══════════════════════════════════════════════════════════════════

import type { OklchTriple, ThemeInputs } from "../../types/theme-inputs";
import { hexToOklch } from "../oklch";

// ────────────────────────────────────────────────────────────────────
// Helper — derive a v4 anchors block from v3-style hex shortcuts
// ────────────────────────────────────────────────────────────────────

interface PresetIdentitySeeds {
  /** Brand hex. Powers the brand ramp and identity tokens. */
  brand: string;
  /** Optional accent hex. Defaults to brand. */
  accent?: string;
  /** Optional secondary/rubrication ink hex (B7). Seeds the accent ramp
   *  with precedence over `accent`. */
  ink2?: string;
  /** Polarity. Default light. */
  polarity?: "light" | "dark";
  /** Hue source for the paper/ink anchors. Either "brand" (default),
   *  a literal hex (for two-color editorial themes that want the neutrals
   *  carrying a third hue, e.g. Newsprint's warm-paper), or null for
   *  achromatic. */
  neutralHueFrom?: "brand" | string | null;
  /** Chroma intensity baked into paper. Higher = warmer / more tinted
   *  paper. Default 0.005 (clinical clean). */
  paperC?: number;
  /** Chroma intensity baked into ink. Default 0.01. */
  inkC?: number;
  /** Override paper L. Default 0.987 in light polarity. */
  paperL?: number;
  /** Override ink L. Default 0.180 in light polarity. */
  inkL?: number;
}

/** Paper L in light polarity. Matches LIGHT_RAMP_L[0] so a default v3
 *  brand-tinted preset reads at the same paper lightness. */
const DEFAULT_PAPER_L = 0.987;
/** Ink L in light polarity. Matches LIGHT_RAMP_L[11]. */
const DEFAULT_INK_L = 0.180;

function deriveAnchors(seeds: PresetIdentitySeeds): ThemeInputs["anchors"] {
  const brandLch = hexToOklch(seeds.brand);
  const accentLch = seeds.accent ? hexToOklch(seeds.accent) : undefined;
  const ink2Lch = seeds.ink2 ? hexToOklch(seeds.ink2) : undefined;

  // Pick the hue for the neutral anchors (paper + ink).
  let neutralH: number;
  if (seeds.neutralHueFrom === null) {
    neutralH = 0;
  } else if (seeds.neutralHueFrom == null || seeds.neutralHueFrom === "brand") {
    neutralH = brandLch.H;
  } else {
    neutralH = hexToOklch(seeds.neutralHueFrom).H;
  }

  const paperL = seeds.paperL ?? DEFAULT_PAPER_L;
  const inkL = seeds.inkL ?? DEFAULT_INK_L;
  const paperC = seeds.paperC ?? 0.005;
  const inkC = seeds.inkC ?? 0.01;

  const paper: OklchTriple = { L: paperL, C: paperC, H: neutralH };
  const ink: OklchTriple = { L: inkL, C: inkC, H: neutralH };

  return {
    paper,
    ink,
    brand: brandLch,
    ...(accentLch ? { accent: accentLch } : {}),
    ...(ink2Lch ? { ink2: ink2Lch } : {}),
  };
}

type PresetRest = Omit<ThemeInputs, "anchors" | "polarity">;

/** Compose anchors (derived from seeds) with the rest of the preset
 *  inputs. Polarity is emitted only when seeds explicitly opted into
 *  dark (the resolver defaults missing polarity to "light"); this keeps
 *  the wire symmetric with R's serializer, which drops `polarity:
 *  "light"` as a no-op default. */
export function defineInputs(
  seeds: PresetIdentitySeeds,
  rest: PresetRest = {},
): ThemeInputs {
  return {
    anchors: deriveAnchors(seeds),
    ...(seeds.polarity ? { polarity: seeds.polarity } : {}),
    ...rest,
  };
}

/** Convenience alias for tests + UI shims that still author in v3-style hex
 *  shortcuts. Same shape as `defineInputs` — `{ brand: "#X", accent?: "#Y", … }`
 *  in, fully-resolved v4 `ThemeInputs` (with `anchors`) out. */
export const inputsFromHex = defineInputs;

export type { PresetIdentitySeeds };

// ────────────────────────────────────────────────────────────────────
// Journals (mono-identity, restrained clinical authority)
// ────────────────────────────────────────────────────────────────────

/** Cochrane — the canonical clinical theme. Vanilla baseline. Cyan brand,
 *  warm orange accent. Ease curve smooths the neutral progression. */
export const COCHRANE: ThemeInputs = defineInputs(
  { brand: "#0099CC", accent: "#C8553D" },
  {
    categorical: "okabe_ito",
    fonts: {
      body: "'Source Sans 3', -apple-system, system-ui, sans-serif",
    },
    curves: { neutral: "ease" },
  },
);

/** Lancet — navy + gold editorial gravitas. Raised shell evokes the
 *  cover feel; serif typography with slightly elevated scale ratio. */
export const LANCET: ThemeInputs = defineInputs(
  { brand: "#00407A", accent: "#A6792A" },
  {
    categorical: "okabe_ito",
    shell_mode: "raised",
    type_scale_ratio: 1.25,
    fonts: {
      body: "'Source Serif 4', Georgia, serif",
      display: "'Source Serif 4', Georgia, serif",
    },
    curves: { neutral: "smooth" },
  },
);

/** JAMA — minimalist academic. Black ink, monochrome palette, compact
 *  density, very tight type scale. The "footnote density" of dense
 *  scientific tables. */
export const JAMA: ThemeInputs = defineInputs(
  { brand: "#0F171F", accent: "#0F171F", neutralHueFrom: null },
  {
    categorical: "brand_mono",
    density: "compact",
    type_base_size: 13,
    type_scale_ratio: 1.15,
    fonts: { body: "'Spline Sans', -apple-system, system-ui, sans-serif" },
  },
);

/** NEJM — classic medical serif. Crimson brand + slate accent. Type
 *  scale 1.25; smooth curve on the brand ramp for the velvet-red feel. */
export const NEJM: ThemeInputs = defineInputs(
  { brand: "#BD2F2F", accent: "#1B5377" },
  {
    categorical: "okabe_ito",
    type_scale_ratio: 1.25,
    fonts: {
      body: "'Lora', Georgia, serif",
      display: "'Lora', Georgia, serif",
    },
    curves: { neutral: "ease", brand: "smooth" },
  },
);

/** Nature — slick scientific. Raised shell + ruled texture (the paper-
 *  in-a-glossy-spread metaphor). Brand-tinted neutrals (subtle teal cast). */
export const NATURE: ThemeInputs = defineInputs(
  {
    brand: "#005A6C",
    accent: "#E8A427",
    neutralHueFrom: "brand",
    paperC: 0.008,
    inkC: 0.012,
  },
  {
    categorical: "okabe_ito",
    shell_mode: "raised",
    shell_texture: "ruled",
    type_scale_ratio: 1.25,
    curves: { brand: "smooth" },
  },
);

/** BMJ — clean clinical, blue + red accent. Standard everything,
 *  ease curve for legibility. */
export const BMJ: ThemeInputs = defineInputs(
  { brand: "#2A6EBB", accent: "#E33B3B" },
  {
    categorical: "okabe_ito",
    fonts: {
      body: "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
      display: "'IBM Plex Serif', Georgia, serif",
    },
    curves: { neutral: "ease" },
  },
);

// ────────────────────────────────────────────────────────────────────
// Modes
// ────────────────────────────────────────────────────────────────────

/** Dark — the canonical dark mode. Float shell so the paper drifts on
 *  its own elevation shadow. Log curve on neutral deepens the darks. */
export const DARK: ThemeInputs = defineInputs(
  { brand: "#89B4FA", accent: "#F38BA8", polarity: "dark" },
  {
    categorical: "okabe_ito",
    shell_mode: "float",
    curves: { neutral: "log", brand: "ease", accent: "ease" },
  },
);

// ────────────────────────────────────────────────────────────────────
// Design movements
// ────────────────────────────────────────────────────────────────────

/** Bauhaus — geometric, primary colors, bold weights, raised shell +
 *  grid texture (the literal Bauhaus grid). */
export const BAUHAUS: ThemeInputs = defineInputs(
  { brand: "#D32023", accent: "#FFCB05" },
  {
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
  },
);

/** Swiss — International Typographic Style. Helvetica geometry, grid
 *  texture, compact density, tight type. Red + black. */
export const SWISS: ThemeInputs = defineInputs(
  { brand: "#E30613", accent: "#000000", neutralHueFrom: null },
  {
    categorical: "tableau10",
    density: "compact",
    shell_texture: "grid",
    type_scale_ratio: 1.2,
    type_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    fonts: {
      body: "'Hanken Grotesk', 'Helvetica Neue', Helvetica, sans-serif",
      display: "'Hanken Grotesk', 'Helvetica Neue', Helvetica, sans-serif",
    },
    curves: { neutral: "linear" },
  },
);

/** Tufte — data-ink minimum. Ruled texture, italic serif body, very
 *  compact density × 0.9 factor. Log curve deepens neutrals so chart
 *  marks read as ink-on-paper. */
export const TUFTE: ThemeInputs = defineInputs(
  { brand: "#222222", accent: "#B54A46", neutralHueFrom: null },
  {
    categorical: "greys",
    density: "compact",
    density_factor: 0.9,
    shell_texture: "ruled",
    type_base_size: 13,
    type_scale_ratio: 1.15,
    fonts: {
      body: "'EB Garamond', Georgia, serif",
      display: "'EB Garamond', Georgia, serif",
    },
    curves: { neutral: "log" },
  },
);

/** Newsprint — actual newspaper. Grain texture, warm-paper neutrals via
 *  the decorative hue at high chroma. Serif body with Crimson display. */
export const NEWSPRINT: ThemeInputs = defineInputs(
  {
    brand: "#2C2C2C",
    accent: "#5C8A3F",
    neutralHueFrom: "#B17D5F",
    paperC: 0.016,
    inkC: 0.018,
  },
  {
    categorical: "okabe_ito",
    shell_texture: "grain",
    type_scale_ratio: 1.2,
    fonts: {
      body: "'Frank Ruhl Libre', Georgia, serif",
      display: "'Crimson Pro', Georgia, 'Times New Roman', serif",
    },
    curves: { neutral: "smooth", brand: "log" },
  },
);

// ────────────────────────────────────────────────────────────────────
// Solarized (light + dark pair)
// ────────────────────────────────────────────────────────────────────

/** Solarized — Ethan Schoonover's editorial light palette. Brand-tinted
 *  warm-yellow paper feel via the cyan brand hue routed through neutrals. */
export const SOLARIZED: ThemeInputs = defineInputs(
  {
    brand: "#268BD2",
    accent: "#CB4B16",
    neutralHueFrom: "brand",
    paperC: 0.012,
    inkC: 0.014,
  },
  {
    categorical: "tableau10",
    fonts: {
      body: "'Public Sans', -apple-system, system-ui, sans-serif",
      mono: "'Spline Sans Mono', 'JetBrains Mono', monospace",
    },
    curves: { neutral: "smooth" },
  },
);

/** Solarized Dark — same anchors, dark polarity. The L-reflection in the
 *  resolver flips the neutrals to a deep blue-grey paper. */
export const SOLARIZED_DARK: ThemeInputs = defineInputs(
  {
    brand: "#268BD2",
    accent: "#CB4B16",
    polarity: "dark",
    neutralHueFrom: "brand",
    paperC: 0.012,
    inkC: 0.014,
  },
  {
    categorical: "tableau10",
    fonts: {
      body: "'Public Sans', -apple-system, system-ui, sans-serif",
      mono: "'Spline Sans Mono', 'JetBrains Mono', monospace",
    },
    curves: { neutral: "smooth" },
  },
);

// ────────────────────────────────────────────────────────────────────
// Tonal — Material You-style
// ────────────────────────────────────────────────────────────────────

/** Tonal — Material You-style. Raised shell + soft elevation (the card
 *  metaphor). Type scale 1.25 + ease curves give the Material rhythm. */
export const TONAL: ThemeInputs = defineInputs(
  { brand: "#6750A4", accent: "#7D5260" },
  {
    categorical: "tableau10",
    shell_mode: "raised",
    type_scale_ratio: 1.25,
    fonts: {
      body: "'Roboto', -apple-system, system-ui, sans-serif",
      display: "'Roboto Flex', 'Roboto', sans-serif",
    },
    curves: { neutral: "ease", brand: "ease", accent: "ease" },
  },
);

/** Tonal Dark — same anchors, dark polarity. Lavender brand on a deep
 *  card; elevation shadow becomes a hue-aware near-black mix. */
export const TONAL_DARK: ThemeInputs = defineInputs(
  { brand: "#D0BCFF", accent: "#EFB8C8", polarity: "dark" },
  {
    categorical: "tableau10",
    shell_mode: "raised",
    type_scale_ratio: 1.25,
    fonts: {
      body: "'Roboto', -apple-system, system-ui, sans-serif",
      display: "'Roboto Flex', 'Roboto', sans-serif",
    },
    curves: { neutral: "ease", brand: "ease", accent: "ease" },
  },
);

// ────────────────────────────────────────────────────────────────────
// LOTR — the storytelling showpieces
// ────────────────────────────────────────────────────────────────────

/** Dwarven — forge, stone, dark gold. DARK polarity (the deep mountain
 *  forge); raised shell; dotted texture (chiseled stone). Cinzel display,
 *  EB Garamond body. */
export const DWARVEN: ThemeInputs = defineInputs(
  {
    brand: "#7A4E22",
    accent: "#C0B000",
    polarity: "dark",
    neutralHueFrom: "brand",
    paperC: 0.012,
    inkC: 0.014,
  },
  {
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
  },
);

/** Elvish — ethereal, flowing, illuminated manuscript. Ruled texture (the
 *  manuscript lines); exp curve on neutral (radiant page); mithril-grey
 *  decorative hue tinting the neutrals. */
export const ELVISH: ThemeInputs = defineInputs(
  {
    brand: "#1F3A5F",
    accent: "#F0CB8A",
    neutralHueFrom: "#B8C2D6",
    paperC: 0.010,
    inkC: 0.012,
  },
  {
    categorical: "okabe_ito",
    shell_texture: "ruled",
    type_base_size: 14,
    type_scale_ratio: 1.333,
    fonts: {
      body: "'Cormorant Garamond', Georgia, serif",
      display: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
    },
    curves: { neutral: "exp", brand: "ease" },
  },
);

/** Hobbit — warm hearth, paper, comfort. Grain texture (paper-and-wool);
 *  high decorative-tint strength making the neutrals noticeably cream. */
export const HOBBIT: ThemeInputs = defineInputs(
  {
    brand: "#A6633E",
    accent: "#7A4527",
    neutralHueFrom: "#6B8E3D",
    paperC: 0.020,
    inkC: 0.022,
  },
  {
    categorical: "okabe_ito",
    shell_texture: "grain",
    type_base_size: 14,
    type_scale_ratio: 1.333,
    fonts: {
      body: "'IM Fell English', Georgia, serif",
      display: "'IM Fell English SC', Georgia, serif",
    },
    curves: { neutral: "smooth", brand: "ease" },
  },
);

// ────────────────────────────────────────────────────────────────────
// Stage 4 additions — bold showcase themes
// ────────────────────────────────────────────────────────────────────

/** Synthwave — neon-on-deep-space. Dark polarity; float shell; grid
 *  texture (perspective rail). Monospace body. Brand-tinted neutrals
 *  (the magenta drift). Exp curves on brand + accent for saturated
 *  mids — the neon glow. Phase D: full effects stack (neon glow on
 *  accent + vivid brand→accent gradient + raised elevation). */
export const SYNTHWAVE: ThemeInputs = defineInputs(
  {
    brand: "#FF00C8",
    accent: "#FAFF00",
    polarity: "dark",
    neutralHueFrom: "brand",
    paperC: 0.016,
    inkC: 0.020,
  },
  {
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
    effects: {
      glow_intensity: "neon",
      glow_anchor: "accent",
      gradient_shell_intensity: "vivid",
      gradient_shell_angle: 110,
      elevation: "raised",
    },
  },
);

/** Brutalist — radius-zero, thick rules, no effects. The substrate
 *  smoke test for the GEOMETRY axis. Achromatic neutrals, ink-and-paper
 *  contrast, exposed grid texture. */
export const BRUTALIST: ThemeInputs = defineInputs(
  {
    brand: "#000000",
    accent: "#000000",
    // C39a: vermilion rubrication ink — the lab brutalist's chromatic
    // identity signal over achromatic neutrals. Seeds the accent ramp.
    ink2: "#D42320",
    neutralHueFrom: null,
  },
  {
    categorical: "greys",
    density: "compact",
    shell_texture: "grid",
    type_base_size: 14,
    type_scale_ratio: 1.25,
    type_weights: { regular: 500, medium: 700, semibold: 800, bold: 900 },
    fonts: {
      body: "'Archivo Black', 'Arial Black', 'Helvetica Neue', sans-serif",
      display: "'Darker Grotesque', 'Archivo Black', sans-serif",
    },
    curves: { neutral: "linear" },
    geometry: {
      radius:       { sm: 0, md: 0, lg: 0, pill: 0 },
      border_width: { hair: 1, thin: 1.5, regular: 2, thick: 3 },
    },
    effects: {
      glow_intensity: "none",
      gradient_shell_intensity: "none",
      elevation: "none",
    },
  },
);

/** Atelier — artist's studio: warm parchment, ink, ruled. Compact ×
 *  0.92 density; decorative-tinted neutrals at high strength (warm
 *  parchment); ruled texture; Italianno display. Subtle warm glow on
 *  the rust accent + soft paper-shadow elevation give the page-on-desk
 *  feel without breaking the editorial restraint. */
export const ATELIER: ThemeInputs = defineInputs(
  {
    brand: "#392A1E",
    accent: "#8B3A3A",
    neutralHueFrom: "#A88B5C",
    paperC: 0.024,
    inkC: 0.024,
  },
  {
    categorical: "okabe_ito",
    density: "compact",
    density_factor: 0.92,
    shell_texture: "ruled",
    type_base_size: 13.5,
    type_scale_ratio: 1.333,
    fonts: {
      body: "'EB Garamond', Georgia, serif",
      display: "'Italianno', 'EB Garamond', cursive, serif",
    },
    curves: { neutral: "log" },
    effects: {
      glow_intensity: "subtle",
      glow_anchor: "accent",
      elevation: "soft",
    },
  },
);

/** Executive — slate + soft gold, raised. Material card meets the
 *  boardroom. Inter body, Cormorant Garamond display (serif title on
 *  sans body — the "executive summary" feel). Float elevation lifts the
 *  card off the page; subtle gradient on the shell gives the premium
 *  material-card sheen without becoming decorative. */
export const EXECUTIVE: ThemeInputs = defineInputs(
  { brand: "#1E3A5F", accent: "#C9A961" },
  {
    categorical: "wong",
    shell_mode: "raised",
    type_base_size: 14,
    type_scale_ratio: 1.333,
    type_weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    fonts: {
      body: "'Mulish', -apple-system, system-ui, sans-serif",
      display: "'Fraunces', Georgia, serif",
    },
    curves: { neutral: "ease", brand: "smooth" },
    effects: {
      gradient_shell_intensity: "subtle",
      gradient_shell_angle: 145,
      elevation: "float",
    },
  },
);

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
  brutalist:       BRUTALIST,
  atelier:         ATELIER,
  executive:       EXECUTIVE,
};

/** Get a preset by name. Unknown name → cochrane (default). */
export function preset(name: string): ThemeInputs {
  return PRESETS[name] ?? COCHRANE;
}
