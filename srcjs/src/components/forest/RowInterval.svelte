<script lang="ts">
  import type { Row, RowStyle, CellStyle, WebTheme, ComputedLayout, EffectSpec, MarkerShape, ForestColumnOptions } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { computeArrowDimensions, renderArrowPath } from "$lib/arrow-utils";
  import { VIZ_MARGIN } from "$lib/axis-utils";
  import { getEffectValue } from "$lib/scale-utils";
  import { getEffectYOffset } from "$lib/rendering-constants";
  import { resolveMarkerStyle, semanticStrokeFor } from "$lib/marker-styling";

  interface Props {
    row: Row;
    yPosition: number;
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    theme: WebTheme | undefined;
    weightCol?: string | null;
    /** Axis limits for CI clipping detection (domain units, not pixels) */
    clipBounds?: [number, number];
    /** Whether using log scale (for filtering non-positive values) */
    isLog?: boolean;
    /** Forest column options (for explicit col_forest columns) */
    forestColumnOptions?: ForestColumnOptions | null;
    /** Cell-level style overrides for the forest column. When the user
     * paints a viz cell, the painter writes flags into the cell's
     * CellStyle; the marker cascade should reflect those for cell-scope
     * paint (otherwise painting a viz cell does nothing visually). */
    cellStyle?: CellStyle | null;
    onRowClick?: () => void;
    onRowHover?: (hovered: boolean, event?: MouseEvent) => void;
  }

  let {
    row,
    yPosition,
    xScale,
    layout,
    theme,
    weightCol = null,
    clipBounds,
    isLog = false,
    forestColumnOptions = null,
    cellStyle = null,
    onRowClick,
    onRowHover,
  }: Props = $props();

  // Effective row-style for the marker cascade: merge cell-level flags
  // over the row-level ones. activeSemanticToken on the result picks
  // whichever token is most specific (cell wins over row when both set).
  const effectiveStyleForMarker = $derived.by((): RowStyle | null => {
    if (!cellStyle) return row.style ?? null;
    return { ...(row.style ?? {}), ...(cellStyle as Partial<RowStyle>) } as RowStyle;
  });

  // Arrow configuration (scales with theme line width)
  const arrowConfig = $derived(computeArrowDimensions(theme));

  // Compute effective effects to render from forest column options
  // Each col_forest() now fully owns its effect definitions
  const effectsToRender = $derived.by(() => {
    if (!forestColumnOptions) {
      // No forest column options - no effects to render
      return [];
    }

    const filterLog = forestColumnOptions.scale === "log" || isLog;

    // Mode 1: Inline single effect (point/lower/upper columns specified)
    if (forestColumnOptions.point && forestColumnOptions.lower && forestColumnOptions.upper) {
      const pointVal = row.metadata[forestColumnOptions.point] as number | null | undefined;
      const lowerVal = row.metadata[forestColumnOptions.lower] as number | null | undefined;
      const upperVal = row.metadata[forestColumnOptions.upper] as number | null | undefined;
      const point = (!filterLog || (pointVal != null && pointVal > 0)) ? pointVal : null;
      const lower = (!filterLog || (lowerVal != null && lowerVal > 0)) ? lowerVal : null;
      const upper = (!filterLog || (upperVal != null && upperVal > 0)) ? upperVal : null;
      return [{
        id: "inline",
        pointCol: forestColumnOptions.point,
        lowerCol: forestColumnOptions.lower,
        upperCol: forestColumnOptions.upper,
        label: null,
        color: null,
        shape: null as MarkerShape | null,
        opacity: null as number | null,
        point,
        lower,
        upper,
      }];
    }

    // Mode 2: Inline multiple effects (effects list in forest column options)
    if (forestColumnOptions.effects && forestColumnOptions.effects.length > 0) {
      return forestColumnOptions.effects.map(effect => ({
        ...effect,
        point: getEffectValue(row.metadata, null, effect.pointCol, "point", filterLog),
        lower: getEffectValue(row.metadata, null, effect.lowerCol, "lower", filterLog),
        upper: getEffectValue(row.metadata, null, effect.upperCol, "upper", filterLog),
      }));
    }

    // No effects defined - return empty (no marker to render)
    return [];
  });

  // Check if any effect has valid values
  const hasAnyValidValues = $derived(
    effectsToRender.some(e =>
      e.point != null && !Number.isNaN(e.point) &&
      e.lower != null && !Number.isNaN(e.lower) &&
      e.upper != null && !Number.isNaN(e.upper)
    )
  );

  // Check if this is a summary row (should render diamond instead of square)
  const isSummaryRow = $derived(row.style?.type === 'summary');

  // Check if intervals are clipped (extend beyond axis limits)
  // Uses domain values (axis limits), not pixel coordinates
  function isClippedLeft(lower: number): boolean {
    if (!clipBounds) return xScale(lower) < 0;  // Fallback to pixel-based
    return lower < clipBounds[0];
  }

  function isClippedRight(upper: number): boolean {
    if (!clipBounds) return xScale(upper) > layout.forestWidth;  // Fallback to pixel-based
    return upper > clipBounds[1];
  }

  // Clamp value to axis limits (domain units) then convert to pixels
  function clampAndScale(value: number): number {
    if (!clipBounds) return Math.max(0, Math.min(layout.forestWidth, xScale(value)));
    const clamped = Math.max(clipBounds[0], Math.min(clipBounds[1], value));
    return xScale(clamped);
  }

  // Arrow x positions - should be at actual axis limits, not hardcoded padding
  // This ensures arrows align precisely with where the axis line starts/ends
  const leftArrowX = $derived(
    clipBounds ? xScale(clipBounds[0]) : VIZ_MARGIN
  );
  const rightArrowX = $derived(
    clipBounds ? xScale(clipBounds[1]) : layout.forestWidth - VIZ_MARGIN
  );

  // Diamond height for summary rows
  const diamondHeight = $derived(10 ?? 10);
  const halfDiamondHeight = $derived(diamondHeight / 2);

  // Base point size from theme
  const basePointSize = $derived(theme?.plot?.pointSize ?? 6);

  // Get point size for an effect (scaled by weight or markerStyle.size for primary)
  function getEffectSize(isPrimary: boolean): number {
    // Row-level marker size (only applies to primary effect). Treated as a
    // raw weight-like value and normalized the same way as legacy weight.
    if (isPrimary && row.markerStyle?.size != null) {
      const scale = 0.5 + Math.sqrt(row.markerStyle.size / 100) * 1.5;
      return Math.min(Math.max(basePointSize * scale, 3), basePointSize * 2.5);
    }

    // Legacy weight column support
    const weight = weightCol ? (row.metadata[weightCol] as number | undefined) : undefined;
    if (weight) {
      // Scale between 0.5x and 2x based on weight
      const scale = 0.5 + Math.sqrt(weight / 100) * 1.5;
      return Math.min(Math.max(basePointSize * scale, 3), basePointSize * 2.5);
    }

    return basePointSize;
  }

  // Get style (fill, stroke, shape, opacity) for an effect.
  //
  // Color cascade (4-layer, see `$lib/marker-styling`):
  //   Layer 4: row.markerStyle.color (per-row literal — applies to ALL effects)
  //   Layer 3: row.style.{accent,emphasis,muted} → theme color
  //              single-effect: replaces fill
  //              multi-effect:  preserves per-effect fill, adds outline
  //   Layer 2: effect.color (per-effect literal)
  //   Layer 1: theme.series.map(s => s.fill)[idx] cycle (palette default)
  //
  // Shape and opacity remain primary-effect-only (row.markerStyle drives the
  // main marker; secondary effects use their own effect-spec values).
  function getEffectStyle(effect: typeof effectsToRender[0], idx: number): {
    fill: string;
    stroke: string | null;
    strokeWidth: number;
    shape: MarkerShape;
    opacity: number;
  } {
    const isPrimary = idx === 0;
    const markerStyle = row.markerStyle;

    // Theme effect defaults for multi-effect plots
    const themeEffectColors = theme?.series?.map(s => s.fill);
    // Per-series marker shapes ride on the SlotBundle now: theme.series[i].shape
    // (NA on the wire = null → fall through to the 4-shape rotation).
    const defaultShapes: MarkerShape[] = ["square", "circle", "diamond", "triangle"];

    // Resolve Layer 1+2 (per-effect literal or palette cycle) into a base color.
    // Summary rows use `colors.summaryFill` as their base so the diamond honors
    // its dedicated palette slot; non-summary rows follow the effect-color
    // cascade. Layers 3+4 (bundle.markerFill / row.markerStyle.color) still
    // layer on top via resolveMarkerStyle below.
    let baseColor: string;
    if (effect.color) {
      baseColor = effect.color;
    } else if (isSummaryRow && isPrimary && theme?.series?.[0]?.fill) {
      baseColor = theme.series[0].fill;
    } else if (themeEffectColors && themeEffectColors.length > 0) {
      baseColor = themeEffectColors[idx % themeEffectColors.length];
    } else {
      baseColor = theme?.accent?.default ?? "#2563eb";
    }

    // Apply Layers 3+4 via the shared cascade resolver. Pass the cell-
    // level merged style so cell-scope painting on a viz column reaches
    // the marker (otherwise painting a viz cell would not surface
    // visually since the viz cell DOM is just a backdrop for the SVG).
    const ms = resolveMarkerStyle(
      baseColor,
      markerStyle?.color ?? null,
      effectiveStyleForMarker,
      effectsToRender.length,
      theme,
    );

    // Shape priority (primary-effect-only for marker_shape override):
    //   row markerStyle.shape > effect.shape > theme.series[idx].shape >
    //   default 4-shape rotation
    let shape: MarkerShape;
    const themeSlotShape = theme?.series?.[idx]?.shape as MarkerShape | null | undefined;
    if (isPrimary && markerStyle?.shape) {
      shape = markerStyle.shape;
    } else if (effect.shape) {
      shape = effect.shape;
    } else if (themeSlotShape) {
      shape = themeSlotShape;
    } else {
      shape = defaultShapes[idx % defaultShapes.length];
    }

    // Opacity priority (primary-effect-only for marker_opacity override):
    let opacity: number;
    if (isPrimary && markerStyle?.opacity != null) {
      opacity = markerStyle.opacity;
    } else if (effect.opacity != null) {
      opacity = effect.opacity;
    } else {
      opacity = 1;
    }

    return { fill: ms.fill, stroke: ms.stroke, strokeWidth: ms.strokeWidth, shape, opacity };
  }
