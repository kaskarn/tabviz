// Composed-cell width measurement.
//
// A column's auto-width is the widest cell it must hold. For PLAIN columns
// (text, numeric) the cell is a single text run, so the cheap flat-string
// estimator (`getColumnDisplayText` → `estimateTextWidth`) is exact. But a
// COMPOSED cell — an interval rendered as `point · gap · [bounds]` with the
// bounds at a smaller/muted size, a stacked layout, a variant with brackets
// and an en-dash — renders a NODE TREE whose laid-out width is NOT the width
// of the concatenated string: it has inter-node gaps, per-node font sizes, and
// (for variants) different delimiter glyphs. Measuring the flat string and
// padding with a fudge buffer (the old `COMPOSED_TEXT_BUFFER`) both over- and
// under-shot depending on the variant.
//
// The honest measure is "measure what you draw": run the SAME `renderCell` the
// renderer runs, then `renderNodeToSvg` the tree with a width-only resolver and
// take its `.width`. To stay cheap we don't do that for every cell — we RANK
// every row by the cheap flat estimate (`rankTopKBy`), then exact-measure only
// the top-K widest trees. The cheap estimate is a faithful monotone proxy
// (more digits → wider point AND wider bounds), and K covers per-cell
// non-uniformity; this is the same rank-then-exact strategy `width-measure.ts`
// uses for flat strings, just ranking ROWS and measuring TREES.
//
// This is the single source for BOTH measurement sites — the live widget
// (`stores/slices/columns`) and the SVG export (`export/svg-generator`) — so
// they stay WYSIWYG-locked. Each injects its own width metric: the widget a
// Canvas-exact measurer (matches the browser's real font metrics), the V8
// export the pure-JS estimator (matches what its own renderer draws, since
// `renderNodeToSvg` is canvas-free).

import type { ColumnSpec, WebTheme } from "../types";
import type { RenderNode } from "./render-types";
import type { RenderTarget } from "./extend";
import type { NodeRules } from "./theme-finalize";
import type { StyleResolver } from "./render-svg";
import { renderCell } from "./dispatch";
import { renderNodeToSvg } from "./render-svg";
import { rankTopKBy, estimateTextWidth } from "../lib/width-measure";

/**
 * Top-K for composed-cell tree measurement. Higher than `DEFAULT_TOP_K` (3,
 * used for flat strings) because a composed cell's flat-string rank can drift
 * from its tree-width rank by more than a plain string's can (a variant may
 * add brackets to one row's bounds but render another row's bounds em-dashed);
 * 10 is the "extra safe" band the maintainer asked for.
 */
export const COMPOSED_TOP_K = 10;

/** Width budget handed to `renderCell` during measurement: large enough that
 *  no renderer self-truncates to the cell box (we want the cell's NATURAL
 *  width, which the caller then clamps to AUTO_WIDTH.MAX). */
const UNCONSTRAINED_CELL_WIDTH = 100_000;

/** Symbolic render-tree font sizes in resolved PIXELS. The caller resolves
 *  these in its OWN space so measurement matches its render: the DOM converts
 *  rem→px against the live document root (cells render at body size); the V8
 *  export reuses `makeThemeResolver`'s map directly. Getting this wrong (e.g.
 *  measuring 14px while the DOM renders 16px) silently mis-sizes columns. */
export interface MeasureSizes {
  /** Emphasis / larger nodes. */
  major: number;
  /** Default (un-styled) text — what an interval point renders at. */
  base: number;
  /** Muted / smaller nodes — what a `bracket_muted` interval's bounds use. */
  minor: number;
}

/**
 * A width-only `StyleResolver` over explicit pixel sizes. Color/font/weight
 * are omitted: they don't affect laid-out WIDTH (weight is folded into the
 * injected `measure` closure's font binding when it matters).
 *
 * @param measure optional width metric; omit for the pure-JS estimator (V8).
 */
