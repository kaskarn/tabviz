<script lang="ts">
  import type { WebTheme, ComputedLayout } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";

  interface Props {
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    theme: WebTheme | undefined;
    axisLabel?: string;
    position?: "top" | "bottom";
    plotHeight?: number;
  }

  let { xScale, layout, theme, axisLabel, position = "bottom", plotHeight = 0 }: Props = $props();

  // Get axis config from theme
  const axisConfig = $derived(theme?.axis);
  const showGridlines = $derived(axisConfig?.gridlines ?? false);
  const gridlineStyle = $derived(axisConfig?.gridlineStyle ?? "dotted");

  // Edge threshold for text anchor adjustment (prevents clipping at boundaries)
  // Should be >= AXIS_LABEL_PADDING from forestStore to ensure edge labels are detected
  const EDGE_THRESHOLD = 35;

  // Generate nice tick values with spacing-aware filtering to prevent overlap
  const ticks = $derived.by(() => {
    // Use explicit tick values if provided
    if (axisConfig?.tickValues && axisConfig.tickValues.length > 0) {
      // Filter to domain bounds to ensure ticks stay within axis range
      const [domainMin, domainMax] = xScale.domain() as [number, number];
      return axisConfig.tickValues.filter(t => t >= domainMin && t <= domainMax);
    }

    const minSpacing = 50; // minimum pixels between tick labels
    const maxTicks = Math.max(2, Math.floor(layout.forestWidth / minSpacing));

    // Use tick count from config if provided
    const requestedTicks = axisConfig?.tickCount ?? null;
    const tickCount = requestedTicks ?? Math.min(7, maxTicks);

    const allTicks = xScale.ticks(tickCount);
    if (allTicks.length === 0) return [];

    // Filter ticks symmetrically from null value outward
    // This ensures both sides of the null line adapt equally when resizing
    const nullValue = layout.nullValue;
    const nullX = xScale(nullValue);

    // Separate ticks into left and right of null
    const leftTicks = allTicks.filter(t => t < nullValue).reverse(); // Process outward from null
    const rightTicks = allTicks.filter(t => t > nullValue);
    const hasNullTick = allTicks.some(t => t === nullValue);

    // Filter left side (from null outward to left)
    const filteredLeft: number[] = [];
    let lastLeftX = nullX;
    for (const tick of leftTicks) {
      const x = xScale(tick);
      if (lastLeftX - x >= minSpacing) {
        filteredLeft.unshift(tick); // Prepend to maintain order
        lastLeftX = x;
      }
    }

    // Filter right side (from null outward to right)
    const filteredRight: number[] = [];
    let lastRightX = nullX;
    for (const tick of rightTicks) {
      const x = xScale(tick);
      if (x - lastRightX >= minSpacing) {
        filteredRight.push(tick);
        lastRightX = x;
      }
    }

    // Combine: left + null (if present) + right
    const result = [...filteredLeft];
    if (hasNullTick) result.push(nullValue);
    result.push(...filteredRight);

    return result;
  });

  // Position axis line based on position prop
  const axisY = $derived(position === "bottom" ? 0 : layout.headerHeight - 8);
  const isBottom = $derived(position === "bottom");

  // Gridline dash array based on style
  const gridlineDashArray = $derived(
    gridlineStyle === "dashed" ? "4,4" :
    gridlineStyle === "dotted" ? "2,2" : "none"
  );

  /**
   * Get appropriate text-anchor to prevent label clipping at edges.
   * Labels near the left edge use "start", near the right edge use "end",
   * and labels in the middle use "middle" for centered alignment.
   */
  function getTextAnchor(tickX: number): "start" | "middle" | "end" {
    if (tickX < EDGE_THRESHOLD) return "start";
    if (tickX > layout.forestWidth - EDGE_THRESHOLD) return "end";
    return "middle";
  }

  /**
   * Get x-offset for text to ensure it doesn't extend outside SVG bounds.
   * Used in combination with text-anchor for edge labels.
   */
  function getTextXOffset(tickX: number): number {
    if (tickX < EDGE_THRESHOLD) return 2; // Slight offset from left edge
    if (tickX > layout.forestWidth - EDGE_THRESHOLD) return -2; // Slight offset from right edge
    return 0;
  }
</script>

<g class="effect-axis">
  <!-- Axis line -->
  <line
    x1={0}
    x2={layout.forestWidth}
    y1={axisY}
    y2={axisY}
    stroke="var(--wf-border, #e2e8f0)"
    stroke-width="1"
  />

  <!-- Gridlines (rendered first so they appear behind ticks) -->
  {#if showGridlines && plotHeight > 0}
    {#each ticks as tick (tick)}
      <line
        x1={xScale(tick)}
        x2={xScale(tick)}
        y1={isBottom ? axisY : axisY}
        y2={isBottom ? -plotHeight : plotHeight}
        stroke="var(--wf-border, #e2e8f0)"
        stroke-width="1"
        stroke-dasharray={gridlineDashArray}
        opacity="0.5"
      />
    {/each}
  {/if}

  <!-- Ticks and labels -->
  {#each ticks as tick (tick)}
    {@const tickX = xScale(tick)}
    <g transform="translate({tickX}, 0)">
      <line
        y1={isBottom ? axisY : axisY - 4}
        y2={isBottom ? axisY + 4 : axisY}
        stroke="var(--wf-border, #e2e8f0)"
        stroke-width="1"
      />
      <text
        x={getTextXOffset(tickX)}
        y={isBottom ? axisY + 16 : axisY - 8}
        text-anchor={getTextAnchor(tickX)}
        fill="var(--wf-secondary, #64748b)"
        font-size="var(--wf-font-size-sm, 0.75rem)"
      >
        {formatTick(tick)}
      </text>
    </g>
  {/each}

  <!-- Axis label -->
  {#if axisLabel}
    <text
      x={layout.forestWidth / 2}
      y={isBottom ? axisY + 28 : axisY - 24}
      text-anchor="middle"
      fill="var(--wf-secondary, #64748b)"
      font-size="var(--wf-font-size-sm, 0.75rem)"
      font-weight="500"
    >
      {axisLabel}
    </text>
  {/if}
</g>

<script lang="ts" module>
  function formatTick(value: number): string {
    if (Math.abs(value) < 0.01) return "0";
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }
</script>

<style>
  .effect-axis text {
    font-variant-numeric: tabular-nums;
  }
</style>
