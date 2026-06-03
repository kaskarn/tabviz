// Stage 2 §6 — Elevation shadow color tokens.
//
// Browser side: emits CSS color values that box-shadow declarations
// reference. SVG side: same values feed `<feFlood flood-color>` inside
// `<filter>` defs. The shared color tokens are the parity guarantee —
// browser and SVG render the same shadow.
//
// The colors lean toward the paper's hue rather than pure black per
// rgc_v4's elevation philosophy. Mix recipe:
//   raised-near = mix(paper, black, 12%) @ alpha 0.12
//   raised-far  = mix(paper, black, 24%) @ alpha 0.08
//   overlay-near = mix(paper, black, 24%) @ alpha 0.18
//   overlay-far  = mix(paper, black, 32%) @ alpha 0.12

export interface ElevationShadowColors {
  raisedNear: string;
  raisedFar: string;
  overlayNear: string;
  overlayFar: string;
}

/** Mix two hex colors, returning a hex string. `t` is the second color's
 *  share, clamped [0,1]. Simple sRGB linear interpolation — good enough
 *  for shadow tinting (saturation isn't critical here). */
function mixHex(a: string, b: string, t: number): string {
  const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
  const p = (c: string, i: number): number => parseInt(c.replace("#", "").slice(i, i + 2), 16);
  const ar = p(a, 0), ag = p(a, 2), ab = p(a, 4);
  const br = p(b, 0), bg = p(b, 2), bb = p(b, 4);
  const r = clamp(ar + (br - ar) * t);
  const g = clamp(ag + (bg - ag) * t);
  const bl = clamp(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/** Convert a hex to `rgba(r,g,b,a)`. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compute shadow colors for the elevation tiers. `paperBg` is the
 *  resolved paper background hex; we mix it with black per the recipe. */
export function resolveElevationShadows(paperBg: string): ElevationShadowColors {
  return {
    raisedNear:  hexToRgba(mixHex(paperBg, "#000000", 0.12), 0.12),
    raisedFar:   hexToRgba(mixHex(paperBg, "#000000", 0.24), 0.08),
    overlayNear: hexToRgba(mixHex(paperBg, "#000000", 0.24), 0.18),
    overlayFar:  hexToRgba(mixHex(paperBg, "#000000", 0.32), 0.12),
  };
}

/** Map a shadow cssVar to its key in ElevationShadowColors. */
export function elevationKeyForCssVar(cssVar: string): keyof ElevationShadowColors | null {
  switch (cssVar) {
    case "--tv-shadow-raised-near":  return "raisedNear";
    case "--tv-shadow-raised-far":   return "raisedFar";
    case "--tv-shadow-overlay-near": return "overlayNear";
    case "--tv-shadow-overlay-far":  return "overlayFar";
    default: return null;
  }
}
