// Stage 2 — Typography cascade (Tier 1 inputs + size scale + Tier 2 type roles).
//
// Mirrors the color cascade's three-tier structure:
//   Tier 1 inputs:    fonts trio + type_base_size + type_scale_ratio + weights
//   Tier 1 derived:   7-step size scale (label/foot/body/head/subtitle/title/display)
//   Tier 2 roles:     9 named roles (title/subtitle/body/numeric/label/
//                     caption/footnote/cell/tick)
//   Tier 3 tokens:    --tv-text-{role}-{family|size|weight|lh|track} + font shorthand
//
// Design lock 2026-06-02: stage-2-design.md §1.

import type { ThemeInputs } from "../../types/theme-inputs";

/** Names of the 7-step size scale. */
export type SizeScaleStep =
  | "label"     // -1.2 stops
  | "foot"      // -0.6 stops
  | "body"      // 0 stops (base)
  | "head"      // +0.6 stops
  | "subtitle"  // +1.2 stops
  | "title"     // +2.1 stops
  | "display"   // +3.1 stops
  ;

/** Tier 1 → Tier 1-derived: the resolved size scale. */
export type SizeScale = Readonly<Record<SizeScaleStep, number>>;

/** Named type roles (Tier 2 typography). The `heading` role was dropped in
 *  Coh.22 (rationalization) — zero consumers; subtitle+title cover the slot. */
export type TypeRoleName =
  | "title"
  | "subtitle"
  | "body"
  | "numeric"
  | "label"
  | "caption"
  | "footnote"
  | "cell"
  | "tick"
  ;

/** Tier 2 type role recipe — composes font family slot + scale step + weight +
 *  line-height + tracking. Line-height of `null` defers to a density-derived
 *  default (e.g. cell rows use the cascade's row-height ratio). */
export interface TypeRole {
  family: "display" | "body" | "mono";
  size: SizeScaleStep;
  weight: "regular" | "medium" | "semibold" | "bold";
  lh: number | null;
  track: string;
}

/** Default role bindings — verbatim from stage-2-design.md §1d. */
export const DEFAULT_TYPE_ROLES: Readonly<Record<TypeRoleName, TypeRole>> = {
  title:    { family: "display", size: "title",    weight: "semibold", lh: 1.12, track: "-0.022em" },
  subtitle: { family: "body",    size: "subtitle", weight: "regular",  lh: 1.34, track: "-0.01em" },
  body:     { family: "body",    size: "body",     weight: "regular",  lh: null, track: "0" },
  numeric:  { family: "mono",    size: "body",     weight: "regular",  lh: null, track: "0" },
  label:    { family: "mono",    size: "label",    weight: "bold",     lh: 1,    track: "0.06em" },
  caption:  { family: "body",    size: "foot",     weight: "regular",  lh: 1.5,  track: "0" },
  footnote: { family: "body",    size: "foot",     weight: "regular",  lh: 1.5,  track: "0" },
  cell:     { family: "body",    size: "body",     weight: "regular",  lh: null, track: "0" },
  tick:     { family: "mono",    size: "foot",     weight: "regular",  lh: 1,    track: "0" },
};

/** Tier 1 typography inputs (defaults). The values match v3 conventions: base
 *  14 px, ratio 1.2 (Major Third minus a hair), regular/medium/semibold/bold
 *  weights aligned with the WOFF2 stacks bundled in `font-presets.ts`. */
export const DEFAULT_TYPE_BASE_SIZE = 14;
export const DEFAULT_TYPE_SCALE_RATIO = 1.2;
export const DEFAULT_TYPE_WEIGHTS: Readonly<{
  regular: number;
  medium: number;
  semibold: number;
  bold: number;
}> = { regular: 400, medium: 500, semibold: 600, bold: 700 };

/** Build the size scale from a base size and scale ratio. Each step's
 *  exponent is chosen for editorial-quality rhythm (verbatim from
 *  stage-2-design.md §1c). */
export function buildSizeScale(base: number, ratio: number): SizeScale {
  // Round to 2 decimals for stable cssVar emission.
  const p = (n: number): number => Math.round(base * Math.pow(ratio, n) * 100) / 100;
  return {
    label:    p(-1.2),
    foot:     p(-0.6),
    body:     p(0),
    head:     p(0.6),
    subtitle: p(1.2),
    title:    p(2.1),
    display:  p(3.1),
  };
}

/** Read typography inputs from `ThemeInputs` with defaults applied.
 *  Returns the fully-resolved Tier 1 typography. */
export function resolveTypographyInputs(inputs: ThemeInputs): {
  fonts: { display: string; body: string; mono: string };
  baseSize: number;
  ratio: number;
  weights: { regular: number; medium: number; semibold: number; bold: number };
  scale: SizeScale;
} {
  const body = inputs.fonts?.body ?? "system-ui, -apple-system, sans-serif";
  const fonts = {
    body,
    display: inputs.fonts?.display ?? body,
    mono: inputs.fonts?.mono ?? "ui-monospace, SFMono-Regular, monospace",
  };
  const baseSize = inputs.type_base_size ?? DEFAULT_TYPE_BASE_SIZE;
  const ratio = inputs.type_scale_ratio ?? DEFAULT_TYPE_SCALE_RATIO;
  const weightInputs = inputs.type_weights;
  const weights = {
    regular:  weightInputs?.regular  ?? DEFAULT_TYPE_WEIGHTS.regular,
    medium:   weightInputs?.medium   ?? DEFAULT_TYPE_WEIGHTS.medium,
    semibold: weightInputs?.semibold ?? DEFAULT_TYPE_WEIGHTS.semibold,
    bold:     weightInputs?.bold     ?? DEFAULT_TYPE_WEIGHTS.bold,
  };
  return { fonts, baseSize, ratio, weights, scale: buildSizeScale(baseSize, ratio) };
}

/** Lookup helper used by the resolver: given a role + the resolved Tier 1
 *  typography, return the concrete CSS values that the Tier 3 cssVars emit. */
export function resolveTypeRole(
  roleName: TypeRoleName,
  resolved: ReturnType<typeof resolveTypographyInputs>,
  roleTable: Readonly<Record<TypeRoleName, TypeRole>> = DEFAULT_TYPE_ROLES,
): {
  family: string;
  size: number;
  weight: number;
  lh: number | null;
  track: string;
  font: string;
} {
  const role = roleTable[roleName];
  const family = resolved.fonts[role.family];
  const size = resolved.scale[role.size];
  const weight = resolved.weights[role.weight];
  const lh = role.lh;
  const track = role.track;
  // CSS `font` shorthand: weight size/lh family. When lh is null, omit the
  // line-height segment so descendants inherit naturally.
  const font = lh !== null
    ? `${weight} ${size}px/${lh} ${family}`
    : `${weight} ${size}px ${family}`;
  return { family, size, weight, lh, track, font };
}
