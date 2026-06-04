/**
 * Theme validation utilities. Two distinct layers:
 *
 *   1. `validateThemeInputs(inputs)` — construction-time check of
 *      authoring-input ranges + enums (anchor L/C/H bounds, density
 *      enum, geometry numeric ranges, effects enum membership).
 *      Mirrors `R/classes-theme.R::ThemeInputs`' S7 validator, so a TS
 *      author hand-rolling inputs hits the same errors an R author
 *      hits via S7. Throws `ThemeInputsValidationError`.
 *
 *   2. `validateResolvedTheme(theme)` — post-resolution check of
 *      contrast invariants for the bold-band header rows, accent
 *      semantic fills, etc. (TS port of `R/utils-theme-validate.R`).
 *      Throws `ThemeValidationError`.
 *
 * Skipping resolved-theme validation is supported via
 * `resolveTheme(draft, { validate: false })` for tests that use
 * synthetic high-saturation colors.
 */

import { contrastRatio } from "../oklch";
import type { WebTheme } from "../../types/theme-resolved";
import type { ThemeInputs, OklchTriple } from "../../types/theme-inputs";

// Header text is bold (weight=600) and lives in chrome bands rather than
// dense reading flow, so WCAG AA Large (3.0) is the applicable bar.
// Body text on surface.base gets the stricter 4.5 (WCAG AA Normal).
const WCAG_AA_LARGE = 3.0;
const WCAG_AA_NORMAL = 4.5;

interface Invariant {
  name: string;
  fg: string | null;
  bg: string | null;
  path: string[];
  minRatio: number;
}

interface ContrastFailure {
  name: string;
  ratio: number;
  minRatio: number;
  fg: string;
  bg: string;
  path: string[];
}

export class ThemeValidationError extends Error {
  failures: ContrastFailure[];
  constructor(failures: ContrastFailure[]) {
    const lines = failures.map((f) =>
      `${f.name}\n  fg=${f.fg} on bg=${f.bg} -> contrast=${f.ratio.toFixed(2)} (need >=${f.minRatio.toFixed(1)})\n  cascade: ${f.path.join(" <- ")}`,
    );
    super(`Theme failed ${failures.length} contrast invariant${failures.length === 1 ? "" : "s"}.\n${lines.join("\n")}`);
    this.name = "ThemeValidationError";
    this.failures = failures;
  }
}

/**
 * Validate every contrast invariant on a resolved theme. Throws a
 * `ThemeValidationError` on failure; returns void on success.
 */
