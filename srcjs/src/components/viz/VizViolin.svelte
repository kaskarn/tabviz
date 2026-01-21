<script lang="ts">
  import type { Row, WebTheme, VizViolinColumnOptions, VizViolinEffect, KDEResult } from "$types";
  import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
  import { computeKDE, computeQuartiles, normalizeKDE } from "$lib/viz-utils";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    width: number;
    options: VizViolinColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed scale (shared across all rows). If not provided, falls back to row-local computation. */
    sharedScale?: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  let { row, yPosition, rowHeight, width, options, theme, sharedScale }: Props = $props();

  // Compute KDE for each effect
  const effectKDEs = $derived.by((): (KDEResult | null)[] => {
    return options.effects.map((effect) => {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (!data || !Array.isArray(data) || data.length < 2) {
        return null;
      }
      return computeKDE(data, options.bandwidth);
    });
  });

  // Compute quartiles for each effect (for median/quartile lines)
  const effectQuartiles = $derived.by(() => {
    return options.effects.map((effect) => {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (!data || !Array.isArray(data) || data.length < 2) {
        return null;
      }
      return computeQuartiles(data);
    });
  });

  // Check if we have valid data
  const hasValidData = $derived(effectKDEs.some((k) => k !== null));

  // Use shared scale if provided, otherwise compute locally (fallback)
  const xScale = $derived.by((): ScaleLinear<number, number> | ScaleLogarithmic<number, number> => {
    if (sharedScale) return sharedScale;

    const isLog = options.scale === "log";
    const padding = theme?.spacing?.padding ?? 12;

    // Compute domain from all KDE x values if not specified
    // WARNING: This results in per-row scaling - not ideal for comparison
    let domainMin = options.axisRange?.[0];
    let domainMax = options.axisRange?.[1];

    if (domainMin == null || domainMax == null) {
      const allXValues: number[] = [];
      for (const kde of effectKDEs) {
        if (kde && kde.x.length > 0) {
          allXValues.push(...kde.x);
        }
      }
      if (allXValues.length > 0) {
        domainMin = domainMin ?? Math.min(...allXValues);
        domainMax = domainMax ?? Math.max(...allXValues);
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

  // Violin dimensions
  const violinConfig = $derived.by(() => {
    const numEffects = options.effects.length;
    const totalHeight = rowHeight * 0.8;
    const violinHeight = (totalHeight - (numEffects - 1) * 2) / numEffects;

    return {
      maxWidth: violinHeight / 2, // Half-height for each side of mirrored violin
      violinHeight: Math.max(10, violinHeight),
      gap: numEffects > 1 ? 2 : 0,
      totalHeight,
    };
  });

  // Default colors from theme, with fallbacks
  const defaultColors = $derived(
    theme?.shapes?.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  function getEffectColor(effect: VizViolinEffect, idx: number): string {
    return effect.color ?? defaultColors[idx % defaultColors.length];
  }

  function getEffectOpacity(effect: VizViolinEffect): number {
    return effect.fillOpacity ?? 0.5;
  }

  // Generate violin path for an effect
  function generateViolinPath(kde: KDEResult, centerY: number, maxHalfHeight: number): string {
    if (kde.x.length < 2) return "";

    // Normalize KDE to max half-height
    const normalized = normalizeKDE(kde, maxHalfHeight);

    // Build path: right side (positive y offset), then left side (negative y offset)
    const points: string[] = [];

    // Right side (top to bottom in data space, but we're rendering horizontally)
    for (let i = 0; i < normalized.x.length; i++) {
      const x = xScale(normalized.x[i]);
      const y = centerY - normalized.y[i]; // Above center
      points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    // Left side (reversed, below center)
    for (let i = normalized.x.length - 1; i >= 0; i--) {
      const x = xScale(normalized.x[i]);
      const y = centerY + normalized.y[i]; // Below center
      points.push(`L ${x} ${y}`);
    }

    points.push("Z");
    return points.join(" ");
  }
</script>

{#if hasValidData}
  <g class="viz-violin-row">
    {#each options.effects as effect, idx}
      {@const kde = effectKDEs[idx]}
      {@const quartiles = effectQuartiles[idx]}
      {#if kde && kde.x.length >= 2}
        {@const violinCenterY = yPosition - violinConfig.totalHeight / 2 +
          violinConfig.violinHeight / 2 + idx * (violinConfig.violinHeight + violinConfig.gap)}
        {@const color = getEffectColor(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}
        {@const path = generateViolinPath(kde, violinCenterY, violinConfig.maxWidth)}
        {@const lineColor = theme?.colors.foreground ?? "#1a1a1a"}

        <!-- Violin shape -->
        <path
          d={path}
          fill={color}
          fill-opacity={opacity}
          stroke={lineColor}
          stroke-width="0.5"
          class="violin-path"
        />

        <!-- Median line -->
        {#if options.showMedian !== false && quartiles}
          {@const medianX = xScale(quartiles.median)}
          <line
            x1={medianX}
            x2={medianX}
            y1={violinCenterY - violinConfig.maxWidth * 0.6}
            y2={violinCenterY + violinConfig.maxWidth * 0.6}
            stroke={lineColor}
            stroke-width="2"
          />
        {/if}

        <!-- Quartile lines -->
        {#if options.showQuartiles && quartiles}
          {@const q1X = xScale(quartiles.q1)}
          {@const q3X = xScale(quartiles.q3)}
          <line
            x1={q1X}
            x2={q1X}
            y1={violinCenterY - violinConfig.maxWidth * 0.4}
            y2={violinCenterY + violinConfig.maxWidth * 0.4}
            stroke={lineColor}
            stroke-width="1"
            stroke-dasharray="2,2"
          />
          <line
            x1={q3X}
            x2={q3X}
            y1={violinCenterY - violinConfig.maxWidth * 0.4}
            y2={violinCenterY + violinConfig.maxWidth * 0.4}
            stroke={lineColor}
            stroke-width="1"
            stroke-dasharray="2,2"
          />
        {/if}
      {/if}
    {/each}
  </g>
{/if}

<style>
  .viz-violin-row {
    pointer-events: auto;
  }

  .violin-path {
    transition: fill-opacity 0.15s ease;
  }

  .viz-violin-row:hover .violin-path {
    fill-opacity: 0.7;
  }
</style>
