// Stage 3 — R-modifier snippet generator.
//
// Diffs the current ThemeInputs against the base and emits a pipeable
// R `set_*()` chain that reproduces the diff:
//
//   web_theme_cochrane() |> set_brand("#FF6B35") |> set_accent("#2563EB")
//
// Used by the live snippet strip + the on-close console echo.

import type { ThemeInputs, OklchTriple } from "../types/theme-inputs";
import { PRESETS } from "../lib/theme/theme-presets-inputs";

/** Emit an anchor as an R `oklch()` call — the studio is LCH-native and
 *  R's anchor coercion accepts oklch() triples, so the author's actual
 *  L/C/H intent round-trips instead of being quantized through hex
 *  (R3 studio review: `set_brand("#321161")` discarded the dialed
 *  L=0.18/C=0.13/H=231 semantics). */
function rOklch(t: OklchTriple): string {
  const r = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;
  return `oklch(${r(t.L, 4)}, ${r(t.C, 4)}, ${r(t.H, 1)})`;
}

/** Compare two OKLCH triples for value equality. */
function triplesEqual(a: OklchTriple | undefined, b: OklchTriple | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.L === b.L && a.C === b.C && a.H === b.H;
}

/** A single diff step in the snippet chain. */
export interface SnippetStep {
  /** The R setter name (e.g. "set_brand", "set_polarity"). */
  readonly setter: string;
  /** The R-formatted argument expression (e.g. `"#FF6B35"`, `mode = "dark"`). */
  readonly args: string;
}

/** Human label for an edit, derived by diffing prev → next with the same
 *  machinery as the snippet chain (studio E: every history entry read
 *  "Edit", so the undo button couldn't say what it would undo).
 *
 *  "set_brand" → "Brand", "set_shell_mode" → "Shell mode"; multi-setter
 *  edits report the first + a count. */
export function describeInputsEdit(prev: ThemeInputs, next: ThemeInputs): string {
  const pretty = (setter: string): string => {
    const words = setter.replace(/^set_/, "").replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
  const steps = buildSnippetSteps(prev, next);
  if (steps.length === 0) return "Edit";
  const first = pretty(steps[0]!.setter);
  return steps.length === 1 ? first : `${first} (+${steps.length - 1} more)`;
}

/** Build the snippet chain by diffing edits against base.
 *
 *  Returns an empty array when no changes (snippet strip shows just the
 *  base preset call). */
export function buildSnippetSteps(
  base: ThemeInputs,
  edits: ThemeInputs,
): SnippetStep[] {
  const steps: SnippetStep[] = [];

  // V4 anchors — emit set_paper/set_ink/set_brand/set_accent when the
  // corresponding anchor's OKLCH triple has changed.
  if (!triplesEqual(edits.anchors.paper, base.anchors.paper)) {
    steps.push({ setter: "set_paper", args: rOklch(edits.anchors.paper) });
  }
  if (!triplesEqual(edits.anchors.ink, base.anchors.ink)) {
    steps.push({ setter: "set_ink", args: rOklch(edits.anchors.ink) });
  }
  if (!triplesEqual(edits.anchors.brand, base.anchors.brand)) {
    steps.push({ setter: "set_brand", args: rOklch(edits.anchors.brand) });
  }
  if (!triplesEqual(edits.anchors.accent, base.anchors.accent)) {
    if (edits.anchors.accent) {
      steps.push({ setter: "set_accent", args: rOklch(edits.anchors.accent) });
    }
  }
  // Polarity: R-side input @mode mirrors polarity per Stage 1's mode/polarity split.
  // The studio uses inputs.polarity (Stage 1 §22); R serializes as `mode = ...`.
  if (edits.polarity !== base.polarity && edits.polarity !== undefined) {
    steps.push({ setter: "set_polarity", args: rString(edits.polarity) });
  }
  if (edits.mode !== base.mode && edits.mode !== undefined) {
    steps.push({ setter: "set_mode", args: rString(edits.mode) });
  }
  if (edits.density !== base.density && edits.density !== undefined) {
    steps.push({ setter: "set_density", args: `density = ${rString(edits.density)}` });
  }
  if (edits.density_factor !== base.density_factor && edits.density_factor !== undefined) {
    steps.push({ setter: "set_density", args: `factor = ${edits.density_factor}` });
  }
  if (edits.shell_mode !== base.shell_mode && edits.shell_mode !== undefined) {
    steps.push({ setter: "set_shell_mode", args: rString(edits.shell_mode) });
  }
  if (edits.shell_texture !== base.shell_texture && edits.shell_texture !== undefined) {
    steps.push({ setter: "set_shell_texture", args: rString(edits.shell_texture) });
  }

  // Typography Tier 1
  if (edits.type_base_size !== base.type_base_size && edits.type_base_size !== undefined) {
    steps.push({ setter: "set_type_scale", args: `base = ${edits.type_base_size}` });
  }
  if (edits.type_scale_ratio !== base.type_scale_ratio && edits.type_scale_ratio !== undefined) {
    steps.push({ setter: "set_type_scale", args: `ratio = ${edits.type_scale_ratio}` });
  }
  if (!fontsEqual(edits.fonts, base.fonts)) {
    const args: string[] = [];
    if (edits.fonts?.body && edits.fonts.body !== base.fonts?.body) args.push(`body = ${rString(edits.fonts.body)}`);
    if (edits.fonts?.display && edits.fonts.display !== base.fonts?.display) args.push(`display = ${rString(edits.fonts.display)}`);
    if (edits.fonts?.mono && edits.fonts.mono !== base.fonts?.mono) args.push(`mono = ${rString(edits.fonts.mono)}`);
    if (args.length > 0) {
      steps.push({ setter: "set_fonts", args: args.join(", ") });
    }
  }

  // ink2 (rubrication) — clearable anchor.
  if (!triplesEqual(edits.anchors.ink2, base.anchors.ink2)) {
    if (edits.anchors.ink2) {
      steps.push({ setter: "set_ink2", args: rOklch(edits.anchors.ink2) });
    }
  }

  // header_style — top-level structural variant input.
  if (edits.header_style !== base.header_style && edits.header_style !== undefined) {
    steps.push({ setter: "set_header_style", args: rString(edits.header_style) });
  }
  if ((edits.border_preset ?? null) !== (base.border_preset ?? null) && edits.border_preset) {
    steps.push({ setter: "set_border_preset", args: rString(edits.border_preset) });
  }

  // slot_style — Tier-1 series styling.
  if (edits.slot_style !== base.slot_style && edits.slot_style !== undefined) {
    steps.push({ setter: "set_inputs", args: `slot_style = ${rString(edits.slot_style)}` });
  }

  // Geometry — radius / border_width scales. set_geometry(radius = list(...),
  // border_width = list(...)) takes named numeric lists.
  const geomArgs: string[] = [];
  const radiusDiff = diffNumericRecord(edits.geometry?.radius, base.geometry?.radius);
  if (radiusDiff) geomArgs.push(`radius = ${rList(radiusDiff)}`);
  const borderDiff = diffNumericRecord(edits.geometry?.border_width, base.geometry?.border_width);
  if (borderDiff) geomArgs.push(`border_width = ${rList(borderDiff)}`);
  if (geomArgs.length > 0) {
    steps.push({ setter: "set_geometry", args: geomArgs.join(", ") });
  }

  // Effects — every key set_effects() accepts.
  const fxKeys = [
    "glow_intensity", "glow_anchor", "gradient_shell_intensity",
    "gradient_shell_angle", "elevation", "caption_style", "glass",
    "title_style",
  ] as const;
  const fxArgs: string[] = [];
  for (const k of fxKeys) {
    const ev = edits.effects?.[k];
    const bv = base.effects?.[k];
    if (ev !== bv && ev !== undefined) {
      fxArgs.push(`${k} = ${typeof ev === "number" ? ev : rString(String(ev))}`);
    }
  }
  if (fxArgs.length > 0) {
    steps.push({ setter: "set_effects", args: fxArgs.join(", ") });
  }

  return steps;
}

/** Emit role-override pins as `set_role()` steps so the snippet stays
 *  honest about TOTAL control (settings-overhaul P0): spine rebinds are
 *  part of the artifact and must appear in the R chain, or the copied
 *  code reproduces less than the chart shows. */
export function buildRoleOverrideSteps(
  roleOverrides: Record<string, { ramp: string; grade: number } | undefined> | undefined,
): SnippetStep[] {
  if (!roleOverrides) return [];
  return Object.entries(roleOverrides)
    .filter((e): e is [string, { ramp: string; grade: number }] => e[1] != null)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([role, b]) => ({
      setter: "set_role",
      args: `${rString(role)}, ${rString(b.ramp)}, ${b.grade}`,
    }));
}

