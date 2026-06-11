// Borders derivation (W4 finale, 2026-06-11).
//
// `theme.borders` left the wire: the cluster was ALWAYS
// expandBorderPreset(inputs.border_preset, role border, role
// border-subtle) — no mutation surface existed (the R test suite itself
// asserted the colors ≡ the role tokens). This module is the ONE
// derivation, consumed by:
//   - the `borders` resolver group (emits the 11 --tv-*border* tokens),
//   - the SVG export (structured BorderSpec line drawing),
// so DOM and export agree by construction.

import type { ThemeInputs } from "../../types/theme-inputs";

export interface BorderSpecResolved {
  thickness: number;
  style: "single" | "double" | string;
  color: string;
}
export interface BordersResolved {
  layout: "horizontal" | "vertical" | "grid" | "none" | string;
  major: BorderSpecResolved;
  minor: BorderSpecResolved;
  table: BorderSpecResolved;
}

/** Expand the Tier-1 `border_preset` enum into the T3 borders cluster.
 *  Five treatments over the theme's own rule colors; "hairline" is the
 *  named form of the historical default (so unset ≡ hairline byte-for-
 *  byte and no existing theme shifts). */
export function resolveBorders(
  preset: ThemeInputs["border_preset"],
  ruleStrong: string,
  ruleSubtle: string,
): BordersResolved {
  switch (preset) {
    case "none":
      return {
        layout: "none",
        major: { thickness: 0, style: "single", color: ruleStrong },
        minor: { thickness: 0, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
    case "ruled":
      return {
        layout: "horizontal",
        major: { thickness: 2, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
    case "frame":
      return {
        layout: "horizontal",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 2, style: "single", color: ruleStrong },
      };
    case "boxed":
      return {
        layout: "grid",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 1, style: "single", color: ruleStrong },
      };
    case "hairline":
    default:
      // The historical default cluster, now nameable.
      return {
        layout: "horizontal",
        major: { thickness: 1, style: "single", color: ruleStrong },
        minor: { thickness: 1, style: "single", color: ruleSubtle },
        table: { thickness: 0, style: "single", color: ruleStrong },
      };
  }
}
