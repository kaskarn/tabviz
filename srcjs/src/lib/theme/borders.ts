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
  group: BorderSpecResolved;
  minor: BorderSpecResolved;
  table: BorderSpecResolved;
}

/** Resolved geometry border-width SLOTS (px). The `border_preset` picks the
 *  LAYOUT + which slot each rule draws from; these values (tunable via the
 *  settings "Rules" control → inputs.geometry.border_width) are the WIDTHS.
 *  This is the unification: preset = layout, slots = width. */
export interface BorderWidths {
  hair: number;
  thin: number;
  regular: number;
  thick: number;
}

/** Expand the Tier-1 `border_preset` enum into the T3 borders cluster.
 *  Five treatments over the theme's own rule colors; "hairline" is the
 *  named form of the historical default (so unset ≡ hairline byte-for-
 *  byte and no existing theme shifts). */
export function resolveBorders(
  preset: ThemeInputs["border_preset"],
  ruleStrong: string,
  ruleSubtle: string,
  w: BorderWidths,
): BordersResolved {
  // border_preset = LAYOUT + slot mapping; the WIDTHS come from the geometry
  // slots `w` (settings "Rules" control). Mapping (preserves the prior fixed
  // thicknesses when the slots sit at their defaults regular=2/thin=1/thick=2.5,
  // except frame's outer border 2→thick 2.5):
  //   header (major) → regular · group + row (minor) → thin ·
  //   frame/outer (table) → thick · gridlines/alt-row → hair (consumed elsewhere)
  const strong = (thickness: number): BorderSpecResolved => ({ thickness, style: "single", color: ruleStrong });
  const subtle = (thickness: number): BorderSpecResolved => ({ thickness, style: "single", color: ruleSubtle });
  switch (preset) {
    case "none":
      return { layout: "none", major: strong(0), group: subtle(0), minor: subtle(0), table: strong(0) };
    case "ruled":
      // `ruled` is the EMPHASIZED-rules preset — its group rule stays at the
      // `regular` weight (the prior 2px), distinguishing it from `hairline`.
      return { layout: "horizontal", major: strong(w.regular), group: strong(w.regular), minor: subtle(w.thin), table: strong(0) };
    case "frame":
      return { layout: "horizontal", major: strong(w.regular), group: subtle(w.thin), minor: subtle(w.thin), table: strong(w.thick) };
    case "boxed":
      return { layout: "grid", major: strong(w.regular), group: subtle(w.thin), minor: subtle(w.thin), table: strong(w.thin) };
    case "hairline":
    default:
      // The historical default cluster, now nameable.
      return { layout: "horizontal", major: strong(w.regular), group: subtle(w.thin), minor: subtle(w.thin), table: strong(0) };
  }
}
