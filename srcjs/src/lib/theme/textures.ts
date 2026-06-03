// Stage 2 §3 — Surface texture color tokens.
//
// Four textures (ruled / grid / dotted / grain) share two color knobs:
//   --tv-shell-texture-line, --tv-shell-texture-dot
//   --tv-paper-texture-line, --tv-paper-texture-dot
//
// The colors come from the neutral ramp at low grades so the textures
// read as faint paper marks rather than visible chrome.

export interface TextureColors {
  shellLine: string;
  shellDot: string;
  paperLine: string;
  paperDot: string;
}

/** Resolve texture colors from neutral ramp grades. The recipe pairs:
 *  line = neutral.3 (very faint)
 *  dot  = neutral.4 (slightly stronger)
 *
 *  Both surfaces share the same neutrals — shell and paper textures look
 *  the same on a given theme. This is intentional: textures are about
 *  surface PERSONALITY, not about distinguishing shell from paper. */
export function resolveTextureColors(neutralRamp: readonly string[]): TextureColors {
  const at = (i: number): string => neutralRamp[Math.min(i, neutralRamp.length - 1)] ?? "#000000";
  const line = at(2);  // neutral grade 3 (0-indexed = 2)
  const dot  = at(3);  // neutral grade 4
  return {
    shellLine: line,
    shellDot:  dot,
    paperLine: line,
    paperDot:  dot,
  };
}

/** Map a texture cssVar to its key in TextureColors. */
export function textureKeyForCssVar(cssVar: string): keyof TextureColors | null {
  switch (cssVar) {
    case "--tv-shell-texture-line": return "shellLine";
    case "--tv-shell-texture-dot":  return "shellDot";
    case "--tv-paper-texture-line": return "paperLine";
    case "--tv-paper-texture-dot":  return "paperDot";
    default: return null;
  }
}

/** Stage 2 §3 surface texture name. */
export type ShellTexture = "none" | "ruled" | "grid" | "dotted" | "grain";

/** Emit an SVG `<pattern>` definition for a given texture. Returns null
 *  when `texture === "none"`. Used by svg-generator.ts to render the
 *  shell/paper SVG with the same texture the browser shows. Caller
 *  wraps with `<defs>...</defs>` and references via `fill="url(#id)"`. */
export function svgTexturePattern(texture: ShellTexture, surface: "shell" | "paper" = "shell"): string | null {
  const id = `tv-pattern-${surface}-${texture}`;
  const line = `var(--tv-${surface}-texture-line)`;
  const dot  = `var(--tv-${surface}-texture-dot)`;
  switch (texture) {
    case "none":
      return null;
    case "ruled":
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="29" height="29">` +
        `<line x1="0" y1="28" x2="29" y2="28" stroke="${line}" stroke-width="1"/>` +
        `</pattern>`
      );
    case "grid":
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="24" height="24">` +
        `<line x1="0" y1="23" x2="24" y2="23" stroke="${line}" stroke-width="1"/>` +
        `<line x1="23" y1="0" x2="23" y2="24" stroke="${line}" stroke-width="1"/>` +
        `</pattern>`
      );
    case "dotted":
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="15" height="15">` +
        `<circle cx="7.5" cy="7.5" r="1" fill="${dot}"/>` +
        `</pattern>`
      );
    case "grain":
      // SVG fractalNoise — librsvg supports it; renders as paper grain.
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="180" height="180">` +
        `<filter id="${id}-noise">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="1"/>` +
        `<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/>` +
        `</filter>` +
        `<rect width="180" height="180" filter="url(#${id}-noise)"/>` +
        `</pattern>`
      );
  }
}

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

/** Stage 2 §4 — emit a knockout `<rect>` to sit behind a text element on
 *  a textured surface. Caller draws the rect first, then the text. */
export function svgTextureKnockoutRect(
  x: number,
  y: number,
  width: number,
  height: number,
  surface: "shell" | "paper" = "shell",
): string {
  const padX = 7, padY = 1.5;
  const fill = `var(--tv-${surface}-text-knockout-bg)`;
  return (
    `<rect class="tv-text-knockout" ` +
    `x="${x - padX}" y="${y - padY}" ` +
    `width="${width + padX * 2}" height="${height + padY * 2}" ` +
    `fill="${fill}" rx="4"/>`
  );
}
