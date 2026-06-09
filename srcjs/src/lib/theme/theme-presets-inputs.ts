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
  /** Optional accent hex. Defaults to brand. Also drives the rubrication
   *  channel (--tv-ink2); pin --tv-ink2 to make rubrication differ. */
  accent?: string;
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
/** NEJM — classic medical serif. Crimson brand + slate accent. Type
 *  scale 1.25; smooth curve on the brand ramp for the velvet-red feel. */
export const NEJM: ThemeInputs = defineInputs(
  { brand: "#BD2F2F", accent: "#1B5377" },
  {
    categorical: "okabe_ito",
    border_preset: "frame",
    type_scale_ratio: 1.25,
    fonts: {
      body: "'Lora', Georgia, serif",
      display: "'Lora', Georgia, serif",
    },
    curves: { neutral: "ease", brand: "smooth" },
  },
);
// ────────────────────────────────────────────────────────────────────
// Modes
// ────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────
// Design movements
// ────────────────────────────────────────────────────────────────────
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
    // C65: newspaper rows are tight — column-inches discipline.
    density_factor: 0.95,
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
// ────────────────────────────────────────────────────────────────────
// Tonal — Material You-style
// ────────────────────────────────────────────────────────────────────
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
    // C65: storybook breathing room.
    density_factor: 1.05,
    shell_mode: "raised",
    // C66: torchlit-hall depth — soft elevation.
    effects: { elevation: "low" },
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
    // B5/D6: neon semantic palette — status is identity for synthwave.
    status: {
      positive: { L: 0.88, C: 0.211, H: 156.631 },   // #00FF9C
      negative: { L: 0.65, C: 0.238, H: 17.898 },    // #FF2D55
      warning:  { L: 0.885, C: 0.181, H: 94.784 },   // #FFD60A
      info:     { L: 0.844, C: 0.146, H: 209.285 },  // #00E5FF
    },
    // 1f/C66: neon series — tableau-corporate colors inside a neon frame
    // were the palette-level identity collapse.
    categorical: "neon",
    marks: { point_shape: "diamond" },
    // C65: float-card radius is part of the neon identity (lab: 9).
    geometry: { radius: { sm: 4, md: 9, lg: 14, pill: 999 } },
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
      elevation: "medium",
      // 2c-i: neon underline beneath the title (lab synthwave).
      title_style: "underline",
    },
  },
);

/** Brutalist — radius-zero, thick rules, no effects. The substrate
 *  smoke test for the GEOMETRY axis. Achromatic neutrals, ink-and-paper
 *  contrast, exposed grid texture. */
export const BRUTALIST: ThemeInputs = defineInputs(
  {
    brand: "#000000",
    // C39a: vermilion engagement hue (was the ink2 anchor, which won the
    // accent-ramp seed — the old accent#000 was black-on-black, invisible).
    // The lab brutalist's chromatic identity signal over achromatic neutrals.
    accent: "#D42320",
    neutralHueFrom: null,
  },
  {
    // B5/D6: ink-discipline semantic palette — vermilion negative matches
    // the rubrication ink; the rest stay muted so red owns the alarm.
    status: {
      positive: { L: 0.523, C: 0.135, H: 144.167 },  // #2E7D32
      negative: { L: 0.56, C: 0.21, H: 28.014 },     // #D42320
      warning:  { L: 0.642, C: 0.144, H: 65.037 },   // #C77700
      info:     { L: 0.387, C: 0.025, H: 229.789 },  // #37474F
    },
    categorical: "ink_vermilion",
    // 1f: hard-edged marks — square points, thick CI caps.
    marks: { point_shape: "square", interval_weight: "thick" },
    density: "compact",
    // C65: brutalist wants DENSE — compact preset tightened further.
    density_factor: 0.88,
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
    // 2c-i: solid-ink header band (structural variant) + rubrication
    // title bar (lab brutalist).
    header_style: "bold",
    effects: {
      glow_intensity: "none",
      gradient_shell_intensity: "none",
      elevation: "none",
      title_style: "bar",
    },
  },
);
// ────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// rgc_v4 lab ports (wire-audit 2b / C39b) — the lab's exact anchor hues,
// spreading the brand spectrum (H200 / H150 / H305) away from the
// blue-journal cluster.
// ────────────────────────────────────────────────────────────────────