export function makeMeasureResolver(
  sizes: MeasureSizes,
  measure?: (text: string, fontSizePx: number) => number,
): StyleResolver {
  return {
    size: (v) => (typeof v === "number" ? v : (sizes[v as keyof MeasureSizes] ?? sizes.base)),
    ...(measure ? { measure } : {}),
  };
}

/** One row's measurement inputs, decoupled from the caller's Row shape. */
export interface ComposedCandidate {
  /** Flat display text — the cheap rank key. */
  text: string;
  /** The flat field record handed to `renderCell` as `ctx.row`. */
  metadata: Record<string, unknown>;
  /** Bold row (summary / row_bold) — selects the bold-bound resolver so the
   *  widened glyphs are measured, mirroring the flat path's bold candidates. */
  bold: boolean;
}

/** A render tree is trivial when it's a single un-styled text run — the flat
 *  estimator already measured it exactly, so tree measurement adds nothing. */
function isTrivial(node: RenderNode | null): boolean {
  return node != null && node.kind === "text" && node.style?.size == null;
}

/**
 * Exact width of a composed column over its top-K widest rows, or `null` when
 * the column is NOT composed (every probed cell is a single un-styled text
 * run) — signalling the caller to keep its proven flat-string path. The
 * returned width is the bare laid-out tree width; the caller adds cell padding
 * and clamps, exactly as it does for the flat measure.
 *
 * @param resolverFor builds the width-only resolver for a row's weight — DOM
 *   passes a Canvas measurer bound to the bold/regular font; export omits the
 *   measurer (estimator). Called once per winner.
 */
export function measureComposedColumnWidth(
  col: ColumnSpec,
  candidates: readonly ComposedCandidate[],
  baseFontSizePx: number,
  resolverFor: (bold: boolean) => StyleResolver,
  opts: { theme?: WebTheme | null; nodeRules?: NodeRules; target: RenderTarget; topK?: number },
): number | null {
  if (candidates.length === 0) return null;
  const winners = rankTopKBy(
    candidates,
    (c) => (c.text ? estimateTextWidth(c.text, baseFontSizePx) : -1),
    opts.topK ?? COMPOSED_TOP_K,
  );

  let max = 0;
  let anyComposed = false;
  for (const c of winners) {
    const tree = renderCell(
      col,
      c.metadata[col.field],
      {
        cellWidth: UNCONSTRAINED_CELL_WIDTH,
        rowHeight: 0,
        row: c.metadata,
        target: opts.target === "svg" ? "svg" : "browser",
        theme: opts.theme,
      },
      opts.nodeRules,
      opts.target,
    );
    if (tree == null) continue; // NA / empty cell — nothing to lay out.
    // A DOM-component cell (CellPvalue / CellBadge / … — `component(...)`) is
    // NOT a tree-measurable text composition: `renderNodeToSvg` can't size it
    // (falls back to width 0). Its width comes from the flat displayText (the
    // component renders that same string) or glyphNaturalWidth. Bail to the
    // caller's flat path. (Columns are uniform-type, so one component winner
    // ⇒ the whole column is component-based.) Without this, pvalue/badge auto
    // columns measured 0 → fell to the MIN floor → CLIPPED (hero P column).
    if (tree.kind === "component") return null;
    // Track whether ANY winner is a real composition; a column whose cells are
    // all single un-styled text runs is flat-exact, so we hand back null and
    // the caller keeps its proven flat path (which splits bold candidates onto
    // the bold key). But once one cell IS composed we measure EVERY non-null
    // winner's tree — including trivial text rows, whose tree width equals the
    // flat estimate — so a wide plain row in a MIXED column isn't dropped.
    if (!isTrivial(tree)) anyComposed = true;
    const { width } = renderNodeToSvg(tree, resolverFor(c.bold));
    if (width > max) max = width;
  }
  return anyComposed ? max : null;
}
