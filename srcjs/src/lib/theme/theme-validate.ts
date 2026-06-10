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
import { INTERACTION_FLAG_KEYS } from "../interaction-resolve";
import type { WebTheme } from "../../types/theme-resolved";
import type { ThemeInputs, OklchTriple } from "../../types/theme-inputs";
import { getCssVars, readVar, readSurfaceBg, readContentPrimary } from "./consumer-bridge";

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
  // Validate against the v4 cssVars — the canonical resolved values.
  // The v3 chrome (theme.surface/content/divider/header.X) is a config
  // bridge populated by buildThemeStructure; using v4 cssVars here
  // avoids the hidden drift between the two resolvers and means the
  // contrast check operates on what the renderer actually paints.
  const failures = collectContrastFailures(getCssVars(theme));
  if (failures.length > 0) {
    throw new ThemeValidationError(failures);
  }
}

/** Non-throwing variant over a raw cssVars map — the studio consumes
 *  this for its live contrast banner (R3 studio UX F1: dragging Paper L
 *  to 0 rendered an unreadable chart with zero feedback because the
 *  validator only ran in buildTheme, which the studio's resolve path
 *  bypasses). */
export function collectContrastFailures(
  cv: Record<string, string>,
): ContrastFailure[] {
  const surfaceBg = readSurfaceBg(cv);
  const text      = readContentPrimary(cv);
  const headerLightBg = readVar(cv, "--tv-header-light-bg", surfaceBg) ?? surfaceBg;
  const headerLightFg = readVar(cv, "--tv-header-light-fg", text)      ?? text;
  const headerTintBg  = readVar(cv, "--tv-header-tint-bg",  surfaceBg) ?? surfaceBg;
  const headerTintFg  = readVar(cv, "--tv-header-tint-fg",  text)      ?? text;
  const headerFillBg  = readVar(cv, "--tv-header-fill-bg",  surfaceBg) ?? surfaceBg;
  const headerFillFg  = readVar(cv, "--tv-header-fill-fg",  text)      ?? text;

  const invariants: Invariant[] = [
    {
      name: "header bold (fill) band: header-fill-fg must read on header-fill-bg",
      fg: headerFillFg,
      bg: headerFillBg,
      path: ["--tv-header-fill-fg", "--tv-header-fill-bg"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "column-group bold band: shares header-fill in v4",
      fg: headerFillFg,
      bg: headerFillBg,
      path: ["--tv-header-fill-fg", "--tv-header-fill-bg"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "header tint band: header-tint-fg must read on header-tint-bg",
      fg: headerTintFg,
      bg: headerTintBg,
      path: ["--tv-header-tint-fg", "--tv-header-tint-bg"],
      minRatio: WCAG_AA_LARGE,
    },
    {
      name: "leaf header light band: header-light-fg must read on header-light-bg",
      fg: headerLightFg,
      bg: headerLightBg,
      path: ["--tv-header-light-fg", "--tv-header-light-bg"],
      minRatio: WCAG_AA_NORMAL,
    },
    {
      name: "default cell text: --tv-text must read on --tv-surface-bg",
      fg: text,
      bg: surfaceBg,
      path: ["--tv-text", "--tv-surface-bg"],
      minRatio: WCAG_AA_NORMAL,
    },
    // Subtle/muted text (footnotes, captions, axis-tick labels — SMALL
    // text, so the 4.5 normal-text bar applies). Unchecked until the
    // adversarial color review (H3) found grade-6 subtle failing AA in
    // every preset; the binding moved to grade 7 and this invariant
    // keeps it honest.
    {
      name: "subtle text (footnotes/ticks): --tv-text-subtle must read on --tv-surface-bg",
      fg: readVar(cv, "--tv-text-subtle", text) ?? text,
      bg: surfaceBg,
      path: ["--tv-text-subtle", "--tv-surface-bg"],
      minRatio: WCAG_AA_NORMAL,
    },
    {
      name: "muted text: --tv-text-muted must read on --tv-surface-bg",
      fg: readVar(cv, "--tv-text-muted", text) ?? text,
      bg: surfaceBg,
      path: ["--tv-text-muted", "--tv-surface-bg"],
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

  return failures;
}

// ────────────────────────────────────────────────────────────────────────────
// Inputs validation — mirrors R `classes-theme.R::ThemeInputs` S7 validator
// ────────────────────────────────────────────────────────────────────────────

/** A structured validation issue (Wave 4 contract pull): the machine-
 *  actionable shape an MCP server / LLM driver needs, vs a join-string.
 *  `path` is the dotted input path (e.g. `anchors.paper.L`), `code` a stable
 *  category (`enum` | `range` | `required` | `unknown`), `message` the
 *  human sentence. */
export interface ThemeIssue {
  readonly path: string;
  readonly code: "enum" | "range" | "required" | "unknown" | "shape" | "parse";
  readonly message: string;
}

export class ThemeInputsValidationError extends Error {
  /** Structured issues — the contract surface. */
  issues: ThemeIssue[];
  /** Back-compat string view (issues' messages); existing consumers read this. */
  problems: string[];
  constructor(issues: ThemeIssue[]) {
    super(`ThemeInputs failed ${issues.length} validation check${issues.length === 1 ? "" : "s"}.\n${issues.map((i) => "  - " + i.message).join("\n")}`);
    this.name = "ThemeInputsValidationError";
    this.issues = issues;
    this.problems = issues.map((i) => i.message);
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
const ELEVATION_VALUES = ["none", "low", "medium", "high"] as const;
const CAPTION_STYLE_VALUES = ["none", "chip", "stripe", "both"] as const;
const GLASS_VALUES = ["none", "frosted", "aurora"] as const;
const HEADER_STYLE_VALUES = ["light", "tint", "bold"] as const;
const BORDER_PRESET_VALUES = ["none", "hairline", "ruled", "frame", "boxed"] as const;
const TITLE_STYLE_VALUES = ["normal", "bar", "underline"] as const;
const POINT_SHAPE_VALUES = ["circle", "square", "diamond", "triangle"] as const;
const INTERVAL_WEIGHT_VALUES = ["hair", "regular", "thick"] as const;
// Tier-2 type-role vocab (Wave 3.5 ingress validation).
const TYPE_ROLE_VALUES = [
  "title", "subtitle", "body", "numeric", "label", "caption", "footnote", "cell", "tick",
] as const;
const TYPE_FAMILY_VALUES = ["display", "body", "mono", "numeric"] as const;
const TYPE_SIZE_VALUES = ["label", "foot", "body", "head", "subtitle", "title", "display"] as const;
const TYPE_WEIGHT_VALUES = ["regular", "medium", "semibold", "bold"] as const;

function checkTriple(triple: OklchTriple | undefined, name: string, problems: ThemeIssue[], required: boolean): void {
  if (triple === undefined) {
    if (required) problems.push({ path: name, code: "required", message: `${name}: required, got undefined` });
    return;
  }
  // Number.isFinite, not typeof: `typeof NaN === "number"` and both
  // NaN<0 / NaN>1 are false, so NaN sailed through and #NANNANNAN-
  // poisoned every derived color (round-2 robustness review).
  if (!Number.isFinite(triple.L) || triple.L < 0 || triple.L > 1) {
    problems.push({ path: `${name}.L`, code: "range", message: `${name}.L must be a finite number in [0, 1], got ${triple.L}` });
  }
  if (!Number.isFinite(triple.C) || triple.C < 0 || triple.C > 0.5) {
    problems.push({ path: `${name}.C`, code: "range", message: `${name}.C must be a finite number in [0, 0.5], got ${triple.C}` });
  }
  if (!Number.isFinite(triple.H) || triple.H < 0 || triple.H >= 360) {
    problems.push({ path: `${name}.H`, code: "range", message: `${name}.H must be a finite number in [0, 360), got ${triple.H}` });
  }
}

function checkEnum<T extends readonly string[]>(
  value: T[number] | undefined, choices: T, name: string, problems: ThemeIssue[],
): void {
  if (value === undefined) return;
  if (!(choices as readonly string[]).includes(value)) {
    problems.push({ path: name, code: "enum", message: `${name} must be one of [${choices.join(", ")}], got '${value}'` });
  }
}

function checkRange(
  value: number | undefined, lo: number, hi: number, name: string, problems: ThemeIssue[],
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < lo || value > hi) {
    problems.push({ path: name, code: "range", message: `${name} must be a number in [${lo}, ${hi}], got ${value}` });
  }
}

/**
 * Validate authoring-input ranges + enum memberships. Mirrors the R
 * `ThemeInputs` S7 validator. Call before passing inputs into the
 * resolver — catches typo'd enum values, out-of-range OKLCH triples,
 * and other authoring mistakes that the type system can't catch.
 */
export function validateThemeInputs(inputs: ThemeInputs): void {
  const p: ThemeIssue[] = [];

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
  checkEnum(inputs.effects?.caption_style, CAPTION_STYLE_VALUES, "effects.caption_style", p);
  checkEnum(inputs.effects?.glass, GLASS_VALUES, "effects.glass", p);
  checkEnum(inputs.header_style, HEADER_STYLE_VALUES, "header_style", p);
  checkEnum(inputs.border_preset, BORDER_PRESET_VALUES, "border_preset", p);
  checkEnum(inputs.effects?.title_style, TITLE_STYLE_VALUES, "effects.title_style", p);
  checkEnum(inputs.marks?.point_shape, POINT_SHAPE_VALUES, "marks.point_shape", p);
  checkEnum(inputs.marks?.interval_weight, INTERVAL_WEIGHT_VALUES, "marks.interval_weight", p);

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

  // Tier-2 type-role rebinds (Wave 3.5): the ONE validating ingress must
  // reject out-of-vocab leaves — an unchecked `size:"garbage"` resolved to
  // `--tv-text-*-size: undefinedpx` in exported CSS (review P0). Unknown
  // role keys are also flagged (inert at resolve, but pollute the artifact).
  if (inputs.type_roles && typeof inputs.type_roles === "object") {
    for (const [role, rec] of Object.entries(inputs.type_roles)) {
      if (!TYPE_ROLE_VALUES.includes(role as (typeof TYPE_ROLE_VALUES)[number])) {
        p.push({ path: `type_roles.${role}`, code: "unknown", message: `type_roles: '${role}' is not a type role (one of [${TYPE_ROLE_VALUES.join(", ")}])` });
        continue;
      }
      if (!rec || typeof rec !== "object") continue;
      checkEnum(rec.family, TYPE_FAMILY_VALUES, `type_roles.${role}.family`, p);
      checkEnum(rec.size, TYPE_SIZE_VALUES, `type_roles.${role}.size`, p);
      checkEnum(rec.weight, TYPE_WEIGHT_VALUES, `type_roles.${role}.weight`, p);
    }
  }

  // Theme-opinionated interaction defaults (interactivity-UX arc P1):
  // sparse map of known boolean capability flags. Unknown keys / non-boolean
  // values are flagged here at the validating ingress; the resolver
  // (lib/interaction-resolve.ts sanitize) ALSO drops them defensively, but a
  // shareable theme artifact shouldn't carry garbage silently.
  if (inputs.interaction_defaults !== undefined) {
    if (inputs.interaction_defaults === null || typeof inputs.interaction_defaults !== "object" || Array.isArray(inputs.interaction_defaults)) {
      p.push({ path: "interaction_defaults", code: "shape", message: "interaction_defaults must be a map of capability flags to booleans" });
    } else {
      for (const [key, value] of Object.entries(inputs.interaction_defaults)) {
        const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        if (!(INTERACTION_FLAG_KEYS as readonly string[]).includes(camel)) {
          p.push({ path: `interaction_defaults.${key}`, code: "unknown", message: `interaction_defaults: '${key}' is not a capability flag (one of [${INTERACTION_FLAG_KEYS.join(", ")}])` });
          continue;
        }
        if (typeof value !== "boolean") {
          p.push({ path: `interaction_defaults.${key}`, code: "shape", message: `interaction_defaults.${key} must be a boolean` });
        }
      }
    }
  }

  if (p.length > 0) throw new ThemeInputsValidationError(p);
}
