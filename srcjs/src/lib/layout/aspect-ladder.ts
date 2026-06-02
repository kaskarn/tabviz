// Aspect ladder — the shared, pure math for aspect-ratio reshape.
//
// When a target aspect ratio is pinned, the layout is reshaped to hit
// `width / height == targetAspect`. Two runtimes drive this: the DOM path
// (`stores/slices/layout-zoom.svelte.ts`, which emits scale factors the
// reactive render applies against live measurement) and the export path
// (`export/svg-generator.ts::generateSVGForAspectTarget`, which mutates a spec
// clone and re-runs `computeLayout`). Both call the functions here for the
// arithmetic so the (delicate, frequently-tuned) ladder lives in ONE tested
// place with ONE column-classification model.
//
// Parity note: the DOM is an ESTIMATOR (its `naturalPlotHeight` is
// `rowSlots × rowHeight`) and the export is EXACT (real wrap/content-inflated
// `plotHeight`). They legitimately feed different inputs — unification means one
// shared FORMULA, not identical pixels.
//
// Pure module: no Svelte runes, no DOM, no theme resolver. V8-safe, bun-testable.

import { ASPECT } from "../rendering-constants";

/** Minimum legible data-row height when shrinking: max(FLOOR, round(font×LINE_FACTOR)+PAD). */
export function minRowHeightFor(bodyFontSize: number): number {
  return Math.max(
    ASPECT.MIN_ROW_HEIGHT.FLOOR,
    Math.round(bodyFontSize * ASPECT.MIN_ROW_HEIGHT.LINE_FACTOR) + ASPECT.MIN_ROW_HEIGHT.PAD,
  );
}

/** Resolve a pinned aspect ratio + anchor into absolute target canvas dims. */
export function resolveAspectTargets(
  naturalWidth: number,
  naturalHeight: number,
  targetAspect: number,
  anchor: "width" | "height" | "auto",
  maxWidthMult: number = ASPECT.MAX_LAYOUT_WIDTH_MULT,
): { targetWidth: number; targetHeight: number; resolvedAnchor: "width" | "height" } {
  const naturalAspect =
    naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
  // "auto" anchors whichever dimension keeps the layout from blowing up: a
  // target wider than natural anchors height (grow width), narrower anchors
  // width (grow height).
  const resolvedAnchor: "width" | "height" =
    anchor === "auto" ? (targetAspect >= naturalAspect ? "height" : "width") : anchor;

  let targetWidth: number;
  let targetHeight: number;
  if (resolvedAnchor === "height") {
    // Hard cap: width never exceeds maxWidthMult × natural (practical
    // visible/scrollable ceiling; TARGET_ASPECT_MAX keeps the ratio finite).
    const maxLayoutWidth = naturalWidth * maxWidthMult;
    targetHeight = naturalHeight;
    targetWidth = Math.min(naturalHeight * targetAspect, maxLayoutWidth);
  } else {
    targetWidth = naturalWidth;
    targetHeight = targetWidth / targetAspect;
  }
  return { targetWidth, targetHeight, resolvedAnchor };
}

export interface AspectLadderInput {
  /** Resolved target canvas dims (post anchor + cap). */
  targetWidth: number;
  targetHeight: number;
  /** Natural total dims the deltas are measured against. */
  naturalWidth: number;
  naturalHeight: number;
  /** Natural width of the flex/plot region (export: naturalLayout.forestWidth;
   *  DOM: forestWidth + Σ flex viz column widths). */
  naturalFlexWidth: number;
  /** Σ natural auto-widths over NON-flex AUTO columns (Lever 1B base; excludes
   *  flex columns and pinned numeric-width columns). */
  naturalNonFlexAutoSum: number;
  /** Σ of the scalable chrome spacing keys (computeScalableChromeHeight). */
  scalableChromeHeight: number;
  /** Rows-area height. Export: naturalLayout.plotHeight (exact). DOM:
   *  rowSlots × rowHeight (estimate). */
  naturalPlotHeight: number;
  /** total - plot. */
  naturalChromeHeight: number;
  naturalRowHeight: number;
  /** max(1, flexCap). */
  flexCap: number;
  /** minRowHeightFor(bodyFontSize). */
  minRowHeight: number;
  /** Defaults from ASPECT; overridable for testing. */
  chromeShare?: number;
  nonFlexScaleFloor?: number;
  chromeScaleFloor?: number;
  /** When an external pre-step (export auto-wrap) already absorbed the height
   *  delta, the height ladder is a no-op (scales = 1). */
  heightDeltaConsumed?: boolean;
}

