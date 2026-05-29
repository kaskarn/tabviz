// V3 data palette registry — categorical / sequential / diverging
// schemes for data series.
//
// Per the locked design: data palettes live in their own namespace,
// independent of brand chrome. Brand color drives the table's identity
// (header bands, callouts); data scheme drives which colors encode
// distinct series in forest plots / sparklines / bars.
//
// Defaults (per research synthesis):
//   categorical: okabe_ito  (Nature Methods canonical, colorblind-safe)
//   sequential:  viridis    (perceptually uniform; standard scientific)
//   diverging:   rdbu       (colorblind-safe; ColorBrewer canon)

import type { TokenRampsV3 } from "../types/theme-v3";
import { rampStep } from "./oklch";

// ────────────────────────────────────────────────────────────────────
// Categorical schemes (color arrays — distinct hues, equal weight)
// ────────────────────────────────────────────────────────────────────

/** Okabe-Ito 8-color colorblind-safe palette. Nature Methods canonical. */
export const OKABE_ITO: readonly string[] = [
  "#000000", // black
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
];

/** Tableau 10 — visually distinctive, journal-credible. */
export const TABLEAU_10: readonly string[] = [
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
  "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
];

/** ColorBrewer Set2 — soft pastels, 8 colors, colorblind-safe. */
export const SET2: readonly string[] = [
  "#66C2A5", "#FC8D62", "#8DA0CB", "#E78AC3", "#A6D854",
  "#FFD92F", "#E5C494", "#B3B3B3",
];

/** ColorBrewer Dark2 — saturated, 8 colors. */
export const DARK2: readonly string[] = [
  "#1B9E77", "#D95F02", "#7570B3", "#E7298A", "#66A61E",
  "#E6AB02", "#A6761D", "#666666",
];

/** ColorBrewer Set1 — bright primaries, 9 colors. */
export const SET1: readonly string[] = [
  "#E41A1C", "#377EB8", "#4DAF4A", "#984EA3", "#FF7F00",
  "#FFFF33", "#A65628", "#F781BF", "#999999",
];

/** ColorBrewer Paired — 12 colors in 6 light/dark pairs. */
export const PAIRED: readonly string[] = [
  "#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C", "#FB9A99", "#E31A1C",
  "#FDBF6F", "#FF7F00", "#CAB2D6", "#6A3D9A", "#FFFF99", "#B15928",
];

/** Wong palette — 8-color colorblind-safe, similar in spirit to Okabe-Ito. */
export const WONG: readonly string[] = [
  "#000000", "#E69F00", "#56B4E9", "#009E73",
  "#F0E442", "#0072B2", "#D55E00", "#CC79A7",
];

/** Registry. Names match the strings accepted in `ThemeInputsV3.categorical`. */
export const CATEGORICAL_SCHEMES: Readonly<Record<string, readonly string[]>> = {
  okabe_ito: OKABE_ITO,
  tableau10: TABLEAU_10,
  set1: SET1,
  set2: SET2,
  dark2: DARK2,
  paired: PAIRED,
  wong: WONG,
};

/** Resolve a categorical scheme name to its color array. Unknown → Okabe-Ito. */
export function resolveCategorical(
  name: string,
  ramps?: TokenRampsV3,
): readonly string[] {
  // Special: brand-monochrome derives from the brand ramp.
  if (name === "brand_mono" && ramps) {
    // 5 steps from brand ramp 4..10, spread.
    return [
      rampStep(ramps.brand, 4),
      rampStep(ramps.brand, 6),
      rampStep(ramps.brand, 8),
      rampStep(ramps.brand, 9),
      rampStep(ramps.brand, 11),
    ];
  }
  return CATEGORICAL_SCHEMES[name] ?? OKABE_ITO;
}

// ────────────────────────────────────────────────────────────────────
// Sequential schemes (9-stop arrays; linear-interpolate at consumption)
// ────────────────────────────────────────────────────────────────────
//
// Hand-coded 9-stop arrays sampled from d3/ColorBrewer/Viridis. Renderer
// linearly interpolates between adjacent stops for any t in [0,1].
// Self-contained: no d3-scale-chromatic dependency.

/** Viridis — perceptually uniform; standard scientific default. */
export const VIRIDIS: readonly string[] = [
  "#440154", "#482878", "#3E4989", "#31688E", "#26828E",
  "#1F9E89", "#35B779", "#6DCD59", "#B4DE2C",
];

/** Magma — black to yellow through purple/red. */
export const MAGMA: readonly string[] = [
  "#000004", "#180F3E", "#451078", "#721F81", "#9F2F7F",
  "#CD4071", "#F1605D", "#FD9668", "#FECC8F",
];

/** Plasma — similar to magma but more vibrant. */
export const PLASMA: readonly string[] = [
  "#0D0887", "#41049D", "#6A00A8", "#900DA4", "#B12A90",
  "#CC4778", "#E16462", "#F1844B", "#FCA636",
];

