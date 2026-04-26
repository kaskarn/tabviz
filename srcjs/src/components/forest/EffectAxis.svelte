<script lang="ts">
  import type { WebTheme, ComputedLayout } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { computeAxisLayout } from "$lib/typography-layout";
  
  interface Props {
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    theme: WebTheme | undefined;
    axisLabel?: string;
    position?: "top" | "bottom";
    plotHeight?: number;
    /** Precomputed base ticks from axis-utils (will be filtered for spacing) */
    baseTicks?: number[];
    /** Override gridlines display (if undefined, falls back to theme.axis.gridlines) */
    gridlines?: boolean;
  }

  let { xScale, layout, theme, axisLabel, position = "bottom", plotHeight = 0, baseTicks, gridlines }: Props = $props();

  // Get axis config from theme
  const axisConfig = $derived(theme?.axis);
  const showGridlines = $derived(gridlines ?? axisConfig?.gridlines ?? false);
  const gridlineStyle = $derived(axisConfig?.gridlineStyle ?? "dotted");

  // Edge threshold for text anchor adjustment (prevents clipping at boundaries)
  // Should be >= VIZ_MARGIN to ensure edge labels are detected
  const EDGE_THRESHOLD = 35;

  // Extract nullTick config (default: true)
  const shouldIncludeNullTick = $derived(axisConfig?.nullTick ?? true);

  // Generate nice tick values with spacing-aware filtering to prevent overlap
  // Uses baseTicks from axis-utils if provided, otherwise falls back to D3 generation
  // Ensures: (1) null tick always present if nullTick = true, (2) at least 2 ticks
  const ticks = $derived.by(() => {
    const [domainMin, domainMax] = xScale.domain() as [number, number];
    const nullValue = layout.nullValue;
    const nullInDomain = nullValue >= domainMin && nullValue <= domainMax;

    // Use explicit tick values if provided (highest priority)
    if (axisConfig?.tickValues && axisConfig.tickValues.length > 0) {
      // Filter to domain bounds
      let result = axisConfig.tickValues.filter((t: number) => t >= domainMin && t <= domainMax);
      // Ensure null tick is included if configured and in domain
      if (shouldIncludeNullTick && nullInDomain && !result.includes(nullValue)) {
        result = [...result, nullValue].sort((a, b) => a - b);
      }
      return result;
    }

    // Get base ticks: use precomputed baseTicks from axis-utils, or fall back to D3
    const minSpacing = 50; // minimum pixels between tick labels
    const maxTicks = Math.max(2, Math.floor(layout.forestWidth / minSpacing));
    const requestedTicks = axisConfig?.tickCount ?? null;
    const tickCount = requestedTicks ?? Math.min(7, maxTicks);

    const allTicks = baseTicks && baseTicks.length > 0
      ? baseTicks.filter(t => t >= domainMin && t <= domainMax)
      : xScale.ticks(tickCount);

    if (allTicks.length === 0) {
      // Even with no ticks, ensure at least null + one domain boundary
      if (shouldIncludeNullTick && nullInDomain) {
        return [nullValue];
      }
      return [];
    }

    // Filter ticks symmetrically from null value outward
    // This ensures both sides of the null line adapt equally when resizing
    const nullX = xScale(nullValue);

    // Separate ticks into left and right of null
    const leftTicks = allTicks.filter(t => t < nullValue).reverse(); // Process outward from null
    const rightTicks = allTicks.filter(t => t > nullValue);
    const hasNullTickInAll = allTicks.some(t => t === nullValue);

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

    // Combine: left + null (if present or required) + right
    const result = [...filteredLeft];

    // Include null tick if: (1) it was in base ticks, OR (2) nullTick config requires it and it's in domain
    if (hasNullTickInAll || (shouldIncludeNullTick && nullInDomain)) {
      result.push(nullValue);
    }

    result.push(...filteredRight);

    // Guarantee at least 2 ticks
    if (result.length < 2) {
      // Add domain boundaries if needed
      const tickSet = new Set(result);
      if (!tickSet.has(domainMin)) {
        result.unshift(domainMin);
      }
      if (result.length < 2 && !tickSet.has(domainMax)) {
        result.push(domainMax);
      }
    }

    return result;
  });

  // Position axis line based on position prop
  const axisY = $derived(position === "bottom" ? 0 : layout.headerHeight - 8);
  const isBottom = $derived(position === "bottom");

  // Axis geometry derived from theme typography + tick mark length so
  // the visible tick lines and label/axis-label baselines stay in sync
  // with `theme.plot.tickMarkLength`. Mirrors the SVG-export math in
  // `$lib/typography-layout.computeAxisLayout`.
  const axisGeom = $derived(theme
    ? computeAxisLayout(
        { fontSizeSm: theme.text.label.size, lineHeight: 1.5 },
        !!axisLabel,
        theme.plot.tickMarkLength,
      )
    : { tickMarkLength: 4, tickLabelY: 16, axisLabelY: 28, axisRegionHeight: 32 });

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
  <!-- Axis line (matches scale range which already includes VIZ_MARGIN from cell edges) -->
  <line
    x1={xScale.range()[0]}
    x2={xScale.range()[1]}
    y1={axisY}
    y2={axisY}
    stroke="var(--tv-axis-line, var(--tv-border, #e2e8f0))"
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
        stroke="var(--tv-border, #e2e8f0)"
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
        y1={isBottom ? axisY : axisY - axisGeom.tickMarkLength}
        y2={isBottom ? axisY + axisGeom.tickMarkLength : axisY}
        stroke="var(--tv-axis-tick, var(--tv-border, #e2e8f0))"
        stroke-width="1"
      />
      <text
        x={getTextXOffset(tickX)}
        y={isBottom ? axisY + axisGeom.tickLabelY : axisY - axisGeom.tickLabelY + axisGeom.tickMarkLength}
        text-anchor={getTextAnchor(tickX)}
        fill="var(--tv-axis-tick-fg, var(--tv-secondary, #64748b))"
        font-family="var(--tv-text-tick-family, var(--tv-font-family))"
        font-size="var(--tv-font-size-sm, 0.75rem)"
        font-weight="var(--tv-text-tick-weight, 400)"
        font-style="var(--tv-text-tick-italic, normal)"
      >
        {formatTick(tick)}
      </text>
    </g>
  {/each}

  <!-- Axis label -->
  {#if axisLabel}
    <text
      x={layout.forestWidth / 2}
      y={isBottom ? axisY + axisGeom.axisLabelY : axisY - axisGeom.axisLabelY}
      text-anchor="middle"
      fill="var(--tv-axis-label-fg, var(--tv-secondary, #64748b))"
      font-family="var(--tv-text-label-family, var(--tv-font-family))"
      font-size="var(--tv-font-size-sm, 0.75rem)"
      font-weight="var(--tv-text-label-weight, 500)"
      font-style="var(--tv-text-label-italic, normal)"
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
