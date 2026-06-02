// Natural-height behaviors for visual column schemas — the vertical mirror of
// width-behaviors.ts. Each schema owns the geometry calc for its own content;
// the dispatcher returns `undefined` for schemas with no intrinsic tall content
// (text/numeric/badge/bar — single-line), and callers (computeContentHeights in
// table-metrics' feeders) Math.max the results across a row's columns with the
// text-wrap height and base rowHeight.
//
// Glyph dimensions come from CELL_GEOMETRY (lib/rendering-constants) — the same
// single source width-behaviors and the SVG renderers read.
//
// naturalHeight is PER-ROW (one row's value) — height is row-local, unlike
// naturalWidth which scans all rows for the column's extent.

import { registerBehaviors } from "../extend";
import { EFFECT, CELL_GEOMETRY } from "../../lib/rendering-constants";

type PictogramOpts = {
  pictogram?: {
    size?: "sm" | "base" | "lg";
    layout?: "row" | "stack" | "row_value_trail";
    maxGlyphs?: number;
    valueLabel?: boolean;
  };
};
type IconOpts  = { icon?: { size?: "sm" | "base" | "lg" | "xl" } };
type RingOpts  = { ring?: { size?: "sm" | "base" | "lg" } };
type SparklineOpts = { sparkline?: { height?: number | null } };
type ImgOpts = { img?: { height?: number | null } };
type ForestOpts = { forest?: { effects?: unknown[] | null } };

/** Re-register height behaviors. Idempotent. */
export function registerHeightBehaviors(): void {

  // Pictogram: row layout is single-glyph-tall; stack layout grows vertically
  // by the per-row glyph count (capped at 20, matching CellPictogram's guard).
  registerBehaviors("pictogram", {
    naturalHeight: (column, row) => {
      const opts = (column.options as PictogramOpts).pictogram;
      const glyphPx = CELL_GEOMETRY.pictogram.glyphPx[opts?.size ?? "base"];
      if ((opts?.layout ?? "row") !== "stack") return glyphPx;
      // stack: vertical column of glyphs, CSS gap: 0 → count × glyphPx.
      const v = Number(row.metadata[column.field]);
      const slots = Number.isFinite(v) ? Math.min(20, Math.max(1, Math.ceil(v))) : 1;
      return slots * glyphPx;
    },
  });

  // Ring: a donut SVG; the label sits inside (line-height 1), so the diameter
  // is the controlling height.
  registerBehaviors("ring", {
    naturalHeight: (column) => {
      const sizeKey = (column.options as RingOpts).ring?.size ?? "base";
      return CELL_GEOMETRY.ring.diameter[sizeKey];
    },
  });

  // Icon: glyph rendered at a font-size multiple of the body size. xl (1.6×)
  // can exceed a normal row, which is the whole point of measuring it.
  registerBehaviors("icon", {
    naturalHeight: (column, _row, ctx) => {
      const sizeKey = (column.options as IconOpts).icon?.size ?? "base";
      const mult = CELL_GEOMETRY.icon.fontScale[sizeKey];
      return Math.ceil(ctx.fontSize * mult);
    },
  });

  // Sparkline: explicit height option (default 20, matching CellSparkline).
  registerBehaviors("sparkline", {
    naturalHeight: (column) =>
      (column.options as SparklineOpts).sparkline?.height ?? 20,
  });

  // Img: explicit height option when set (CellImg renders at that height).
  registerBehaviors("img", {
    naturalHeight: (column) =>
      (column.options as ImgOpts).img?.height ?? 0,
  });

  // Forest (schema key viz_forest): a multi-effect row stacks N effect markers
  // vertically, spread by EFFECT.SPACING and centered on the row
  // (getEffectYOffset). One effect fits the default row; each extra effect adds
  // EFFECT.SPACING of vertical extent. ctx.rowHeight is the baseline.
  registerBehaviors("viz_forest", {
    naturalHeight: (column, _row, ctx) => {
      const effects = (column.options as ForestOpts).forest?.effects;
      const n = Array.isArray(effects) ? effects.length : 0;
      if (n <= 1) return 0; // single/inline effect fits the base row
      return ctx.rowHeight + (n - 1) * EFFECT.SPACING;
    },
  });

}  // end registerHeightBehaviors

// Side-effect: register on first import (mirrors width-behaviors).
registerHeightBehaviors();