/** ColorBrewer Blues 9-step. */
export const BLUES: readonly string[] = [
  "#F7FBFF", "#DEEBF7", "#C6DBEF", "#9ECAE1", "#6BAED6",
  "#4292C6", "#2171B5", "#08519C", "#08306B",
];

/** ColorBrewer Greens 9-step. */
export const GREENS: readonly string[] = [
  "#F7FCF5", "#E5F5E0", "#C7E9C0", "#A1D99B", "#74C476",
  "#41AB5D", "#238B45", "#006D2C", "#00441B",
];

/** ColorBrewer Greys 9-step. */
export const GREYS: readonly string[] = [
  "#FFFFFF", "#F0F0F0", "#D9D9D9", "#BDBDBD", "#969696",
  "#737373", "#525252", "#252525", "#000000",
];

/** ColorBrewer Oranges 9-step. */
export const ORANGES: readonly string[] = [
  "#FFF5EB", "#FEE6CE", "#FDD0A2", "#FDAE6B", "#FD8D3C",
  "#F16913", "#D94801", "#A63603", "#7F2704",
];

/** ColorBrewer Reds 9-step. */
export const REDS: readonly string[] = [
  "#FFF5F0", "#FEE0D2", "#FCBBA1", "#FC9272", "#FB6A4A",
  "#EF3B2C", "#CB181D", "#A50F15", "#67000D",
];

export const SEQUENTIAL_SCHEMES: Readonly<Record<string, readonly string[]>> = {
  viridis: VIRIDIS,
  magma:   MAGMA,
  plasma:  PLASMA,
  blues:   BLUES,
  greens:  GREENS,
  greys:   GREYS,
  oranges: ORANGES,
  reds:    REDS,
};

export function resolveSequential(name: string): readonly string[] {
  return SEQUENTIAL_SCHEMES[name] ?? VIRIDIS;
}

// ────────────────────────────────────────────────────────────────────
// Diverging schemes (9-stop arrays with neutral midpoint)
// ────────────────────────────────────────────────────────────────────

/** ColorBrewer RdBu 9-step diverging. Colorblind-safe; scientific canon. */
export const RDBU: readonly string[] = [
  "#67001F", "#B2182B", "#D6604D", "#F4A582", "#F7F7F7",
  "#92C5DE", "#4393C3", "#2166AC", "#053061",
];

/** ColorBrewer PiYG 9-step (pink-yellowgreen). */
export const PIYG: readonly string[] = [
  "#8E0152", "#C51B7D", "#DE77AE", "#F1B6DA", "#F7F7F7",
  "#B8E186", "#7FBC41", "#4D9221", "#276419",
];

/** ColorBrewer Spectral 9-step (rainbow-ish, but colorblind-acceptable). */
export const SPECTRAL: readonly string[] = [
  "#9E0142", "#D53E4F", "#F46D43", "#FDAE61", "#FFFFBF",
  "#E6F598", "#ABDDA4", "#66C2A5", "#3288BD",
];

/** ColorBrewer BrBG 9-step (brown-bluegreen). */
export const BRBG: readonly string[] = [
  "#543005", "#8C510A", "#BF812D", "#DFC27D", "#F5F5F5",
  "#80CDC1", "#35978F", "#01665E", "#003C30",
];

export const DIVERGING_SCHEMES: Readonly<Record<string, readonly string[]>> = {
  rdbu:     RDBU,
  piyg:     PIYG,
  spectral: SPECTRAL,
  brbg:     BRBG,
};

export function resolveDiverging(name: string): readonly string[] {
  return DIVERGING_SCHEMES[name] ?? RDBU;
}

/** Linear-interpolate a stop array at t in [0,1]. */
export function sampleScheme(scheme: readonly string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 1) return scheme[scheme.length - 1]!;
  const idx = clamped * (scheme.length - 1);
  const lo = Math.floor(idx);
  const hi = lo + 1;
  const frac = idx - lo;
  if (frac === 0) return scheme[lo]!;
  // Simple sRGB lerp; for high-fidelity, OKLCH-lerp from oklch.ts could be wired.
  return lerpHex(scheme[lo]!, scheme[hi]!, frac);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
  const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "#" + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0").toUpperCase();
}

// ────────────────────────────────────────────────────────────────────
// Series anchors — categorical scheme × series_anchors override
// ────────────────────────────────────────────────────────────────────

/**
 * Resolve the color for series N. Uses series_anchors[N] if set, else
 * falls back to categorical_scheme[N mod len].
 *
 * Forest single-effect default: when n_effects === 1, the renderer
 * should pick `ink_muted` from the chrome layer (not from this
 * data-palette path) — Cochrane/RevMan convention.
 */
export function resolveSeriesColor(
  index: number,
  schemeName: string,
  seriesAnchors: ReadonlyArray<string | null> | undefined,
  ramps?: TokenRampsV3,
): string {
  if (seriesAnchors && seriesAnchors[index]) {
    return seriesAnchors[index]!;
  }
  const scheme = resolveCategorical(schemeName, ramps);
  return scheme[index % scheme.length]!;
}
