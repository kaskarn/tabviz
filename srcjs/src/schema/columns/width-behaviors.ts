// Natural-width behaviors for glyph column schemas.
//
// Migrated from `lib/width-utils.ts::glyphNaturalWidth`. Each schema
// owns the geometry calculation for its own visual layout. The
// dispatcher returns `undefined` for non-glyph schemas; callers
// (column auto-width, svg-generator) Math.max it against the
// text-derived width budget.
//
// Glyph dimensions come from CELL_GEOMETRY (lib/rendering-constants) — the
// single source shared with the SVG renderers, the height behaviors, and the
// cell components' absolute-px CSS.

import { registerBehaviors } from "../extend";
import { CELL_GEOMETRY, TYPOGRAPHY } from "../../lib/rendering-constants";

type PictogramOpts = {
  pictogram?: {
    size?: "sm" | "base" | "lg";
    layout?: "row" | "stack" | "row_value_trail";
    maxGlyphs?: number;
    valueLabel?: boolean;
  };
};
type StarsOpts = { stars?: { maxGlyphs?: number } };
type IconOpts  = { icon?:  { size?: "sm" | "base" | "lg" | "xl" } };
type RingOpts  = {
  ring?: { size?: "sm" | "base" | "lg"; showLabel?: boolean };
};

/** Re-register width behaviors. Idempotent. */
export function registerWidthBehaviors(): void {

registerBehaviors("pictogram", {
  naturalWidth: (column, rows) => {
    const opts = (column.options as PictogramOpts).pictogram;
    const sizeKey = opts?.size ?? "base";
    const glyphPx = CELL_GEOMETRY.pictogram.glyphPx[sizeKey];
    const gap = CELL_GEOMETRY.pictogram.gap;
    const layout = opts?.layout ?? "row";

    let slots: number;
    if (layout === "stack") {
      slots = 1;
    } else if (opts?.maxGlyphs != null) {
      slots = Math.min(20, opts.maxGlyphs);
    } else {
      // count mode: scan rows for max value, capped at 20 (matches the
      // runaway-row guard in CellPictogram.svelte).
      let m = 0;
      for (const row of rows) {
        const v = Number(row.metadata[column.field]);
        if (Number.isFinite(v)) m = Math.max(m, Math.ceil(v));
      }
      slots = Math.min(20, m);
    }
    const trackW = slots * glyphPx + Math.max(0, slots - 1) * gap;

    if (opts?.valueLabel) {
      const labelFontPx = sizeKey === "sm" ? 11 : sizeKey === "lg" ? 14 : 12;
      const labelW = 5 * labelFontPx * TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO;
      return trackW + 4 + labelW;
    }
    return trackW;
  },
});

registerBehaviors("stars", {
  naturalWidth: (column) => {
    const max = (column.options as StarsOpts).stars?.maxGlyphs ?? 5;
    return max * CELL_GEOMETRY.stars.glyphPx + Math.max(0, max - 1) * CELL_GEOMETRY.stars.gap;
  },
});

registerBehaviors("icon", {
  naturalWidth: (column) => {
    const sizeKey = (column.options as IconOpts).icon?.size ?? "base";
    return CELL_GEOMETRY.icon.px[sizeKey];
  },
});

registerBehaviors("ring", {
  naturalWidth: (column) => {
    const opts = (column.options as RingOpts).ring;
    const sizeKey = opts?.size ?? "base";
    const diameter = CELL_GEOMETRY.ring.diameter[sizeKey];
    if (!(opts?.showLabel ?? true)) return diameter;
    const labelFontPx = CELL_GEOMETRY.labelFontPx[sizeKey];
    // "100%" is the widest typical label (4 chars).
    const labelW = 4 * labelFontPx * TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO;
    return diameter + 4 + labelW;
  },
});

}  // end registerWidthBehaviors

// Side-effect: register on first import (back-compat).
registerWidthBehaviors();