export interface AspectLadderResult {
  /** Lever 1A: absorbed flex-region width (export's targetForestWidth). */
  flexWidth: number;
  /** Lever 1B: scale for non-flex auto columns. */
  nonFlexScale: number;
  /** Height ladder: multiplicative factor on rowHeight / plot height. */
  rowHeightScale: number;
  /** Height ladder: multiplicative factor on the scalable chrome keys. */
  chromeScale: number;
  /** Residual width after Lever 1A (diagnostics / parity). */
  widthResidual: number;
}

/**
 * The width levers (1A flex absorption clamp, 1B non-flex-auto scale) and the
 * height ladder (grow: CHROME_SHARE split; shrink: rows-then-chrome with floors).
 * Lifted verbatim from the export path so both runtimes share one formula.
 */
export function computeAspectLadder(input: AspectLadderInput): AspectLadderResult {
  const {
    targetWidth, targetHeight,
    naturalWidth, naturalHeight,
    naturalFlexWidth, naturalNonFlexAutoSum,
    scalableChromeHeight, naturalPlotHeight, naturalChromeHeight, naturalRowHeight,
    flexCap, minRowHeight,
    chromeShare = ASPECT.CHROME_SHARE,
    nonFlexScaleFloor = ASPECT.NON_FOREST_SCALE_FLOOR,
    chromeScaleFloor = ASPECT.CHROME_SCALE_FLOOR,
    heightDeltaConsumed = false,
  } = input;

  // ── Width ladder ──────────────────────────────────────────────────────────
  // Lever 1A: absorb the width delta into the flex region, cap-clamped to
  // [natural/flexCap, natural×flexCap].
  const widthDelta = targetWidth - naturalWidth;
  let flexWidth = naturalFlexWidth;
  let widthResidual = widthDelta;
  if (naturalFlexWidth > 0 && flexCap > 1) {
    const proposedFlex = naturalFlexWidth + widthDelta;
    const cappedFlex = Math.max(
      naturalFlexWidth / flexCap,
      Math.min(naturalFlexWidth * flexCap, proposedFlex),
    );
    flexWidth = cappedFlex;
    widthResidual = widthDelta - (cappedFlex - naturalFlexWidth);
  }
  // Lever 1B: distribute the residual proportionally across non-flex auto
  // columns, floored so they can't collapse to zero.
  let nonFlexScale = 1;
  if (Math.abs(widthResidual) > 0.5 && naturalNonFlexAutoSum > 0) {
    nonFlexScale = Math.max(
      nonFlexScaleFloor,
      (naturalNonFlexAutoSum + widthResidual) / naturalNonFlexAutoSum,
    );
  }

  // ── Height ladder ─────────────────────────────────────────────────────────
  let rowHeightScale = 1;
  let chromeScale = 1;
  const heightDelta = targetHeight - naturalHeight;
  if (heightDeltaConsumed) {
    // External pre-step (auto-wrap) absorbed the delta — leave scales at 1.
  } else if (heightDelta > 0) {
    // Taller: chrome takes a fixed share, rowHeight takes the rest (avoids
    // 100% rowHeight ballooning at very tall aspects).
    const chromeDelta = heightDelta * chromeShare;
    const rowDelta = heightDelta - chromeDelta;
    if (scalableChromeHeight > 0)
      chromeScale = (scalableChromeHeight + chromeDelta) / scalableChromeHeight;
    if (naturalPlotHeight > 0)
      rowHeightScale = (naturalPlotHeight + rowDelta) / naturalPlotHeight;
  } else if (heightDelta < 0) {
    // Shorter: rowHeight first, floored at minRowHeight for legibility.
    const targetPlotHeight = Math.max(0, targetHeight - naturalChromeHeight);
    const proposedRowHeight =
      naturalPlotHeight > 0 ? (targetPlotHeight / naturalPlotHeight) * naturalRowHeight : naturalRowHeight;
    if (proposedRowHeight >= minRowHeight) {
      rowHeightScale = naturalRowHeight > 0 ? proposedRowHeight / naturalRowHeight : 1;
    } else {
      // Floor saturated: pin rowHeight at minRowHeight, shrink chrome to absorb
      // the remainder (chrome floored so hierarchy survives).
      rowHeightScale = naturalRowHeight > 0 ? minRowHeight / naturalRowHeight : 1;
      const flooredPlotHeight =
        naturalRowHeight > 0 ? minRowHeight * (naturalPlotHeight / naturalRowHeight) : 0;
      const residualHeight = targetHeight - (naturalChromeHeight + flooredPlotHeight);
      if (scalableChromeHeight > 0) {
        chromeScale = Math.max(
          chromeScaleFloor,
          (scalableChromeHeight + residualHeight) / scalableChromeHeight,
        );
      }
    }
  }

  return { flexWidth, nonFlexScale, rowHeightScale, chromeScale, widthResidual };
}
