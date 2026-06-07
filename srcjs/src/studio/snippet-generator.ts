// Stage 3 — R-modifier snippet generator.
//
// The pure ThemeInputs diff machinery lives in $lib/theme/theme-diff
// (shared with the settings divergence badge); this module keeps the
// STUDIO-specific emitters: role-override / pin steps (read the studio
// store's artifact channels) and the preset base expression (reads the
// PRESETS registry).

import { PRESETS } from "../lib/theme/theme-presets-inputs";
import { rString, type SnippetStep } from "../lib/theme/theme-diff";

export {
  buildSnippetSteps,
  describeInputsEdit,
  formatSnippet,
  type SnippetStep,
} from "../lib/theme/theme-diff";

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

/** Emit token pins as `set_pin()` steps — same artifact-honesty rule
 *  as role overrides: the copied R chain must reproduce everything the
 *  chart shows, including raw T2/3 pins (settings-overhaul P3). */
export function buildPinSteps(
  pins: Record<string, string> | undefined,
): SnippetStep[] {
  if (!pins) return [];
  return Object.entries(pins)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cssVar, value]) => ({
      setter: "set_pin",
      args: `${rString(cssVar)}, ${rString(value)}`,
    }));
}

/** R base expression for a preset name. Every shipped preset follows the
 *  `web_theme_<name>()` pattern, so the expression derives from the
 *  PRESETS registry — the old hand-maintained map in StudioShell went
 *  stale at 18/27 and the 9 newest presets emitted the literal
 *  `your_theme`, which errors in R (three review agents, independently). */
export function buildBaseExpression(name: string): string {
  return name in PRESETS ? `web_theme_${name}()` : "your_theme";
}

