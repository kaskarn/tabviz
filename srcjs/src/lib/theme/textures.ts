// Stage 2 §3 — Surface texture color tokens.
//
// Four textures (ruled / grid / dotted / grain) share two color knobs:
//   --tv-shell-texture-line, --tv-shell-texture-dot
//
// The colors come from the neutral ramp at low grades so the textures
// read as faint paper marks rather than visible chrome.
//
// SHELL-ONLY since the spacing rework (2026-06-05): the shell wraps the
// whole figure (caption + strip + paper), so the texture always lives on
// the shell — under flush/float the shell bg is transparent but its
// background-image still paints, showing through wherever the opaque
// paper doesn't cover. The old paper-texture fallthrough (data attr +
// twin paper-side tokens) was deleted with it, along with the
// never-consumed svgTexturePattern / svgTextureKnockoutRect helpers
// (texture is browser-only territory per D11).

export interface TextureColors {
  shellLine: string;
  shellDot: string;
}

/** Resolve texture colors from neutral ramp grades. The recipe pairs:
 *  line = neutral.3 (very faint)
 *  dot  = neutral.4 (slightly stronger) */
export function resolveTextureColors(neutralRamp: readonly string[]): TextureColors {
  const at = (i: number): string => neutralRamp[Math.min(i, neutralRamp.length - 1)] ?? "#000000";
  return {
    shellLine: at(2),  // neutral grade 3 (0-indexed = 2)
    shellDot:  at(3),  // neutral grade 4
  };
}

/** Map a texture cssVar to its key in TextureColors. */
export function textureKeyForCssVar(cssVar: string): keyof TextureColors | null {
  switch (cssVar) {
    case "--tv-shell-texture-line": return "shellLine";
    case "--tv-shell-texture-dot":  return "shellDot";
    default: return null;
  }
}

/** Stage 2 §3 surface texture name. */
export type ShellTexture = "none" | "ruled" | "grid" | "dotted" | "grain";

/** Mix a hex color with white at the given opacity. Used to pre-resolve
 *  the texture knockout pad (`shell-bg @ 78%` against page white). */
function premixOnWhite(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const o = Math.max(0, Math.min(1, opacity));
  const mix = (c: number): number => Math.round(c * o + 255 * (1 - o));
  const toHex = (c: number): string => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** Resolve the knockout pad color for a given surface bg.
 *
 *  Stage 2 §4: shell bg at 78% opacity premixed against a neutral page
 *  background (white). The result is a hex literal both CSS and SVG can
 *  consume directly — no `color-mix()` needed (librsvg compatibility). */
export function resolveTextureKnockoutBg(surfaceBg: string): string {
  if (surfaceBg === "transparent" || !surfaceBg.startsWith("#")) {
    return "rgba(255,255,255,0.78)";
  }
  return premixOnWhite(surfaceBg, 0.78);
}
