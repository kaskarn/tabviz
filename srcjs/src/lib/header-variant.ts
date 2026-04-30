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

interface VariantsShape {
  headerStyle?: string;
}

/** Resolve the active header style, falling back to "light" on unknown. */
export function activeHeaderStyle(theme: WebTheme): HeaderStyle {
  const v = (theme as { variants?: VariantsShape }).variants?.headerStyle;
  if (v === "bold" || v === "tint") return v;
  return "light";
}

/** Return the active leaf-header variant hexes (bg/fg/rule). */
export function activeHeaderVariant(theme: WebTheme): HeaderVariantHexes {
  const cluster = (theme as { header?: HeaderClusterShape }).header ?? {};
  return cluster[activeHeaderStyle(theme)] ?? cluster.light ?? {};
}

/** Return the active column-group header variant hexes. */
export function activeColumnGroupVariant(theme: WebTheme): HeaderVariantHexes {
  const cluster = (theme as { columnGroup?: HeaderClusterShape }).columnGroup ?? {};
  return cluster[activeHeaderStyle(theme)] ?? cluster.light ?? {};
}
