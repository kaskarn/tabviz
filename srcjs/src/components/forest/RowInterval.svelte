<script lang="ts">
  import type { Row, WebTheme, ComputedLayout, EffectSpec, MarkerShape } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";

  interface Props {
    row: Row;
    yPosition: number;
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    theme: WebTheme | undefined;
    effects?: EffectSpec[];
    weightCol?: string | null;
    onRowClick?: () => void;
    onRowHover?: (hovered: boolean, event?: MouseEvent) => void;
  }

  let {
    row,
    yPosition,
    xScale,
    layout,
    theme,
    effects = [],
    weightCol = null,
    onRowClick,
    onRowHover,
  }: Props = $props();

  // Helper to get numeric value from row (primary or metadata)
  function getValue(row: Row, colName: string, primary: "point" | "lower" | "upper"): number | null {
    // Check metadata first (for additional effects)
    const metaVal = row.metadata[colName];
    if (metaVal != null && typeof metaVal === "number" && !Number.isNaN(metaVal)) {
      return metaVal;
    }
    // Fall back to primary columns if colName matches
    if (colName === row.pointCol || primary === "point") return row.point;
    if (colName === row.lowerCol || primary === "lower") return row.lower;
    if (colName === row.upperCol || primary === "upper") return row.upper;
    return null;
  }

  // Compute effective effects to render
  // If no effects specified, create a default one from primary columns
  const effectsToRender = $derived.by(() => {
    if (effects.length === 0) {
      // Default effect from primary columns
      return [{
        id: "primary",
        pointCol: "point",
        lowerCol: "lower",
        upperCol: "upper",
        label: null,
        color: null,
        shape: null as MarkerShape | null,
        opacity: null as number | null,
        point: row.point,
        lower: row.lower,
        upper: row.upper,
      }];
    }

    // Map effects with resolved values
    return effects.map(effect => ({
      ...effect,
      point: getValue(row, effect.pointCol, "point"),
      lower: getValue(row, effect.lowerCol, "lower"),
      upper: getValue(row, effect.upperCol, "upper"),
    }));
  });

  // Vertical offset between multiple effects
  const EFFECT_SPACING = 6; // pixels between effects

  // Calculate vertical offset for each effect (centered around yPosition)
  function getEffectYOffset(index: number, total: number): number {
    if (total <= 1) return 0;
    const totalHeight = (total - 1) * EFFECT_SPACING;
    return -totalHeight / 2 + index * EFFECT_SPACING;
  }

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

  // Check if intervals are clipped (extend beyond axis)
  function isClippedLeft(lower: number): boolean {
    return xScale(lower) < 0;
  }

  function isClippedRight(upper: number): boolean {
    return xScale(upper) > layout.forestWidth;
  }

  // Clamp x-coordinate to visible range
  function clampX(x: number): number {
    return Math.max(0, Math.min(layout.forestWidth, x));
  }

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
          <!-- Summary row: render diamond shape spanning lower to upper -->
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
          {@const clampedX1 = clampX(x1)}
          {@const clampedX2 = clampX(x2)}
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
              d="M 0 {effectY} L 6 {effectY - 4} L 6 {effectY + 4} Z"
              fill={lineColor}
            />
          {:else}
            <line
              x1={clampedX1}
              x2={clampedX1}
              y1={effectY - 4}
              y2={effectY + 4}
              stroke={lineColor}
              stroke-width={theme?.shapes.lineWidth ?? 1.5}
            />
          {/if}
          <!-- Right whisker or arrow if clipped -->
          {#if clippedR}
            <path
              d="M {layout.forestWidth} {effectY} L {layout.forestWidth - 6} {effectY - 4} L {layout.forestWidth - 6} {effectY + 4} Z"
              fill={lineColor}
            />
          {:else}
            <line
              x1={clampedX2}
              x2={clampedX2}
              y1={effectY - 4}
              y2={effectY + 4}
              stroke={lineColor}
              stroke-width={theme?.shapes.lineWidth ?? 1.5}
            />
          {/if}

          <!-- Point estimate marker (shape varies) -->
          {#if style.shape === "circle"}
            <circle
              cx={cx}
              cy={effectY}
              r={pointSize}
              fill={style.color}
              fill-opacity={style.opacity}
              class="point-estimate"
            />
          {:else if style.shape === "diamond"}
            {@const diamondPts = [
              `${cx},${effectY - pointSize}`,
              `${cx + pointSize},${effectY}`,
              `${cx},${effectY + pointSize}`,
              `${cx - pointSize},${effectY}`
            ].join(' ')}
            <polygon
              points={diamondPts}
              fill={style.color}
              fill-opacity={style.opacity}
              class="point-estimate"
            />
          {:else if style.shape === "triangle"}
            {@const trianglePts = [
              `${cx},${effectY - pointSize}`,
              `${cx + pointSize},${effectY + pointSize}`,
              `${cx - pointSize},${effectY + pointSize}`
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
              x={cx - pointSize}
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
