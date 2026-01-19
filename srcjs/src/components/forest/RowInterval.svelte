<script lang="ts">
  import type { Row, WebTheme, ComputedLayout, EffectSpec, MarkerShape, ForestColumnOptions } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { computeArrowDimensions, renderArrowPath } from "$lib/arrow-utils";
  import { AXIS_LABEL_PADDING } from "$lib/axis-utils";
  import { getEffectValue } from "$lib/scale-utils";
  import { getEffectYOffset } from "$lib/rendering-constants";

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
    onRowClick,
    onRowHover,
  }: Props = $props();

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
    clipBounds ? xScale(clipBounds[0]) : AXIS_LABEL_PADDING
  );
  const rightArrowX = $derived(
    clipBounds ? xScale(clipBounds[1]) : layout.forestWidth - AXIS_LABEL_PADDING
  );

  // Diamond height for summary rows
  const diamondHeight = $derived(theme?.shapes.summaryHeight ?? 10);
  const halfDiamondHeight = $derived(diamondHeight / 2);

  // Base point size from theme
  const basePointSize = $derived(theme?.shapes.pointSize ?? 6);

  // Get point size for an effect (scaled by weight or markerStyle.size for primary)
  function getEffectSize(isPrimary: boolean): number {
    // Check row-level marker size (only applies to primary effect)
    if (isPrimary && row.markerStyle?.size != null) {
      return basePointSize * row.markerStyle.size;
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

  // Get style (color, shape, opacity) for an effect
  // Priority: row.markerStyle (primary only) > effect spec > theme default
  function getEffectStyle(effect: typeof effectsToRender[0], idx: number): {
    color: string;
    shape: MarkerShape;
    opacity: number;
  } {
    const isPrimary = idx === 0;
    const markerStyle = row.markerStyle;

    // Theme marker defaults for multi-effect plots
    const themeMarkerColors = theme?.shapes.markerColors;
    const themeMarkerShapes = theme?.shapes.markerShapes;
    const defaultShapes: MarkerShape[] = ["square", "circle", "diamond", "triangle"];

    // Color priority:
    // 1. Primary effect: row.markerStyle.color (if set)
    // 2. effect.color (if set)
    // 3. theme.shapes.markerColors[idx] (if defined)
    // 4. theme.colors.interval (fallback)
    let color: string;
    if (isPrimary && markerStyle?.color) {
      color = markerStyle.color;
    } else if (effect.color) {
      color = effect.color;
    } else if (themeMarkerColors && themeMarkerColors.length > 0) {
      // Cycle through marker colors if more effects than colors defined
      color = themeMarkerColors[idx % themeMarkerColors.length];
    } else {
      color = theme?.colors.interval ?? theme?.colors.primary ?? "#2563eb";
    }

    // Shape priority:
    // 1. Primary effect: row.markerStyle.shape (if set)
    // 2. effect.shape (if set)
    // 3. theme.shapes.markerShapes[idx] (if defined)
    // 4. Default shapes: square, circle, diamond, triangle (cycling)
    let shape: MarkerShape;
    if (isPrimary && markerStyle?.shape) {
      shape = markerStyle.shape;
    } else if (effect.shape) {
      shape = effect.shape;
    } else if (themeMarkerShapes && themeMarkerShapes.length > 0) {
      shape = themeMarkerShapes[idx % themeMarkerShapes.length];
    } else {
      shape = defaultShapes[idx % defaultShapes.length];
    }

    // Opacity priority: same pattern
    let opacity: number;
    if (isPrimary && markerStyle?.opacity != null) {
      opacity = markerStyle.opacity;
    } else if (effect.opacity != null) {
      opacity = effect.opacity;
    } else {
      opacity = 1;
    }

    return { color, shape, opacity };
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
        {@const lineColor = theme?.colors.intervalLine ?? "#475569"}

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
            fill={style.color}
            fill-opacity={style.opacity}
            stroke={theme?.colors.summaryBorder ?? "#1d4ed8"}
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
            stroke-width={theme?.shapes.lineWidth ?? 1.5}
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
              stroke-width={theme?.shapes.lineWidth ?? 1.5}
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
              stroke-width={theme?.shapes.lineWidth ?? 1.5}
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
              fill={style.color}
              fill-opacity={style.opacity}
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
              fill={style.color}
              fill-opacity={style.opacity}
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
              fill={style.color}
              fill-opacity={style.opacity}
              class="point-estimate"
            />
          {:else}
            <!-- Default: square -->
            <rect
              x={clampedCx - pointSize}
              y={effectY - pointSize}
              width={pointSize * 2}
              height={pointSize * 2}
              fill={style.color}
              fill-opacity={style.opacity}
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
