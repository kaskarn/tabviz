<script lang="ts">
  import type { SparklineColumnOptions } from "$types";
  import { scaleLinear } from "d3-scale";
  import { line as d3line, area as d3area, curveCatmullRom } from "d3-shape";

  interface Props {
    data: number[] | undefined | null;
    options?: SparklineColumnOptions;
    naText?: string;
    /** Per-row/cell color override, computed by ForestPlot from the
     * active semantic bundle's markerFill. Lets accent / muted / emphasis
     * paint retint sparklines to match the forest-marker treatment.
     * `null` falls through to the brand default. */
    colorOverride?: string | null;
  }

  let { data, options, naText, colorOverride = null }: Props = $props();

  const chartType = $derived(options?.type ?? "line");
  const chartHeight = $derived(options?.height ?? 20);
  // Resolution order: per-column user override > per-row/cell semantic
  // paint > theme brand default.
  const chartColor = $derived(
    options?.color ?? colorOverride ?? "var(--tv-brand, var(--tv-primary, #2563eb))"
  );
  const chartWidth = 60;

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
{/if}

<style>
  .cell-sparkline {
    display: block;
    flex-shrink: 0;
  }
</style>
