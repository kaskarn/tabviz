// Stage 3 — R-modifier snippet generator.
//
// Diffs the current ThemeInputs against the base and emits a pipeable
// R `set_*()` chain that reproduces the diff:
//
//   web_theme_cochrane() |> set_brand("#FF6B35") |> set_accent("#2563EB")
//
// Used by the live snippet strip + the on-close console echo.

import type { ThemeInputs, OklchTriple } from "../types/theme-inputs";
import { oklchToHex } from "../lib/oklch";

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
    steps.push({ setter: "set_paper", args: rString(oklchToHex(edits.anchors.paper)) });
  }
  if (!triplesEqual(edits.anchors.ink, base.anchors.ink)) {
    steps.push({ setter: "set_ink", args: rString(oklchToHex(edits.anchors.ink)) });
  }
  if (!triplesEqual(edits.anchors.brand, base.anchors.brand)) {
    steps.push({ setter: "set_brand", args: rString(oklchToHex(edits.anchors.brand)) });
  }
  if (!triplesEqual(edits.anchors.accent, base.anchors.accent)) {
    if (edits.anchors.accent) {
      steps.push({ setter: "set_accent", args: rString(oklchToHex(edits.anchors.accent)) });
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

  // V4 dropped neutral_tint*; the tint surface area now lives on the
  // paper/ink anchors directly (their C component). Set via set_paper /
  // set_ink — handled above.

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
