<script lang="ts">
  import type { Row, WebTheme, VizBarColumnOptions, VizBarEffect } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { resolveMarkerStyle } from "$lib/marker-styling";
  import { semanticMarkOpacity } from "$lib/semantic-styling";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    options: VizBarColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed column scale, shared across all rows. Always provided by the
     *  parent (the only renderer); the column owns scale construction so every
     *  row shares one scale. See the axis slice's per-column resolver. */
    sharedScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  const { row, yPosition, rowHeight, options, theme, sharedScale }: Props = $props();

  const xScale = $derived(sharedScale);

  // Compute bar dimensions
  const barConfig = $derived.by(() => {
    const numEffects = options.effects.length;
    const totalBarHeight = rowHeight * 0.7; // Use 70% of row height
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
    theme?.series?.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  // Per-row overrides (from tabviz(marker_color = "col") / marker_opacity)
  const rowColorOverride = $derived(row.markerStyle?.color ?? null);
  const rowOpacityOverride = $derived(row.markerStyle?.opacity ?? null);
  const numEffects = $derived(options.effects.length);

  // Resolve full marker style (fill + optional outline) via the cascade.
  function getMarkerStyle(effect: VizBarEffect, idx: number) {
    const base = effect.color ?? defaultColors[idx % defaultColors.length];
    return resolveMarkerStyle(base, rowColorOverride, row.style, numEffects, theme);
  }

  // Opacity is orthogonal to color cascade
  function getEffectOpacity(effect: VizBarEffect): number {
    const base = effect.opacity ?? 0.85;
    return rowOpacityOverride !== null ? rowOpacityOverride : base;
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
        {@const ms = getMarkerStyle(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}
        {@const mutedOp = semanticMarkOpacity(row.style)}
        {@const fillOp = mutedOp ? opacity * mutedOp.fill : opacity}
        {@const strokeOp = mutedOp ? mutedOp.stroke : 1}

        <rect
          x={barX}
          y={barY}
          width={Math.max(1, barWidth)}
          height={barConfig.barHeight}
          fill={ms.fill}
          fill-opacity={fillOp}
          stroke={ms.stroke}
          stroke-width={ms.strokeWidth}
          stroke-opacity={strokeOp}
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
