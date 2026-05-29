/**
 * OKLCH color manipulation utilities — JS counterpart to R/utils-oklch.R.
 *
 * Used by the settings panel to cascade Brand and Accent edits through the
 * derived theme tree without needing a server round-trip. Output is always
 * a 6-digit hex string so the resolved value can flow into the theme wire
 * shape and be picker-compatible.
 *
 * Math: Björn Ottosson's OKLab transform from linear sRGB. OKLCH is the
 * polar form of OKLab (C = chroma, H = hue in degrees). Out-of-gamut
 * results are clipped by bisecting on chroma (preserving L and H), the
 * same approach as the R-side `from_oklch`.
 */

interface OKLab { L: number; a: number; b: number; }
interface OKLCH { L: number; C: number; H: number; }
interface RGB { r: number; g: number; b: number; }

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}
function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  // Uppercase to match R's `farver::encode_colour` output — required for
  // byte-equal parity with R-resolved theme snapshots.
  return "#" + [clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

function rgbToOklab({ r, g, b }: RGB): OKLab {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const lc = Math.cbrt(l), mc = Math.cbrt(m), sc = Math.cbrt(s);
  return {
    L: 0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc,
    a: 1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc,
    b: 0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc,
  };
}
function oklabToRgb({ L, a, b }: OKLab): RGB {
  const lc = L + 0.3963377774 * a + 0.2158037573 * b;
  const mc = L - 0.1055613458 * a - 0.0638541728 * b;
  const sc = L - 0.0894841775 * a - 1.2914855480 * b;
  const ll = lc * lc * lc, mm = mc * mc * mc, ss = sc * sc * sc;
  return {
    r: linearToSrgb(+4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss),
    g: linearToSrgb(-1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss),
    b: linearToSrgb(-0.0041960863 * ll - 0.7034186147 * mm + 1.7076147010 * ss),
  };
}

function oklabToOklch({ L, a, b }: OKLab): OKLCH {
  const C = Math.sqrt(a * a + b * b);
  const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, H };
}
function oklchToOklab({ L, C, H }: OKLCH): OKLab {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

function inGamut({ r, g, b }: RGB): boolean {
  return r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;
}

/**
 * OKLCH → hex with gamut clipping. Mirrors `from_oklch` in R: when sRGB is
 * out of gamut, bisect on C (preserving L and H) until in gamut. 40
 * iterations.
 */
function oklchToHex(lch: OKLCH): string {
  let rgb = oklabToRgb(oklchToOklab(lch));
  if (!inGamut(rgb)) {
    let lo = 0, hi = lch.C;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const probe = oklabToRgb(oklchToOklab({ L: lch.L, C: mid, H: lch.H }));
      if (!inGamut(probe)) hi = mid; else lo = mid;
    }
    rgb = oklabToRgb(oklchToOklab({ L: lch.L, C: lo, H: lch.H }));
  }
  return rgbToHex(rgb);
}

function hexToOklch(hex: string): OKLCH {
  return oklabToOklch(rgbToOklab(hexToRgb(hex)));
}

/** Direct hex↔OKLCH access for theme rationalization layer. */
export { hexToOklch, oklchToHex };
export type { OKLCH };

/**
 * Increase OKLCH lightness by `by` (0..1). Negative `by` darkens. Mirrors
 * `oklch_lighten` in R.
 */
export function oklchLighten(hex: string, by: number): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ ...lch, L: Math.max(0, Math.min(1, lch.L + by)) });
}

/** Decrease OKLCH lightness by `by` (0..1). Mirrors `oklch_darken` in R. */
export function oklchDarken(hex: string, by: number): string {
  return oklchLighten(hex, -by);
}

/**
 * Mix two colors in OKLCH at proportion `t`. t=0 → a; t=1 → b. Hue
 * interpolates along the shortest path around the wheel. Mirrors
 * `oklch_mix` in R.
 *
 * Achromatic-endpoint guard. Two failing cases this fixes:
 *   (a) cream + navy 0.4 landing at hue ~135° (green) via shortest-path.
 *   (b) Chained low-chroma mix where BOTH endpoints sit below the
 *       chroma threshold (e.g. surface.base + a faintly-tinted
 *       surface.muted) and shortest-path picks an unrelated hue.
 * Rule: when either endpoint is below threshold, lock to the endpoint
 * with the larger chroma — that's the "intent" hue direction. Both-low
 * cases still produce a faint result, but along the right direction.
 */
