<script lang="ts">
  import type { Row, WebTheme, VizBarColumnOptions, VizBarEffect } from "$types";
  import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    width: number;
    options: VizBarColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed scale (shared across all rows). If not provided, falls back to row-local computation. */
    sharedScale?: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  let { row, yPosition, rowHeight, width, options, theme, sharedScale }: Props = $props();

  // Use shared scale if provided, otherwise compute locally (fallback)
  const xScale = $derived.by((): ScaleLinear<number, number> | ScaleLogarithmic<number, number> => {
    if (sharedScale) return sharedScale;

    const isLog = options.scale === "log";
    const padding = theme?.spacing?.padding ?? 12; // Padding for axis labels

    // Compute domain from data if not specified
    let domainMin = options.axisRange?.[0] ?? 0;
    let domainMax = options.axisRange?.[1] ?? 100;

    // If no explicit domain, compute from all effect values in this row
    // WARNING: This results in per-row scaling - not ideal for comparison
    if (!options.axisRange) {
      const values: number[] = [];
      for (const effect of options.effects) {
        const val = row.metadata[effect.value] as number | undefined;
        if (val != null && !Number.isNaN(val)) {
          values.push(val);
        }
      }
      if (values.length > 0) {
        domainMin = Math.min(0, ...values);
        domainMax = Math.max(...values) * 1.1; // Add 10% padding
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

  // Compute bar dimensions
  const barConfig = $derived.by(() => {
    const numEffects = options.effects.length;
    const totalBarHeight = rowHeight * 0.7; // Use 70% of row height
    const barHeight = totalBarHeight / numEffects;
    const barGap = numEffects > 1 ? 2 : 0;
    const adjustedBarHeight = (totalBarHeight - barGap * (numEffects - 1)) / numEffects;

    return {
      barHeight: Math.max(4, adjustedBarHeight),
      barGap,
      totalHeight: totalBarHeight,
    };
  });

  // Default colors from theme, with fallbacks
  const defaultColors = $derived(
    theme?.shapes?.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  // Get color for an effect
  function getEffectColor(effect: VizBarEffect, idx: number): string {
    return effect.color ?? defaultColors[idx % defaultColors.length];
  }

  // Get opacity for an effect
  function getEffectOpacity(effect: VizBarEffect): number {
    return effect.opacity ?? 0.85;
  }

  // Check if we have valid data
  const hasValidData = $derived(
    options.effects.some((e) => {
      const val = row.metadata[e.value];
      return val != null && !Number.isNaN(val as number);
    })
  );
</script>

{#if hasValidData}
  <g class="viz-bar-row">
    <!-- Bars for each effect -->
    {#each options.effects as effect, idx}
      {@const value = row.metadata[effect.value] as number | undefined}
      {#if value != null && !Number.isNaN(value)}
        {@const barY = yPosition - barConfig.totalHeight / 2 + idx * (barConfig.barHeight + barConfig.barGap)}
        {@const barX = xScale(Math.min(0, value))}
        {@const barWidth = Math.abs(xScale(value) - xScale(0))}
        {@const color = getEffectColor(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}

        <rect
          x={barX}
          y={barY}
          width={Math.max(1, barWidth)}
          height={barConfig.barHeight}
          fill={color}
          fill-opacity={opacity}
          rx="2"
          class="bar-segment"
        />
      {/if}
    {/each}
  </g>
{/if}

<style>
  .viz-bar-row {
    pointer-events: auto;
  }

  .bar-segment {
    transition: fill-opacity 0.15s ease;
  }

  .viz-bar-row:hover .bar-segment {
    fill-opacity: 1;
  }
</style>
