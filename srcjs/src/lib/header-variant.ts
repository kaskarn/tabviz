/**
 * Header variant resolution — maps `theme.variants.headerStyle` (light /
 * tint / bold) to the corresponding cluster sub-property.
 *
 * Centralized to keep render sites in sync. Pre-2026-04-29 the choice was
 * binary (light vs bold) and inlined as ternaries; the tint variant added
 * a third value, so a helper avoids drift across ~10 render sites.
 */

import type { WebTheme } from "../types";

export type HeaderStyle = "light" | "tint" | "bold";

interface HeaderVariantHexes {
  bg?: string;
  fg?: string;
  rule?: string;
}

interface HeaderClusterShape {
  light?: HeaderVariantHexes;
  tint?: HeaderVariantHexes;
  bold?: HeaderVariantHexes;
}

/** Resolve the active header style, falling back to "light" on unknown.
 *
 *  ONE vocabulary (R2 decision; W3 retirement 2026-06-11): the
 *  top-level input `header_style` (light/tint/bold) is the only
 *  source — the `variants.headerStyle` wire mirror is gone (every
 *  shipped theme carries authoringInputs; pre-release clean break). */
export function activeHeaderStyle(theme: WebTheme): HeaderStyle {
  const t1 = (theme as {
    authoringInputs?: { header_style?: string };
  }).authoringInputs?.header_style;
  if (t1 === "bold" || t1 === "tint" || t1 === "light") return t1;
  return "light";
}

/** Return the active leaf-header variant hexes (bg/fg/rule). */
export function activeHeaderVariant(theme: WebTheme): HeaderVariantHexes {
  const cluster = (theme as { header?: HeaderClusterShape }).header ?? {};
  return cluster[activeHeaderStyle(theme)] ?? cluster.light ?? {};
}