/** Ledger — accountant's ruled book. Teal-ink brand (H200), oxblood
 *  rubrication (H28), warm cream paper. Chip + stripe caption (the two
 *  deliberately source different anchors). Hairline rules. */
export const LEDGER: ThemeInputs = defineInputs(
  {
    brand: "#006266",
    accent: "#862721",
    neutralHueFrom: "#DECBB1",
    paperC: 0.012,
    inkC: 0.014,
  },
  {
    categorical: "dark2",
    density_factor: 0.97,
    shell_mode: "raised",
    shell_texture: "ruled",
    marks: { interval_weight: "hair" },
    geometry: { radius: { sm: 1, md: 3, lg: 5, pill: 999 } },
    fonts: {
      body: "'Spectral', Georgia, serif",
      display: "'Spectral', Georgia, serif",
      mono: "'Spline Sans Mono', monospace",
    },
    curves: { neutral: "ease" },
    effects: { caption_style: "both" },
  },
);

/** Terminal — phosphor CRT. Single green hue carries the whole surface
 *  via `monochrome`; amber accent doubles as the rubrication channel. Ruled
 *  texture reads as scanlines; subtle glow reads as phosphor bleed. */
export const TERMINAL: ThemeInputs = defineInputs(
  {
    brand: "#20C45F",
    accent: "#DAA500",
    polarity: "dark",
  },
  {
    monochrome: true,
    categorical: "greens",
    density: "compact",
    shell_texture: "ruled",
    geometry: { radius: { sm: 0, md: 0, lg: 0, pill: 0 } },
    fonts: {
      body: "'Space Mono', 'Courier New', monospace",
      display: "'Space Mono', 'Courier New', monospace",
      mono: "'Space Mono', 'Courier New', monospace",
    },
    type_base_size: 13,
    effects: { glow_intensity: "subtle", glow_anchor: "brand" },
    curves: { neutral: "exp" },
  },
);

/** Aurora — borealis glass. Magenta-violet brand (H305), cyan accent
 *  (H200), dark float card with glow + gradient shell. The full glass
 *  stack (backdrop blobs, sheen, bevel) lands in Pass 5; these pins
 *  already give it the chromatic identity. */
export const AURORA: ThemeInputs = defineInputs(
  {
    brand: "#B15DFC",
    accent: "#17D0D8",
    polarity: "dark",
  },
  {
    categorical: "wong",
    // raised (not float): the glass pane needs the recipe-driven band
    // padding to be visible around the paper; the glass tint overrides
    // the raised bg via higher selector specificity.
    shell_mode: "raised",
    geometry: { radius: { sm: 4, md: 11, lg: 16, pill: 999 } },
    fonts: {
      body: "'Outfit', -apple-system, system-ui, sans-serif",
      display: "'Outfit', -apple-system, system-ui, sans-serif",
    },
    effects: {
      glass: "aurora",
      glow_intensity: "subtle",
      glow_anchor: "accent",
      gradient_shell_intensity: "subtle",
      elevation: "high",
      caption_style: "chip",
    },
    curves: { neutral: "smooth" },
  },
);

/** Blueprint — drafting-table cyanotype. Deep cyan-navy paper (dark
 *  polarity, brand-hued neutrals), amber rubrication for callouts, grid
 *  texture as the drafting sheet, monospace annotations, radius 0. */
