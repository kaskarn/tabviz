<script lang="ts">
  import type { Row, WebTheme, VizBoxplotColumnOptions, VizBoxplotEffect, BoxplotStats } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { computeBoxplotStats } from "$lib/viz-utils";
  import { resolveMarkerStyle } from "$lib/marker-styling";
  import { semanticMarkOpacity } from "$lib/semantic-styling";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    options: VizBoxplotColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed column scale, shared across all rows. Always provided by the
     *  parent (the only renderer); the column owns scale construction. */
    sharedScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  const { row, yPosition, rowHeight, options, theme, sharedScale }: Props = $props();

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

  const xScale = $derived(sharedScale);

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
    theme?.series?.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  // Per-row overrides (from tabviz(marker_color = "col") / marker_opacity)
  const rowColorOverride = $derived(row.markerStyle?.color ?? null);
  const rowOpacityOverride = $derived(row.markerStyle?.opacity ?? null);
  const numEffects = $derived(options.effects.length);

  // Resolve full marker style (fill + optional outline) via the cascade.
  function getMarkerStyle(effect: VizBoxplotEffect, idx: number) {
    const base = effect.color ?? defaultColors[idx % defaultColors.length];
    return resolveMarkerStyle(base, rowColorOverride, row.style, numEffects, theme);
  }

  function getEffectOpacity(effect: VizBoxplotEffect): number {
    const base = effect.opacity ?? effect.fillOpacity ?? 0.7;
    return rowOpacityOverride !== null ? rowOpacityOverride : base;
  }
</script>

{#if hasValidData}
  <g class="viz-boxplot-row">
    {#each options.effects as effect, idx}
      {@const stats = effectStats[idx]}
      {#if stats}
        {@const boxY = yPosition - boxConfig.totalHeight / 2 + idx * (boxConfig.boxHeight + boxConfig.boxGap)}
        {@const boxCenterY = boxY + boxConfig.boxHeight / 2}
        {@const ms = getMarkerStyle(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}
        {@const defaultLineColor = theme?.content?.primary ?? "#1a1a1a"}
        {@const lineColor = ms.stroke ?? defaultLineColor}
        {@const themeLineWidth = theme?.plot?.lineWidth ?? 1.5}
        {@const lineWidth = ms.stroke ? ms.strokeWidth : themeLineWidth}
        {@const outlierR = (theme?.plot?.pointSize ?? 6) * 0.4}
        {@const outlierStroke = themeLineWidth}
        {@const color = ms.fill}
        {@const mutedOp = semanticMarkOpacity(row.style)}
        {@const fillOp = mutedOp ? opacity * mutedOp.fill : opacity}
        {@const strokeOp = mutedOp ? mutedOp.stroke : 1}

        <!-- Whisker lines (min to Q1, Q3 to max) -->
          <!-- Left whisker -->
          <line
            x1={xScale(stats.min)}
            x2={xScale(stats.q1)}
            y1={boxCenterY}
            y2={boxCenterY}
            stroke={lineColor}
            stroke-width={lineWidth}
            stroke-opacity={strokeOp}
          />
          <!-- Left whisker cap -->
          <line
            x1={xScale(stats.min)}
            x2={xScale(stats.min)}
            y1={boxCenterY - boxConfig.boxHeight / 4}
            y2={boxCenterY + boxConfig.boxHeight / 4}
            stroke={lineColor}
            stroke-width={lineWidth}
            stroke-opacity={strokeOp}
          />

          <!-- Right whisker -->
          <line
            x1={xScale(stats.q3)}
            x2={xScale(stats.max)}
            y1={boxCenterY}
            y2={boxCenterY}
            stroke={lineColor}
            stroke-width={lineWidth}
            stroke-opacity={strokeOp}
          />
          <!-- Right whisker cap -->
          <line
            x1={xScale(stats.max)}
            x2={xScale(stats.max)}
            y1={boxCenterY - boxConfig.boxHeight / 4}
            y2={boxCenterY + boxConfig.boxHeight / 4}
            stroke={lineColor}
            stroke-width={lineWidth}
            stroke-opacity={strokeOp}
          />

        <!-- Box (Q1 to Q3) -->
        <rect
          x={xScale(stats.q1)}
          y={boxY}
          width={Math.max(2, xScale(stats.q3) - xScale(stats.q1))}
          height={boxConfig.boxHeight}
          fill={color}
          fill-opacity={fillOp}
          stroke={lineColor}
          stroke-width={lineWidth}
          stroke-opacity={strokeOp}
          class="box-rect"
        />

        <!-- Median line -->
        <line
          x1={xScale(stats.median)}
          x2={xScale(stats.median)}
          y1={boxY}
          y2={boxY + boxConfig.boxHeight}
          stroke={lineColor}
          stroke-width={Math.max(2, lineWidth)}
          stroke-opacity={strokeOp}
        />

        <!-- Outliers -->
        {#if options.showOutliers !== false && stats.outliers.length > 0}
          {#each stats.outliers as outlier}
            <circle
              cx={xScale(outlier)}
              cy={boxCenterY}
              r={outlierR}
              fill="none"
              stroke={color}
              stroke-width={outlierStroke}
              stroke-opacity={strokeOp}
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
