<script lang="ts">
  import type { SparklineColumnOptions } from "$types";
  import { SPARKLINE } from "$lib/rendering-constants";
  import { scaleLinear } from "d3-scale";
  import { line as d3line, area as d3area, curveCatmullRom } from "d3-shape";

  interface Props {
    data: number[] | undefined | null;
    options?: SparklineColumnOptions;
    naText?: string;
    /** Per-row/cell color override, computed by TabvizPlot from the
     * active semantic bundle's markerFill. Lets accent / muted / emphasis
     * paint retint sparklines to match the forest-marker treatment.
     * `null` falls through to the brand default. */
    colorOverride?: string | null;
  }

  const { data, options, naText, colorOverride = null }: Props = $props();

  const chartType = $derived(options?.type ?? "line");
  const chartHeight = $derived(options?.height ?? SPARKLINE.DEFAULT_HEIGHT);
  // The sparkline FILLS its column, matching the SVG export (which draws at
  // the cell width). `measuredWidth` tracks the rendered width (Svelte's
  // ResizeObserver via bind:clientWidth); before the first measure it falls
  // back to DEFAULT_WIDTH. The viewBox is kept at chartWidth so the drawing
  // is 1:1 with the rendered px (no horizontal stretch). Was a hardcoded
  // 60px — exports widened to fill while the widget stayed 60 (cell-parity
  // review, 2026-06-14).
  let measuredWidth = $state(0);
  const chartWidth = $derived(measuredWidth > 0 ? measuredWidth : SPARKLINE.DEFAULT_WIDTH);
  // Resolution order: per-column user override > per-row/cell semantic
  // paint > theme primary identity.
  const chartColor = $derived(
    options?.color ?? colorOverride ?? "var(--tv-accent, var(--tv-accent, #2563eb))"
  );

  // Handle nested arrays from R list columns (data may be [[values]] instead of [values])
  const normalizedData = $derived.by(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    // If first element is an array, unwrap the nested structure
    if (Array.isArray(data[0])) {
      return data[0] as number[];
    }
    return data as number[];
  });

  const points = $derived.by(() => {
    if (normalizedData.length === 0) return [];

    const yMin = Math.min(...normalizedData);
    const yMax = Math.max(...normalizedData);
    const yPadding = (yMax - yMin) * 0.1 || 1;

    const xScale = scaleLinear()
      .domain([0, normalizedData.length - 1])
      .range([2, chartWidth - 2]);

    const yScale = scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([chartHeight - 2, 2]);

    return normalizedData.map((d, i) => [xScale(i), yScale(d)] as [number, number]);
  });

  const linePath = $derived.by(() => {
    if (points.length === 0) return "";
    const lineGen = d3line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(curveCatmullRom.alpha(0.5));
    return lineGen(points) ?? "";
  });

  const areaPath = $derived.by(() => {
    if (points.length === 0) return "";
    const areaGen = d3area<[number, number]>()
      .x((d) => d[0])
      .y0(chartHeight - 2)
      .y1((d) => d[1])
      .curve(curveCatmullRom.alpha(0.5));
    return areaGen(points) ?? "";
  });

  const barWidth = $derived(points.length > 0 ? (chartWidth - 8) / points.length - 1 : 0);

  // Render naText as plain text when there's no data to chart.
  const isEmpty = $derived(points.length === 0);
</script>

{#if isEmpty}
  {#if naText}
    <span class="sparkline-na">{naText}</span>
  {/if}
{:else}
  <!-- The wrapper fills the column and is MEASURED (bind:clientWidth); the
       svg is drawn at the measured width so it's always 1:1 (no stretch),
       matching the export which draws at the cell width. -->
  <div class="cell-sparkline-wrap" bind:clientWidth={measuredWidth}>
  <svg class="cell-sparkline" width={chartWidth} height={chartHeight} viewBox="0 0 {chartWidth} {chartHeight}">
    {#if chartType === "bar"}
      {#each points as [x, y], i (i)}
        <rect
          x={x - barWidth / 2}
          y={y}
          width={barWidth}
          height={chartHeight - 2 - y}
          fill={chartColor}
          opacity="0.8"
        />
      {/each}
    {:else if chartType === "area"}
      <path d={areaPath} fill={chartColor} opacity="0.3" />
      <path d={linePath} fill="none" stroke={chartColor} stroke-width="1.5" />
    {:else}
      <path d={linePath} fill="none" stroke={chartColor} stroke-width="1.5" />
      <!-- End dot -->
      {#if points.length > 0}
        {@const lastPoint = points[points.length - 1]}
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2" fill={chartColor} />
      {/if}
    {/if}
  </svg>
  </div>
{/if}

<style>
  .cell-sparkline-wrap {
    width: 100%;
    min-width: 0;
    display: block;
  }
  .cell-sparkline {
    display: block;
  }
</style>