const CHROMA_ACHROMATIC = 0.02;

export function oklchMix(a: string, b: string, t: number): string {
  const la = hexToOklch(a);
  const lb = hexToOklch(b);
  let ha = la.H, hb = lb.H;
  let H: number;

  if (la.C < CHROMA_ACHROMATIC || lb.C < CHROMA_ACHROMATIC) {
    // Either (or both) endpoint(s) achromatic. Lock to the endpoint
    // with larger chroma — the more "meaningful" hue.
    H = lb.C > la.C ? hb : ha;
  } else {
    if (Math.abs(hb - ha) > 180) {
      if (hb > ha) ha += 360; else hb += 360;
    }
    H = (ha + t * (hb - ha) + 360) % 360;
  }

  return oklchToHex({
    L: la.L + t * (lb.L - la.L),
    C: la.C + t * (lb.C - la.C),
    H,
  });
}

/**
 * Adjust OKLCH chroma by `by`. Positive saturates, negative desaturates.
 * Mirrors `oklch_chroma` in R.
 */
export function oklchChroma(hex: string, by: number): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ ...lch, C: Math.max(0, lch.C + by) });
}

/**
 * WCAG 2.1 relative luminance of a hex color.
 */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colors. Mirrors `contrast_ratio` in R.
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Walk `fg`'s OKLCH lightness toward black or white (depending on whether
 * `bg` is light or dark) until contrast against `bg` meets `target`.
 * Default 4.5 matches WCAG AA for body text. Mirrors `ensure_contrast` in R.
 */
export function ensureContrast(fg: string, bg: string, target = 4.5): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const bgL = hexToOklch(bg).L;
  const lch = hexToOklch(fg);
  const direction = bgL > 0.5 ? -1 : 1;
  for (let step = 0.02; step <= 1; step += 0.02) {
    const candidate = oklchToHex({
      ...lch,
      L: Math.max(0, Math.min(1, lch.L + direction * step)),
    });
    if (contrastRatio(candidate, bg) >= target) return candidate;
  }
  return oklchToHex({ ...lch, L: direction < 0 ? 0 : 1 });
}

// ────────────────────────────────────────────────────────────────────
// APCA — Accessible Perceptual Contrast Algorithm (Andrew Somers)
// ────────────────────────────────────────────────────────────────────
//
// SAPC-APCA W3 reference (APCA 0.0.98G-4g). Returns a signed Lc value
// in ~[-108, +106]. Magnitude convention: |Lc| ≥ 60 = readable for
// large/bold text (e.g. row-group bands, header text). |Lc| ≥ 75 =
// body text minimum. |Lc| ≥ 90 = high-contrast body / fine print.
// Sign: positive = dark text on light bg; negative = light text on dark bg.
//
// APCA is preferable to WCAG 2.1 in dark-mode and small-text regimes —
// WCAG 2 systematically overstates contrast on dark backgrounds, which
// is exactly tabviz's dark-theme regime. We dual-audit (WCAG for
// regulatory compliance, APCA for legibility decisions).
//
// Reference: https://github.com/Myndex/SAPC-APCA

// Linear sRGB → luminance using APCA's 2.4 exponent (not WCAG's 2.2).
function sRgbToYApca(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126729 * Math.pow(r, 2.4) +
         0.7151522 * Math.pow(g, 2.4) +
         0.0721750 * Math.pow(b, 2.4);
}

const APCA_BLACK_THRESH = 0.022;
const APCA_BLACK_CLAMP  = 1.414;
const APCA_DELTA_Y_MIN  = 0.0005;
const APCA_SCALE_BOW    = 1.14;
const APCA_NORM_BG      = 0.56;
const APCA_NORM_TXT     = 0.57;
const APCA_REV_BG       = 0.65;
const APCA_REV_TXT      = 0.62;
const APCA_OFFSET       = 0.027;

