// Stage 3 — R-modifier snippet generator.
//
// Diffs the current ThemeInputs against the base and emits a pipeable
// R `set_*()` chain that reproduces the diff:
//
//   web_theme_cochrane() |> set_brand("#FF6B35") |> set_accent("#2563EB")
//
// Used by the live snippet strip + the on-close console echo.

import type { ThemeInputs } from "../types/theme-inputs";

/** A single diff step in the snippet chain. */
export interface SnippetStep {
  /** The R setter name (e.g. "set_brand", "set_polarity"). */
  readonly setter: string;
  /** The R-formatted argument expression (e.g. `"#FF6B35"`, `mode = "dark"`). */
  readonly args: string;
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

  if (edits.brand !== base.brand) {
    steps.push({ setter: "set_brand", args: rString(edits.brand) });
  }
  if (edits.accent !== base.accent && edits.accent !== undefined) {
    steps.push({ setter: "set_accent", args: rString(edits.accent) });
  }
  if (edits.decorative !== base.decorative && edits.decorative !== undefined && edits.decorative !== null) {
    steps.push({ setter: "set_decorative", args: rString(edits.decorative) });
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
  if (edits.densityFactor !== base.densityFactor && edits.densityFactor !== undefined) {
    steps.push({ setter: "set_density", args: `factor = ${edits.densityFactor}` });
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

  // Neutral tint
  if (edits.neutral_tint !== base.neutral_tint && edits.neutral_tint !== undefined) {
    const v = typeof edits.neutral_tint === "string" ? rString(edits.neutral_tint) : rString(edits.neutral_tint.hex);
    steps.push({ setter: "set_neutral_tint", args: `tint = ${v}` });
  }
  if (edits.neutral_tint_strength !== base.neutral_tint_strength && edits.neutral_tint_strength !== undefined) {
    steps.push({ setter: "set_neutral_tint", args: `strength = ${edits.neutral_tint_strength}` });
  }

  return steps;
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