/** Diff two flat numeric records; returns the changed keys or null. */
function diffNumericRecord(
  a: Record<string, number | undefined> | undefined,
  b: Record<string, number | undefined> | undefined,
): Record<string, number> | null {
  if (!a) return null;
  const out: Record<string, number> = {};
  for (const k of Object.keys(a)) {
    const av = a[k];
    if (av !== undefined && av !== b?.[k]) out[k] = av;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Format a flat numeric record as an R list(...) literal. */
function rList(rec: Record<string, number>): string {
  return `list(${Object.entries(rec).map(([k, v]) => `${k} = ${v}`).join(", ")})`;
}

/** R base expression for a preset name. Every shipped preset follows the
 *  `web_theme_<name>()` pattern, so the expression derives from the
 *  PRESETS registry — the old hand-maintained map in StudioShell went
 *  stale at 18/27 and the 9 newest presets emitted the literal
 *  `your_theme`, which errors in R (three review agents, independently). */
export function buildBaseExpression(name: string): string {
  return name in PRESETS ? `web_theme_${name}()` : "your_theme";
}

/** Format the snippet as a pipe chain, given the base call expression. */
export function formatSnippet(baseExpression: string, steps: SnippetStep[]): string {
  if (steps.length === 0) return baseExpression;
  const parts = [baseExpression, ...steps.map(s => `${s.setter}(${s.args})`)];
  return parts.join(" |> ");
}

function rString(s: string): string {
  // Use R double-quotes; escape internal `"` and `\`.
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function fontsEqual(
  a: ThemeInputs["fonts"] | undefined,
  b: ThemeInputs["fonts"] | undefined,
): boolean {
  if (a === b) return true;
  return (a?.body ?? null) === (b?.body ?? null) &&
         (a?.display ?? null) === (b?.display ?? null) &&
         (a?.mono ?? null) === (b?.mono ?? null);
}