/**
 * APCA Lc — signed lightness-contrast value.
 *
 * @param textHex  Foreground (text/marker) color
 * @param bgHex    Background color
 * @returns Lc value. Convention: |Lc| ≥ 60 large text; ≥ 75 body text.
 */
export function apcaContrast(textHex: string, bgHex: string): number {
  const yT = sRgbToYApca(textHex);
  const yB = sRgbToYApca(bgHex);

  // Soft-clamp Y values near black.
  const txY = yT < APCA_BLACK_THRESH
    ? yT + Math.pow(APCA_BLACK_THRESH - yT, APCA_BLACK_CLAMP)
    : yT;
  const bgY = yB < APCA_BLACK_THRESH
    ? yB + Math.pow(APCA_BLACK_THRESH - yB, APCA_BLACK_CLAMP)
    : yB;

  // Below the perception floor — no measurable contrast.
  if (Math.abs(bgY - txY) < APCA_DELTA_Y_MIN) return 0;

  let SAPC: number;
  if (bgY > txY) {
    // Dark text on light bg (positive output).
    SAPC = (Math.pow(bgY, APCA_NORM_BG) - Math.pow(txY, APCA_NORM_TXT)) * APCA_SCALE_BOW;
    if (SAPC < 0.1) return 0;
    return (SAPC - APCA_OFFSET) * 100;
  } else {
    // Light text on dark bg (negative output).
    SAPC = (Math.pow(bgY, APCA_REV_BG) - Math.pow(txY, APCA_REV_TXT)) * APCA_SCALE_BOW;
    if (SAPC > -0.1) return 0;
    return (SAPC + APCA_OFFSET) * 100;
  }
}

/** Absolute Lc value (use when you only care about magnitude). */
export function apcaLc(textHex: string, bgHex: string): number {
  return Math.abs(apcaContrast(textHex, bgHex));
}

/**
 * Pick the best ink color from a set of candidates for a given bg via
 * APCA. Returns the candidate with the highest |Lc| against `bgHex` that
 * meets `targetLc` (default 60 = readable for large text). If none meet
 * the target, returns the candidate with the highest |Lc| anyway.
 *
 * Use case: from a neutral ramp [neutral.0, neutral.11], pick the one
 * that reads legibly on a brand bg. Drives `brand_ink`, `accent_ink`,
 * `positive_ink`, etc.
 */
export function pickInkOnBg(
  bgHex: string,
  candidates: string[],
  targetLc = 60,
): string {
  if (candidates.length === 0) {
    throw new Error("pickInkOnBg: candidates must be non-empty");
  }
  let best = candidates[0]!;
  let bestLc = apcaLc(best, bgHex);
  for (const c of candidates.slice(1)) {
    const lc = apcaLc(c, bgHex);
    // Prefer candidates that meet the target; among those, prefer the
    // one with the LOWEST Lc above target (least visual force). If none
    // meet, fall back to highest |Lc| overall.
    if (bestLc < targetLc) {
      if (lc > bestLc) { best = c; bestLc = lc; }
    } else {
      if (lc >= targetLc && lc < bestLc) { best = c; bestLc = lc; }
    }
  }
  return best;
}

// ────────────────────────────────────────────────────────────────────
// 12-step OKLCH-uniform ramps (Radix-style per-step contracts)
// ────────────────────────────────────────────────────────────────────
//
// A 12-step ramp encodes a per-step UI contract (step 1 = app bg,
// step 9 = solid bg purest, step 12 = high-contrast text). Each step
// holds a fixed OKLCH lightness; the chroma curve peaks near step 9
// (the "solid" step) and tapers toward the ends.
//
// Light mode: L step 1 → 12 is 98 → 13 (light to dark).
// Dark mode: L step 1 → 12 is 13 → 98 (dark to light).
//
// Step labels stay stable across modes (so `paper = neutral.1` always
// means "the lightest-in-mode step"); the underlying L values shift.

