// Human-readable "what does this value mean" copy for the theme-vocabulary
// enum controls, surfaced as per-segment hover tooltips (PillSegment.title,
// which Pill.svelte already renders as the button `title`). ONE source so
// the controls explain themselves without scattering copy across call sites,
// and so the overloaded vocabulary (`ruled` means a heavier border under
// `border_preset` but lined-paper under `shell_texture`) is disambiguated at
// the point of use. Keyed by VOCABULARY → value → description.
//
// Added for the maintainer-feedback pass (2026-06-13): "theme settings
// toggles should have elegant on-hover explanations — what is glow, glass,
// ruled?". The infrastructure existed (Pill renders seg.title); only the
// copy was missing.

import type { PillSegment } from "$components/primitives/v2/types";

export const OPTION_DESCRIPTIONS: Record<string, Record<string, string>> = {
  polarity: {
    light: "Light background, dark text.",
    dark: "Dark background, light text (inverted).",
  },
  density: {
    compact: "Tight spacing — more rows per inch.",
    comfortable: "Balanced default spacing.",
    spacious: "Airy spacing — more breathing room.",
  },
  header_style: {
    light: "Plain header, no fill.",
    tint: "Header on a tinted band.",
    bold: "Strong filled header band.",
  },
  shell_mode: {
    flush: "No card — the table sits flush to the edge.",
    raised: "Table on a raised paper card.",
    float: "Floating card with a margin around it.",
    transparent: "Transparent shell — no card surface.",
  },
  shell_texture: {
    none: "Plain paper, no pattern.",
    ruled: "Lined-paper background pattern.",
    grid: "Graph-paper grid background.",
    dotted: "Dotted background pattern.",
    grain: "Subtle paper grain.",
  },
  border_preset: {
    none: "No rules or frame.",
    hairline: "Thin horizontal rules between rows.",
    ruled: "Horizontal rules, with heavier header / group rules.",
    frame: "Row rules plus an outer frame.",
    boxed: "Full grid — row and column dividers plus a frame.",
  },
  glow_intensity: {
    none: "No glow.",
    subtle: "Soft halo behind the shell.",
    neon: "Strong neon halo.",
  },
  glow_anchor: {
    brand: "Glow uses the brand color.",
    accent: "Glow uses the accent color.",
  },
  gradient_shell_intensity: {
    none: "Flat shell, no gradient.",
    subtle: "Subtle shell gradient.",
    vivid: "Vivid shell gradient.",
  },
  glass: {
    none: "Opaque shell.",
    frosted: "Frosted translucency — blurs what's behind (browser only).",
    aurora: "Frosted glass with drifting color blobs (browser only).",
  },
  elevation: {
    none: "No shadow.",
    low: "Subtle drop shadow.",
    medium: "Medium drop shadow.",
    high: "Strong drop shadow — lifts the card off the page.",
  },
};

/** Build Pill segments from a value list, attaching each value's hover
 *  description (PillSegment.title) from {@link OPTION_DESCRIPTIONS}. Values
 *  with no description simply carry no title (no tooltip). The label defaults
 *  to the value; pass `labelOf` to override (e.g. snake_case → spaced). */
export function describedSegments<T extends string>(
  vocab: string,
  values: readonly T[],
  labelOf?: (v: T) => string,
): PillSegment<T>[] {
  const d = OPTION_DESCRIPTIONS[vocab] ?? {};
  return values.map((v) => ({ value: v, label: labelOf ? labelOf(v) : v, title: d[v] }));
}