</script>

{#if hasAnyValidValues}
  <g
    class="interval-row"
    role="button"
    tabindex="0"
    onclick={onRowClick}
    onmouseenter={(e) => onRowHover?.(true, e)}
    onmouseleave={(e) => onRowHover?.(false, e)}
    onkeydown={(e) => e.key === "Enter" && onRowClick?.()}
  >
    {#each effectsToRender as effect, idx}
      {@const hasValidEffect = effect.point != null && !Number.isNaN(effect.point) &&
                               effect.lower != null && !Number.isNaN(effect.lower) &&
                               effect.upper != null && !Number.isNaN(effect.upper)}
      {#if hasValidEffect}
        {@const effectY = yPosition + getEffectYOffset(idx, effectsToRender.length)}
        {@const x1 = xScale(effect.lower!)}
        {@const x2 = xScale(effect.upper!)}
        {@const cx = xScale(effect.point!)}
        {@const style = getEffectStyle(effect, idx)}
        {@const pointSize = getEffectSize(idx === 0)}
        {@const semanticStroke = semanticStrokeFor(row.style, theme)}
        {@const lineColor = semanticStroke ?? theme?.series?.[0]?.stroke ?? "#475569"}

        {#if isSummaryRow}
          <!-- Summary row: render diamond shape spanning lower to upper.
               Note: Summary diamonds are intentionally NOT clipped - they represent
               the overall effect size and typically shouldn't extend beyond axis limits.
               If clipping is needed in the future, use clampAndScale() for x1/x2. -->
          {@const summaryDiamondPoints = [
            `${x1},${effectY}`,
            `${cx},${effectY - halfDiamondHeight}`,
            `${x2},${effectY}`,
            `${cx},${effectY + halfDiamondHeight}`
          ].join(' ')}
          <polygon
            points={summaryDiamondPoints}
            fill={style.fill}
            fill-opacity={style.opacity}
            stroke={theme?.series?.[0]?.stroke ?? "#1d4ed8"}
            stroke-width="1"
            class="point-estimate"
          />
        {:else}
          <!-- Regular row: CI line with whiskers -->
          {@const clippedL = isClippedLeft(effect.lower!)}
          {@const clippedR = isClippedRight(effect.upper!)}
          {@const clampedX1 = clampAndScale(effect.lower!)}
          {@const clampedX2 = clampAndScale(effect.upper!)}
          {@const whiskerHalfHeight = arrowConfig.height / 2}
          <line
            x1={clampedX1}
            x2={clampedX2}
            y1={effectY}
            y2={effectY}
            stroke={lineColor}
            stroke-width={theme?.plot?.lineWidth ?? 1.5}
          />
          <!-- Left whisker or arrow if clipped -->
          {#if clippedL}
            <path
              d={renderArrowPath("left", leftArrowX, effectY, arrowConfig)}
              fill={arrowConfig.color}
              fill-opacity={arrowConfig.opacity}
            />
          {:else}
            <line
              x1={clampedX1}
              x2={clampedX1}
              y1={effectY - whiskerHalfHeight}
              y2={effectY + whiskerHalfHeight}
              stroke={lineColor}
              stroke-width={theme?.plot?.lineWidth ?? 1.5}
            />
          {/if}
          <!-- Right whisker or arrow if clipped -->
          {#if clippedR}
            <path
              d={renderArrowPath("right", rightArrowX, effectY, arrowConfig)}
              fill={arrowConfig.color}
              fill-opacity={arrowConfig.opacity}
            />
          {:else}
            <line
              x1={clampedX2}
              x2={clampedX2}
              y1={effectY - whiskerHalfHeight}
              y2={effectY + whiskerHalfHeight}
              stroke={lineColor}
              stroke-width={theme?.plot?.lineWidth ?? 1.5}
            />
          {/if}

          <!-- Point estimate marker (shape varies).
               Clamp to visible range so markers don't render outside forest area
               when explicit axis limits exclude the point estimate. -->
          {@const clampedCx = clampAndScale(effect.point!)}
          {#if style.shape === "circle"}
            <circle
              cx={clampedCx}
              cy={effectY}
              r={pointSize}
              fill={style.fill}
              fill-opacity={style.opacity}
              stroke={style.stroke}
              stroke-width={style.strokeWidth}
              class="point-estimate"
            />
          {:else if style.shape === "diamond"}
            {@const diamondPts = [
              `${clampedCx},${effectY - pointSize}`,
              `${clampedCx + pointSize},${effectY}`,
              `${clampedCx},${effectY + pointSize}`,
              `${clampedCx - pointSize},${effectY}`
            ].join(' ')}
            <polygon
              points={diamondPts}
              fill={style.fill}
              fill-opacity={style.opacity}
              stroke={style.stroke}
              stroke-width={style.strokeWidth}
              class="point-estimate"
            />
          {:else if style.shape === "triangle"}
            {@const trianglePts = [
              `${clampedCx},${effectY - pointSize}`,
              `${clampedCx + pointSize},${effectY + pointSize}`,
              `${clampedCx - pointSize},${effectY + pointSize}`
            ].join(' ')}
            <polygon
              points={trianglePts}
              fill={style.fill}
              fill-opacity={style.opacity}
              stroke={style.stroke}
              stroke-width={style.strokeWidth}
              class="point-estimate"
            />
          {:else}
            <!-- Default: square -->
            <rect
              x={clampedCx - pointSize}
              y={effectY - pointSize}
              width={pointSize * 2}
              height={pointSize * 2}
              fill={style.fill}
              fill-opacity={style.opacity}
              stroke={style.stroke}
              stroke-width={style.strokeWidth}
              class="point-estimate"
            />
          {/if}
        {/if}
      {/if}
    {/each}
  </g>
{/if}

<style>
  .interval-row {
    cursor: pointer;
    outline: none;
  }

  .interval-row:hover .point-estimate,
  .interval-row:focus .point-estimate {
    opacity: 0.8;
  }

  .point-estimate {
    transition: opacity 0.15s ease;
  }
</style>
