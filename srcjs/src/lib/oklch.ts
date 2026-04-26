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
  return "#" + [clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
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
 */
export function oklchMix(a: string, b: string, t: number): string {
  const la = hexToOklch(a);
  const lb = hexToOklch(b);
  let ha = la.H, hb = lb.H;
  if (Math.abs(hb - ha) > 180) {
    if (hb > ha) ha += 360; else hb += 360;
  }
  return oklchToHex({
    L: la.L + t * (lb.L - la.L),
    C: la.C + t * (lb.C - la.C),
    H: (ha + t * (hb - ha) + 360) % 360,
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
