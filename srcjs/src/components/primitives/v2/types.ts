// v2 primitive types — kept in a .ts sibling so they can be imported
// from outside the .svelte component module scope. Svelte 5 doesn't
// re-export instance-script types through the build, hence the split.

import type { GlyphToken } from "$lib/ui-glyphs";

/** One choice in a Pill (segmented or boolean toggle). */
export interface PillSegment<U> {
  value: U;
  label?: string;
  glyph?: GlyphToken;
  title?: string;
}

/** The four orthogonal authoring modes a styling option can be in. */
export type MappedMode = "theme" | "static" | "field" | "condition";

/** Theme-anchored swatch shown in a Swatch palette. */
export interface ThemeSwatch {
  /** Hex color, e.g. "#b53a1f". */
  color: string;
  /** Token name shown as tooltip — e.g. "accent", "primary". */
  token: string;
}

/** One entry in a TabBar. Glyph optional (compact mode hides label). */
export interface TabEntry<U extends string> {
  value: U;
  label: string;
  glyph?: GlyphToken;
  title?: string;
}

/** One row in a Picker dropdown menu. */
export interface PickerItem<U> {
  value: U;
  label: string;
  glyph?: GlyphToken;
  /** Faint suffix shown after the label (e.g. type hint). */
  secondary?: string;
  /** Group bucket label — items sharing a group appear together. */
  group?: string;
  disabled?: boolean;
}