export const BLUEPRINT: ThemeInputs = defineInputs(
  {
    brand: "#007D9F",
    accent: "#E69C3A",
    polarity: "dark",
    paperC: 0.045,
    inkC: 0.02,
  },
  {
    // ARCHITECTURAL DRAFT, not a code terminal. Blueprint reads as a drafting
    // sheet: a geometric SANS for labels/annotations (Archivo) — deliberately
    // NOT the all-mono of Terminal, so the two dark/grid identities don't
    // collapse to one "dark mono grid" gestalt (distinctness review
    // 2026-06-09). Two-color (paired) vs Terminal's monochrome single-hue.
    categorical: "paired",
    density: "compact",
    shell_texture: "grid",
    geometry: { radius: { sm: 0, md: 0, lg: 0, pill: 0 } },
    marks: { point_shape: "triangle" },
    fonts: {
      body: "'Archivo', 'Helvetica Neue', system-ui, sans-serif",
      display: "'Archivo', 'Helvetica Neue', system-ui, sans-serif",
      mono: "'IBM Plex Mono', 'Courier New', monospace",
    },
    type_base_size: 13,
    effects: { title_style: "underline" },
    curves: { neutral: "smooth" },
  },
);
// THE COMMITTED IDENTITY SET (9). The 27→9 hard cull (UX-redesign B, locked
// with the user 2026-06-09): each survivor owns a distinct axis (rgc_v4 model).
// `nejm` is the Clinical representative AND the default (replaced cochrane).
// The 18 deleted looks (cochrane, lancet, jama, nature, bmj, swiss, bauhaus,
// tufte, solarized(+dark), tonal(+dark), elvish, hobbit, atelier, executive,
// sunprint, dark) are gone from the roster. Their BRAND COLOR is a
// `set_brand()` recolor of a survivor away; their FULL personality (the
// journals differed in shell_mode / type scale / density / neutrals too) is a
// `webTheme({ baseTheme: "nejm", shell_mode, type_scale_ratio, … })` away —
// set_brand alone does NOT reproduce them. See docs/dev/ux-redesign-plan.md.
export const PRESETS: Readonly<Record<string, ThemeInputs>> = {
  nejm:       NEJM,        // Clinical / restraint (default)
  ledger:     LEDGER,      // COLOR axis
  brutalist:  BRUTALIST,   // GEOMETRY axis
  aurora:     AURORA,      // EFFECTS axis
  terminal:   TERMINAL,    // ALIASING axis
  newsprint:  NEWSPRINT,   // TEXTURE axis
  blueprint:  BLUEPRINT,   // DRAFT / GRID
  synthwave:  SYNTHWAVE,   // NEON
  dwarven:    DWARVEN,     // FANTASY / display-serif (fonts-in-PDF showcase)
};

/** C17/C56 (wire-audit Pass 4d): nudge the supporting anchors' HUES
 *  toward brand H without touching L — "everything tinted from one brand
 *  color" in one move. A REFINEMENT tool, not the on-ramp (the on-ramp
 *  is preset + set_brand). Strength = fraction of the angular distance
 *  each anchor travels: subtle 0.3, medium 0.6, vivid 1.0. Mirrored by
 *  R's tint_from_brand(). */
export function tintFromBrand(
  inputs: ThemeInputs,
  strength: "subtle" | "medium" | "vivid" = "medium",
): ThemeInputs {
  const t = strength === "subtle" ? 0.3 : strength === "medium" ? 0.6 : 1.0;
  const brandH = inputs.anchors.brand.H;
  const toward = (h: number): number => {
    const d = ((brandH - h + 540) % 360) - 180; // shortest arc
    return ((h + d * t) % 360 + 360) % 360;
  };
  const nudge = (a: OklchTriple | undefined): OklchTriple | undefined =>
    a ? { ...a, H: toward(a.H) } : undefined;
  return {
    ...inputs,
    anchors: {
      ...inputs.anchors,
      paper: nudge(inputs.anchors.paper)!,
      ink: nudge(inputs.anchors.ink)!,
      ...(inputs.anchors.accent ? { accent: nudge(inputs.anchors.accent) } : {}),
    },
  };
}

/** Get a preset by name. Unknown name → nejm (default after the 27→9 cull). */
export function preset(name: string): ThemeInputs {
  return PRESETS[name] ?? NEJM;
}