/** Per-step OKLCH L values in light mode (step 1..12, 0-indexed array). */
const LIGHT_RAMP_L = [
  0.987, // 1 — app bg / paper_raised
  0.967, // 2 — subtle bg / paper (was 0.972 — softer, less near-white)
  0.954, // 3 — UI idle / paper_alt (was 0.952 — tighter step from paper for subtler banding)
  0.918, // 4 — UI hover
  0.870, // 5 — UI active / selected
  0.804, // 6 — subtle border / rule_subtle
  0.728, // 7 — UI border / rule_strong / focus
  0.640, // 8 — hovered UI border
  0.540, // 9 — solid bg purest / brand
  0.452, // 10 — solid bg hover / brand_hover
  0.310, // 11 — low-contrast text / ink_muted
  0.180, // 12 — high-contrast text / ink
];

const DARK_RAMP_L = [...LIGHT_RAMP_L].reverse();

/** Chroma curve: peaks at step 9 (index 8), tapers parabolically. */
function chromaAt(stepIndex: number, peakChroma: number): number {
  const peakIndex = 8; // step 9 (1-indexed) = index 8
  const distance = Math.abs(stepIndex - peakIndex);
  // Falloff curve: 1.0 at peak, ~0.08 at the far end.
  const falloff = Math.max(0.04, 1 - (distance * distance) / 25);
  return peakChroma * falloff;
}

export interface RampOptions {
  /** Mode for L direction. Default `"light"`. */
  mode?: "light" | "dark";
  /** Override the peak chroma (at step 9). Default = seed's OKLCH chroma. */
  chromaPeak?: number;
  /** Optional tint hex to blend into low-chroma steps (ends only). */
  tintHex?: string;
  /** 0..0.10 typical. Default 0. */
  tintAmount?: number;
}

/**
 * Generate a 12-step OKLCH-uniform ramp from a seed color.
 *
 * Returns an array of 12 hex strings, indexed 0..11 (corresponding to
 * Radix-style steps 1..12). Use `rampStep(ramp, 9)` for 1-indexed access.
 *
 * The seed determines the hue and (by default) the peak chroma. L values
 * are fixed per step; chroma peaks at step 9 (the "solid" step) and
 * tapers toward the lightest/darkest ends. Mode toggles the L direction.
 *
 * @example
 * const brand = oklchRamp("#0099CC");                // light-mode brand ramp
 * const neutral = oklchRamp("#888", { chromaPeak: 0 }); // pure achromatic
 * const tinted = oklchRamp("#888", { chromaPeak: 0.005, tintHex: "#0099CC", tintAmount: 0.04 });
 */
export function oklchRamp(seed: string, options: RampOptions = {}): string[] {
  const seedLch = hexToOklch(seed);
  const mode = options.mode ?? "light";
  const chromaPeak = options.chromaPeak ?? seedLch.C;
  const Ls = mode === "light" ? LIGHT_RAMP_L : DARK_RAMP_L;

  const ramp: string[] = [];
  for (let i = 0; i < 12; i++) {
    let hex = oklchToHex({
      L: Ls[i]!,
      C: chromaAt(i, chromaPeak),
      H: seedLch.H,
    });
    if (options.tintHex !== undefined && options.tintAmount && options.tintAmount > 0) {
      // Tint blends into low-chroma steps only (the ends — far from the
      // chroma peak). Strength tapers from each end toward the center.
      const distFromCenter = Math.abs(i - 8) / 8; // 0 at peak, 1 at ends
      const strength = options.tintAmount * Math.max(0, distFromCenter - 0.3);
      if (strength > 0) hex = oklchMix(hex, options.tintHex, strength);
    }
    ramp.push(hex);
  }
  return ramp;
}

/** 1-indexed accessor matching Radix step numbering. `rampStep(r, 1)..rampStep(r, 12)`. */
export function rampStep(ramp: string[], step: number): string {
  if (step < 1 || step > 12 || !Number.isInteger(step)) {
    throw new Error(`rampStep: step must be integer in 1..12, got ${step}`);
  }
  return ramp[step - 1]!;
}