export function validateResolvedTheme(theme: WebTheme): void {
  const invariants: Invariant[] = [
    {
      name: "header bold band: header.bold.fg must read on header.bold.bg",
      fg: theme.header.bold.fg,
      bg: theme.header.bold.bg,
      path: ["header.bold.fg", "header.bold.bg", "content.inverse", "inputs.primaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "column-group bold band: columnGroup.bold.fg must read on columnGroup.bold.bg",
      fg: theme.columnGroup.bold.fg,
      bg: theme.columnGroup.bold.bg,
      path: ["columnGroup.bold.fg", "columnGroup.bold.bg", "content.inverse", "inputs.secondaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "header tint band: header.tint.fg must read on header.tint.bg",
      fg: theme.header.tint.fg,
      bg: theme.header.tint.bg,
      path: ["header.tint.fg", "header.tint.bg", "content.primary", "inputs.primaryDeep"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "leaf header light band: header.light.fg must read on surface.base",
      fg: theme.header.light.fg,
      bg: theme.surface.base,
      path: ["header.light.fg", "content.primary", "surface.base"],
      minRatio: WCAG_AA_NORMAL,
    },
    {
      name: "default cell text: content.primary must read on surface.base",
      fg: theme.content.primary,
      bg: theme.surface.base,
      path: ["content.primary", "surface.base"],
      minRatio: WCAG_AA_NORMAL,
    },
  ];

  const failures: ContrastFailure[] = [];
  for (const inv of invariants) {
    if (inv.fg == null || inv.bg == null) continue;
    const ratio = contrastRatio(inv.fg, inv.bg);
    if (ratio < inv.minRatio) {
      failures.push({
        name: inv.name,
        ratio,
        minRatio: inv.minRatio,
        fg: inv.fg,
        bg: inv.bg,
        path: inv.path,
      });
    }
  }

  if (failures.length > 0) {
    throw new ThemeValidationError(failures);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Inputs validation — mirrors R `classes-theme.R::ThemeInputs` S7 validator
// ────────────────────────────────────────────────────────────────────────────

export class ThemeInputsValidationError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`ThemeInputs failed ${problems.length} validation check${problems.length === 1 ? "" : "s"}.\n${problems.map((p) => "  - " + p).join("\n")}`);
    this.name = "ThemeInputsValidationError";
    this.problems = problems;
  }
}

const POLARITY_VALUES = ["light", "dark"] as const;
const MODE_VALUES = ["standard", "high-contrast", "reduced-transparency"] as const;
const DENSITY_VALUES = ["compact", "comfortable", "spacious"] as const;
const SHELL_MODE_VALUES = ["flush", "raised", "float", "transparent"] as const;
const SHELL_TEXTURE_VALUES = ["none", "ruled", "grid", "dotted", "grain"] as const;
const CURVE_VALUES = ["linear", "ease", "smooth", "log", "exp"] as const;
const GLOW_INTENSITY_VALUES = ["none", "subtle", "neon"] as const;
const GLOW_ANCHOR_VALUES = ["brand", "accent"] as const;
const GRADIENT_INTENSITY_VALUES = ["none", "subtle", "vivid"] as const;
const ELEVATION_VALUES = ["none", "soft", "raised", "float"] as const;

function checkTriple(triple: OklchTriple | undefined, name: string, problems: string[], required: boolean): void {
  if (triple === undefined) {
    if (required) problems.push(`${name}: required, got undefined`);
    return;
  }
  if (typeof triple.L !== "number" || triple.L < 0 || triple.L > 1) {
    problems.push(`${name}.L must be a number in [0, 1], got ${triple.L}`);
  }
  if (typeof triple.C !== "number" || triple.C < 0 || triple.C > 0.5) {
    problems.push(`${name}.C must be a number in [0, 0.5], got ${triple.C}`);
  }
  if (typeof triple.H !== "number" || triple.H < 0 || triple.H >= 360) {
    problems.push(`${name}.H must be a number in [0, 360), got ${triple.H}`);
  }
}

function checkEnum<T extends readonly string[]>(
  value: T[number] | undefined, choices: T, name: string, problems: string[],
): void {
  if (value === undefined) return;
  if (!(choices as readonly string[]).includes(value)) {
    problems.push(`${name} must be one of [${choices.join(", ")}], got '${value}'`);
  }
}

function checkRange(
  value: number | undefined, lo: number, hi: number, name: string, problems: string[],
): void {
  if (value === undefined) return;
  if (typeof value !== "number" || value < lo || value > hi) {
    problems.push(`${name} must be a number in [${lo}, ${hi}], got ${value}`);
  }
}

/**
 * Validate authoring-input ranges + enum memberships. Mirrors the R
 * `ThemeInputs` S7 validator. Call before passing inputs into the
 * resolver — catches typo'd enum values, out-of-range OKLCH triples,
 * and other authoring mistakes that the type system can't catch.
 */
export function validateThemeInputs(inputs: ThemeInputs): void {
  const p: string[] = [];

  // Anchors — paper / ink / brand required; accent optional.
  checkTriple(inputs.anchors?.paper, "anchors.paper", p, true);
  checkTriple(inputs.anchors?.ink,   "anchors.ink",   p, true);
  checkTriple(inputs.anchors?.brand, "anchors.brand", p, true);
  checkTriple(inputs.anchors?.accent, "anchors.accent", p, false);

  // Status — all optional.
  checkTriple(inputs.status?.positive, "status.positive", p, false);
  checkTriple(inputs.status?.negative, "status.negative", p, false);
  checkTriple(inputs.status?.warning,  "status.warning",  p, false);
  checkTriple(inputs.status?.info,     "status.info",     p, false);

  // Enums
  checkEnum(inputs.polarity, POLARITY_VALUES, "polarity", p);
  checkEnum(inputs.mode, MODE_VALUES, "mode", p);
  checkEnum(inputs.density, DENSITY_VALUES, "density", p);
  checkEnum(inputs.shell_mode, SHELL_MODE_VALUES, "shell_mode", p);
  checkEnum(inputs.shell_texture, SHELL_TEXTURE_VALUES, "shell_texture", p);
  checkEnum(inputs.curves?.neutral, CURVE_VALUES, "curves.neutral", p);
  checkEnum(inputs.curves?.brand,   CURVE_VALUES, "curves.brand",   p);
  checkEnum(inputs.curves?.accent,  CURVE_VALUES, "curves.accent",  p);
  checkEnum(inputs.effects?.glow_intensity, GLOW_INTENSITY_VALUES, "effects.glow_intensity", p);
  checkEnum(inputs.effects?.glow_anchor, GLOW_ANCHOR_VALUES, "effects.glow_anchor", p);
  checkEnum(inputs.effects?.gradient_shell_intensity, GRADIENT_INTENSITY_VALUES, "effects.gradient_shell_intensity", p);
  checkEnum(inputs.effects?.elevation, ELEVATION_VALUES, "effects.elevation", p);

  // Numeric ranges
  checkRange(inputs.density_factor, 0.5, 2, "density_factor", p);
  checkRange(inputs.type_base_size, 8, 32, "type_base_size", p);
  checkRange(inputs.type_scale_ratio, 1.05, 1.6, "type_scale_ratio", p);
  for (const k of ["regular", "medium", "semibold", "bold"] as const) {
    checkRange(inputs.type_weights?.[k], 100, 900, `type_weights.${k}`, p);
  }
  for (const k of ["sm", "md", "lg", "pill"] as const) {
    checkRange(inputs.geometry?.radius?.[k], 0, 999, `geometry.radius.${k}`, p);
  }
  for (const k of ["hair", "thin", "regular", "thick"] as const) {
    checkRange(inputs.geometry?.border_width?.[k], 0, 999, `geometry.border_width.${k}`, p);
  }
  checkRange(inputs.effects?.gradient_shell_angle, 0, 360, "effects.gradient_shell_angle", p);

  if (p.length > 0) throw new ThemeInputsValidationError(p);
}
