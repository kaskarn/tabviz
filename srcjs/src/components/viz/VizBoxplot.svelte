<script lang="ts">
  import type { Row, WebTheme, VizBoxplotColumnOptions, VizBoxplotEffect, BoxplotStats } from "$types";
  import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
  import { computeBoxplotStats, computeQuartiles, computeOutliers } from "$lib/viz-utils";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    width: number;
    options: VizBoxplotColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed scale (shared across all rows). If not provided, falls back to row-local computation. */
    sharedScale?: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  let { row, yPosition, rowHeight, width, options, theme, sharedScale }: Props = $props();

  // Compute stats for each effect
  const effectStats = $derived.by((): (BoxplotStats | null)[] => {
    return options.effects.map((effect) => {
      // Mode 1: Array data - compute stats
      if (effect.data) {
        const data = row.metadata[effect.data] as number[] | undefined;
        if (!data || !Array.isArray(data) || data.length === 0) {
          return null;
        }
        return computeBoxplotStats(data);
      }

      // Mode 2: Pre-computed stats
      if (effect.min && effect.q1 && effect.median && effect.q3 && effect.max) {
        const min = row.metadata[effect.min] as number;
        const q1 = row.metadata[effect.q1] as number;
        const median = row.metadata[effect.median] as number;
        const q3 = row.metadata[effect.q3] as number;
        const max = row.metadata[effect.max] as number;

        if ([min, q1, median, q3, max].some((v) => v == null || Number.isNaN(v))) {
          return null;
        }

        // Get outliers if specified
        let outliers: number[] = [];
        if (effect.outliers) {
          const outliersData = row.metadata[effect.outliers] as number[] | undefined;
          if (outliersData && Array.isArray(outliersData)) {
            outliers = outliersData;
          }
        }

        return { min, q1, median, q3, max, outliers };
      }

      return null;
    });
  });

  // Check if we have valid data
  const hasValidData = $derived(effectStats.some((s) => s !== null));

  // Use shared scale if provided, otherwise compute locally (fallback)
  const xScale = $derived.by((): ScaleLinear<number, number> | ScaleLogarithmic<number, number> => {
    if (sharedScale) return sharedScale;

    const isLog = options.scale === "log";
    const padding = theme?.spacing?.padding ?? 12;

    // Compute domain from data if not specified
    // WARNING: This results in per-row scaling - not ideal for comparison
    let domainMin = options.axisRange?.[0];
    let domainMax = options.axisRange?.[1];

    if (domainMin == null || domainMax == null) {
      const allValues: number[] = [];
      for (const stats of effectStats) {
        if (stats) {
          allValues.push(stats.min, stats.max);
          if (options.showOutliers !== false) {
            allValues.push(...stats.outliers);
          }
        }
      }
      if (allValues.length > 0) {
        const dataMin = Math.min(...allValues);
        const dataMax = Math.max(...allValues);
        const range = dataMax - dataMin;
        domainMin = domainMin ?? dataMin - range * 0.05;
        domainMax = domainMax ?? dataMax + range * 0.05;
      } else {
        domainMin = domainMin ?? 0;
        domainMax = domainMax ?? 100;
      }
    }

    if (isLog) {
      return scaleLog()
        .domain([Math.max(0.01, domainMin), domainMax])
        .range([padding, width - padding]);
    }

    return scaleLinear()
      .domain([domainMin, domainMax])
      .range([padding, width - padding]);
  });

  // Box dimensions
  const boxConfig = $derived.by(() => {
    const numEffects = options.effects.length;
    const totalHeight = rowHeight * 0.7;
    const boxHeight = (totalHeight - (numEffects - 1) * 2) / numEffects;

    return {
      boxHeight: Math.max(8, boxHeight),
      boxGap: numEffects > 1 ? 2 : 0,
      totalHeight,
    };
  });

  // Default colors from theme, with fallbacks
  const defaultColors = $derived(
    theme?.shapes?.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  function getEffectColor(effect: VizBoxplotEffect, idx: number): string {
    return effect.color ?? defaultColors[idx % defaultColors.length];
  }

  function getEffectOpacity(effect: VizBoxplotEffect): number {
    return effect.fillOpacity ?? 0.7;
  }
</script>

{#if hasValidData}
  <g class="viz-boxplot-row">
    {#each options.effects as effect, idx}
      {@const stats = effectStats[idx]}
      {#if stats}
        {@const boxY = yPosition - boxConfig.totalHeight / 2 + idx * (boxConfig.boxHeight + boxConfig.boxGap)}
        {@const boxCenterY = boxY + boxConfig.boxHeight / 2}
        {@const color = getEffectColor(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}
        {@const lineColor = theme?.colors.foreground ?? "#1a1a1a"}

        <!-- Whisker lines (min to Q1, Q3 to max) -->
          <!-- Left whisker -->
          <line
            x1={xScale(stats.min)}
            x2={xScale(stats.q1)}
            y1={boxCenterY}
            y2={boxCenterY}
            stroke={lineColor}
            stroke-width="1"
          />
          <!-- Left whisker cap -->
          <line
            x1={xScale(stats.min)}
            x2={xScale(stats.min)}
            y1={boxCenterY - boxConfig.boxHeight / 4}
            y2={boxCenterY + boxConfig.boxHeight / 4}
            stroke={lineColor}
            stroke-width="1"
          />

          <!-- Right whisker -->
          <line
            x1={xScale(stats.q3)}
            x2={xScale(stats.max)}
            y1={boxCenterY}
            y2={boxCenterY}
            stroke={lineColor}
            stroke-width="1"
          />
          <!-- Right whisker cap -->
          <line
            x1={xScale(stats.max)}
            x2={xScale(stats.max)}
            y1={boxCenterY - boxConfig.boxHeight / 4}
            y2={boxCenterY + boxConfig.boxHeight / 4}
            stroke={lineColor}
            stroke-width="1"
          />

        <!-- Box (Q1 to Q3) -->
        <rect
          x={xScale(stats.q1)}
          y={boxY}
          width={Math.max(2, xScale(stats.q3) - xScale(stats.q1))}
          height={boxConfig.boxHeight}
          fill={color}
          fill-opacity={opacity}
          stroke={lineColor}
          stroke-width="1"
          class="box-rect"
        />

        <!-- Median line -->
        <line
          x1={xScale(stats.median)}
          x2={xScale(stats.median)}
          y1={boxY}
          y2={boxY + boxConfig.boxHeight}
          stroke={lineColor}
          stroke-width="2"
        />

        <!-- Outliers -->
        {#if options.showOutliers !== false && stats.outliers.length > 0}
          {#each stats.outliers as outlier}
            <circle
              cx={xScale(outlier)}
              cy={boxCenterY}
              r="2.5"
              fill="none"
              stroke={color}
              stroke-width="1.5"
              class="outlier"
            />
          {/each}
        {/if}
      {/if}
    {/each}
  </g>
{/if}

<style>
  .viz-boxplot-row {
    pointer-events: auto;
  }

  .box-rect {
    transition: fill-opacity 0.15s ease;
  }

  .viz-boxplot-row:hover .box-rect {
    fill-opacity: 0.9;
  }

  .outlier {
    transition: stroke-opacity 0.15s ease;
  }
</style>
