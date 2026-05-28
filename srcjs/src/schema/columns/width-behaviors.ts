// Natural-width behaviors for glyph column schemas.
//
// Migrated from `lib/width-utils.ts::glyphNaturalWidth`. Each schema
// owns the geometry calculation for its own visual layout. The
// dispatcher returns `undefined` for non-glyph schemas; callers
// (column auto-width, svg-generator) Math.max it against the
// text-derived width budget.
//
// Geometry mirrors the live cell components verbatim — see the
// comments inline. Numbers here are the source of truth for both
// browser and V8/SVG measurement paths.

import { registerBehaviors } from "../extend";

type PictogramOpts = {
  pictogram?: {
    size?: "sm" | "base" | "lg";
    layout?: "row" | "stack" | "row_value_trail";
    maxGlyphs?: number;
    valueLabel?: boolean;
  };
};
type StarsOpts = { stars?: { maxStars?: number } };
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
    const glyphPx = sizeKey === "sm" ? 10 : sizeKey === "lg" ? 20 : 14;
    const gap = 1;
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
      const labelW = 5 * labelFontPx * 0.55;
      return trackW + 4 + labelW;
    }
    return trackW;
  },
});

registerBehaviors("stars", {
  naturalWidth: (column) => {
    const max = (column.options as StarsOpts).stars?.maxStars ?? 5;
    return max * 12 + Math.max(0, max - 1) * 2;
  },
});

registerBehaviors("icon", {
  naturalWidth: (column) => {
    const sizeKey = (column.options as IconOpts).icon?.size ?? "base";
    return sizeKey === "sm" ? 12 : sizeKey === "lg" ? 16 : sizeKey === "xl" ? 26 : 14;
  },
});

registerBehaviors("ring", {
  naturalWidth: (column) => {
    const opts = (column.options as RingOpts).ring;
    const sizeKey = opts?.size ?? "base";
    const diameter = sizeKey === "sm" ? 18 : sizeKey === "lg" ? 32 : 24;
    if (!(opts?.showLabel ?? true)) return diameter;
    const labelFontPx = sizeKey === "sm" ? 9 : sizeKey === "lg" ? 12 : 11;
    // "100%" is the widest typical label (4 chars).
    const labelW = 4 * labelFontPx * 0.55;
    return diameter + 4 + labelW;
  },
});

}  // end registerWidthBehaviors

// Side-effect: register on first import (back-compat).
registerWidthBehaviors();
