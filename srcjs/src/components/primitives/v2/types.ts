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
